/**
 * Recent Events API
 * Returns recent operational events for Ops Feed
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  let user: any = null;
  try {
    user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 1000) // Clamp between 1 and 1000
      : 20;

    // Get recent events from audit log or event store
    // For now, query from evidence and artifacts for operational events
    const recentEvidence = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        createdAt: true,
        sourceType: true,
      },
    });

    const recentArtifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        OR: [
          { status: "PUBLISHED" },
          { status: "APPROVED" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: Math.floor(limit / 2),
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    // Format as events
    const events = [
      ...recentEvidence.map((ev) => ({
        id: ev.id,
        type: `signal.${ev.type || "ingested"}`,
        occurred_at: ev.createdAt.toISOString(),
        actor_id: "system",
        data: {
          source_type: ev.sourceType,
        },
      })),
      ...recentArtifacts.map((art) => ({
        id: art.id,
        type: `artifact.${art.status.toLowerCase()}`,
        occurred_at: art.createdAt.toISOString(),
        actor_id: "system",
        data: {
          title: art.title,
          status: art.status,
        },
      })),
    ]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, limit);

    return NextResponse.json({ events });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching recent events", {
      error: error instanceof Error ? error.message : String(error),
      tenant_id: (user as any)?.tenantId || "unknown",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
