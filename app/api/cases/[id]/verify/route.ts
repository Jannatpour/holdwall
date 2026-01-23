/**
 * Case Verification API
 * 
 * POST /api/cases/[id]/verify - Verify customer identity
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import crypto from "crypto";

const eventStore = new DatabaseEventStore();

const verifySchema = z.object({
  method: z.enum(["EMAIL", "PHONE", "DOCUMENT", "ACCOUNT"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
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

        // Verify case belongs to tenant
        const case_ = await db.case.findFirst({
          where: { id: caseId, tenantId },
        });

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        const body = await request.json();
        const validated = verifySchema.parse(body);

        // Create verification record
        const verification = await db.caseVerification.create({
          data: {
            caseId,
            method: validated.method,
            status: "PENDING",
            metadata: validated.metadata as any,
          },
        });

        // For EMAIL method, send verification code
        if (validated.method === "EMAIL" && case_.submittedByEmail) {
          // Generate verification code
          const code = crypto.randomInt(100000, 999999).toString();
          
          // Send email with verification code
          try {
            const { EmailService } = await import("@/lib/email/service");
            const emailService = new EmailService();
            
            const subject = "Case Verification Code";
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
                    <p>Your verification code for case <strong>${case_.caseNumber}</strong> is:</p>
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
            const text = `Your verification code for case ${case_.caseNumber} is: ${code}\n\nThis code will expire in 15 minutes.`;

            await emailService.send(case_.submittedByEmail, { subject, html, text });
            
            logger.info("Verification code email sent", {
              case_id: caseId,
              verification_id: verification.id,
              method: validated.method,
              email: case_.submittedByEmail,
            });
          } catch (emailError) {
            logger.error("Failed to send verification code email", {
              case_id: caseId,
              verification_id: verification.id,
              error: emailError instanceof Error ? emailError.message : String(emailError),
            });
            // Continue - code is still stored in metadata for manual retrieval if needed
          }
          
          // Update metadata with code (for testing/fallback)
          await db.caseVerification.update({
            where: { id: verification.id },
            data: {
              metadata: {
                ...(validated.metadata || {}),
                verificationCode: code,
                email: case_.submittedByEmail,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
              },
            },
          });

          logger.info("Verification code generated", {
            case_id: caseId,
            verification_id: verification.id,
            method: validated.method,
          });
        }

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context?.user?.id || "system",
          type: "case.verification.initiated",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            case_id: caseId,
            verification_id: verification.id,
            method: validated.method,
          },
          signatures: [],
        });

        logger.info("Case verification initiated", {
          tenant_id: tenantId,
          case_id: caseId,
          method: validated.method,
        });

        return NextResponse.json(verification, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to initiate verification", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to initiate verification", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 100,
      },
    }
  );
  return handler(request);
}
