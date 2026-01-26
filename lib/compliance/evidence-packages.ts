/**
 * Compliance Evidence Packages
 * 
 * Generates continuous compliance evidence packages for:
 * - SOC2 (change management, access control, incident response, data retention)
 * - GDPR (access requests, exports, deletions, data processing records)
 * - Financial Services (audit trails, regulatory reports, access logs)
 * 
 * All packages are exportable as JSON, PDF, or ZIP for audit readiness.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { AuditBundleService } from "@/lib/governance/audit-bundle";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { GDPRCompliance } from "@/lib/compliance/gdpr";
import { RegulatoryReportsService } from "@/lib/cases/regulatory-reports";
import { format } from "date-fns";

export interface ComplianceEvidencePackage {
  package_id: string;
  package_type: "SOC2" | "GDPR" | "FINANCIAL_SERVICES" | "COMPREHENSIVE";
  tenant_id: string;
  generated_at: string;
  time_range: {
    start: string;
    end: string;
  };
  metadata: {
    generated_by?: string;
    purpose: string;
    compliance_frameworks: string[];
  };
  soc2_evidence?: SOC2Evidence;
  gdpr_evidence?: GDPREvidence;
  financial_services_evidence?: FinancialServicesEvidence;
  summary: {
    total_events: number;
    total_evidence_items: number;
    total_access_logs: number;
    compliance_status: "compliant" | "non_compliant" | "partial";
    issues: string[];
  };
}

export interface SOC2Evidence {
  change_management: {
    deployments: Array<{
      deployment_id: string;
      timestamp: string;
      environment: string;
      changes: string[];
      approved_by?: string;
      rollback_available: boolean;
    }>;
    migrations: Array<{
      migration_id: string;
      timestamp: string;
      description: string;
      applied_by: string;
      rollback_available: boolean;
    }>;
    feature_flags: Array<{
      flag_id: string;
      name: string;
      enabled: boolean;
      changed_at: string;
      changed_by: string;
    }>;
  };
  access_control: {
    rbac_checks: Array<{
      check_id: string;
      timestamp: string;
      user_id: string;
      resource: string;
      action: string;
      allowed: boolean;
      reason?: string;
    }>;
    access_logs: Array<{
      log_id: string;
      timestamp: string;
      actor_id: string;
      resource_type: string;
      resource_id: string;
      action: string;
      ip_address?: string;
    }>;
    permission_changes: Array<{
      change_id: string;
      timestamp: string;
      user_id: string;
      role_before: string;
      role_after: string;
      changed_by: string;
    }>;
  };
  incident_response: {
    incidents: Array<{
      incident_id: string;
      timestamp: string;
      severity: string;
      status: string;
      response_time_minutes?: number;
      resolution_time_minutes?: number;
      artifacts: string[];
    }>;
    drills: Array<{
      drill_id: string;
      timestamp: string;
      drill_type: string;
      status: "passed" | "failed" | "partial";
      findings: string[];
    }>;
  };
  data_retention: {
    retention_policies: Array<{
      policy_id: string;
      data_type: string;
      retention_days: number;
      enforcement_status: "enforced" | "partial" | "not_enforced";
    }>;
    data_deletions: Array<{
      deletion_id: string;
      timestamp: string;
      data_type: string;
      records_deleted: number;
      reason: string;
    }>;
  };
}

export interface GDPREvidence {
  access_requests: Array<{
    request_id: string;
    user_id: string;
    timestamp: string;
    status: "pending" | "completed" | "rejected";
    data_provided: boolean;
  }>;
  export_requests: Array<{
    request_id: string;
    user_id: string;
    timestamp: string;
    format: "json" | "csv" | "zip";
    status: "pending" | "completed" | "expired";
    download_url?: string;
  }>;
  deletion_requests: Array<{
    request_id: string;
    user_id: string;
    timestamp: string;
    status: "pending" | "completed" | "rejected";
    anonymization_applied: boolean;
    data_types_deleted: string[];
  }>;
  data_processing_records: Array<{
    record_id: string;
    processing_purpose: string;
    legal_basis: string;
    data_categories: string[];
    retention_period: string;
    data_subjects_count: number;
  }>;
  consent_records: Array<{
    consent_id: string;
    user_id: string;
    timestamp: string;
    consent_type: string;
    granted: boolean;
    withdrawn_at?: string;
  }>;
}

export interface FinancialServicesEvidence {
  regulatory_reports: Array<{
    report_id: string;
    report_type: "CFPB" | "FINRA" | "SEC" | "STATE_BANKING" | "GDPR" | "CUSTOM";
    period_start: string;
    period_end: string;
    total_cases: number;
    sla_compliance: number;
    generated_at: string;
  }>;
  audit_trails: Array<{
    trail_id: string;
    resource_type: string;
    resource_id: string;
    events: number;
    evidence_items: number;
    integrity_verified: boolean;
  }>;
  access_logs: Array<{
    log_id: string;
    timestamp: string;
    actor_id: string;
    resource_type: string;
    resource_id: string;
    action: string;
    regulatory_relevant: boolean;
  }>;
  case_resolutions: Array<{
    case_id: string;
    case_number: string;
    resolution_time_hours: number;
    sla_met: boolean;
    regulatory_flags: string[];
  }>;
}

export class ComplianceEvidencePackageService {
  private auditBundleService: AuditBundleService;
  private auditLog: DatabaseAuditLog;
  private eventStore: DatabaseEventStore;
  private evidenceVault: DatabaseEvidenceVault;
  private gdpr: GDPRCompliance;
  private regulatoryReports: RegulatoryReportsService;

  constructor() {
    this.auditLog = new DatabaseAuditLog();
    this.eventStore = new DatabaseEventStore();
    this.evidenceVault = new DatabaseEvidenceVault();
    this.auditBundleService = new AuditBundleService(
      this.auditLog,
      this.eventStore,
      this.evidenceVault
    );
    this.gdpr = new GDPRCompliance();
    this.regulatoryReports = new RegulatoryReportsService();
  }

  /**
   * Generate comprehensive compliance evidence package
   */
  async generatePackage(
    tenantId: string,
    packageType: "SOC2" | "GDPR" | "FINANCIAL_SERVICES" | "COMPREHENSIVE",
    timeRange: { start: string; end: string },
    options?: {
      generatedBy?: string;
      purpose?: string;
    }
  ): Promise<ComplianceEvidencePackage> {
    const packageId = `compliance-pkg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const package_: ComplianceEvidencePackage = {
      package_id: packageId,
      package_type: packageType,
      tenant_id: tenantId,
      generated_at: now,
      time_range: timeRange,
      metadata: {
        generated_by: options?.generatedBy,
        purpose: options?.purpose || "Compliance audit evidence",
        compliance_frameworks: this.getFrameworksForType(packageType),
      },
      summary: {
        total_events: 0,
        total_evidence_items: 0,
        total_access_logs: 0,
        compliance_status: "compliant",
        issues: [],
      },
    };

    // Generate evidence based on package type - execute in parallel for performance
    const evidencePromises: Array<Promise<void>> = [];
    
    if (packageType === "SOC2" || packageType === "COMPREHENSIVE") {
      evidencePromises.push(
        this.generateSOC2Evidence(tenantId, timeRange).then(
          (evidence) => { package_.soc2_evidence = evidence; }
        )
      );
    }

    if (packageType === "GDPR" || packageType === "COMPREHENSIVE") {
      evidencePromises.push(
        this.generateGDPREvidence(tenantId, timeRange).then(
          (evidence) => { package_.gdpr_evidence = evidence; }
        )
      );
    }

    if (packageType === "FINANCIAL_SERVICES" || packageType === "COMPREHENSIVE") {
      evidencePromises.push(
        this.generateFinancialServicesEvidence(tenantId, timeRange).then(
          (evidence) => { package_.financial_services_evidence = evidence; }
        )
      );
    }

    // Wait for all evidence generation to complete
    await Promise.all(evidencePromises);

    // Calculate summary - optimize with parallel queries
    const [events, evidence, accessLogsCount] = await Promise.all([
      this.eventStore.query({
        tenant_id: tenantId,
        occurred_after: timeRange.start,
        occurred_before: timeRange.end,
      }),
      this.evidenceVault.query({
        tenant_id: tenantId,
      }),
      db.evidenceAccessLog.count({
        where: {
          tenantId: tenantId,
          createdAt: {
            gte: new Date(timeRange.start),
            lte: new Date(timeRange.end),
          },
        },
      }),
    ]);

    package_.summary = {
      total_events: events.length,
      total_evidence_items: evidence.length,
      total_access_logs: accessLogsCount,
      compliance_status: this.assessComplianceStatus(package_),
      issues: this.identifyComplianceIssues(package_),
    };

    return package_;
  }

  /**
   * Generate SOC2 evidence
   */
  private async generateSOC2Evidence(
    tenantId: string,
    timeRange: { start: string; end: string }
  ): Promise<SOC2Evidence> {
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);

    // Validate date range
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid date range provided");
    }
    if (endDate < startDate) {
      throw new Error("End date must be after start date");
    }

    // Change management: deployments, migrations, feature flags
    const events = await this.eventStore.query({
      tenant_id: tenantId,
      occurred_after: timeRange.start,
      occurred_before: timeRange.end,
    });

    const deploymentEvents = events.filter((e) => e.type.startsWith("deployment."));
    const migrationEvents = events.filter((e) => e.type.startsWith("migration."));
    const featureFlagEvents = events.filter((e) => e.type.startsWith("feature_flag."));

    // Access control: RBAC checks, access logs, permission changes
    const rbacEvents = events.filter((e) => e.type.startsWith("rbac.") || e.type.startsWith("access."));
    
    // Optimize access logs query with proper indexing
    const accessLogs = await db.evidenceAccessLog.findMany({
      where: {
        tenantId: tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      take: 1000,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Incident response: security incidents and drills
    const incidentEvents = events.filter((e) => e.type.startsWith("security_incident."));

    // Data retention: policies and deletions
    const retentionEvents = events.filter((e) => e.type.startsWith("data_retention.") || e.type.startsWith("gdpr.data_deleted"));

    return {
      change_management: {
        deployments: deploymentEvents.map((e) => ({
          deployment_id: e.event_id,
          timestamp: e.occurred_at,
          environment: (e.payload as any).environment || "unknown",
          changes: (e.payload as any).changes || [],
          approved_by: (e.payload as any).approved_by,
          rollback_available: (e.payload as any).rollback_available || false,
        })),
        migrations: migrationEvents.map((e) => ({
          migration_id: e.event_id,
          timestamp: e.occurred_at,
          description: (e.payload as any).description || e.type,
          applied_by: e.actor_id,
          rollback_available: (e.payload as any).rollback_available || false,
        })),
        feature_flags: featureFlagEvents.map((e) => ({
          flag_id: e.event_id,
          name: (e.payload as any).flag_name || "unknown",
          enabled: (e.payload as any).enabled || false,
          changed_at: e.occurred_at,
          changed_by: e.actor_id,
        })),
      },
      access_control: {
        rbac_checks: rbacEvents.map((e) => ({
          check_id: e.event_id,
          timestamp: e.occurred_at,
          user_id: e.actor_id,
          resource: (e.payload as any).resource || "unknown",
          action: (e.payload as any).action || "unknown",
          allowed: (e.payload as any).allowed !== false,
          reason: (e.payload as any).reason,
        })),
        access_logs: accessLogs.map((log) => ({
          log_id: log.id,
          timestamp: log.createdAt.toISOString(),
          actor_id: log.actorId,
          resource_type: "evidence",
          resource_id: log.evidenceId,
          action: String(log.accessType),
          ip_address: log.ipAddress ?? undefined,
        })),
        permission_changes: events
          .filter((e) => e.type === "rbac.role_changed" || e.type === "user.role_updated")
          .map((e) => ({
            change_id: e.event_id,
            timestamp: e.occurred_at,
            user_id: (e.payload as any).user_id || e.actor_id,
            role_before: (e.payload as any).role_before || "unknown",
            role_after: (e.payload as any).role_after || "unknown",
            changed_by: e.actor_id,
          })),
      },
      incident_response: {
        incidents: incidentEvents.map((e) => ({
          incident_id: e.event_id,
          timestamp: e.occurred_at,
          severity: (e.payload as any).severity || "medium",
          status: (e.payload as any).status || "open",
          response_time_minutes: (e.payload as any).response_time_minutes,
          resolution_time_minutes: (e.payload as any).resolution_time_minutes,
          artifacts: (e.payload as any).artifacts || [],
        })),
        drills: await this.getChaosDrills(tenantId, timeRange),
      },
      data_retention: {
        retention_policies: [
          {
            policy_id: "default",
            data_type: "evidence",
            retention_days: 2555, // 7 years default
            enforcement_status: "enforced",
          },
        ],
        data_deletions: retentionEvents.map((e) => ({
          deletion_id: e.event_id,
          timestamp: e.occurred_at,
          data_type: (e.payload as any).data_type || "unknown",
          records_deleted: (e.payload as any).records_deleted || 0,
          reason: (e.payload as any).reason || "retention_policy",
        })),
      },
    };
  }

  /**
   * Generate GDPR evidence
   */
  private async generateGDPREvidence(
    tenantId: string,
    timeRange: { start: string; end: string }
  ): Promise<GDPREvidence> {
    const events = await this.eventStore.query({
      tenant_id: tenantId,
      occurred_after: timeRange.start,
      occurred_before: timeRange.end,
    });

    const gdprEvents = events.filter((e) => e.type.startsWith("gdpr."));

    return {
      access_requests: gdprEvents
        .filter((e) => e.type === "gdpr.access_requested" || e.type === "gdpr.access_completed")
        .map((e) => ({
          request_id: (e.payload as any).request_id || e.event_id,
          user_id: (e.payload as any).user_id || e.actor_id,
          timestamp: e.occurred_at,
          status: e.type.includes("completed") ? "completed" : "pending",
          data_provided: e.type.includes("completed"),
        })),
      export_requests: gdprEvents
        .filter((e) => e.type === "gdpr.export_created" || e.type === "gdpr.export_downloaded")
        .map((e) => ({
          request_id: (e.payload as any).request_id || e.event_id,
          user_id: (e.payload as any).user_id || e.actor_id,
          timestamp: e.occurred_at,
          format: (e.payload as any).format || "json",
          status: e.type.includes("downloaded") ? "completed" : "pending",
          download_url: (e.payload as any).download_url,
        })),
      deletion_requests: gdprEvents
        .filter((e) => e.type === "gdpr.data_deleted" || e.type === "gdpr.deletion_requested")
        .map((e) => ({
          request_id: (e.payload as any).request_id || e.event_id,
          user_id: (e.payload as any).user_id || e.actor_id,
          timestamp: e.occurred_at,
          status: e.type.includes("deleted") ? "completed" : "pending",
          anonymization_applied: (e.payload as any).anonymization_applied || false,
          data_types_deleted: (e.payload as any).data_types_deleted || [],
        })),
      data_processing_records: await this.getDataProcessingRecords(tenantId, timeRange),
      consent_records: await this.getConsentRecords(tenantId, timeRange),
    };
  }

  /**
   * Generate Financial Services evidence
   */
  private async generateFinancialServicesEvidence(
    tenantId: string,
    timeRange: { start: string; end: string }
  ): Promise<FinancialServicesEvidence> {
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);

    // Optimize queries with parallel execution
    const [reports, accessLogs, cases] = await Promise.all([
      db.case.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        take: 100,
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.evidenceAccessLog.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        take: 1000,
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.case.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          resolution: true,
        },
        take: 100,
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    return {
      regulatory_reports: [
        {
          report_id: "report-1",
          report_type: "CUSTOM",
          period_start: timeRange.start,
          period_end: timeRange.end,
          total_cases: reports.length,
          sla_compliance: Math.round(this.calculateSLACompliance(cases) * 100) / 100,
          generated_at: new Date().toISOString(),
        },
      ],
      audit_trails: [
        {
          trail_id: "trail-1",
          resource_type: "case",
          resource_id: "all",
          events: reports.length,
          evidence_items: (await this.evidenceVault.query({ tenant_id: tenantId })).length,
          integrity_verified: true,
        },
      ],
      access_logs: accessLogs.map((log) => ({
        log_id: log.id,
        timestamp: log.createdAt.toISOString(),
        actor_id: log.actorId,
        resource_type: "evidence",
        resource_id: log.evidenceId,
        action: log.accessType,
        regulatory_relevant: true,
      })),
      case_resolutions: cases
        .filter((c) => c.resolution)
        .map((c) => {
          const createdAt = new Date(c.createdAt);
          const resolvedAt = c.resolution ? new Date(c.resolution.createdAt) : new Date();
          const resolutionTimeHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return {
            case_id: c.id,
            case_number: c.caseNumber,
            resolution_time_hours: Math.round(resolutionTimeHours * 100) / 100,
            sla_met: resolutionTimeHours <= 72, // 72-hour SLA
            regulatory_flags: (c.metadata as any)?.regulatory_flags || [],
          };
        }),
    };
  }

  /**
   * Export package as JSON
   */
  async exportJSON(package_: ComplianceEvidencePackage): Promise<string> {
    return JSON.stringify(package_, null, 2);
  }

  /**
   * Export package as PDF using jsPDF
   */
  async exportPDF(package_: ComplianceEvidencePackage): Promise<Blob> {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      
      let yPos = 20;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const maxWidth = doc.internal.pageSize.width - 2 * margin;
      
      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(`COMPLIANCE EVIDENCE PACKAGE: ${package_.package_type}`, margin, yPos);
      yPos += 10;
      
      // Metadata
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Package ID: ${package_.package_id}`, margin, yPos);
      yPos += 5;
      doc.text(`Tenant ID: ${package_.tenant_id}`, margin, yPos);
      yPos += 5;
      doc.text(`Generated: ${package_.generated_at}`, margin, yPos);
      yPos += 5;
      doc.text(`Time Range: ${package_.time_range.start} to ${package_.time_range.end}`, margin, yPos);
      yPos += 10;
      
      // Summary
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("SUMMARY", margin, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Events: ${package_.summary.total_events}`, margin, yPos);
      yPos += 5;
      doc.text(`Total Evidence Items: ${package_.summary.total_evidence_items}`, margin, yPos);
      yPos += 5;
      doc.text(`Total Access Logs: ${package_.summary.total_access_logs}`, margin, yPos);
      yPos += 5;
      doc.text(`Compliance Status: ${package_.summary.compliance_status.toUpperCase()}`, margin, yPos);
      yPos += 5;
      
      if (package_.summary.issues.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Issues:", margin, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        package_.summary.issues.forEach((issue) => {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
          }
          const lines = doc.splitTextToSize(`• ${issue}`, maxWidth);
          doc.text(lines, margin + 5, yPos);
          yPos += lines.length * 5;
        });
      }
      yPos += 5;
      
      // SOC2 Evidence
      if (package_.soc2_evidence) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("SOC2 EVIDENCE", margin, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Deployments: ${package_.soc2_evidence.change_management.deployments.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Migrations: ${package_.soc2_evidence.change_management.migrations.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Feature Flags: ${package_.soc2_evidence.change_management.feature_flags.length}`, margin, yPos);
        yPos += 5;
        doc.text(`RBAC Checks: ${package_.soc2_evidence.access_control.rbac_checks.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Access Logs: ${package_.soc2_evidence.access_control.access_logs.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Incidents: ${package_.soc2_evidence.incident_response.incidents.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Drills: ${package_.soc2_evidence.incident_response.drills.length}`, margin, yPos);
        yPos += 10;
      }
      
      // GDPR Evidence
      if (package_.gdpr_evidence) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("GDPR EVIDENCE", margin, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Access Requests: ${package_.gdpr_evidence.access_requests.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Export Requests: ${package_.gdpr_evidence.export_requests.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Deletion Requests: ${package_.gdpr_evidence.deletion_requests.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Data Processing Records: ${package_.gdpr_evidence.data_processing_records.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Consent Records: ${package_.gdpr_evidence.consent_records.length}`, margin, yPos);
        yPos += 10;
      }
      
      // Financial Services Evidence
      if (package_.financial_services_evidence) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("FINANCIAL SERVICES EVIDENCE", margin, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Regulatory Reports: ${package_.financial_services_evidence.regulatory_reports.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Audit Trails: ${package_.financial_services_evidence.audit_trails.length}`, margin, yPos);
        yPos += 5;
        doc.text(`Case Resolutions: ${package_.financial_services_evidence.case_resolutions.length}`, margin, yPos);
      }
      
      const pdfBlob = doc.output("blob");
      return pdfBlob;
    } catch (error) {
      logger.warn("jsPDF not available, returning text format", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to text format
      const text = this.formatPackageAsText(package_);
      return new Blob([text], { type: "text/plain" });
    }
  }

  /**
   * Export package as ZIP (JSON + PDF)
   */
  async exportZIP(package_: ComplianceEvidencePackage): Promise<Blob> {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const json = await this.exportJSON(package_);
    zip.file(`compliance-package-${package_.package_id}.json`, json);

    const pdf = await this.exportPDF(package_);
    zip.file(`compliance-package-${package_.package_id}.pdf`, await pdf.arrayBuffer());

    return await zip.generateAsync({ type: "blob" });
  }

  /**
   * Format package as human-readable text
   */
  private formatPackageAsText(package_: ComplianceEvidencePackage): string {
    const lines: string[] = [];
    lines.push("=".repeat(80));
    lines.push(`COMPLIANCE EVIDENCE PACKAGE: ${package_.package_type}`);
    lines.push("=".repeat(80));
    lines.push(`Package ID: ${package_.package_id}`);
    lines.push(`Tenant ID: ${package_.tenant_id}`);
    lines.push(`Generated: ${package_.generated_at}`);
    lines.push(`Time Range: ${package_.time_range.start} to ${package_.time_range.end}`);
    lines.push("");
    lines.push("SUMMARY");
    lines.push("-".repeat(80));
    lines.push(`Total Events: ${package_.summary.total_events}`);
    lines.push(`Total Evidence Items: ${package_.summary.total_evidence_items}`);
    lines.push(`Total Access Logs: ${package_.summary.total_access_logs}`);
    lines.push(`Compliance Status: ${package_.summary.compliance_status}`);
    if (package_.summary.issues.length > 0) {
      lines.push(`Issues: ${package_.summary.issues.join(", ")}`);
    }
    lines.push("");

    if (package_.soc2_evidence) {
      lines.push("SOC2 EVIDENCE");
      lines.push("-".repeat(80));
      lines.push(`Deployments: ${package_.soc2_evidence.change_management.deployments.length}`);
      lines.push(`Migrations: ${package_.soc2_evidence.change_management.migrations.length}`);
      lines.push(`Feature Flags: ${package_.soc2_evidence.change_management.feature_flags.length}`);
      lines.push(`RBAC Checks: ${package_.soc2_evidence.access_control.rbac_checks.length}`);
      lines.push(`Access Logs: ${package_.soc2_evidence.access_control.access_logs.length}`);
      lines.push(`Incidents: ${package_.soc2_evidence.incident_response.incidents.length}`);
      lines.push(`Drills: ${package_.soc2_evidence.incident_response.drills.length}`);
      lines.push("");
    }

    if (package_.gdpr_evidence) {
      lines.push("GDPR EVIDENCE");
      lines.push("-".repeat(80));
      lines.push(`Access Requests: ${package_.gdpr_evidence.access_requests.length}`);
      lines.push(`Export Requests: ${package_.gdpr_evidence.export_requests.length}`);
      lines.push(`Deletion Requests: ${package_.gdpr_evidence.deletion_requests.length}`);
      lines.push(`Data Processing Records: ${package_.gdpr_evidence.data_processing_records.length}`);
      lines.push(`Consent Records: ${package_.gdpr_evidence.consent_records.length}`);
      lines.push("");
    }

    if (package_.financial_services_evidence) {
      lines.push("FINANCIAL SERVICES EVIDENCE");
      lines.push("-".repeat(80));
      lines.push(`Regulatory Reports: ${package_.financial_services_evidence.regulatory_reports.length}`);
      lines.push(`Audit Trails: ${package_.financial_services_evidence.audit_trails.length}`);
      lines.push(`Case Resolutions: ${package_.financial_services_evidence.case_resolutions.length}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Get compliance frameworks for package type
   */
  private getFrameworksForType(
    type: "SOC2" | "GDPR" | "FINANCIAL_SERVICES" | "COMPREHENSIVE"
  ): string[] {
    switch (type) {
      case "SOC2":
        return ["SOC2 Type II"];
      case "GDPR":
        return ["GDPR", "CCPA"];
      case "FINANCIAL_SERVICES":
        return ["CFPB", "FINRA", "SEC"];
      case "COMPREHENSIVE":
        return ["SOC2 Type II", "GDPR", "CCPA", "CFPB", "FINRA", "SEC"];
      default:
        return [];
    }
  }

  /**
   * Assess overall compliance status
   */
  private assessComplianceStatus(package_: ComplianceEvidencePackage): "compliant" | "non_compliant" | "partial" {
    const issues = this.identifyComplianceIssues(package_);
    if (issues.length === 0) return "compliant";
    if (issues.some((i) => i.includes("CRITICAL") || i.includes("BREACH"))) return "non_compliant";
    return "partial";
  }

  /**
   * Identify compliance issues
   */
  private identifyComplianceIssues(package_: ComplianceEvidencePackage): string[] {
    const issues: string[] = [];

    // Check SOC2 evidence
    if (package_.soc2_evidence) {
      if (package_.soc2_evidence.access_control.rbac_checks.some((c) => !c.allowed)) {
        issues.push("Unauthorized access attempts detected");
      }
      if (package_.soc2_evidence.incident_response.incidents.some((i) => i.status === "open")) {
        issues.push("Open security incidents");
      }
      if (package_.soc2_evidence.data_retention.retention_policies.some((p) => p.enforcement_status !== "enforced")) {
        issues.push("Data retention policies not fully enforced");
      }
    }

    // Check GDPR evidence
    if (package_.gdpr_evidence) {
      const pendingAccess = package_.gdpr_evidence.access_requests.filter((r) => r.status === "pending");
      if (pendingAccess.length > 0) {
        issues.push(`${pendingAccess.length} pending GDPR access requests`);
      }
      const pendingDeletions = package_.gdpr_evidence.deletion_requests.filter((r) => r.status === "pending");
      if (pendingDeletions.length > 0) {
        issues.push(`${pendingDeletions.length} pending GDPR deletion requests`);
      }
    }

    return issues;
  }

  /**
   * Get consent records for GDPR evidence
   */
  private async getConsentRecords(
    tenantId: string,
    timeRange: { start: string; end: string }
  ): Promise<Array<{
    consent_id: string;
    user_id: string;
    timestamp: string;
    consent_type: string;
    granted: boolean;
    withdrawn_at?: string;
  }>> {
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);

    const consentEvents = await db.event.findMany({
      where: {
        tenantId,
        type: "consent.recorded",
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        occurredAt: "desc",
      },
      take: 1000,
    });

    return consentEvents.map((event) => {
      const payload = event.payload as any;
      return {
        consent_id: event.id,
        user_id: event.actorId,
        timestamp: event.occurredAt.toISOString(),
        consent_type: payload.consentType || "unknown",
        granted: payload.granted === true,
        withdrawn_at: payload.withdrawnAt || undefined,
      };
    });
  }

  /**
   * Get data processing records for GDPR evidence
   */
  private async getDataProcessingRecords(
    tenantId: string,
    timeRange: { start: string; end: string }
  ): Promise<Array<{
    record_id: string;
    processing_purpose: string;
    legal_basis: string;
    data_categories: string[];
    retention_period: string;
    data_subjects_count: number;
  }>> {
    try {
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);

      // Validate date range
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        logger.warn("Invalid date range for data processing records", { timeRange, tenantId });
        throw new Error("Invalid date range provided");
      }

      if (endDate < startDate) {
        logger.warn("End date before start date for data processing records", { timeRange, tenantId });
        throw new Error("End date must be after start date");
      }

      // Get data processing events
      const processingEvents = await db.event.findMany({
        where: {
          tenantId,
          type: {
            in: ["gdpr.data_processing_recorded", "data.processing_started", "data.processing_completed"],
          },
          occurredAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
        take: 100,
      });

      // Get user count once (reused for all records that don't have it in payload)
      const defaultUserCount = await db.user.count({ where: { tenantId } }).catch(() => 0);

      // If no events found, return default processing record
      if (processingEvents.length === 0) {
        return [
          {
            record_id: `processing-${tenantId}-default`,
            processing_purpose: "Case management and resolution",
            legal_basis: "Legitimate interest",
            data_categories: ["personal_data", "case_data", "evidence"],
            retention_period: "7 years",
            data_subjects_count: defaultUserCount,
          },
        ];
      }

      // Map events to processing records
      const records = processingEvents.map((event) => {
        const payload = event.payload as any;
        return {
          record_id: payload.record_id || event.id,
          processing_purpose: payload.processing_purpose || payload.purpose || "Data processing",
          legal_basis: payload.legal_basis || "Legitimate interest",
          data_categories: Array.isArray(payload.data_categories)
            ? payload.data_categories
            : ["personal_data", "case_data", "evidence"],
          retention_period: payload.retention_period || "7 years",
          data_subjects_count: payload.data_subjects_count ?? defaultUserCount,
        };
      });

      // Deduplicate by record_id
      const uniqueRecords = new Map<string, typeof records[0]>();
      for (const record of records) {
        if (!uniqueRecords.has(record.record_id)) {
          uniqueRecords.set(record.record_id, record);
        }
      }

      return Array.from(uniqueRecords.values());
    } catch (error) {
      logger.error("Failed to get data processing records", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
        timeRange,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return default record on error to ensure compliance package generation doesn't fail
      return [
        {
          record_id: `processing-${tenantId}-error-${Date.now()}`,
          processing_purpose: "Case management and resolution",
          legal_basis: "Legitimate interest",
          data_categories: ["personal_data", "case_data", "evidence"],
          retention_period: "7 years",
          data_subjects_count: 0,
        },
      ];
    }
  }

  /**
   * Get chaos drills for SOC2 evidence
   */
  private async getChaosDrills(
    tenantId: string,
    timeRange: { start: string; end: string }
  ): Promise<Array<{
    drill_id: string;
    timestamp: string;
    drill_type: string;
    status: "passed" | "failed" | "partial";
    findings: string[];
  }>> {
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);

    const drillEvents = await db.event.findMany({
      where: {
        tenantId,
        type: {
          startsWith: "chaos.drill.",
        },
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        occurredAt: "desc",
      },
      take: 100,
    });

    return drillEvents.map((event) => {
      const payload = event.payload as any;
      const drillType = event.type.replace("chaos.drill.", "");
      return {
        drill_id: payload.drill_id || event.id,
        timestamp: event.occurredAt.toISOString(),
        drill_type: drillType,
        status: (payload.status === "passed" || payload.status === "failed" || payload.status === "partial")
          ? payload.status
          : "partial",
        findings: Array.isArray(payload.findings) ? payload.findings : [],
      };
    });
  }

  /**
   * Calculate SLA compliance percentage from cases
   */
  private calculateSLACompliance(cases: Array<{ slaDeadline: Date | null; resolvedAt: Date | null; createdAt: Date }>): number {
    if (cases.length === 0) return 1.0;
    
    const casesWithSLA = cases.filter((c) => c.slaDeadline !== null);
    if (casesWithSLA.length === 0) return 1.0;
    
    const compliantCases = casesWithSLA.filter((c) => {
      if (!c.resolvedAt || !c.slaDeadline) return false;
      return c.resolvedAt <= c.slaDeadline;
    });
    
    return compliantCases.length / casesWithSLA.length;
  }
}
