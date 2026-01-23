/**
 * Security Incident Playbooks
 * 
 * Pre-built playbooks for common security incident scenarios
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { SecurityIncidentService } from "./service";
import type { SecurityIncidentType, SecurityIncidentSeverity } from "@prisma/client";

export interface SecurityIncidentPlaybook {
  id: string;
  name: string;
  description: string;
  incidentTypes: SecurityIncidentType[];
  severityLevels: SecurityIncidentSeverity[];
  template: {
    type: "security_incident_response";
    steps: Array<{
      step: string;
      action: string;
    }>;
  };
  recommendedAutopilotMode: "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH";
}

export class SecurityIncidentPlaybookService {
  private incidentService: SecurityIncidentService;

  constructor() {
    this.incidentService = new SecurityIncidentService();
  }

  /**
   * Get default playbooks for security incidents
   */
  getDefaultPlaybooks(): SecurityIncidentPlaybook[] {
    return [
      {
        id: "data-breach-response",
        name: "Data Breach Response",
        description: "Comprehensive response workflow for data breach incidents",
        incidentTypes: ["DATA_BREACH"],
        severityLevels: ["HIGH", "CRITICAL"],
        template: {
          type: "security_incident_response",
          steps: [
            {
              step: "assess_risk",
              action: "Assess narrative risk and outbreak probability",
            },
            {
              step: "generate_explanation",
              action: "Generate evidence-backed explanation with root cause, resolution, and prevention",
            },
            {
              step: "route_approvals",
              action: "Route to Legal, Compliance, and Executive for approval",
            },
            {
              step: "publish",
              action: "Publish to trust center and monitor AI citations",
            },
          ],
        },
        recommendedAutopilotMode: "AUTO_ROUTE",
      },
      {
        id: "ransomware-response",
        name: "Ransomware Response",
        description: "Response workflow for ransomware attacks",
        incidentTypes: ["RANSOMWARE"],
        severityLevels: ["HIGH", "CRITICAL"],
        template: {
          type: "security_incident_response",
          steps: [
            {
              step: "assess_risk",
              action: "Assess narrative risk - ransomware incidents have high narrative impact",
            },
            {
              step: "generate_explanation",
              action: "Generate transparent explanation focusing on containment and recovery",
            },
            {
              step: "route_approvals",
              action: "Route to Security, Legal, and Executive for approval",
            },
            {
              step: "publish",
              action: "Publish authoritative explanation to prevent speculation",
            },
          ],
        },
        recommendedAutopilotMode: "AUTO_ROUTE",
      },
      {
        id: "ddos-response",
        name: "DDoS Attack Response",
        description: "Response workflow for DDoS attacks",
        incidentTypes: ["DDOS"],
        severityLevels: ["MEDIUM", "HIGH", "CRITICAL"],
        template: {
          type: "security_incident_response",
          steps: [
            {
              step: "assess_risk",
              action: "Assess narrative risk - service availability concerns",
            },
            {
              step: "generate_explanation",
              action: "Generate explanation with timeline and mitigation steps",
            },
            {
              step: "route_approvals",
              action: "Route to Operations and Comms for approval",
            },
            {
              step: "publish",
              action: "Publish status update and resolution timeline",
            },
          ],
        },
        recommendedAutopilotMode: "AUTO_DRAFT",
      },
      {
        id: "phishing-response",
        name: "Phishing Campaign Response",
        description: "Response workflow for phishing attacks",
        incidentTypes: ["PHISHING"],
        severityLevels: ["MEDIUM", "HIGH"],
        template: {
          type: "security_incident_response",
          steps: [
            {
              step: "assess_risk",
              action: "Assess narrative risk - customer trust concerns",
            },
            {
              step: "generate_explanation",
              action: "Generate educational explanation with prevention guidance",
            },
            {
              step: "route_approvals",
              action: "Route to Security and Comms for approval",
            },
            {
              step: "publish",
              action: "Publish customer communication and prevention tips",
            },
          ],
        },
        recommendedAutopilotMode: "AUTO_DRAFT",
      },
      {
        id: "unauthorized-access-response",
        name: "Unauthorized Access Response",
        description: "Response workflow for unauthorized access incidents",
        incidentTypes: ["UNAUTHORIZED_ACCESS"],
        severityLevels: ["HIGH", "CRITICAL"],
        template: {
          type: "security_incident_response",
          steps: [
            {
              step: "assess_risk",
              action: "Assess narrative risk - security posture concerns",
            },
            {
              step: "generate_explanation",
              action: "Generate explanation with access details and containment",
            },
            {
              step: "route_approvals",
              action: "Route to Security, Legal, and Executive for approval",
            },
            {
              step: "publish",
              action: "Publish transparent explanation with security measures",
            },
          ],
        },
        recommendedAutopilotMode: "AUTO_ROUTE",
      },
    ];
  }

  /**
   * Create playbook for tenant
   */
  async createPlaybook(
    tenantId: string,
    playbook: Omit<SecurityIncidentPlaybook, "id">
  ): Promise<string> {
    const created = await db.playbook.create({
      data: {
        tenantId,
        name: playbook.name,
        description: playbook.description,
        template: playbook.template as any,
        autopilotMode: playbook.recommendedAutopilotMode,
      },
    });

    logger.info("Security incident playbook created", {
      tenant_id: tenantId,
      playbook_id: created.id,
      name: playbook.name,
    });

    return created.id;
  }

  /**
   * Get playbooks for tenant
   */
  async getPlaybooks(tenantId: string): Promise<SecurityIncidentPlaybook[]> {
    const playbooks = await db.playbook.findMany({
      where: {
        tenantId,
        template: {
          path: ["type"],
          equals: "security_incident_response",
        },
      },
    });

    return playbooks.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      incidentTypes: [], // Would be stored in metadata
      severityLevels: [], // Would be stored in metadata
      template: p.template as any,
      recommendedAutopilotMode: p.autopilotMode as any,
    }));
  }

  /**
   * Initialize default playbooks for tenant
   */
  async initializeDefaultPlaybooks(tenantId: string): Promise<string[]> {
    const defaultPlaybooks = this.getDefaultPlaybooks();
    const createdIds: string[] = [];

    for (const playbook of defaultPlaybooks) {
      const id = await this.createPlaybook(tenantId, playbook);
      createdIds.push(id);
    }

    logger.info("Default security incident playbooks initialized", {
      tenant_id: tenantId,
      count: createdIds.length,
    });

    return createdIds;
  }
}
