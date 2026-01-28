/**
 * Case Tracking Verification API
 * 
 * POST /api/cases/track/verify - Verify email with code and return case
 */

import { NextRequest, NextResponse } from "next/server";
import { CaseService } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const caseService = new CaseService();

const verifySchema = z.object({
  caseNumber: z.string().min(1),
  email: z.string().email(),
  code: z.string().length(6),
});

// Shared verification codes storage
// In production, use Redis or similar shared store
// For now, using a module-level Map (works for single instance, needs Redis for multi-instance)
const verificationCodes = new Map<string, { code: string; expiresAt: Date; caseId: string }>();

// Export function to get/set codes (for sharing between routes)
export function getVerificationCode(key: string) {
  return verificationCodes.get(key);
}

export function setVerificationCode(key: string, data: { code: string; expiresAt: Date; caseId: string }) {
  verificationCodes.set(key, data);
}

export function deleteVerificationCode(key: string) {
  verificationCodes.delete(key);
}

/**
 * POST /api/cases/track/verify - Verify code and return case
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = verifySchema.parse(body);

    const key = `${validated.caseNumber}:${validated.email}`;
    const stored = getVerificationCode(key);

    if (!stored) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new one." },
        { status: 404 }
      );
    }

    if (new Date() > stored.expiresAt) {
      verificationCodes.delete(key);
      return NextResponse.json(
        { error: "Verification code expired. Please request a new one." },
        { status: 400 }
      );
    }

    if (stored.code !== validated.code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Code is valid, get case (public endpoint - query directly)
    const case_ = await db.case.findUnique({
      where: { caseNumber: validated.caseNumber },
      include: {
        resolution: true,
        evidence: {
          include: {
            evidence: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!case_) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    // Clean up verification code
    deleteVerificationCode(key);

    // Type assertion for included relations
    const caseWithRelations = case_ as typeof case_ & {
      resolution?: {
        customerPlan: unknown;
        internalPlan: unknown;
        safetySteps?: unknown;
        timeline?: unknown;
        status: string;
        resolutionArtifactId?: string | null;
      };
      evidence?: Array<{ evidenceId: string; evidenceType: string }>;
    };

    // Record verification
    await db.caseVerification.create({
      data: {
        caseId: case_.id,
        method: "EMAIL",
        status: "VERIFIED",
        verifiedAt: new Date(),
        metadata: {
          email: validated.email,
          verifiedAt: new Date().toISOString(),
        } as any,
      },
    });

    logger.info("Case verified via email", {
      case_id: case_.id,
      case_number: validated.caseNumber,
      email: validated.email,
    });

    return NextResponse.json({
      success: true,
      case: {
        id: case_.id,
        caseNumber: case_.caseNumber,
        type: case_.type,
        status: case_.status,
        severity: case_.severity,
        description: case_.description,
        impact: case_.impact,
        createdAt: case_.createdAt.toISOString(),
        updatedAt: case_.updatedAt.toISOString(),
        resolution: caseWithRelations.resolution ? {
          customerPlan: caseWithRelations.resolution.customerPlan,
          internalPlan: caseWithRelations.resolution.internalPlan,
          safetySteps: caseWithRelations.resolution.safetySteps,
          timeline: caseWithRelations.resolution.timeline,
          status: caseWithRelations.resolution.status,
          resolutionArtifactId: caseWithRelations.resolution.resolutionArtifactId,
        } : null,
        evidence: caseWithRelations.evidence?.map((e) => ({
          evidenceId: e.evidenceId,
          evidenceType: e.evidenceType,
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Failed to verify case", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to verify case", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
