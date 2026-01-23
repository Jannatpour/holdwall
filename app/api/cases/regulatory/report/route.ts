/**
 * Regulatory Reports API
 * 
 * POST /api/cases/regulatory/report - Generate regulatory report
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { regulatoryReportsService } from "@/lib/cases/regulatory-reports";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const generateReportSchema = z.object({
  reportType: z.enum(["CFPB", "FINRA", "SEC", "STATE_BANKING", "GDPR", "CUSTOM"]),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid start date",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid end date",
  }),
  format: z.enum(["PDF", "CSV", "XML", "JSON"]).optional(),
});

export async function POST(request: NextRequest) {
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
        const tenantId = context?.tenantId;

        if (!tenantId) {
          return NextResponse.json(
            { error: "Tenant ID required" },
            { status: 400 }
          );
        }

        const body = await request.json();
        const validated = generateReportSchema.parse(body);

        const startDate = new Date(validated.startDate);
        const endDate = new Date(validated.endDate);

        let report;
        switch (validated.reportType) {
          case "CFPB":
            report = await regulatoryReportsService.generateCFPBReport(tenantId, startDate, endDate);
            break;
          case "FINRA":
            report = await regulatoryReportsService.generateFINRAReport(tenantId, startDate, endDate);
            break;
          case "GDPR":
            report = await regulatoryReportsService.generateGDPRReport(tenantId, startDate, endDate);
            break;
          default:
            report = await regulatoryReportsService.generateReport(
              tenantId,
              validated.reportType,
              startDate,
              endDate,
              validated.format || "JSON"
            );
        }

        // Export report if format is specified
        if (validated.format && validated.format !== "JSON") {
          const fileBuffer = await regulatoryReportsService.exportReport(report);
          const contentType = {
            PDF: "application/pdf",
            CSV: "text/csv",
            XML: "application/xml",
            JSON: "application/json",
          }[validated.format];

          // NextResponse expects a web BodyInit; convert Node Buffer to Uint8Array.
          return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="regulatory-report-${report.reportType}-${startDate.toISOString().split("T")[0]}.${validated.format.toLowerCase()}"`,
            },
          });
        }

        return NextResponse.json(report);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to generate regulatory report", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to generate report", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 10,
      },
    }
  );
  return handler(request);
}
