/**
 * Compliance Evidence Package API
 * 
 * Generate and export compliance evidence packages (SOC2, GDPR, Financial Services)
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { ComplianceEvidencePackageService } from "@/lib/compliance/evidence-packages";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import { sanitizeInput } from "@/lib/security/input-sanitizer";

const generateSchema = z.object({
  package_type: z.enum(["SOC2", "GDPR", "FINANCIAL_SERVICES", "COMPREHENSIVE"]),
  time_range: z.object({
    start: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid ISO 8601 datetime format for start",
    }),
    end: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid ISO 8601 datetime format for end",
    }),
  }).refine((data) => {
    const start = new Date(data.start);
    const end = new Date(data.end);
    return end >= start;
  }, {
    message: "End time must be after start time",
  }),
  purpose: z.string().max(1000).optional(),
});

const service = new ComplianceEvidencePackageService();

export const POST = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    const tenantId = context?.tenantId || "";

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Sanitize input before validation
    const sanitizedBody = {
      ...body,
      purpose: body.purpose ? sanitizeInput(body.purpose, { maxLength: 1000 }) : undefined,
    };
    
    const validated = generateSchema.parse(sanitizedBody);

    // Generate package
    const package_ = await service.generatePackage(
      tenantId,
      validated.package_type,
      validated.time_range,
      {
        generatedBy: context?.user?.id,
        purpose: validated.purpose,
      }
    );

    // Determine export format - sanitize format parameter
    const formatParam = new URL(request.url).searchParams.get("format") || "json";
    const format = ["json", "pdf", "zip"].includes(formatParam) ? formatParam : "json";

    if (format === "zip") {
      const zipBlob = await service.exportZIP(package_);
      return new NextResponse(zipBlob, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="compliance-package-${package_.package_id}.zip"`,
        },
      });
    }

    if (format === "pdf") {
      const pdfBlob = await service.exportPDF(package_);
      // Check if it's actually a PDF (from jsPDF) or text fallback
      const contentType = pdfBlob.type === "application/pdf" 
        ? "application/pdf" 
        : "text/plain";
      return new NextResponse(pdfBlob, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="compliance-package-${package_.package_id}.pdf"`,
        },
      });
    }

    // Default: JSON
    const json = await service.exportJSON(package_);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="compliance-package-${package_.package_id}.json"`,
      },
    });
  },
  {
    requireAuth: true,
    requireRole: "ADMIN",
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // Limit compliance package generation
    },
  }
);

export const GET = createApiHandler(
  async (request: NextRequest) => {
    return NextResponse.json({
      description: "Generate compliance evidence packages for SOC2, GDPR, and Financial Services audits",
      usage: {
        method: "POST",
        endpoint: "/api/compliance/evidence-package",
        body: {
          package_type: "SOC2 | GDPR | FINANCIAL_SERVICES | COMPREHENSIVE",
          time_range: {
            start: "ISO 8601 timestamp",
            end: "ISO 8601 timestamp",
          },
          purpose: "optional - purpose of the package (max 1000 characters)",
        },
        query_params: {
          format: "json | pdf | zip (default: json)",
        },
      },
      supported_frameworks: {
        SOC2: ["SOC2 Type II"],
        GDPR: ["GDPR", "CCPA"],
        FINANCIAL_SERVICES: ["CFPB", "FINRA", "SEC"],
        COMPREHENSIVE: ["SOC2 Type II", "GDPR", "CCPA", "CFPB", "FINRA", "SEC"],
      },
      security: {
        authentication: "Required (ADMIN role)",
        rate_limit: "10 requests per minute",
      },
    });
  },
  {
    requireAuth: true,
    requireRole: "ADMIN",
  }
);
