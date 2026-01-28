/**
 * Case Service
 * 
 * Core service for Financial Services Trust & Resolution Desk case management.
 * Handles CRUD operations, case number generation, and case lifecycle management.
 */

import { db, enforceTenantId, withTenantFilter } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { IdempotencyService, withIdempotency, generateIdempotencyKey } from "@/lib/operations/idempotency";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import crypto from "crypto";
import type {
  Case,
  CaseType,
  CaseStatus,
  CaseSeverity,
  CasePriority,
  CaseEvidence,
  CaseResolution,
  CaseComment,
  CaseTag,
  CaseTagAssignment,
  CaseNotification,
  CaseVerification,
  CaseEscalation,
  CaseTemplate,
  CaseRelationship,
} from "@prisma/client";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const transactionManager = new TransactionManager();
const idempotencyService = new IdempotencyService();
const errorRecovery = new ErrorRecoveryService();

export interface CreateCaseInput {
  tenantId: string;
  type: CaseType;
  submittedBy: string;
  submittedByEmail?: string;
  submittedByName?: string;
  description: string;
  impact?: string;
  preferredResolution?: string;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateCaseInput {
  status?: CaseStatus;
  severity?: CaseSeverity;
  priority?: CasePriority | null;
  assignedTo?: string | null;
  assignedTeam?: string | null;
  description?: string;
  impact?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CaseFilters {
  status?: CaseStatus[];
  type?: CaseType[];
  severity?: CaseSeverity[];
  priority?: CasePriority[];
  assignedTo?: string;
  assignedTeam?: string;
  submittedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface CaseListResult {
  cases: Case[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Generate unique case number
 * Format: CASE-YYYYMMDD-XXXXXX (e.g., CASE-20260122-A1B2C3)
 */
function generateCaseNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CASE-${dateStr}-${randomStr}`;
}

/**
 * Case Service
 */
export class CaseService {
  /**
   * Create a new case
   */
  async createCase(input: CreateCaseInput): Promise<Case> {
    const { tenantId, type, submittedBy, submittedByEmail, submittedByName, description, impact, preferredResolution, evidenceIds = [], metadata } = input;

    // Generate case number with idempotency
    const idempotencyKey = generateIdempotencyKey(
      tenantId,
      "create_case",
      {
        submittedBy,
        description: description.substring(0, 100), // Use first 100 chars for idempotency
        type,
      }
    );

    return await withIdempotency(
      idempotencyService,
      tenantId,
      "create_case",
      {
        submittedBy,
        description: description.substring(0, 100),
        type,
      },
      async () => {
        return await transactionManager.executeSimple(async (tx) => {
          // Generate unique case number
          let caseNumber = generateCaseNumber();
          let attempts = 0;
          while (attempts < 10) {
            const existing = await tx.case.findUnique({
              where: { caseNumber },
            });
            if (!existing) break;
            caseNumber = generateCaseNumber();
            attempts++;
          }

          if (attempts >= 10) {
            throw new Error("Failed to generate unique case number after 10 attempts");
          }

          // Calculate SLA deadline
          const { caseSLAService } = await import("./sla");
          const slaDeadline = caseSLAService.calculateSLADeadline({
            id: "", // Will be set after creation
            tenantId,
            caseNumber,
            type,
            status: "SUBMITTED",
            severity: "MEDIUM",
            priority: null,
            submittedBy,
            submittedByEmail,
            submittedByName,
            description,
            impact,
            preferredResolution,
            regulatorySensitivity: false,
            slaDeadline: null,
            assignedTo: null,
            assignedTeam: null,
            resolvedAt: null,
            metadata: metadata as any,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          // Create case
          const case_ = await tx.case.create({
            data: {
              tenantId,
              caseNumber,
              type,
              status: "SUBMITTED",
              severity: "MEDIUM",
              submittedBy,
              submittedByEmail,
              submittedByName,
              description,
              impact,
              preferredResolution,
              regulatorySensitivity: false,
              slaDeadline,
              metadata: metadata as any,
            },
          });

          // Link evidence if provided
          if (evidenceIds.length > 0) {
            await tx.caseEvidence.createMany({
              data: evidenceIds.map((evidenceId) => ({
                caseId: case_.id,
                evidenceId,
                evidenceType: "UPLOAD",
                role: "PRIMARY",
              })),
            });
          }

          // Emit event
          await eventStore.append({
            event_id: crypto.randomUUID(),
            tenant_id: tenantId,
            actor_id: submittedBy,
            type: "case.created",
            occurred_at: new Date().toISOString(),
            correlation_id: case_.id,
            schema_version: "1.0",
            evidence_refs: evidenceIds,
            payload: {
              case_id: case_.id,
              case_number: caseNumber,
              type,
              status: "SUBMITTED",
            },
            signatures: [],
          });

          logger.info("Case created", {
            tenant_id: tenantId,
            case_id: case_.id,
            case_number: caseNumber,
            type,
          });

          metrics.increment("cases_created_total", {
            tenant_id: tenantId,
            type,
          });

          // Send notifications and webhooks asynchronously
          setImmediate(async () => {
            try {
              const { caseNotificationsService } = await import("./notifications");
              await caseNotificationsService.sendCaseCreated(case_);
            } catch (error) {
              logger.error("Failed to send case created notification", {
                case_id: case_.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }

            try {
              const { caseWebhooksService } = await import("./webhooks");
              await caseWebhooksService.sendWebhook(tenantId, "case.created", case_);
            } catch (error) {
              logger.error("Failed to send case created webhook", {
                case_id: case_.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          });

          // Trigger autonomous processing via pipeline worker (event-driven)
          // The pipeline worker will handle case.created events and trigger triage + resolution
          // This ensures automatic processing without blocking the case creation response

          return case_;
        });
      }
    );
  }

  /**
   * Get case by ID
   */
  async getCase(
    caseId: string,
    tenantId: string
  ): Promise<(Case & {
    evidence: Array<CaseEvidence & { evidence: any }>;
    resolution: CaseResolution | null;
    comments: CaseComment[];
    tagAssignments: Array<{ tag: CaseTag }>;
    notifications: CaseNotification[];
    verifications: CaseVerification[];
    escalations: CaseEscalation[];
    relationships: Array<{ relatedCase: Partial<Case> }>;
    relatedCases: Array<{ case: Partial<Case> }>;
  }) | null> {
    const case_ = await db.case.findFirst({
      where: {
        id: caseId,
        tenantId,
      },
      include: {
        evidence: {
          include: {
            evidence: true,
          },
        },
        resolution: true,
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            replies: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
        tagAssignments: {
          include: {
            tag: true,
          },
        },
        notifications: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        verifications: {
          orderBy: { createdAt: "desc" },
        },
        escalations: {
          orderBy: { createdAt: "desc" },
        },
        relationships: {
          include: {
            relatedCase: {
              select: {
                id: true,
                caseNumber: true,
                type: true,
                status: true,
                severity: true,
              },
            },
          },
        },
        relatedCases: {
          include: {
            case: {
              select: {
                id: true,
                caseNumber: true,
                type: true,
                status: true,
                severity: true,
              },
            },
          },
        },
      },
    });

    return case_;
  }

  /**
   * Get case by case number (for public tracking)
   * Note: tenantId is optional for public endpoints - if provided, enforces tenant isolation
   */
  async getCaseByNumber(caseNumber: string, tenantId?: string): Promise<Case | null> {
    // If tenantId is provided, enforce tenant isolation
    if (tenantId) {
      const enforcedTenantId = enforceTenantId(tenantId, "get case by number");
      return await db.case.findFirst({
        where: {
          caseNumber,
          tenantId: enforcedTenantId, // Enforce tenant isolation
        },
        include: {
          resolution: true,
          evidence: {
            include: {
              evidence: true,
            },
          },
        },
      });
    }
    
    // For public endpoints without tenantId, still query but don't filter by tenant
    // This is acceptable for public case tracking where caseNumber is the identifier
    return await db.case.findUnique({
      where: {
        caseNumber,
      },
      include: {
        resolution: true,
        evidence: {
          include: {
            evidence: true,
          },
        },
      },
    });
  }

  /**
   * List cases with filters and pagination
   */
  async listCases(
    tenantId: string,
    filters: CaseFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<CaseListResult> {
    const skip = (page - 1) * limit;

    // Enforce tenant isolation - tenantId is required
    const enforcedTenantId = enforceTenantId(tenantId, "list cases");
    const where: any = {
      tenantId: enforcedTenantId, // Always include tenantId filter
    };

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.type && filters.type.length > 0) {
      where.type = { in: filters.type };
    }

    if (filters.severity && filters.severity.length > 0) {
      where.severity = { in: filters.severity };
    }

    if (filters.priority && filters.priority.length > 0) {
      where.priority = { in: filters.priority };
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters.assignedTeam) {
      where.assignedTeam = filters.assignedTeam;
    }

    if (filters.submittedBy) {
      where.submittedBy = { contains: filters.submittedBy, mode: "insensitive" };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    if (filters.search) {
      where.OR = [
        { caseNumber: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { submittedBy: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [cases, total] = await Promise.all([
      db.case.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          resolution: {
            select: {
              status: true,
            },
          },
          tagAssignments: {
            include: {
              tag: true,
            },
          },
        },
      }),
      db.case.count({ where }),
    ]);

    return {
      cases,
      total,
      page,
      limit,
    };
  }

  /**
   * Update case
   */
  async updateCase(
    caseId: string,
    tenantId: string,
    input: UpdateCaseInput
  ): Promise<Case> {
    const case_ = await db.case.findFirst({
      where: {
        id: caseId,
        tenantId,
      },
    });

    if (!case_) {
      throw new Error("Case not found");
    }

    const updated = await db.case.update({
      where: { id: caseId },
      data: {
        ...(input.status && { status: input.status }),
        ...(input.severity && { severity: input.severity }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo }),
        ...(input.assignedTeam !== undefined && { assignedTeam: input.assignedTeam }),
        ...(input.description && { description: input.description }),
        ...(input.impact !== undefined && { impact: input.impact }),
        ...(input.metadata && { metadata: input.metadata as any }),
        ...(input.status === "RESOLVED" && !case_.resolvedAt && { resolvedAt: new Date() }),
      },
    });

    const oldStatus = case_.status;

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: tenantId,
      actor_id: "system",
      type: "case.updated",
      occurred_at: new Date().toISOString(),
      correlation_id: caseId,
      causation_id: case_.id,
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        case_id: caseId,
        updates: input,
      },
      signatures: [],
    });

    logger.info("Case updated", {
      tenant_id: tenantId,
      case_id: caseId,
      updates: Object.keys(input),
    });

    metrics.increment("cases_updated_total", {
      tenant_id: tenantId,
    });

    // Send notifications, webhooks, and check escalation asynchronously
    setImmediate(async () => {
      try {
        const { caseNotificationsService } = await import("./notifications");
        if (input.status && input.status !== oldStatus) {
          await caseNotificationsService.sendStatusUpdate(updated, oldStatus, input.status);
        }
      } catch (error) {
        logger.error("Failed to send case update notification", {
          case_id: caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const { caseWebhooksService } = await import("./webhooks");
        await caseWebhooksService.sendWebhook(tenantId, "case.updated", updated, { updates: input });
      } catch (error) {
        logger.error("Failed to send case update webhook", {
          case_id: caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const { caseEscalationService } = await import("./escalation");
        await caseEscalationService.checkEscalationRules(updated);
      } catch (error) {
        logger.error("Failed to check escalation rules", {
          case_id: caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return updated;
  }

  /**
   * Add evidence to case
   */
  async addEvidence(
    caseId: string,
    tenantId: string,
    evidenceId: string,
    evidenceType: "UPLOAD" | "LINK" | "INTERNAL_LOG" | "TRANSACTION" = "UPLOAD",
    role: "PRIMARY" | "SUPPORTING" | "REFUTATION" = "PRIMARY"
  ): Promise<CaseEvidence> {
    const case_ = await db.case.findFirst({
      where: {
        id: caseId,
        tenantId,
      },
    });

    if (!case_) {
      throw new Error("Case not found");
    }

    const caseEvidence = await db.caseEvidence.create({
      data: {
        caseId,
        evidenceId,
        evidenceType,
        role,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: tenantId,
      actor_id: "system",
      type: "case.evidence_added",
      occurred_at: new Date().toISOString(),
      correlation_id: caseId,
      schema_version: "1.0",
      evidence_refs: [evidenceId],
      payload: {
        case_id: caseId,
        evidence_id: evidenceId,
        evidence_type: evidenceType,
        role,
      },
      signatures: [],
    });

    logger.info("Evidence added to case", {
      tenant_id: tenantId,
      case_id: caseId,
      evidence_id: evidenceId,
    });

    return caseEvidence;
  }

  /**
   * Delete case (soft delete by setting status to CLOSED)
   */
  async deleteCase(caseId: string, tenantId: string): Promise<void> {
    const case_ = await db.case.findFirst({
      where: {
        id: caseId,
        tenantId,
      },
    });

    if (!case_) {
      throw new Error("Case not found");
    }

    await db.case.update({
      where: { id: caseId },
      data: {
        status: "CLOSED",
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: tenantId,
      actor_id: "system",
      type: "case.closed",
      occurred_at: new Date().toISOString(),
      correlation_id: caseId,
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        case_id: caseId,
      },
      signatures: [],
    });

    logger.info("Case closed", {
      tenant_id: tenantId,
      case_id: caseId,
    });

    metrics.increment("cases_closed_total", {
      tenant_id: tenantId,
    });
  }
}

