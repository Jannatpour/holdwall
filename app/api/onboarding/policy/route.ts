import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { financialServicesMode, EscalationRule } from "@/lib/financial-services/operating-mode";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const { sku, risk_policy, decisive_negatives } = body;

    logger.info("Onboarding: Policy saved", { tenant_id, sku });

    // If SKU B (Narrative Risk Early Warning), enable Financial Services mode
    if (sku === "B" || sku === "b") {
      // Parse risk policy into escalation rules
      const escalationRules = parseRiskPolicyToEscalationRules(risk_policy, decisive_negatives);

      // Enable Financial Services mode with parsed escalation rules
      await financialServicesMode.enable(tenant_id, {
        governanceLevel: "financial",
        legalApprovalRequired: true,
        evidenceThreshold: 0.7,
        conservativePublishing: true,
        regulatoryTracking: true,
        escalationRules,
      });

      logger.info("Financial Services mode enabled for SKU B", {
        tenant_id,
        rules_count: escalationRules.length,
      });
    }

    // If SKU D (Security Incident Narrative Management), enable security incident features
    if (sku === "D" || sku === "d") {
      // Enable security incident webhook integration
      // This would configure default webhook endpoints
      logger.info("Security Incident Narrative Management enabled for SKU D", {
        tenant_id,
      });
    }

    // Save policy to Policy table (if it exists) or tenant settings
    const tenant = await db.tenant.findUnique({
      where: { id: tenant_id },
    });

    if (tenant) {
      const currentSettings = (tenant.settings || {}) as any;
      await db.tenant.update({
        where: { id: tenant_id },
        data: {
          settings: {
            ...currentSettings,
            onboarding: {
              sku,
              risk_policy,
              decisive_negatives,
              completed_at: new Date().toISOString(),
            },
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Onboarding: Failed to save policy", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to save policy" },
      { status: 500 }
    );
  }
}

/**
 * Parse risk policy text into structured escalation rules
 */
function parseRiskPolicyToEscalationRules(
  riskPolicy: string,
  decisiveNegatives: string
): EscalationRule[] {
  const rules: EscalationRule[] = [];
  const lines = riskPolicy.split("\n").filter((line) => line.trim());

  // Parse each policy line
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: "If claim includes 'X' + condition → Action"
    const ifMatch = trimmed.match(/if\s+claim\s+includes\s+["']([^"']+)["']/i);
    const referencesMatch = trimmed.match(/if\s+claim\s+references\s+["']([^"']+)["']/i);
    const mentionsMatch = trimmed.match(/if\s+claim\s+mentions\s+["']([^"']+)["']/i);
    const indicatesMatch = trimmed.match(/if\s+claim\s+indicates\s+["']([^"']+)["']/i);

    let condition = "";
    let severity: "high" | "medium" | "low" = "medium";
    let routeTo: string[] = [];
    let autoDowngrade: string | undefined;

    if (ifMatch) {
      const keyword = ifMatch[1].toLowerCase();
      condition = `claim includes '${keyword}'`;

      // Determine severity and routing based on keyword
      if (keyword.includes("fraud") || keyword.includes("scam")) {
        severity = "high";
        routeTo = ["Risk", "Legal"];
        if (trimmed.includes("rising velocity")) {
          condition += " + rising velocity";
        }
      } else if (keyword.includes("regulator")) {
        severity = "high";
        routeTo = ["Legal", "Executive"];
        condition = `claim references 'regulator'`;
      } else if (keyword.includes("data breach") || keyword.includes("breach")) {
        severity = "high";
        routeTo = ["Security", "Legal"];
        condition = `claim mentions 'data breach'`;
      } else if (keyword.includes("resolved")) {
        severity = "low";
        routeTo = [];
        autoDowngrade = "downgrade";
        condition = `claim indicates 'already resolved'`;
      }
    } else if (referencesMatch) {
      const keyword = referencesMatch[1].toLowerCase();
      condition = `claim references '${keyword}'`;
      if (keyword.includes("regulator")) {
        severity = "high";
        routeTo = ["Legal", "Executive"];
      }
    } else if (mentionsMatch) {
      const keyword = mentionsMatch[1].toLowerCase();
      condition = `claim mentions '${keyword}'`;
      if (keyword.includes("breach")) {
        severity = "high";
        routeTo = ["Security", "Legal"];
      }
    } else if (indicatesMatch) {
      const keyword = indicatesMatch[1].toLowerCase();
      condition = `claim indicates '${keyword}'`;
      if (keyword.includes("resolved")) {
        severity = "low";
        autoDowngrade = "downgrade";
      }
    } else if (trimmed.includes("Outbreak probability")) {
      // Outbreak probability rule
      const probMatch = trimmed.match(/Outbreak\s+probability\s+>\s+([\d.]+)/i);
      if (probMatch) {
        condition = `outbreak probability > ${probMatch[1]}`;
        severity = "high";
        routeTo = ["Risk", "Trust & Safety"];
      }
    } else if (trimmed.includes("Anomaly detected")) {
      condition = "anomaly detected";
      severity = "medium";
      routeTo = ["Risk"];
    } else if (trimmed.includes("Drift")) {
      const driftMatch = trimmed.match(/Drift\s+>\s+([\d.]+)σ/i);
      if (driftMatch) {
        condition = `drift > ${driftMatch[1]}σ`;
        severity = "high";
        routeTo = ["Trust & Safety"];
      }
    }

    if (condition) {
      rules.push({
        id: `rule-${rules.length + 1}-${Date.now()}`,
        name: condition,
        condition,
        severity,
        routeTo,
        autoDowngrade,
        enabled: true,
      });
    }
  }

  // Parse decisive negatives into high-severity rules
  const negativeLines = decisiveNegatives.split("\n").filter((line) => line.trim());
  for (const line of negativeLines) {
    const trimmed = line.replace(/^-\s*/, "").trim();
    if (!trimmed) continue;

    let condition = "";
    let severity: "high" | "medium" | "low" = "high";
    let routeTo: string[] = ["Risk", "Legal"];

    if (trimmed.includes("fraud") || trimmed.includes("illegal")) {
      condition = `claim includes 'fraud' or 'illegal activity'`;
    } else if (trimmed.includes("breach") || trimmed.includes("security")) {
      condition = `claim includes 'data breach' or 'security incident'`;
      routeTo = ["Security", "Legal"];
    } else if (trimmed.includes("regulatory") || trimmed.includes("violation")) {
      condition = `claim includes 'regulatory violation'`;
      routeTo = ["Legal", "Compliance"];
    } else if (trimmed.includes("velocity")) {
      const velMatch = trimmed.match(/(\d+)\s+mentions\/hour/i);
      if (velMatch) {
        condition = `narrative velocity > ${velMatch[1]} mentions/hour`;
        routeTo = ["Risk", "Trust & Safety"];
      }
    } else if (trimmed.includes("Outbreak probability")) {
      const probMatch = trimmed.match(/Outbreak\s+probability\s+>\s+([\d.]+)/i);
      if (probMatch) {
        condition = `outbreak probability > ${probMatch[1]}`;
        routeTo = ["Risk", "Executive"];
      }
    } else if (trimmed.includes("Coordinated attack")) {
      condition = "coordinated attack pattern detected";
      routeTo = ["Security", "Risk", "Legal"];
    }

    if (condition) {
      rules.push({
        id: `decisive-negative-${rules.length + 1}-${Date.now()}`,
        name: `Decisive Negative: ${trimmed.substring(0, 50)}`,
        condition,
        severity,
        routeTo,
        enabled: true,
      });
    }
  }

  return rules;
}
