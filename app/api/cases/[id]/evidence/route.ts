/**
 * Case Evidence API
 * 
 * POST /api/cases/[id]/evidence - Add evidence to case
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { FileUploadService } from "@/lib/file/upload";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const caseService = new CaseService();
const evidenceVault = new DatabaseEvidenceVault();
const fileUploadService = new FileUploadService();

const addEvidenceSchema = z.object({
  evidenceId: z.string().optional(),
  evidenceType: z.enum(["UPLOAD", "LINK", "INTERNAL_LOG", "TRANSACTION"]).optional(),
  role: z.enum(["PRIMARY", "SUPPORTING", "REFUTATION"]).optional(),
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

        // Check if file upload or evidence ID
        const contentType = request.headers.get("content-type");
        let evidenceId: string;

        if (contentType?.includes("multipart/form-data")) {
          // Handle file upload
          const formData = await request.formData();
          const file = formData.get("file") as File;

          if (!file) {
            return NextResponse.json(
              { error: "File is required" },
              { status: 400 }
            );
          }

          // Validate file
          const validation = fileUploadService.validateFile(file, {
            maxSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: [
              "application/pdf",
              "image/png",
              "image/jpeg",
              "image/jpg",
              "text/csv",
            ],
            scanForViruses: true,
          });

          if (!validation.valid) {
            return NextResponse.json(
              { error: validation.error },
              { status: 400 }
            );
          }

          // Scan for viruses
          const scanResult = await fileUploadService.scanFile(file);
          if (!scanResult.clean) {
            return NextResponse.json(
              { error: "File failed virus scan", threats: scanResult.threats },
              { status: 400 }
            );
          }

          // Upload to evidence vault
          const buffer = await file.arrayBuffer();
          const fileContent = Buffer.from(buffer).toString("base64");
          evidenceId = await evidenceVault.store({
            tenant_id: tenantId,
            type: "document",
            source: {
              type: "upload",
              id: `case-evidence-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              url: undefined,
              collected_at: new Date().toISOString(),
              collected_by: context?.user?.id || "system",
              method: "manual",
            },
            content: {
              raw: fileContent,
              normalized: fileContent,
              metadata: {
                filename: file.name,
                size: file.size,
                type: file.type,
              },
            },
            provenance: {
              collection_method: "file_upload",
              retention_policy: "case_evidence",
              compliance_flags: [],
            },
            metadata: {
              uploadedBy: context?.user?.id || "system",
              uploadedAt: new Date().toISOString(),
              caseId,
            },
          });
        } else {
          // Use provided evidence ID
          const body = await request.json();
          const validated = addEvidenceSchema.parse(body);

          if (!validated.evidenceId) {
            return NextResponse.json(
              { error: "Evidence ID is required" },
              { status: 400 }
            );
          }

          evidenceId = validated.evidenceId;
        }

        // Add evidence to case
        const caseEvidence = await caseService.addEvidence(
          caseId,
          tenantId,
          evidenceId,
          "UPLOAD", // Default, can be overridden
          "PRIMARY" // Default, can be overridden
        );

        logger.info("Evidence added to case", {
          tenant_id: tenantId,
          case_id: caseId,
          evidence_id: evidenceId,
        });

        return NextResponse.json(caseEvidence);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to add evidence", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to add evidence", message: error instanceof Error ? error.message : "Unknown error" },
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
