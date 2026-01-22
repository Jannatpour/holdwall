/**
 * Global Search API
 * Search across claims, evidence, artifacts, audits, signals, tasks, influencers, and trust assets
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().min(2).max(200),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const validated = searchSchema.parse({
      q: searchParams.get("q") || "",
    });

    const query = validated.q;
    const results: Array<{
      id: string;
      type: string;
      title: string;
      description?: string;
      url: string;
    }> = [];

    // Search claims
    const claims = await db.claim.findMany({
      where: {
        tenantId: tenant_id,
        OR: [
          { canonicalText: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: {
        id: true,
        canonicalText: true,
        variants: true,
      },
    });

    for (const claim of claims) {
      const content = claim.canonicalText || claim.variants.join(" ") || "";
      results.push({
        id: claim.id,
        type: "claim",
        title: content.substring(0, 100),
        description: content.substring(0, 200),
        url: `/claims/${claim.id}`,
      });
    }

    // Search evidence
    const evidence = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        OR: [
          { contentRaw: { contains: query, mode: "insensitive" } },
          { contentNormalized: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: {
        id: true,
        contentRaw: true,
        contentNormalized: true,
        type: true,
      },
    });

    for (const ev of evidence) {
      const content = ev.contentNormalized || ev.contentRaw || "";
      results.push({
        id: ev.id,
        type: "evidence",
        title: `${ev.type} evidence ${ev.id.substring(0, 8)}`,
        description: content.substring(0, 200),
        url: `/evidence/${ev.id}`,
      });
    }

    // Search artifacts
    const artifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        padlPublished: true,
      },
    });

    for (const artifact of artifacts) {
      const content = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
      results.push({
        id: artifact.id,
        type: "artifact",
        title: artifact.title,
        description: content.substring(0, 200),
        url: `/studio?artifact=${artifact.id}`,
      });
    }

    // Trust assets (published artifacts)
    for (const asset of artifacts.filter((a) => a.padlPublished || a.status === "PUBLISHED")) {
      results.push({
        id: asset.id,
        type: "trust_asset",
        title: asset.title,
        description: "Published trust artifact (PADL)",
        url: `/trust?asset=${asset.id}`,
      });
    }

    // Search signals via evidence (authoritative content); events are used for streaming/audit, not search.
    const signalEvidence = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        type: "SIGNAL",
        OR: [
          { contentRaw: { contains: query, mode: "insensitive" } },
          { contentNormalized: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sourceType: true,
        sourceUrl: true,
        contentRaw: true,
        contentNormalized: true,
        contentMetadata: true,
      },
    });

    for (const sig of signalEvidence) {
      const content = sig.contentNormalized || sig.contentRaw || "";
      const author = (sig.contentMetadata as any)?.author;
      results.push({
        id: sig.id,
        type: "signal",
        title: author ? `Signal by ${author}` : `Signal: ${sig.sourceType}`,
        description: content.substring(0, 200),
        url: `/signals?evidence=${sig.id}`,
      });
    }

    // Search audit events (immutable logs) by type/correlation id.
    const audits = await db.event.findMany({
      where: {
        tenantId: tenant_id,
        type: { startsWith: "audit." },
        OR: [
          { type: { contains: query, mode: "insensitive" } },
          { correlationId: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        type: true,
        correlationId: true,
        occurredAt: true,
      },
    });

    for (const audit of audits) {
      results.push({
        id: audit.id,
        type: "audit",
        title: `Audit: ${audit.type}`,
        description: `Correlation: ${audit.correlationId}`,
        url: `/governance?correlation=${audit.correlationId}`,
      });
    }

    // Search playbook executions (tasks)
    const playbookExecutions = await db.playbookExecution.findMany({
      where: {
        playbook: {
          tenantId: tenant_id,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
      },
      take: 5,
      include: {
        playbook: true,
      },
    });

    for (const execution of playbookExecutions) {
      results.push({
        id: execution.id,
        type: "task",
        title: `Task: ${execution.playbook.name}`,
        description: `Status: ${execution.status}`,
        url: `/playbooks?execution_id=${execution.id}`,
      });
    }

    // Search approvals (as tasks/actions)
    const approvals = await db.approval.findMany({
      where: {
        tenantId: tenant_id,
        OR: [
          { action: { contains: query, mode: "insensitive" } },
          { resourceType: { contains: query, mode: "insensitive" } },
          { reason: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        decision: true,
      },
    });

    for (const approval of approvals) {
      results.push({
        id: approval.id,
        type: "task",
        title: `Approval: ${approval.action}`,
        description: `${approval.resourceType} • ${approval.decision ?? "PENDING"}`,
        url: `/governance?approval_id=${approval.id}`,
      });
    }

    // Influencers: derive from signal evidence authors stored in JSON metadata.
    const influencerRows = await db.$queryRaw<
      Array<{ author: string | null; mentions: bigint }>
    >`SELECT (\"contentMetadata\"->>'author') AS author, COUNT(*)::bigint AS mentions
      FROM \"Evidence\"
      WHERE \"tenantId\" = ${tenant_id}
        AND \"type\" = 'SIGNAL'
        AND (\"contentMetadata\"->>'author') ILIKE ${"%" + query + "%"}
      GROUP BY author
      ORDER BY mentions DESC
      LIMIT 5`;

    for (const row of influencerRows) {
      if (!row.author) continue;
      results.push({
        id: row.author,
        type: "influencer",
        title: row.author,
        description: `${Number(row.mentions)} signal mention(s)`,
        url: `/signals?author=${encodeURIComponent(row.author)}`,
      });
    }

    return NextResponse.json({
      results: results.slice(0, 20), // Limit total results
      count: results.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid search query", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error in search operation", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
