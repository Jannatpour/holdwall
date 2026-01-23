/**
 * Case-Specific Translations Service
 * 
 * Provides case-related translations and integrates with main i18n system.
 */

import { t, type Locale } from "@/lib/i18n/config";

export class CaseTranslations {
  /**
   * Get case type label
   */
  static getCaseTypeLabel(type: string, locale: Locale = "en"): string {
    const key = `cases.${type.toLowerCase().replace(/_/g, "")}`;
    const translation = t(key, locale);
    if (translation === key) {
      // Fallback to English labels
      const labels: Record<string, string> = {
        dispute: "Payment Dispute / Chargeback",
        fraud_ato: "Fraud / Account Takeover",
        outage_delay: "Transaction Delay / Outage",
        complaint: "Complaint / Other",
      };
      return labels[type.toLowerCase().replace(/_/g, "")] || type;
    }
    return translation;
  }

  /**
   * Get case status label
   */
  static getCaseStatusLabel(status: string, locale: Locale = "en"): string {
    return status.replace(/_/g, " ");
  }

  /**
   * Get case severity label
   */
  static getCaseSeverityLabel(severity: string, locale: Locale = "en"): string {
    return severity;
  }

  /**
   * Translate case notification email
   */
  static translateNotification(
    type: "created" | "triaged" | "status_update" | "resolution_ready",
    locale: Locale = "en"
  ): { subject: string; message: string } {
    const baseKey = `cases.notifications.${type}`;
    return {
      subject: t(`${baseKey}.subject`, locale),
      message: t(`${baseKey}.message`, locale),
    };
  }
}
