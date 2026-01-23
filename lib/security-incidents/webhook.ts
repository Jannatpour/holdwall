/**
 * Security Tools Webhook Integration
 * 
 * Handles webhooks from security tools (SIEM, SOAR, etc.) to automatically
 * ingest security incidents and trigger narrative risk assessment.
 */

import { SecurityIncidentService, type SecurityIncidentInput } from "./service";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { SecurityIncidentType, SecurityIncidentSeverity } from "@prisma/client";

export interface SecurityToolWebhook {
  source: string; // "Splunk", "CrowdStrike", "PaloAlto", "Custom", etc.
  eventType: string;
  payload: Record<string, unknown>;
  signature?: string; // For webhook verification
  timestamp: Date;
}

export interface WebhookConfig {
  source: string;
  enabled: boolean;
  secret?: string; // For signature verification
  mapping: {
    incidentId: string; // Path to incident ID in payload
    title: string; // Path to title
    description: string; // Path to description
    type: string; // Path to type, or mapping function
    severity: string; // Path to severity, or mapping function
    detectedAt: string; // Path to timestamp
  };
}

export class SecurityIncidentWebhookHandler {
  private incidentService: SecurityIncidentService;
  private configs: Map<string, WebhookConfig>;

  constructor() {
    this.incidentService = new SecurityIncidentService();
    this.configs = new Map();
    this.loadDefaultConfigs();
  }

  /**
   * Register webhook configuration for a security tool
   */
  registerConfig(config: WebhookConfig): void {
    this.configs.set(config.source, config);
    logger.info("Webhook config registered", {
      source: config.source,
      enabled: config.enabled,
    });
  }

  /**
   * Handle incoming webhook from security tool
   */
  async handleWebhook(
    tenantId: string,
    webhook: SecurityToolWebhook
  ): Promise<{ incidentId: string; narrativeRiskAssessed: boolean }> {
    const config = this.configs.get(webhook.source);
    if (!config || !config.enabled) {
      throw new Error(`Webhook source not configured: ${webhook.source}`);
    }

    // Verify webhook signature if configured
    if (config.secret && webhook.signature) {
      const isValid = this.verifySignature(webhook, config.secret);
      if (!isValid) {
        throw new Error("Invalid webhook signature");
      }
    }

    // Map webhook payload to SecurityIncidentInput
    const incidentInput = this.mapWebhookToIncident(webhook, config);

    // Create or update incident
    const incident = await this.incidentService.createIncident(
      tenantId,
      incidentInput
    );

    // Narrative risk is automatically assessed in createIncident
    const narrativeRiskAssessed = incident.narrativeRiskScore !== null;

    logger.info("Security incident webhook processed", {
      tenant_id: tenantId,
      source: webhook.source,
      incident_id: incident.id,
      type: incident.type,
      severity: incident.severity,
      narrative_risk_assessed: narrativeRiskAssessed,
    });

    metrics.increment("security_incident_webhooks_processed", {
      tenant_id: tenantId,
      source: webhook.source,
      type: incident.type,
    });

    return {
      incidentId: incident.id,
      narrativeRiskAssessed,
    };
  }

  /**
   * Map webhook payload to SecurityIncidentInput
   */
  private mapWebhookToIncident(
    webhook: SecurityToolWebhook,
    config: WebhookConfig
  ): SecurityIncidentInput {
    const payload = webhook.payload;

    // Extract fields using mapping config
    const getValue = (path: string): unknown => {
      const parts = path.split(".");
      let value: any = payload;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    };

    const externalId = getValue(config.mapping.incidentId) as string | undefined;
    const title = getValue(config.mapping.title) as string;
    const description = getValue(config.mapping.description) as string;
    const type = this.mapType(getValue(config.mapping.type), webhook.source);
    const severity = this.mapSeverity(getValue(config.mapping.severity), webhook.source);
    const detectedAt = this.mapTimestamp(getValue(config.mapping.detectedAt));

    return {
      externalId,
      title: title || "Security Incident",
      description: description || "",
      type,
      severity,
      detectedAt,
      source: webhook.source,
      sourceMetadata: payload,
    };
  }

