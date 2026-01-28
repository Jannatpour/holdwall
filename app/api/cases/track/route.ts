/**
 * Case Tracking API
 * 
 * POST /api/cases/track - Lookup case by case number and email
 * Public endpoint for customer case tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { CaseService } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import crypto from "crypto";

const caseService = new CaseService();

const lookupSchema = z.object({
  caseNumber: z.string().min(1),
  email: z.string().email(),
});

// Store verification codes temporarily (in production, use Redis or similar)
// Shared with verify route
const verificationCodes = new Map<string, { code: string; expiresAt: Date; caseId: string }>();

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
 * POST /api/cases/track - Lookup case
 * 
 * Public endpoint. Returns case if email matches, otherwise requires verification.
 */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const caseNumber = url.searchParams.get("caseNumber");
    const email = url.searchParams.get("email");

    if (!caseNumber || !email) {
      return NextResponse.json(
        { error: "Case number and email are required" },
        { status: 400 }
      );
    }

    // Validate input
    const validated = lookupSchema.parse({ caseNumber, email });

    // Find case by case number (public endpoint - query directly)
    // Note: For public tracking, we query by caseNumber which is unique
    const case_ = await db.case.findUnique({
      where: { caseNumber: validated.caseNumber },
    });

    if (!case_) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    // Check if email matches
    const emailMatches = 
      case_.submittedByEmail?.toLowerCase() === validated.email.toLowerCase() ||
      case_.submittedBy?.toLowerCase() === validated.email.toLowerCase();

    if (emailMatches) {
      // Email matches, return case directly
      // Fetch case with relations if needed
      const caseWithRelations = await db.case.findUnique({
        where: { id: case_.id },
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

      return NextResponse.json({
        requiresVerification: false,
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
          resolution: caseWithRelations?.resolution ? {
            customerPlan: (caseWithRelations.resolution as any).customerPlan,
            internalPlan: (caseWithRelations.resolution as any).internalPlan,
            safetySteps: (caseWithRelations.resolution as any).safetySteps,
            timeline: (caseWithRelations.resolution as any).timeline,
            status: (caseWithRelations.resolution as any).status,
            resolutionArtifactId: (caseWithRelations.resolution as any).resolutionArtifactId,
          } : null,
          evidence: caseWithRelations?.evidence?.map((e) => ({
            evidenceId: e.evidence?.id || e.evidenceId,
            evidenceType: e.evidence?.type || "unknown",
          })),
        },
      });
    }

    // Email doesn't match, require verification
    // Generate 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification code
    const key = `${validated.caseNumber}:${validated.email}`;
    setVerificationCode(key, {
      code,
      expiresAt,
      caseId: case_.id,
    });

    // Send email with verification code
    try {
      const { EmailService } = await import("@/lib/email/service");
      const emailService = new EmailService();
      
      const subject = "Your Case Verification Code";
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin-top: 0; color: #1976d2;">Case Verification Code</h2>
              <p>Your verification code for case <strong>${validated.caseNumber}</strong> is:</p>
              <div style="background: white; padding: 20px; border-radius: 4px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; font-size: 32px; letter-spacing: 4px; color: #1976d2;">${code}</h1>
              </div>
              <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
              <p style="color: #666; font-size: 14px;">If you did not request this code, please ignore this email.</p>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              This is an automated email from Holdwall Case Management System.
            </p>
          </body>
        </html>
      `;
      const text = `Your verification code for case ${validated.caseNumber} is: ${code}\n\nThis code will expire in 15 minutes.`;

      await emailService.send(validated.email, { subject, html, text });
      
      logger.info("Verification code email sent", {
        case_number: validated.caseNumber,
        email: validated.email,
      });
    } catch (emailError) {
      logger.error("Failed to send verification code email", {
        case_number: validated.caseNumber,
        email: validated.email,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
      // Continue anyway - code is still stored and can be retrieved via GET endpoint in dev
    }

    logger.info("Case lookup requires verification", {
      case_number: validated.caseNumber,
      email: validated.email,
    });

    return NextResponse.json({
      requiresVerification: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Failed to lookup case", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to lookup case", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cases/track - Get verification code (for testing)
 * 
 * This endpoint is for development/testing only. In production, codes should be sent via email.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const caseNumber = url.searchParams.get("caseNumber");
  const email = url.searchParams.get("email");

  if (!caseNumber || !email) {
    return NextResponse.json(
      { error: "Case number and email are required" },
      { status: 400 }
    );
  }

  const key = `${caseNumber}:${email}`;
  const stored = getVerificationCode(key);

  if (!stored) {
    return NextResponse.json(
      { error: "No verification code found. Please request a new one." },
      { status: 404 }
    );
  }

  if (new Date() > stored.expiresAt) {
    deleteVerificationCode(key);
    return NextResponse.json(
      { error: "Verification code expired. Please request a new one." },
      { status: 400 }
    );
  }

  // Only return code in development
  if (process.env.NODE_ENV === "development") {
    return NextResponse.json({
      code: stored.code,
      expiresAt: stored.expiresAt.toISOString(),
    });
  }

  return NextResponse.json(
    { error: "This endpoint is not available in production" },
    { status: 403 }
  );
}
