/**
 * API Keys Management API
 * Manage API keys for external service integrations
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import { createHash } from "crypto";

const apiKeySchema = z.object({
  name: z.string().min(1),
  service: z.string().min(1),
  key: z.string().min(1), // The actual API key value
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().optional(), // ISO date string
});

/**
 * GET /api/integrations/api-keys
 * List all API keys for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const keys = await db.apiKey.findMany({
      where: {
        tenantId: tenant_id,
        revoked: false,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      keys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        service: key.service,
        maskedKey: key.maskedKey,
        scopes: key.scopes,
        lastUsed: key.lastUsed?.toISOString(),
        expiresAt: key.expiresAt?.toISOString(),
        revoked: key.revoked,
        createdAt: key.createdAt.toISOString(),
        updatedAt: key.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching API keys", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/api-keys
 * Create a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = apiKeySchema.parse(body);

    // Hash the key (never store plaintext)
    const keyHash = createHash("sha256").update(validated.key).digest("hex");
    const maskedKey = `${validated.key.substring(0, 4)}...${validated.key.substring(validated.key.length - 4)}`;

    // Store in database
    const key = await db.apiKey.create({
      data: {
        tenantId: tenant_id,
        name: validated.name,
        service: validated.service,
        keyHash,
        maskedKey,
        scopes: validated.scopes || [],
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
      },
    });

    // Return the key only once (on creation)
    return NextResponse.json(
      {
        key: {
          id: key.id,
          name: key.name,
          service: key.service,
          maskedKey: key.maskedKey,
          apiKey: validated.key, // Only returned on creation
          scopes: key.scopes,
          expiresAt: key.expiresAt?.toISOString(),
          createdAt: key.createdAt.toISOString(),
        },
      },
      { status: 201 }
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
    logger.error("Error creating API key", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