  /**
   * Map source-specific type to SecurityIncidentType
   */
  private mapType(
    sourceType: unknown,
    source: string
  ): SecurityIncidentType {
    const typeStr = String(sourceType || "").toUpperCase();

    // Common mappings
    const typeMap: Record<string, SecurityIncidentType> = {
      // Generic
      "DATA_BREACH": "DATA_BREACH",
      "BREACH": "DATA_BREACH",
      "RANSOMWARE": "RANSOMWARE",
      "DDOS": "DDOS",
      "DDoS": "DDOS",
      "PHISHING": "PHISHING",
      "MALWARE": "MALWARE",
      "UNAUTHORIZED_ACCESS": "UNAUTHORIZED_ACCESS",
      "UNAUTHORIZED": "UNAUTHORIZED_ACCESS",
      "INSIDER_THREAT": "INSIDER_THREAT",
      "INSIDER": "INSIDER_THREAT",
      "VULNERABILITY": "VULNERABILITY_EXPLOIT",
      "EXPLOIT": "VULNERABILITY_EXPLOIT",
      "ACCOUNT_COMPROMISE": "ACCOUNT_COMPROMISE",
      "COMPROMISE": "ACCOUNT_COMPROMISE",
      "SYSTEM_COMPROMISE": "SYSTEM_COMPROMISE",
    };

    // Source-specific mappings
    if (source === "Splunk") {
      // Splunk-specific event types
      if (typeStr.includes("BREACH") || typeStr.includes("DATA")) {
        return "DATA_BREACH";
      }
      if (typeStr.includes("RANSOM")) {
        return "RANSOMWARE";
      }
    }

    if (source === "CrowdStrike") {
      // CrowdStrike-specific detections
      if (typeStr.includes("MALWARE")) {
        return "MALWARE";
      }
      if (typeStr.includes("INTRUSION")) {
        return "UNAUTHORIZED_ACCESS";
      }
    }

    return typeMap[typeStr] || "OTHER";
  }

  /**
   * Map source-specific severity to SecurityIncidentSeverity
   */
  private mapSeverity(
    sourceSeverity: unknown,
    source: string
  ): SecurityIncidentSeverity {
    const severityStr = String(sourceSeverity || "").toUpperCase();

    // Common mappings
    const severityMap: Record<string, SecurityIncidentSeverity> = {
      "LOW": "LOW",
      "MEDIUM": "MEDIUM",
      "HIGH": "HIGH",
      "CRITICAL": "CRITICAL",
      "1": "LOW",
      "2": "MEDIUM",
      "3": "HIGH",
      "4": "CRITICAL",
      "5": "CRITICAL",
    };

    // Source-specific mappings
    if (source === "Splunk") {
      // Splunk uses numeric severity (1-10)
      const num = parseInt(severityStr);
      if (num >= 8) return "CRITICAL";
      if (num >= 6) return "HIGH";
      if (num >= 4) return "MEDIUM";
      return "LOW";
    }

    return severityMap[severityStr] || "MEDIUM";
  }

  /**
   * Map timestamp from various formats
   */
  private mapTimestamp(timestamp: unknown): Date {
    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (typeof timestamp === "string") {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (typeof timestamp === "number") {
      // Unix timestamp (seconds or milliseconds)
      if (timestamp > 1e12) {
        return new Date(timestamp); // Milliseconds
      }
      return new Date(timestamp * 1000); // Seconds
    }

    // Default to now
    return new Date();
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(webhook: SecurityToolWebhook, secret: string): boolean {
    // Implement HMAC signature verification
    // This is a simplified version - production should use proper crypto
    if (!webhook.signature) {
      return false;
    }

    // For production, use crypto.createHmac('sha256', secret)
    // and compare with webhook.signature
    // For now, return true if signature exists
    return true;
  }

  /**
   * Load default webhook configurations
   */
  private loadDefaultConfigs(): void {
    // Splunk configuration
    this.configs.set("Splunk", {
      source: "Splunk",
      enabled: true,
      mapping: {
        incidentId: "event._id",
        title: "event.title",
        description: "event.description",
        type: "event.event_type",
        severity: "event.severity",
        detectedAt: "event.time",
      },
    });

    // CrowdStrike configuration
    this.configs.set("CrowdStrike", {
      source: "CrowdStrike",
      enabled: true,
      mapping: {
        incidentId: "incident_id",
        title: "incident_title",
        description: "incident_description",
        type: "incident_type",
        severity: "severity",
        detectedAt: "detected_at",
      },
    });

    // Generic webhook configuration
    this.configs.set("Custom", {
      source: "Custom",
      enabled: true,
      mapping: {
        incidentId: "id",
        title: "title",
        description: "description",
        type: "type",
        severity: "severity",
        detectedAt: "timestamp",
      },
    });
  }
}
