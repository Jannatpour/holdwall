/**
 * Case Audit Bundle API
 * 
 * GET /api/cases/[id]/audit-bundle - Export complete case packet for legal/compliance
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

const caseService = new CaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
        const caseId = id;
        const tenantId = context?.tenantId;

        if (!tenantId) {
          return NextResponse.json(
            { error: "Tenant ID required" },
            { status: 400 }
          );
        }

        const case_ = await caseService.getCase(caseId, tenantId);

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        // Get all related data for audit bundle
        const [resolution, playbookExecutions, comments, escalations, verifications, relationships] = await Promise.all([
          db.caseResolution.findUnique({ where: { caseId } }),
          db.casePlaybookExecution.findMany({ where: { caseId } }),
          db.caseComment.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } }),
          db.caseEscalation.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } }),
          db.caseVerification.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } }),
          db.caseRelationship.findMany({
            where: { caseId },
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
          }),
        ]);

        // Build audit bundle
        const auditBundle = {
          case: {
            id: case_.id,
            caseNumber: case_.caseNumber,
            type: case_.type,
            status: case_.status,
            severity: case_.severity,
            priority: case_.priority,
            submittedBy: case_.submittedBy,
            submittedByEmail: case_.submittedByEmail,
            submittedByName: case_.submittedByName,
            description: case_.description,
            impact: case_.impact,
            preferredResolution: case_.preferredResolution,
            regulatorySensitivity: case_.regulatorySensitivity,
            slaDeadline: case_.slaDeadline,
            assignedTo: case_.assignedTo,
            assignedTeam: case_.assignedTeam,
            resolvedAt: case_.resolvedAt,
            createdAt: case_.createdAt,
            updatedAt: case_.updatedAt,
            metadata: case_.metadata,
          },
          resolution,
          playbookExecutions,
          comments: comments.map((c) => ({
            id: c.id,
            authorId: c.authorId,
            content: c.content,
            isInternal: c.isInternal,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
          escalations,
          verifications,
          relationships: relationships.map((r) => ({
            relationshipType: r.relationshipType,
            relatedCase: r.relatedCase,
            createdAt: r.createdAt,
          })),
          evidence: (case_ as typeof case_ & { evidence?: Array<{ evidenceId: string; evidenceType: string; role: string; createdAt: Date }> }).evidence?.map((e) => ({
            evidenceId: e.evidenceId,
            evidenceType: e.evidenceType,
            role: e.role,
            createdAt: e.createdAt,
          })),
          generatedAt: new Date().toISOString(),
          generatedBy: context?.user?.id || "system",
        };

        logger.info("Audit bundle generated", {
          tenant_id: tenantId,
          case_id: caseId,
        });

        return NextResponse.json(auditBundle, {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="case-${case_.caseNumber}-audit-bundle.json"`,
          },
        });
      } catch (error) {
        logger.error("Failed to generate audit bundle", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to generate audit bundle", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 50,
      },
    }
  );
  return handler(request);
}
