/**
 * Regulatory Reports Service
 * 
 * Generates automated regulatory reports for financial services compliance.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { Case, CaseType, CaseStatus } from "@prisma/client";

export interface RegulatoryReport {
  id: string;
  tenantId: string;
  reportType: "CFPB" | "FINRA" | "SEC" | "STATE_BANKING" | "GDPR" | "CUSTOM";
  period: {
    start: Date;
    end: Date;
  };
  data: {
    totalCases: number;
    casesByType: Record<CaseType, number>;
    casesByStatus: Record<CaseStatus, number>;
    averageResolutionTime: number;
    slaCompliance: number;
    regulatoryFlags: number;
    complaints: Array<{
      caseNumber: string;
      type: CaseType;
      description: string;
      submittedAt: Date;
      resolvedAt?: Date;
    }>;
  };
  generatedAt: Date;
  format: "PDF" | "CSV" | "XML" | "JSON";
}

export interface ReportConfig {
  reportType: RegulatoryReport["reportType"];
  frequency: "monthly" | "quarterly" | "annually" | "on_demand";
  recipients: string[];
  format: RegulatoryReport["format"];
  includeDetails: boolean;
}

/**
 * Regulatory Reports Service
 */
export class RegulatoryReportsService {
  /**
   * Generate regulatory report
   */
  async generateReport(
    tenantId: string,
    reportType: RegulatoryReport["reportType"],
    startDate: Date,
    endDate: Date,
    format: RegulatoryReport["format"] = "JSON"
  ): Promise<RegulatoryReport> {
    // Query cases in period
    const cases = await db.case.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        resolution: {
          select: {
            resolvedAt: true,
          },
        },
      },
    });

    // Calculate metrics
    const casesByType: Record<CaseType, number> = {
      DISPUTE: 0,
      FRAUD_ATO: 0,
      OUTAGE_DELAY: 0,
      COMPLAINT: 0,
    };

    const casesByStatus: Record<CaseStatus, number> = {
      SUBMITTED: 0,
      TRIAGED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let regulatoryFlags = 0;
    const complaints: RegulatoryReport["data"]["complaints"] = [];

    for (const case_ of cases) {
      casesByType[case_.type]++;
      casesByStatus[case_.status]++;

      if (case_.regulatorySensitivity) {
        regulatoryFlags++;
      }

      if (case_.status === "RESOLVED" || case_.status === "CLOSED") {
        if (case_.resolvedAt) {
          const resolutionTime = case_.resolvedAt.getTime() - case_.createdAt.getTime();
          totalResolutionTime += resolutionTime;
          resolvedCount++;
        }
      }

      // Collect complaint details for report
      complaints.push({
        caseNumber: case_.caseNumber,
        type: case_.type,
        description: case_.description.substring(0, 200),
        submittedAt: case_.createdAt,
        resolvedAt: case_.resolvedAt || undefined,
      });
    }

    const averageResolutionTime = resolvedCount > 0
      ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) // Convert to hours
      : 0;

    // Calculate SLA compliance
    const slaCompliant = cases.filter((case_) => {
      if (!case_.slaDeadline || !case_.resolvedAt) {
        return false;
      }
      return case_.resolvedAt <= case_.slaDeadline;
    }).length;

    const slaCompliance = cases.length > 0
      ? (slaCompliant / cases.length) * 100
      : 100;

    const report: RegulatoryReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      tenantId,
      reportType,
      period: {
        start: startDate,
        end: endDate,
      },
      data: {
        totalCases: cases.length,
        casesByType,
        casesByStatus,
        averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
        slaCompliance: Math.round(slaCompliance * 100) / 100,
        regulatoryFlags,
        complaints: complaints.slice(0, 1000), // Limit to 1000 for report size
      },
      generatedAt: new Date(),
      format,
    };

    logger.info("Regulatory report generated", {
      tenant_id: tenantId,
      report_type: reportType,
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      total_cases: cases.length,
    });

    metrics.increment("regulatory_reports_generated_total", {
      tenant_id: tenantId,
      report_type: reportType,
    });

    return report;
  }

  /**
   * Generate CFPB report
   */
  async generateCFPBReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RegulatoryReport> {
    const report = await this.generateReport(tenantId, "CFPB", startDate, endDate, "XML");

    // CFPB-specific formatting
    // In production, this would format according to CFPB XML schema
    logger.info("CFPB report generated", {
      tenant_id: tenantId,
      report_id: report.id,
    });

    return report;
  }

  /**
   * Generate FINRA report
   */
  async generateFINRAReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RegulatoryReport> {
    const report = await this.generateReport(tenantId, "FINRA", startDate, endDate, "CSV");

    // FINRA-specific formatting
    logger.info("FINRA report generated", {
      tenant_id: tenantId,
      report_id: report.id,
    });

    return report;
  }

  /**
   * Generate GDPR data protection report
   */
  async generateGDPRReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RegulatoryReport> {
    // GDPR reports focus on data privacy cases
    const cases = await db.case.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        OR: [
          { type: "COMPLAINT" },
          { metadata: { path: ["dataPrivacy"], equals: true } },
        ],
      },
    });

    const report = await this.generateReport(tenantId, "GDPR", startDate, endDate, "PDF");

    logger.info("GDPR report generated", {
      tenant_id: tenantId,
      report_id: report.id,
      data_privacy_cases: cases.length,
    });

    return report;
  }

  /**
   * Export report to file
   */
  async exportReport(report: RegulatoryReport): Promise<Buffer> {
    switch (report.format) {
      case "JSON":
        return Buffer.from(JSON.stringify(report, null, 2));

      case "CSV":
        return this.exportToCSV(report);

      case "XML":
        return this.exportToXML(report);

      case "PDF":
        return this.exportToPDF(report);

      default:
        throw new Error(`Unsupported format: ${report.format}`);
    }
  }

  /**
   * Export to CSV
   */
  private exportToCSV(report: RegulatoryReport): Buffer {
    const lines: string[] = [];

    // Header
    lines.push("Report Type,Period Start,Period End,Total Cases,Average Resolution Time (hours),SLA Compliance (%)");

    // Data row
    lines.push([
      report.reportType,
      report.period.start.toISOString(),
      report.period.end.toISOString(),
      report.data.totalCases,
      report.data.averageResolutionTime,
      report.data.slaCompliance,
    ].join(","));

    // Cases by type
    lines.push("");
    lines.push("Cases by Type");
    lines.push("Type,Count");
    Object.entries(report.data.casesByType).forEach(([type, count]) => {
      lines.push(`${type},${count}`);
    });

    // Cases by status
    lines.push("");
    lines.push("Cases by Status");
    lines.push("Status,Count");
    Object.entries(report.data.casesByStatus).forEach(([status, count]) => {
      lines.push(`${status},${count}`);
    });

    return Buffer.from(lines.join("\n"));
  }

  /**
   * Export to XML
   */
  private exportToXML(report: RegulatoryReport): Buffer {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<regulatoryReport>
  <reportType>${report.reportType}</reportType>
  <period>
    <start>${report.period.start.toISOString()}</start>
    <end>${report.period.end.toISOString()}</end>
  </period>
  <summary>
    <totalCases>${report.data.totalCases}</totalCases>
    <averageResolutionTime>${report.data.averageResolutionTime}</averageResolutionTime>
    <slaCompliance>${report.data.slaCompliance}</slaCompliance>
    <regulatoryFlags>${report.data.regulatoryFlags}</regulatoryFlags>
  </summary>
  <casesByType>
    ${Object.entries(report.data.casesByType).map(([type, count]) => `<${type}>${count}</${type}>`).join("\n    ")}
  </casesByType>
  <casesByStatus>
    ${Object.entries(report.data.casesByStatus).map(([status, count]) => `<${status}>${count}</${status}>`).join("\n    ")}
  </casesByStatus>
</regulatoryReport>`;

    return Buffer.from(xml);
  }

  /**
   * Export to PDF
   */
  private exportToPDF(report: RegulatoryReport): Buffer {
    // In production, use a PDF library like pdfkit or puppeteer
    // For now, return a simple text representation
    const text = `
REGULATORY REPORT
=================

Report Type: ${report.reportType}
Period: ${report.period.start.toISOString()} to ${report.period.end.toISOString()}
Generated: ${report.generatedAt.toISOString()}

SUMMARY
-------
Total Cases: ${report.data.totalCases}
Average Resolution Time: ${report.data.averageResolutionTime} hours
SLA Compliance: ${report.data.slaCompliance}%
Regulatory Flags: ${report.data.regulatoryFlags}

CASES BY TYPE
-------------
${Object.entries(report.data.casesByType).map(([type, count]) => `${type}: ${count}`).join("\n")}

CASES BY STATUS
---------------
${Object.entries(report.data.casesByStatus).map(([status, count]) => `${status}: ${count}`).join("\n")}
`;

    return Buffer.from(text);
  }
}

export const regulatoryReportsService = new RegulatoryReportsService();
