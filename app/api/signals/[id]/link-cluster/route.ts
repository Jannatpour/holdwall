/**
 * Link Signal to Cluster API
 * 
 * Links a signal to a claim cluster
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const linkSchema = z.object({
  cluster_id: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let signal_id: string | undefined;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const resolvedParams = await params;
    signal_id = resolvedParams.id;

    const body = await request.json();
    const validated = linkSchema.parse(body);

    // Verify signal exists (signals are stored as Evidence rows)
    const signal = await db.evidence.findUnique({ where: { id: signal_id } });

    if (!signal || signal.tenantId !== tenant_id || signal.type !== "SIGNAL") {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    // Verify cluster exists
    const cluster = await db.claimCluster.findUnique({
      where: { id: validated.cluster_id },
    });

    if (!cluster || cluster.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }

    // Link signal to cluster by storing explicit reference in Evidence.metadata
    const currentMeta = ((signal.metadata as any) || {}) as Record<string, unknown>;
    await db.evidence.update({
      where: { id: signal_id },
      data: {
        metadata: ({
          ...currentMeta,
          cluster_id: validated.cluster_id,
          linked_at: new Date().toISOString(),
          linked_by: (user as any).id || "system",
        } as any),
      },
    });

    return NextResponse.json({
      signal_id,
      cluster_id: validated.cluster_id,
      linked: true,
      linked_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error linking signal to cluster", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      signalId: signal_id,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
