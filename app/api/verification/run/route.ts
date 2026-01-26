/**
 * Verification API
 * Run end-to-end flow verifications
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { EndToEndVerifier } from "@/lib/verification/end-to-end-verifier";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import {
  PROMISE_REGISTRY,
  getPromisesBySKU,
  getCompliancePromises,
  getPromiseById,
} from "@/lib/verification/promise-registry";

const verifier = new EndToEndVerifier();

const verifySchema = z.object({
  tenantId: z.string().optional(),
  flow: z.enum(["all", "signal", "claim", "artifact", "sku-a", "sku-b", "sku-c", "sku-d", "compliance", "tenant-isolation"]).optional(),
  promiseId: z.string().optional(), // Verify specific promise by ID
  sku: z.enum(["A", "B", "C", "D"]).optional(), // Verify all promises for a SKU
});

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const xri = request.headers.get("x-real-ip")?.trim();
  return xff || xri || "unknown";
}

async function resolveCanaryTenantId(): Promise<string> {
  const explicitId = process.env.CANARY_TENANT_ID?.trim();
  if (explicitId) {
    await ensureCanaryBaseline(explicitId).catch(() => undefined);
    return explicitId;
  }

  const slug = (process.env.CANARY_TENANT_SLUG || "canary").trim();
  if (!slug) return "";

  const { db } = await import("@/lib/db/client");
  const existing = await db.tenant.findFirst({ where: { slug } });
  if (existing?.id) {
    await ensureCanaryBaseline(existing.id).catch(() => undefined);
    return existing.id;
  }

  const created = await db.tenant.create({
    data: {
      name: "Canary Tenant",
      slug,
    },
  });
  await ensureCanaryBaseline(created.id).catch(() => undefined);
  return created.id;
}

async function ensureCanaryBaseline(tenantId: string) {
  const { db } = await import("@/lib/db/client");

  // Baseline source policies so signal ingestion validation can run end-to-end.
  // Empty `allowedSources` means "allow all sources of this type".
  const sourceTypes = ["api", "reddit", "twitter", "zendesk", "github", "rss", "webhook", "s3"];
  for (const sourceType of sourceTypes) {
    await db.sourcePolicy.upsert({
      where: {
        tenantId_sourceType: {
          tenantId,
          sourceType,
        },
      },
      update: {},
      create: {
        tenantId,
        sourceType,
        allowedSources: [],
        collectionMethod: "API",
        retentionDays: 365,
        autoDelete: false,
        complianceFlags: [],
      },
    });
  }
}

async function getCanaryContext(request: NextRequest, validated: z.infer<typeof verifySchema>) {
  if (process.env.NODE_ENV !== "production") return { allowed: false as const, reason: "not production" };

  const canaryToken = request.headers.get("x-canary-token");
  const expected = process.env.CANARY_TOKEN?.trim();
  if (!expected || !canaryToken || canaryToken !== expected) {
    return { allowed: false as const, reason: "invalid token" };
  }

  const allowlist = (process.env.CANARY_IP_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = getClientIp(request);
  if (allowlist.length > 0 && !allowlist.includes(ip)) {
    return { allowed: false as const, reason: "ip not allowed" };
  }

  // Restrict canary bypass to SKU flows only (no compliance / tenant isolation / promise-level introspection).
  const flow = validated.flow || "all";
  const allowedFlows = new Set(["sku-a", "sku-b", "sku-c", "sku-d"]);
  if (!allowedFlows.has(flow)) {
    return { allowed: false as const, reason: "flow not allowed" };
  }
  if (validated.promiseId || validated.sku) {
    return { allowed: false as const, reason: "promiseId/sku not allowed" };
  }

  const canaryTenantId = await resolveCanaryTenantId().catch(() => "");
  if (!canaryTenantId) {
    return { allowed: false as const, reason: "missing CANARY_TENANT_ID/CANARY_TENANT_SLUG" };
  }

  // Enforce tenant scoping strictly to the resolved canary tenant.
  if (validated.tenantId && validated.tenantId !== canaryTenantId) {
    return { allowed: false as const, reason: "tenantId mismatch" };
  }

  return { allowed: true as const, tenantId: canaryTenantId, ip };
}

export async function POST(request: NextRequest) {
  try {
    const verifyToken = request.headers.get("x-verify-token");
    const allowTokenBypass =
      process.env.NODE_ENV !== "production" &&
      !!process.env.VERIFY_TOKEN &&
      verifyToken === process.env.VERIFY_TOKEN;

    const body = await request.json();
    const validated = verifySchema.parse(body);

    const canary = await getCanaryContext(request, validated);
    const user = (allowTokenBypass || canary.allowed) ? null : await requireAuth();
    const tenantId = user ? (user as any).tenantId || "" : "";

    const targetTenantId = canary.allowed ? canary.tenantId : (validated.tenantId || tenantId);
    if (!targetTenantId) {
      return NextResponse.json(
        {
          error: "Missing tenantId",
          message:
            "Provide tenantId in the request body, or authenticate, or set VERIFY_TOKEN and send x-verify-token in development.",
        },
        { status: 400 }
      );
    }
    const flow = validated.flow || "all";
    const promiseId = validated.promiseId;
    const sku = validated.sku;

    let results: any[] = [];

    // If specific promise ID provided, verify that promise
    if (promiseId) {
      const promise = getPromiseById(promiseId);
      if (!promise) {
        return NextResponse.json(
          { error: "Promise not found", message: `Promise ID "${promiseId}" not found in registry` },
          { status: 400 }
        );
      }

      // Map promise to verifier method
      const verifierMethod = promise.verification_method.api_verifier;
      if (verifierMethod && typeof (verifier as any)[verifierMethod] === "function") {
        try {
          // Get userId if available for compliance checks
          const userId = user ? (user as any).id : undefined;
          
          if (promiseId.startsWith("compliance-gdpr-") && userId) {
            results = [await (verifier as any)[verifierMethod](targetTenantId, userId)];
          } else if (promiseId === "tenant-isolation") {
            // For tenant isolation, we need two tenants
            const { db } = await import("@/lib/db/client");
            const tenants = await db.tenant.findMany({ take: 2 });
            if (tenants.length >= 2) {
              results = [await verifier.verifyTenantIsolation(tenants[0].id, tenants[1].id)];
            } else {
              return NextResponse.json(
                { error: "Insufficient tenants", message: "Tenant isolation check requires at least 2 tenants" },
                { status: 400 }
              );
            }
          } else {
            results = [await (verifier as any)[verifierMethod](targetTenantId)];
          }
        } catch (error) {
          logger.error("Promise verification failed", {
            promiseId,
            error: error instanceof Error ? error.message : String(error),
          });
          return NextResponse.json(
            { error: "Verification failed", message: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Verification method not implemented", message: `Verifier method "${verifierMethod}" not found` },
          { status: 400 }
        );
      }
    }
    // If SKU provided, verify all promises for that SKU
    else if (sku) {
      const skuPromises = getPromisesBySKU(sku);
      for (const promise of skuPromises) {
        const verifierMethod = promise.verification_method.api_verifier;
        if (verifierMethod && typeof (verifier as any)[verifierMethod] === "function") {
          try {
            const userId = user ? (user as any).id : undefined;
            if (promise.id.startsWith("compliance-gdpr-") && userId) {
              results.push(await (verifier as any)[verifierMethod](targetTenantId, userId));
            } else {
              results.push(await (verifier as any)[verifierMethod](targetTenantId));
            }
          } catch (error) {
            logger.warn("SKU promise verification failed", {
              promiseId: promise.id,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue with other promises
          }
        }
      }
    }
    // Legacy flow-based verification
    else if (flow === "all") {
      results = await verifier.verifyAllFlows(targetTenantId);
    } else if (flow === "signal") {
      results = [await verifier.verifySignalIngestionFlow(targetTenantId)];
    } else if (flow === "claim") {
      // Need evidence ID for claim verification
      const evidenceVault = new (await import("@/lib/evidence/vault-db")).DatabaseEvidenceVault();
      const testEvidence = await evidenceVault.query({
        tenant_id: targetTenantId,
        type: "signal",
      });
      
      if (testEvidence.length > 0) {
        results = [await verifier.verifyClaimExtractionFlow(targetTenantId, testEvidence[0].evidence_id)];
      } else {
        return NextResponse.json({
          error: "No evidence found for claim verification",
          message: "Please ingest at least one signal before verifying claim extraction flow",
        }, { status: 400 });
      }
    } else if (flow === "artifact") {
      // Need evidence IDs for artifact verification
      const evidenceVault = new (await import("@/lib/evidence/vault-db")).DatabaseEvidenceVault();
      const testEvidence = await evidenceVault.query({
        tenant_id: targetTenantId,
        type: "signal",
      });
      
      if (testEvidence.length > 0) {
        results = [await verifier.verifyArtifactCreationFlow(
          targetTenantId,
          testEvidence.slice(0, 3).map(e => e.evidence_id)
        )];
      } else {
        return NextResponse.json({
          error: "No evidence found for artifact verification",
          message: "Please ingest at least one signal before verifying artifact creation flow",
        }, { status: 400 });
      }
    } else if (flow === "sku-a") {
      results = [
        await verifier.verifyAIAnswerMonitoring(targetTenantId),
        await verifier.verifyAAALArtifactCreation(targetTenantId),
        await verifier.verifyPADLPublishing(targetTenantId),
      ];
    } else if (flow === "sku-b") {
      const evidenceVault = new (await import("@/lib/evidence/vault-db")).DatabaseEvidenceVault();
      const testEvidence = await evidenceVault.query({
        tenant_id: targetTenantId,
        type: "signal",
      });
      
      results = [await verifier.verifySignalIngestionFlow(targetTenantId)];
      
      if (testEvidence.length > 0) {
        results.push(await verifier.verifyClaimExtractionFlow(targetTenantId, testEvidence[0].evidence_id));
      }
      
      results.push(
        await verifier.verifyForecastGeneration(targetTenantId),
        await verifier.verifyPlaybookExecution(targetTenantId)
      );
    } else if (flow === "sku-c") {
      results = [
        await verifier.verifyEvidenceVault(targetTenantId),
        await verifier.verifyCaseCreation(targetTenantId),
        await verifier.verifyAuditBundleExport(targetTenantId),
        await verifier.verifyAccessLogging(targetTenantId),
      ];
    } else if (flow === "sku-d") {
      results = [
        await verifier.verifySecurityIncidentIngestion(targetTenantId),
        await verifier.verifyNarrativeRiskAssessment(targetTenantId),
        await verifier.verifyIncidentExplanation(targetTenantId),
      ];
    } else if (flow === "compliance") {
      const userId = user ? (user as any).id : undefined;
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required", message: "Compliance verification requires authenticated user" },
          { status: 401 }
        );
      }
      
      results = [
        await verifier.verifyGDPRAccess(targetTenantId, userId),
        await verifier.verifyGDPRExport(targetTenantId, userId),
        await verifier.verifyGDPRDeletion(targetTenantId, userId),
        await verifier.verifyAuditBundleIntegrity(targetTenantId),
        await verifier.verifyAccessLogging(targetTenantId),
      ];
    } else if (flow === "tenant-isolation") {
      const { db } = await import("@/lib/db/client");
      const tenants = await db.tenant.findMany({ take: 2 });
      if (tenants.length >= 2) {
        results = [await verifier.verifyTenantIsolation(tenants[0].id, tenants[1].id)];
      } else {
        return NextResponse.json(
          { error: "Insufficient tenants", message: "Tenant isolation check requires at least 2 tenants" },
          { status: 400 }
        );
      }
    }

    const report = verifier.generateReport(results);

    return NextResponse.json({
      success: true,
      results,
      report,
      summary: {
        total: results.length,
        passed: results.filter(r => r.overallStatus === "pass").length,
        failed: results.filter(r => r.overallStatus === "fail").length,
        warnings: results.filter(r => r.overallStatus === "warning").length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error running verification", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    return NextResponse.json({
      availableFlows: [
        {
          id: "all",
          name: "All Flows",
          description: "Verify all critical business flows",
        },
        {
          id: "signal",
          name: "Signal Ingestion Flow",
          description: "Verify signal ingestion with validation, idempotency, and error recovery",
        },
        {
          id: "claim",
          name: "Claim Extraction Flow",
          description: "Verify claim extraction from evidence",
        },
        {
          id: "artifact",
          name: "Artifact Creation Flow",
          description: "Verify artifact creation with evidence references and transaction management",
        },
        {
          id: "sku-a",
          name: "SKU A: AI Answer Monitoring & Authority",
          description: "Verify all SKU A promises (monitoring, AAAL, PADL)",
        },
        {
          id: "sku-b",
          name: "SKU B: Narrative Risk Early Warning",
          description: "Verify all SKU B promises (signals, claims, forecasts, playbooks)",
        },
        {
          id: "sku-c",
          name: "SKU C: Evidence-Backed Intake & Case Triage",
          description: "Verify all SKU C promises (evidence vault, cases, audit bundles)",
        },
        {
          id: "sku-d",
          name: "SKU D: Security Incident Narrative Management",
          description: "Verify all SKU D promises (incident ingestion, risk assessment, explanations)",
        },
        {
          id: "compliance",
          name: "Compliance & Regulatory",
          description: "Verify GDPR and SOC2 compliance promises",
        },
        {
          id: "tenant-isolation",
          name: "Tenant Isolation",
          description: "Verify multi-tenant data isolation",
        },
      ],
      promises: PROMISE_REGISTRY.map((p) => ({
        id: p.id,
        promise: p.promise,
        sku: p.sku,
        tags: p.tags,
      })),
      usage: {
        method: "POST",
        endpoint: "/api/verification/run",
        body: {
          flow: "all | signal | claim | artifact | sku-a | sku-b | sku-c | sku-d | compliance | tenant-isolation",
          promiseId: "optional - verify specific promise by ID from registry",
          sku: "optional - verify all promises for SKU (A, B, C, D)",
          tenantId: "optional - defaults to authenticated user's tenant",
        },
      },
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
