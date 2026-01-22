/**
 * Golden Sets API
 * Manage golden sets for AI evaluation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { getGoldenSetManager } from "@/lib/evaluation/golden-sets";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

const goldenSetManager = getGoldenSetManager();

const createGoldenSetSchema = z.object({
  domain: z.enum(["claims", "evidence_linking", "graph_updates", "aaal_outputs"]),
  name: z.string().min(1),
  version: z.string(),
  description: z.string().optional(),
  examples: z.array(z.any()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateGoldenSetSchema = z.object({
  examples: z.array(z.any()).optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/evaluation/golden-sets
 * List all golden sets or get by domain
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get("domain") as
      | "claims"
      | "evidence_linking"
      | "graph_updates"
      | "aaal_outputs"
      | null;

    if (domain) {
      const goldenSet = await goldenSetManager.getGoldenSet(domain);
      if (!goldenSet) {
        return NextResponse.json({ error: "Golden set not found" }, { status: 404 });
      }
      return NextResponse.json(goldenSet);
    }

    // List all golden sets from database
    const goldenSets = await db.goldenSet.findMany({
      orderBy: [{ domain: "asc" }, { name: "asc" }, { version: "desc" }],
      select: {
        id: true,
        domain: true,
        name: true,
        version: true,
        description: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform to include example count
    const goldenSetsWithCounts = await Promise.all(
      goldenSets.map(async (gs) => {
        const fullSet = await goldenSetManager.getGoldenSet(
          gs.domain as any,
          gs.version
        );
        return {
          id: gs.id,
          domain: gs.domain,
          name: gs.name,
          version: gs.version,
          description: gs.description,
          metadata: gs.metadata,
          exampleCount: fullSet?.examples.length || 0,
          createdAt: gs.createdAt.toISOString(),
          updatedAt: gs.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ goldenSets: goldenSetsWithCounts });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error fetching golden sets", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evaluation/golden-sets
 * Create a new golden set
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can create golden sets

    const body = await request.json();
    const validated = createGoldenSetSchema.parse(body);

    const goldenSet = {
      id: `gs-${Date.now()}`,
      domain: validated.domain,
      name: validated.name,
      version: validated.version,
      examples: validated.examples,
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: validated.description,
        total_examples: validated.examples.length,
        ...validated.metadata,
      },
    };

    await goldenSetManager.addGoldenSet(goldenSet, true); // Persist to DB

    return NextResponse.json(goldenSet, { status: 201 });
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

    logger.error("Error creating golden set", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/evaluation/golden-sets
 * Update an existing golden set
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can update golden sets

    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get("domain");
    const name = searchParams.get("name");
    const version = searchParams.get("version");

    if (!domain || !name || !version) {
      return NextResponse.json(
        { error: "domain, name, and version are required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateGoldenSetSchema.parse(body);

    // Get existing golden set
    const existing = await db.goldenSet.findUnique({
      where: {
        domain_name_version: {
          domain: domain as any,
          name,
          version,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Golden set not found" }, { status: 404 });
    }

    // Update in database
    const updated = await db.goldenSet.update({
      where: { id: existing.id },
      data: {
        examples: validated.examples ? (validated.examples as any) : undefined,
        description: validated.description,
        metadata: validated.metadata ? (validated.metadata as any) : undefined,
      },
    });

    // Reload into manager
    const goldenSet = await goldenSetManager.getGoldenSet(domain as any, version);
    if (goldenSet) {
      await goldenSetManager.addGoldenSet(
        {
          ...goldenSet,
          examples: validated.examples || goldenSet.examples,
          metadata: {
            ...goldenSet.metadata,
            description: validated.description || goldenSet.metadata.description,
            updated_at: new Date().toISOString(),
            ...validated.metadata,
          },
        },
        false // Don't persist again, already updated
      );
    }

    return NextResponse.json({
      id: updated.id,
      domain: updated.domain,
      name: updated.name,
      version: updated.version,
      description: updated.description,
      metadata: updated.metadata,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
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

    logger.error("Error updating golden set", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/evaluation/golden-sets
 * Delete a golden set
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can delete golden sets

    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get("domain");
    const name = searchParams.get("name");
    const version = searchParams.get("version");

    if (!domain || !name || !version) {
      return NextResponse.json(
        { error: "domain, name, and version are required" },
        { status: 400 }
      );
    }

    const existing = await db.goldenSet.findUnique({
      where: {
        domain_name_version: {
          domain: domain as any,
          name,
          version,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Golden set not found" }, { status: 404 });
    }

    await db.goldenSet.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error deleting golden set", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
