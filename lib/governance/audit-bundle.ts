/**
 * Governance + Audit Bundle Export
 * 
 * One-click export: PDF executive summary, JSON evidence package, immutable version IDs
 */

import type { AuditLog, AuditEntry } from "@/lib/audit/lineage";
import type { EventEnvelope, EventStore } from "@/lib/events/types";
import type { Evidence, EvidenceVault } from "@/lib/evidence/vault";
import { MerkleTreeBuilder } from "@/lib/evidence/merkle-bundle";
import { logger } from "@/lib/logging/logger";

export interface AuditBundle {
  bundle_id: string;
  tenant_id: string;
  /** Incident/cluster/claim ID */
  resource_id: string;
  resource_type: string;
  /** Timestamp range */
  time_range: {
    start: string;
    end: string;
  };
  /** Audit entries */
  audit_entries: AuditEntry[];
  /** Events */
  events: EventEnvelope[];
  /** Evidence */
  evidence: Evidence[];
  /** Executive summary */
  executive_summary: {
    title: string;
    overview: string;
    key_findings: string[];
    recommendations: string[];
  };
  /** Version IDs (immutable) */
  version_ids: {
    bundle_version: string;
    evidence_versions: string[];
    event_versions: string[];
  };
  /** Merkle bundle (if enabled) */
  merkle_bundle?: {
    bundle_id: string;
    root_hash: string;
    items: Array<{
      index: number;
      data: string;
      hash: string;
    }>;
  };
  created_at: string;
}

export class AuditBundleService {
  constructor(
    private auditLog: AuditLog,
    private eventStore: EventStore,
    private evidenceVault: EvidenceVault
  ) {}

  async createBundle(
    tenant_id: string,
    resource_id: string,
    resource_type: string,
    time_range: { start: string; end: string },
    correlation_id?: string
  ): Promise<AuditBundle> {
    const bundle_id = `bundle-${Date.now()}`;

    // 1. Get audit entries
    const audit_entries = correlation_id
      ? await this.auditLog.getLineage(correlation_id)
      : await this.auditLog.query({
          tenant_id,
          timestamp_after: time_range.start,
          timestamp_before: time_range.end,
        });

    // 2. Get events
    const events = await this.eventStore.query({
      tenant_id,
      occurred_after: time_range.start,
      occurred_before: time_range.end,
    });

    // 3. Get evidence
    const evidence_refs = Array.from(
      new Set(
        [...audit_entries, ...events].flatMap((e) =>
          "evidence_refs" in e ? e.evidence_refs : []
        )
      )
    );
    const evidence = await Promise.all(
      evidence_refs.map((ref) => this.evidenceVault.get(ref))
    );
    const valid_evidence = evidence.filter((e): e is Evidence => e !== null);

    // 4. Create Merkle bundle for evidence (if enabled)
    let merkleBundle = null;
    if (valid_evidence.length > 0 && process.env.ENABLE_MERKLE_BUNDLES === "true") {
      try {
        const merkleBuilder = new MerkleTreeBuilder();
        merkleBundle = merkleBuilder.createBundle(bundle_id, valid_evidence, {
          resource_id: resource_id,
          resource_type: resource_type,
          time_range,
        });
      } catch (error) {
        logger.warn("Failed to create Merkle bundle", { error });
      }
    }

    // 5. Generate executive summary
    const executive_summary = {
      title: `Audit Bundle: ${resource_type} ${resource_id}`,
      overview: `Complete audit trail for ${resource_type} ${resource_id} from ${time_range.start} to ${time_range.end}`,
      key_findings: [
        `${audit_entries.length} audit entries`,
        `${events.length} events`,
        `${valid_evidence.length} evidence items`,
      ],
      recommendations: [
        "Review all evidence references",
        "Verify policy compliance",
        "Check approval workflows",
      ],
    };

    // 6. Create bundle
    const bundle: AuditBundle = {
      bundle_id,
      tenant_id,
      resource_id,
      resource_type,
      time_range,
      audit_entries,
      events,
      evidence: valid_evidence,
      executive_summary,
      version_ids: {
        bundle_version: bundle_id,
        evidence_versions: evidence_refs,
        event_versions: events.map((e) => e.event_id),
      },
      merkle_bundle: merkleBundle ? {
        bundle_id: merkleBundle.bundle_id,
        root_hash: merkleBundle.root_hash,
        items: merkleBundle.items,
      } : undefined,
      created_at: new Date().toISOString(),
    };

    return bundle;
  }

