/**
 * AI Orchestration API
 * RAG + KAG + LLM orchestration endpoint with advanced AI capabilities
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { CompositeOrchestrator } from "@/lib/ai/composite-orchestrator";
import { GraphRAG } from "@/lib/ai/graphrag";
import { K2Reasoning } from "@/lib/ai/k2-reasoning";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import { randomUUID } from "crypto";

const orchestrateSchema = z.object({
  query: z.string().min(1),
  use_rag: z.boolean().optional(),
  use_kag: z.boolean().optional(),
  use_graphrag: z.boolean().optional(),
  use_composite: z.boolean().optional(),
  use_k2: z.boolean().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  maxResults: z.number().int().positive().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  maxSteps: z.number().int().positive().optional(),
  requireVerification: z.boolean().optional(),
});

function okEnvelope(input: {
  trace_id: string;
  method: string;
  answer: string;
  sources: any[];
  confidence: number;
  raw?: unknown;
}) {
  return {
    trace_id: input.trace_id,
    method: input.method,
    answer: input.answer,
    sources: input.sources,
    confidence: input.confidence,
    raw: input.raw,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const sp = request.nextUrl.searchParams;
    const trace_id = randomUUID();
    const parsed = orchestrateSchema.parse({
      query: sp.get("query") || "",
      use_rag: sp.get("use_rag") === "true" ? true : undefined,
      use_kag: sp.get("use_kag") === "true" ? true : undefined,
      use_graphrag: sp.get("use_graphrag") === "true" ? true : undefined,
      use_composite: sp.get("use_composite") === "true" ? true : undefined,
      use_k2: sp.get("use_k2") === "true" ? true : undefined,
      model: sp.get("model") || undefined,
      temperature: sp.get("temperature") ? Number(sp.get("temperature")) : undefined,
      max_tokens: sp.get("max_tokens") ? Number(sp.get("max_tokens")) : undefined,
      maxResults: sp.get("maxResults") ? Number(sp.get("maxResults")) : undefined,
      minConfidence: sp.get("minConfidence") ? Number(sp.get("minConfidence")) : undefined,
      maxSteps: sp.get("maxSteps") ? Number(sp.get("maxSteps")) : undefined,
      requireVerification: sp.get("requireVerification") === "true" ? true : undefined,
    });

    const evidenceVault = new DatabaseEvidenceVault();
    const orchestrator = new AIOrchestrator(evidenceVault);
    const compositeOrchestrator = new CompositeOrchestrator();
    const graphRAG = new GraphRAG();
    const k2Reasoning = new K2Reasoning();

    // Mirror POST logic for GET requests.
    if (parsed.use_graphrag) {
      const evidence = await evidenceVault.search(parsed.query, tenant_id, { limit: 10 });
      await graphRAG.buildKnowledgeGraph(evidence);
      const result = await graphRAG.query(parsed.query, {
        maxResults: parsed.maxResults ?? 5,
        minConfidence: parsed.minConfidence ?? 0.7,
      });
      return NextResponse.json(
        okEnvelope({
          trace_id,
          method: "graphrag",
          answer: result.answer,
          sources: result.sources || [],
          confidence: typeof result.confidence === "number" ? result.confidence : 0.7,
          raw: result,
        })
      );
    }

    if (parsed.use_composite) {
      const result = await compositeOrchestrator.execute({
        id: trace_id,
        type: "reasoning",
        input: parsed.query,
        context: { tenantId: tenant_id, model: parsed.model, temperature: parsed.temperature },
      });
      return NextResponse.json(
        okEnvelope({
          trace_id,
          method: "composite",
          answer: (result as any).answer || (result as any).result || "",
          sources: [],
          confidence: typeof (result as any).confidence === "number" ? (result as any).confidence : 0.6,
          raw: result,
        })
      );
    }

    if (parsed.use_k2) {
      const result = await k2Reasoning.reason(parsed.query, {
        maxSteps: parsed.maxSteps ?? 10,
        requireVerification: parsed.requireVerification ?? true,
      });
      return NextResponse.json(
        okEnvelope({
          trace_id,
          method: "k2",
          answer: (result as any).answer || (result as any).conclusion || "",
          sources: [],
          confidence: typeof (result as any).confidence === "number" ? (result as any).confidence : 0.6,
          raw: result,
        })
      );
    }

    const response = await orchestrator.orchestrate({ ...parsed, tenant_id });
    return NextResponse.json(
      okEnvelope({
        trace_id,
        method: "orchestrator",
        answer: (response as any).answer || "",
        sources: (response as any).sources || (response as any).citations || [],
        confidence: typeof (response as any).confidence === "number" ? (response as any).confidence : 0.6,
        raw: response,
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error orchestrating AI", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const trace_id = randomUUID();
    const body = await request.json();
    const validated = orchestrateSchema.parse(body);

    const evidenceVault = new DatabaseEvidenceVault();
    const orchestrator = new AIOrchestrator(evidenceVault);
    const compositeOrchestrator = new CompositeOrchestrator();
    const graphRAG = new GraphRAG();
    const k2Reasoning = new K2Reasoning();

    // Use advanced AI capabilities if requested
    if (validated.use_graphrag) {
      // Get evidence for GraphRAG
      const evidence = await evidenceVault.search(validated.query, tenant_id, { limit: 10 });
      await graphRAG.buildKnowledgeGraph(evidence);
      const result = await graphRAG.query(validated.query, { 
        maxResults: validated.maxResults ?? 5,
        minConfidence: validated.minConfidence ?? 0.7
      });
      return NextResponse.json(
        okEnvelope({
          trace_id,
          method: "graphrag",
          answer: result.answer,
          sources: result.sources || [],
          confidence: typeof result.confidence === "number" ? result.confidence : 0.7,
          raw: result,
        })
      );
    }

    if (validated.use_composite) {
      const result = await compositeOrchestrator.execute({
        id: trace_id,
        type: "reasoning",
        input: validated.query,
        context: {
          tenantId: tenant_id,
          model: validated.model,
          temperature: validated.temperature,
        },
      });
      return NextResponse.json(
        okEnvelope({
          trace_id,
          method: "composite",
          answer: (result as any).answer || (result as any).result || "",
          sources: [],
          confidence: typeof (result as any).confidence === "number" ? (result as any).confidence : 0.6,
          raw: result,
        })
      );
    }

    if (validated.use_k2) {
      const result = await k2Reasoning.reason(validated.query, {
        maxSteps: validated.maxSteps ?? 10,
        requireVerification: validated.requireVerification ?? true,
      });
      return NextResponse.json(
        okEnvelope({
          trace_id,
          method: "k2",
          answer: (result as any).answer || (result as any).conclusion || "",
          sources: [],
          confidence: typeof (result as any).confidence === "number" ? (result as any).confidence : 0.6,
          raw: result,
        })
      );
    }

    // Default orchestration
    const response = await orchestrator.orchestrate({
      ...validated,
      tenant_id,
    });

    return NextResponse.json(
      okEnvelope({
        trace_id,
        method: "orchestrator",
        answer: (response as any).answer || "",
        sources: (response as any).sources || (response as any).citations || [],
        confidence: typeof (response as any).confidence === "number" ? (response as any).confidence : 0.6,
        raw: response,
      })
    );
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
    logger.error("Error orchestrating AI", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
