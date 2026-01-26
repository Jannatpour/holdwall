/**
 * Signals API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { SignalIngestionService } from "@/lib/signals/ingestion";
import { IdempotencyService } from "@/lib/operations/idempotency";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const idempotencyService = new IdempotencyService();
const errorRecovery = new ErrorRecoveryService();
const ingestionService = new SignalIngestionService(
  evidenceVault,
  eventStore,
  idempotencyService,
  errorRecovery
);

const ingestSignalSchema = z.object({
  source: z.object({
    type: z.string(),
    id: z.string(),
    url: z.string().optional(),
  }),
  content: z.object({
    raw: z.string(),
    normalized: z.string().optional(),
    language: z.string().optional(),
    pii_redacted: z.boolean().optional(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  compliance: z.object({
    source_allowed: z.boolean(),
    collection_method: z.string(),
    retention_policy: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = ingestSignalSchema.parse(body);

    const signal = {
      tenant_id: (user as any).tenantId || "",
      source: validated.source,
      content: validated.content,
      metadata: validated.metadata || {},
      compliance: validated.compliance,
    };

    const connector = {
      name: "api",
      ingest: async () => [
        {
          signal_id: crypto.randomUUID(),
          tenant_id: signal.tenant_id,
          source: signal.source,
          content: signal.content,
          metadata: signal.metadata,
          compliance: signal.compliance,
          created_at: new Date().toISOString(),
        },
      ],
    };

    const evidence_id = await ingestionService.ingestSignal(signal, connector);

    return NextResponse.json({ evidence_id }, { status: 201 });
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
    logger.error("Error ingesting signal", {
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
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;

    // Extract filter parameters
    const source = searchParams.get("source");
    const severity = searchParams.get("severity");
    const language = searchParams.get("language");
    const timeframe = searchParams.get("timeframe") || "24h";
    const evidenceId = searchParams.get("evidence");
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 1000) // Clamp between 1 and 1000
      : 100;

    // Calculate time window
    const now = new Date();
    let timeWindow: Date;
    switch (timeframe) {
      case "1h":
        timeWindow = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "24h":
        timeWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeWindow = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Query evidence of type SIGNAL with filters
    const allSignals = await evidenceVault.query({
      tenant_id,
      type: "signal",
    });

    // Apply filters
    const filtered = allSignals.filter((signal: any) => {
      // Evidence ID filter (for fetching specific signal)
      if (evidenceId && signal.evidence_id !== evidenceId && signal.id !== evidenceId) {
        return false;
      }

      // Timeframe filter (skip if fetching specific evidence)
      if (!evidenceId) {
        const signalDate = new Date(signal.created_at || signal.collected_at || 0);
        if (signalDate < timeWindow) return false;
      }

      // Source filter
      if (source && source !== "all") {
        const signalSource = signal.source?.type || signal.sourceType || "";
        if (signalSource.toLowerCase() !== source.toLowerCase()) return false;
      }

      // Severity filter
      if (severity && severity !== "all") {
        const signalSeverity = signal.metadata?.severity || signal.severity || "";
        if (signalSeverity.toLowerCase() !== severity.toLowerCase()) return false;
      }

      // Language filter
      if (language && language !== "all") {
        const signalLanguage = signal.content?.language || signal.language || "en";
        if (signalLanguage.toLowerCase() !== language.toLowerCase()) return false;
      }

      return true;
    });

    // Sort by created_at descending and limit
    filtered.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || a.collected_at || 0).getTime();
      const dateB = new Date(b.created_at || b.collected_at || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json(filtered.slice(0, limit));
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching signals", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
