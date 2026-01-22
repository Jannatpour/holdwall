/**
 * Semantic Dominance API
 * 
 * Endpoints for AEO optimization, knowledge graphs, entity mapping,
 * LLM crawler guidance, and citation optimization.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AEOOptimizer } from "@/lib/seo/aeo-optimizer";
import { KnowledgeGraphBuilder } from "@/lib/seo/knowledge-graph-builder";
import { EntityMapper } from "@/lib/seo/entity-mapper";
import { LLMCrawlerGuide } from "@/lib/seo/llm-crawler-guide";
import { CitationOptimizer } from "@/lib/seo/citation-optimizer";
import { TopicalAuthority } from "@/lib/seo/topical-authority";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const aeoOptimizer = new AEOOptimizer();
const knowledgeGraphBuilder = new KnowledgeGraphBuilder();
const entityMapper = new EntityMapper();
const llmCrawlerGuide = new LLMCrawlerGuide();
const citationOptimizer = new CitationOptimizer();
const topicalAuthority = new TopicalAuthority();

/**
 * POST /api/seo/semantic-dominance/aeo
 * Optimize content for AI answer engines
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { action } = body;

    if (action === "aeo-optimize") {
      const schema = z.object({
        content: z.string().min(1),
        title: z.string().min(1),
        targetEngines: z.array(z.enum(["chatgpt", "perplexity", "gemini", "claude"])).optional(),
        keywords: z.array(z.string()).optional(),
        questions: z.array(z.string()).optional(),
      });

      const validated = schema.parse(body);
      const result = await aeoOptimizer.optimize(validated);

      return NextResponse.json(result);
    }

    if (action === "build-knowledge-graph") {
      const schema = z.object({
        brandName: z.string().min(1),
        brandProperties: z.record(z.string(), z.unknown()).optional(),
        authoritativeSources: z.array(z.object({
          name: z.string(),
          type: z.string(),
          url: z.string().url().optional(),
          authority: z.number().min(0).max(1),
        })).optional(),
        relatedEntities: z.array(z.object({
          name: z.string(),
          type: z.enum(["brand", "person", "organization", "product", "concept"]),
          relationship: z.enum(["relatedTo", "partOf", "createdBy", "mentionedIn", "authorOf"]),
        })).optional(),
      });

      const validated = schema.parse(body);
      const result = await knowledgeGraphBuilder.buildGraph(validated);

      return NextResponse.json(result);
    }

    if (action === "llm-crawler-guide") {
      const schema = z.object({
        siteUrl: z.string().url(),
        brandName: z.string().min(1),
        description: z.string().min(1),
        keyPages: z.array(z.object({
          path: z.string(),
          title: z.string(),
          description: z.string(),
          priority: z.number().min(0).max(10),
        })),
        contactInfo: z.object({
          email: z.string().email().optional(),
          website: z.string().url().optional(),
        }).optional(),
      });

      const validated = schema.parse(body);
      const result = llmCrawlerGuide.generateGuide(validated);

      return NextResponse.json(result);
    }

    if (action === "optimize-citation") {
      const schema = z.object({
        content: z.string().min(1),
        title: z.string().min(1),
        targetEngines: z.array(z.enum(["chatgpt", "perplexity", "gemini"])).optional(),
        includeSources: z.boolean().optional(),
        includeDates: z.boolean().optional(),
      });

      const validated = schema.parse(body);
      const result = await citationOptimizer.optimize(validated);

      return NextResponse.json(result);
    }

    if (action === "build-topical-authority") {
      const schema = z.object({
        topic: z.string().min(1),
        subtopics: z.array(z.string()).optional(),
        targetWordCount: z.number().positive().optional(),
        minArticles: z.number().positive().optional(),
      });

      const validated = schema.parse(body);
      const result = await topicalAuthority.buildHub(validated);

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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
    logger.error("Semantic dominance calculation error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seo/semantic-dominance/entity-map
 * Get entity mapping for a brand
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  try {
    const user = await requireAuth();
    const brandName = searchParams.get("brandName");

    if (!brandName) {
      return NextResponse.json({ error: "brandName is required" }, { status: 400 });
    }

    const brandId = `brand-${brandName.toLowerCase().replace(/\s+/g, "-")}`;
    const related = entityMapper.findRelated(brandId);
    const stats = entityMapper.getStats();
    const jsonld = entityMapper.toJSONLD();

    return NextResponse.json({
      brandId,
      relatedEntities: related,
      stats,
      jsonld,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Entity mapping error", {
      brandName: searchParams.get("brandName"),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
