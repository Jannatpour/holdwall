/**
 * Cases API Routes
 * 
 * POST /api/cases - Create case (public, rate-limited)
 * GET /api/cases - List cases (authenticated, tenant-scoped)
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { FileUploadService } from "@/lib/file/upload";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const evidenceVault = new DatabaseEvidenceVault();
const fileUploadService = new FileUploadService();
const caseService = new CaseService();

// Public case submission schema
const createCaseSchema = z.object({
  type: z.enum(["DISPUTE", "FRAUD_ATO", "OUTAGE_DELAY", "COMPLAINT"]),
  submittedBy: z.string().min(1).max(255),
  submittedByEmail: z.string().email().optional(),
  submittedByName: z.string().max(255).optional(),
  description: z.string().min(10).max(10000),
  impact: z.string().max(5000).optional(),
  preferredResolution: z.string().max(5000).optional(),
  evidenceIds: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/cases - Create case (public, rate-limited)
 * 
 * Public endpoint for case submission. Rate-limited to 5 per IP per hour.
 * No authentication required, but rate limiting applies.
 */
export const POST = createApiHandler(
  async (request: NextRequest) => {
    try {
      // Get tenant ID from query params or default tenant
      // For public submissions, we need a way to route to the correct tenant
      // This could be via subdomain, query param, or default tenant
      const url = new URL(request.url);
      const tenantSlug = url.searchParams.get("tenant") || "default";
      
      // In production, you'd look up tenant by slug
      // For now, we'll use a default tenant ID
      const tenantId = process.env.DEFAULT_TENANT_ID || "default-tenant";

      // Parse request body
      const body = await request.json();
      
      // Validate input
      const validated = createCaseSchema.parse(body);

      // Handle file uploads if provided
      let evidenceIds = validated.evidenceIds || [];
      
      // If files are uploaded via FormData, process them
      const contentType = request.headers.get("content-type");
      if (contentType?.includes("multipart/form-data")) {
        const formData = await request.formData();
        const files = formData.getAll("files") as File[];
        
        for (const file of files) {
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
          const evidenceId = await evidenceVault.store({
            tenant_id: tenantId,
            type: "document",
            source: {
              type: "upload",
              id: `case-upload-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              url: undefined,
              collected_at: new Date().toISOString(),
              collected_by: validated.submittedBy || "public",
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
              uploadedBy: validated.submittedBy,
              uploadedAt: new Date().toISOString(),
            },
          });

          evidenceIds.push(evidenceId);
        }
      }

      // Create case
      const case_ = await caseService.createCase({
        tenantId,
        type: validated.type,
        submittedBy: validated.submittedBy,
        submittedByEmail: validated.submittedByEmail,
        submittedByName: validated.submittedByName,
        description: validated.description,
        impact: validated.impact,
        preferredResolution: validated.preferredResolution,
        evidenceIds,
        metadata: validated.metadata,
      });

      logger.info("Case created via public API", {
        case_id: case_.id,
        case_number: case_.caseNumber,
        tenant_id: tenantId,
      });

      return NextResponse.json(
        {
          success: true,
          case: {
            id: case_.id,
            caseNumber: case_.caseNumber,
            type: case_.type,
            status: case_.status,
            createdAt: case_.createdAt,
          },
          message: "Case submitted successfully. You will receive a confirmation email shortly.",
        },
        { status: 201 }
      );
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

      logger.error("Failed to create case", {
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { error: "Failed to create case", message: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: false, // Public endpoint
    rateLimit: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5, // 5 submissions per hour per IP
    },
  }
);

/**
 * GET /api/cases - List cases (authenticated, tenant-scoped)
 */
export const GET = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    try {
      const tenantId = context?.tenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: "Tenant ID required" },
          { status: 400 }
        );
      }

      // Parse query parameters
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
      const status = url.searchParams.get("status")?.split(",") as any;
      const type = url.searchParams.get("type")?.split(",") as any;
      const severity = url.searchParams.get("severity")?.split(",") as any;
      const priority = url.searchParams.get("priority")?.split(",") as any;
      const assignedTo = url.searchParams.get("assignedTo") || undefined;
      const assignedTeam = url.searchParams.get("assignedTeam") || undefined;
      const submittedBy = url.searchParams.get("submittedBy") || undefined;
      const dateFrom = url.searchParams.get("dateFrom") ? new Date(url.searchParams.get("dateFrom")!) : undefined;
      const dateTo = url.searchParams.get("dateTo") ? new Date(url.searchParams.get("dateTo")!) : undefined;
      const search = url.searchParams.get("search") || undefined;

      const result = await caseService.listCases(
        tenantId,
        {
          status,
          type,
          severity,
          priority,
          assignedTo,
          assignedTeam,
          submittedBy,
          dateFrom,
          dateTo,
          search,
        },
        page,
        limit
      );

      return NextResponse.json(result);
    } catch (error) {
      logger.error("Failed to list cases", {
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { error: "Failed to list cases", message: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
  }
);
