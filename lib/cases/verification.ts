/**
 * Case Verification Service
 * 
 * Handles customer identity verification for case access and security.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { caseNotificationsService } from "./notifications";
import crypto from "crypto";
import type { Case, CaseVerification, CaseVerificationMethod, CaseVerificationStatus } from "@prisma/client";

const eventStore = new DatabaseEventStore();

export interface VerificationRequest {
  caseId: string;
  method: CaseVerificationMethod;
  recipient: string;
  metadata?: Record<string, unknown>;
}

export interface VerificationResult {
  success: boolean;
  verificationId?: string;
  code?: string; // For testing/development only
  expiresAt?: Date;
  error?: string;
}

/**
 * Case Verification Service
 */
export class CaseVerificationService {
  /**
   * Initiate verification
   */
  async initiateVerification(
    input: VerificationRequest
  ): Promise<VerificationResult> {
    const { caseId, method, recipient, metadata } = input;

    // Verify case exists
    const case_ = await db.case.findUnique({
      where: { id: caseId },
    });

    if (!case_) {
      return {
        success: false,
        error: "Case not found",
      };
    }

    // Check for existing pending verification
    const existing = await db.caseVerification.findFirst({
      where: {
        caseId,
        method,
        status: "PENDING",
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // Within last 15 minutes
        },
      },
    });

    if (existing) {
      // Return existing verification (don't create duplicate)
      return {
        success: true,
        verificationId: existing.id,
        expiresAt: new Date(existing.createdAt.getTime() + 15 * 60 * 1000),
        ...(process.env.NODE_ENV === "development" && existing.metadata
          ? { code: (existing.metadata as any).verificationCode }
          : {}),
      };
    }

    // Generate verification code
    const code = this.generateVerificationCode(method);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create verification record
    const verification = await db.caseVerification.create({
      data: {
        caseId,
        method,
        status: "PENDING",
        metadata: {
          recipient,
          verificationCode: code,
          expiresAt: expiresAt.toISOString(),
          ...metadata,
        } as any,
      },
    });