  async exportPDF(bundle: AuditBundle): Promise<Blob> {
    // Generate PDF using text-based approach (production would use proper PDF library)
    // For now, create a structured text document that can be converted to PDF
    const lines: string[] = [];
    
    lines.push("=".repeat(80));
    lines.push(bundle.executive_summary.title.toUpperCase());
    lines.push("=".repeat(80));
    lines.push("");
    lines.push("OVERVIEW");
    lines.push("-".repeat(80));
    lines.push(bundle.executive_summary.overview);
    lines.push("");
    lines.push("KEY FINDINGS");
    lines.push("-".repeat(80));
    bundle.executive_summary.key_findings.forEach((finding) => {
      lines.push(`• ${finding}`);
    });
    lines.push("");
    lines.push("RECOMMENDATIONS");
    lines.push("-".repeat(80));
    bundle.executive_summary.recommendations.forEach((rec) => {
      lines.push(`• ${rec}`);
    });
    lines.push("");
    lines.push("SUMMARY");
    lines.push("-".repeat(80));
    lines.push(`Audit Entries: ${bundle.audit_entries.length}`);
    lines.push(`Events: ${bundle.events.length}`);
    lines.push(`Evidence Items: ${bundle.evidence.length}`);
    lines.push(`Bundle Version: ${bundle.version_ids.bundle_version}`);
    lines.push(`Generated: ${new Date(bundle.created_at).toLocaleString()}`);
    lines.push("");
    lines.push("AUDIT ENTRIES");
    lines.push("-".repeat(80));
    bundle.audit_entries.slice(0, 50).forEach((entry, index) => {
      const actionLabel =
        (entry as any).action ||
        (entry as any).type ||
        ((entry as any).data && (entry as any).data.type) ||
        "audit.entry";
      lines.push(`${index + 1}. ${actionLabel} - ${new Date(entry.timestamp).toLocaleString()}`);
      if (entry.actor_id) {
        lines.push(`   Actor: ${entry.actor_id}`);
      }
      if (entry.evidence_refs && entry.evidence_refs.length > 0) {
        lines.push(`   Evidence: ${entry.evidence_refs.join(", ")}`);
      }
      lines.push("");
    });
    
    const content = lines.join("\n");
    
    // Try to generate actual PDF using jsPDF if available
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text(bundle.executive_summary.title, 20, 20);
      
      // Overview
      doc.setFontSize(12);
      let yPos = 35;
      doc.text("Overview", 20, yPos);
      yPos += 7;
      const overviewLines = doc.splitTextToSize(
        bundle.executive_summary.overview,
        170
      );
      doc.setFontSize(10);
      doc.text(overviewLines, 20, yPos);
      yPos += overviewLines.length * 5 + 5;
      
      // Key Findings
      doc.setFontSize(12);
      doc.text("Key Findings", 20, yPos);
      yPos += 7;
      doc.setFontSize(10);
      bundle.executive_summary.key_findings.forEach((finding) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`• ${finding}`, 25, yPos);
        yPos += 5;
      });
      yPos += 3;
      
      // Recommendations
      doc.setFontSize(12);
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text("Recommendations", 20, yPos);
      yPos += 7;
      doc.setFontSize(10);
      bundle.executive_summary.recommendations.forEach((rec) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`• ${rec}`, 25, yPos);
        yPos += 5;
      });
      yPos += 5;
      
      // Audit Entries Summary
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.text(`Audit Entries: ${bundle.audit_entries.length}`, 20, yPos);
      yPos += 7;
      doc.text(`Events: ${bundle.events.length}`, 20, yPos);
      yPos += 5;
      doc.text(`Evidence Items: ${bundle.evidence.length}`, 20, yPos);
      yPos += 5;
      
      // Version IDs
      doc.setFontSize(10);
      doc.text(
        `Bundle Version: ${bundle.version_ids.bundle_version}`,
        20,
        yPos
      );
      yPos += 5;
      doc.text(
        `Generated: ${new Date(bundle.created_at).toLocaleString()}`,
        20,
        yPos
      );
      
      // Add new page for detailed audit entries if needed
      if (bundle.audit_entries.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Audit Entries", 20, 20);
        yPos = 30;
        doc.setFontSize(10);
        
        bundle.audit_entries.slice(0, 50).forEach((entry, index) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          const actionLabel =
            (entry as any).action ||
            (entry as any).type ||
            ((entry as any).data && (entry as any).data.type) ||
            "audit.entry";
          doc.text(
            `${index + 1}. ${actionLabel} - ${new Date(entry.timestamp).toLocaleString()}`,
            20,
            yPos
          );
          yPos += 5;
          if (entry.actor_id) {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            doc.setFontSize(9);
            doc.text(`   Actor: ${entry.actor_id}`, 25, yPos);
            yPos += 4;
            doc.setFontSize(10);
          }
          if (entry.evidence_refs && entry.evidence_refs.length > 0) {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            doc.setFontSize(9);
            doc.text(
              `   Evidence: ${entry.evidence_refs.slice(0, 3).join(", ")}${entry.evidence_refs.length > 3 ? "..." : ""}`,
              25,
              yPos
            );
            yPos += 4;
            doc.setFontSize(10);
          }
          yPos += 2;
        });
      }
      
      // Generate PDF blob
      const pdfBlob = doc.output("blob");
      return pdfBlob;
    } catch (error) {
      // jsPDF not available - return structured text that can be converted to PDF
      // In production, use a PDF generation service or ensure jsPDF is installed
      logger.warn("jsPDF not available, returning text format", {
        error: error instanceof Error ? error.message : String(error),
      });
      return new Blob([content], { type: "text/plain" });
    }
  }

  async exportJSON(bundle: AuditBundle): Promise<string> {
    return JSON.stringify(bundle, null, 2);
  }
}
