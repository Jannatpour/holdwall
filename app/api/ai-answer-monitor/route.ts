/**
 * AI Answer Monitor API
 * 
 * Stores AI answer snapshots, tracks citations, calculates citation capture scores,
 * and detects narrative drift over time.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AIAnswerScraper } from "@/lib/monitoring/ai-answer-scraper";
import { AIAnswerEvaluationHarness } from "@/lib/evaluation/harness";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import type { EventEnvelope } from "@/lib/events/types";
import type { AIAnswer } from "@/lib/monitoring/ai-answer-scraper";
import { db } from "@/lib/db/client";
import { randomUUID } from "crypto";
import { z } from "zod";

const scraper = new AIAnswerScraper();
const evaluationHarness = new AIAnswerEvaluationHarness();

const monitorSchema = z.object({
  action: z.enum(["snapshot", "evaluate", "monitor-brand", "get-history"]),
  // For snapshot
  engine: z.enum(["chatgpt", "perplexity", "gemini", "claude"]).optional(),
  query: z.string().optional(),
  answer: z.string().optional(),
  citations: z.array(z.string()).optional(),
  // For evaluate
  prompt: z.string().optional(),
  response: z.string().optional(),
  expectedEvidence: z.array(z.string()).optional(),
  // For monitor-brand
  brandName: z.string().optional(),
  queries: z.array(z.string()).optional(),
  // For get-history
  queryId: z.string().optional(),
  days: z.number().optional(),
});

/**
 * POST /api/ai-answer-monitor
 * Snapshot, evaluate, or monitor AI answers
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = monitorSchema.parse(body);

    switch (validated.action) {
      case "snapshot": {
        if (!validated.engine || !validated.query) {
          return NextResponse.json(
            { error: "engine and query required for snapshot" },
            { status: 400 }
          );
        }

        // Scrape AI answer
        const answer = await scraper.scrape({
          engine: validated.engine,
          query: validated.query,
        });

        // Store snapshot in database
        const snapshot = await db.aIAnswerSnapshot.create({
          data: {
            tenantId: tenant_id,
            engine: validated.engine,
            query: validated.query,
            answer: answer.answer,
            citations: (answer.citations || []).map((c) => c.url),
            tone: answer.tone || "neutral",
            model: answer.model,
            metadata: (answer.metadata || {}) as any,
          },
        });

        // Audit logging
        const auditLog = new DatabaseAuditLog();
        const user_id = (user as any).id || "";
        const correlationId = `ai-answer-snapshot-${snapshot.id}-${Date.now()}`;
        const occurredAt = new Date().toISOString();
        const auditEvent: EventEnvelope = {
          event_id: randomUUID(),
          tenant_id,
          actor_id: user_id,
          type: "action.ai_answer_snapshot",
          occurred_at: occurredAt,
          correlation_id: correlationId,
          causation_id: undefined,
          schema_version: "1.0",
          evidence_refs: [snapshot.id],
          payload: {
            snapshot_id: snapshot.id,
            engine: validated.engine,
            query: validated.query,
            citations_count: answer.citations?.length || 0,
          },
          signatures: [],
        };
        await auditLog.append({
          audit_id: randomUUID(),
          tenant_id,
          actor_id: user_id,
          type: "event",
          timestamp: occurredAt,
          correlation_id: correlationId,
          causation_id: undefined,
          data: auditEvent,
          evidence_refs: [snapshot.id],
        });

        return NextResponse.json({
          success: true,
          snapshot: {
            id: snapshot.id,
            engine: snapshot.engine,
            query: snapshot.query,
            answer: snapshot.answer,
            citations: snapshot.citations,
            tone: snapshot.tone,
            timestamp: snapshot.createdAt.toISOString(),
          },
        });
      }

      case "evaluate": {
        if (!validated.prompt || !validated.response) {
          return NextResponse.json(
            { error: "prompt and response required for evaluation" },
            { status: 400 }
          );
        }

        const evaluation = await evaluationHarness.evaluate(
          validated.prompt,
          validated.response,
          validated.expectedEvidence || [],
          {
            tenantId: tenant_id,
          }
        );

        return NextResponse.json({
          success: true,
          evaluation,
        });
      }

      case "monitor-brand": {
        if (!validated.brandName) {
          return NextResponse.json(
            { error: "brandName required for monitoring" },
            { status: 400 }
          );
        }

        const answers = await scraper.monitorBrandMentions(
          validated.brandName,
          validated.queries,
          ["perplexity", "gemini"]
        );

        // Store all answers
        const snapshots = await Promise.all(
          answers.map((answer: AIAnswer) =>
            db.aIAnswerSnapshot.create({
              data: {
                tenantId: tenant_id,
                engine: answer.engine,
                query: answer.query,
                answer: answer.answer,
                citations: answer.citations?.map((c) => c.url) || [],
                tone: answer.tone || "neutral",
                model: answer.model,
                metadata: ({
                  ...(answer.metadata || {}),
                  brandName: validated.brandName,
                } as any),
              },
            })
          )
        );

        // Evaluate each answer
        const evaluations = await Promise.all(
          answers.map((answer: AIAnswer) =>
            evaluationHarness.evaluate(
              answer.query,
              answer.answer,
              answer.citations?.map((c) => c.url) || [],
              { tenantId: tenant_id }
            )
          )
        );

        // Audit logging
        const auditLog = new DatabaseAuditLog();
        const user_id = (user as any).id || "";
        const correlationId = `ai-answer-monitor-brand-${validated.brandName}-${Date.now()}`;
        const occurredAt = new Date().toISOString();
        const auditEvent: EventEnvelope = {
          event_id: randomUUID(),
          tenant_id,
          actor_id: user_id,
          type: "action.ai_answer_monitor_brand",
          occurred_at: occurredAt,
          correlation_id: correlationId,
          causation_id: undefined,
          schema_version: "1.0",
          evidence_refs: snapshots.map((s) => s.id),
          payload: {
            brand_name: validated.brandName,
            queries_count: validated.queries?.length || 0,
            snapshots_count: snapshots.length,
            average_citation_score:
              evaluations.reduce((sum: number, e) => sum + e.citation_capture_score, 0) /
              (evaluations.length || 1),
          },
          signatures: [],
        };
        await auditLog.append({
          audit_id: randomUUID(),
          tenant_id,
          actor_id: user_id,
          type: "event",
          timestamp: occurredAt,
          correlation_id: correlationId,
          causation_id: undefined,
          data: auditEvent,
          evidence_refs: snapshots.map((s) => s.id),
        });

        return NextResponse.json({
          success: true,
          snapshots: snapshots.map((s) => ({
            id: s.id,
            engine: s.engine,
            query: s.query,
            answer: s.answer,
            citations: s.citations,
            tone: s.tone,
            timestamp: s.createdAt.toISOString(),
          })),
          evaluations,
          summary: {
            totalAnswers: answers.length,
            averageCitationScore: evaluations.reduce((sum, e) => sum + e.citation_capture_score, 0) / evaluations.length,
            averageNarrativeDrift: evaluations.reduce((sum, e) => sum + e.narrative_drift_score, 0) / evaluations.length,
            averageOverallScore: evaluations.reduce((sum, e) => sum + e.overall_score, 0) / evaluations.length,
          },
        });
      }

      case "get-history": {
        const days = validated.days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const snapshots = await db.aIAnswerSnapshot.findMany({
          where: {
            tenantId: tenant_id,
            createdAt: {
              gte: startDate,
            },
            ...(validated.queryId ? { query: validated.queryId } : {}),
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
        });

        // Calculate citation capture trends
        const citationScores = snapshots.map((s) => {
          const citations = Array.isArray(s.citations) ? s.citations : [];
          return citations.length > 0 ? 1.0 : 0.0; // Simplified
        });

        return NextResponse.json({
          success: true,
          snapshots: snapshots.map((s) => ({
            id: s.id,
            engine: s.engine,
            query: s.query,
            answer: s.answer.substring(0, 500),
            citations: s.citations,
            tone: s.tone,
            timestamp: s.createdAt.toISOString(),
          })),
          trends: {
            totalSnapshots: snapshots.length,
            averageCitations:
              citationScores.reduce((sum: number, s: number) => sum + s, 0) /
              (citationScores.length || 1),
            citationTrend: calculateTrend(citationScores),
          },
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
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
    const { logger } = await import("@/lib/logging/logger");
    logger.error("AI Answer Monitor error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Calculate trend from scores
 */
function calculateTrend(scores: number[]): "increasing" | "decreasing" | "stable" {
  if (scores.length < 2) {
    return "stable";
  }

  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));

  const firstAvg = firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length;

  const change = secondAvg - firstAvg;

  if (change > 0.1) {
    return "increasing";
  } else if (change < -0.1) {
    return "decreasing";
  } else {
    return "stable";
  }
}