    // Send verification code
    await this.sendVerificationCode(method, recipient, code, case_);

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: case_.tenantId,
      actor_id: "system",
      type: "case.verification.initiated",
      occurred_at: new Date().toISOString(),
      correlation_id: caseId,
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        case_id: caseId,
        verification_id: verification.id,
        method,
      },
      signatures: [],
    });

    logger.info("Verification initiated", {
      tenant_id: case_.tenantId,
      case_id: caseId,
      verification_id: verification.id,
      method,
    });

    metrics.increment("case_verifications_initiated_total", {
      tenant_id: case_.tenantId,
      method,
    });

    return {
      success: true,
      verificationId: verification.id,
      expiresAt,
      ...(process.env.NODE_ENV === "development" ? { code } : {}),
    };
  }

  /**
   * Verify code
   */
  async verifyCode(
    verificationId: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    const verification = await db.caseVerification.findUnique({
      where: { id: verificationId },
      include: {
        case: true,
      },
    });

    if (!verification) {
      return {
        success: false,
        error: "Verification not found",
      };
    }

    // Check if expired
    const expiresAt = verification.metadata
      ? new Date((verification.metadata as any).expiresAt || 0)
      : new Date(verification.createdAt.getTime() + 15 * 60 * 1000);

    if (new Date() > expiresAt) {
      await db.caseVerification.update({
        where: { id: verificationId },
        data: {
          status: "EXPIRED",
        },
      });

      return {
        success: false,
        error: "Verification code expired",
      };
    }

    // Check if already verified
    if (verification.status === "VERIFIED") {
      return {
        success: true,
      };
    }

    // Verify code
    const storedCode = verification.metadata
      ? (verification.metadata as any).verificationCode
      : null;

    if (!storedCode || storedCode !== code) {
      await db.caseVerification.update({
        where: { id: verificationId },
        data: {
          status: "FAILED",
        },
      });

      metrics.increment("case_verifications_failed_total", {
        tenant_id: verification.case.tenantId,
        method: verification.method,
      });

      return {
        success: false,
        error: "Invalid verification code",
      };
    }

    // Mark as verified
    await db.caseVerification.update({
      where: { id: verificationId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: verification.case.tenantId,
      actor_id: "system",
      type: "case.verification.completed",
      occurred_at: new Date().toISOString(),
      correlation_id: verification.caseId,
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        case_id: verification.caseId,
        verification_id: verificationId,
        method: verification.method,
      },
      signatures: [],
    });

    logger.info("Verification completed", {
      tenant_id: verification.case.tenantId,
      case_id: verification.caseId,
      verification_id: verificationId,
      method: verification.method,
    });

    metrics.increment("case_verifications_completed_total", {
      tenant_id: verification.case.tenantId,
      method: verification.method,
    });

    return {
      success: true,
    };
  }

  /**
   * Generate verification code
   */
  private generateVerificationCode(method: CaseVerificationMethod): string {
    switch (method) {
      case "EMAIL":
      case "PHONE":
        // 6-digit numeric code
        return crypto.randomInt(100000, 999999).toString();
      case "DOCUMENT":
        // Longer alphanumeric code for document verification
        return crypto.randomBytes(16).toString("hex").toUpperCase();
      case "ACCOUNT":
        // Account verification uses different mechanism
        return crypto.randomBytes(32).toString("hex");
      default:
        return crypto.randomInt(100000, 999999).toString();
    }
  }

  /**
   * Send verification code
   */
  private async sendVerificationCode(
    method: CaseVerificationMethod,
    recipient: string,
    code: string,
    case_: Case
  ): Promise<void> {
    switch (method) {
      case "EMAIL":
        await caseNotificationsService.sendNotification({
          caseId: case_.id,
          recipient,
          type: "EMAIL",
          subject: `Verification Code for Case ${case_.caseNumber}`,
          message: `Your verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this message.`,
        });
        break;

      case "PHONE":
        await caseNotificationsService.sendNotification({
          caseId: case_.id,
          recipient,
          type: "SMS",
          message: `Your verification code for case ${case_.caseNumber} is: ${code}. Valid for 15 minutes.`,
        });
        break;

      case "DOCUMENT":
        // Document verification requires different flow
        await caseNotificationsService.sendNotification({
          caseId: case_.id,
          recipient,
          type: "EMAIL",
          subject: `Document Verification Required for Case ${case_.caseNumber}`,
          message: `Please upload a government-issued ID to verify your identity for case ${case_.caseNumber}.\n\nVerification code: ${code}`,
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${case_.caseNumber}/verify`,
          actionLabel: "Upload Document",
        });
        break;

      case "ACCOUNT":
        // Account verification uses magic link
        const magicLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${case_.caseNumber}/verify?token=${code}`;
        await caseNotificationsService.sendNotification({
          caseId: case_.id,
          recipient,
          type: "EMAIL",
          subject: `Verify Your Account for Case ${case_.caseNumber}`,
          message: `Click the link below to verify your account and access case ${case_.caseNumber}.`,
          actionUrl: magicLink,
          actionLabel: "Verify Account",
        });
        break;
    }
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(
    caseId: string,
    method?: CaseVerificationMethod
  ): Promise<CaseVerification[]> {
    const where: any = { caseId };
    if (method) {
      where.method = method;
    }

    return await db.caseVerification.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Check if case is verified
   */
  async isCaseVerified(
    caseId: string,
    method?: CaseVerificationMethod
  ): Promise<boolean> {
    const where: any = {
      caseId,
      status: "VERIFIED",
    };

    if (method) {
      where.method = method;
    }

    const verification = await db.caseVerification.findFirst({
      where,
    });

    return verification !== null;
  }

  /**
   * Require verification level
   */
  async requireVerificationLevel(
    caseId: string,
    level: "basic" | "standard" | "enhanced" | "full"
  ): Promise<CaseVerificationMethod[]> {
    const case_ = await db.case.findUnique({
      where: { id: caseId },
    });

    if (!case_) {
      throw new Error("Case not found");
    }

    const requiredMethods: CaseVerificationMethod[] = [];

    switch (level) {
      case "basic":
        requiredMethods.push("EMAIL");
        break;
      case "standard":
        requiredMethods.push("EMAIL", "PHONE");
        break;
      case "enhanced":
        requiredMethods.push("EMAIL", "PHONE", "DOCUMENT");
        break;
      case "full":
        requiredMethods.push("EMAIL", "PHONE", "DOCUMENT", "ACCOUNT");
        break;
    }

    // Check which methods are already verified
    const verifiedMethods = await this.getVerificationStatus(caseId);
    const verified = verifiedMethods
      .filter((v) => v.status === "VERIFIED")
      .map((v) => v.method);

    // Return methods that still need verification
    return requiredMethods.filter((method) => !verified.includes(method));
  }
}

export const caseVerificationService = new CaseVerificationService();
