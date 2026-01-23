/**
 * Evidence Chain of Custody API
 * 
 * Endpoints for chain-of-custody verification and version management
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ChainOfCustodyService } from "@/lib/evidence/chain-of-custody";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const chainOfCustodyService = new ChainOfCustodyService();

const verifySchema = z.object({
  evidence_id: z.string(),
});

const getVersionsSchema = z.object({
  evidence_id: z.string(),
});

const getVersionSchema = z.object({
  evidence_id: z.string(),
  version_number: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const action = body.action;

    if (action === "verify") {
      const validated = verifySchema.parse(body);

      const verification = await chainOfCustodyService.verifyChainOfCustody(
        validated.evidence_id
      );

      return NextResponse.json({
        verification,
      });
    }

    if (action === "get_versions") {
      const validated = getVersionsSchema.parse(body);

      const versions = await chainOfCustodyService.getVersions(validated.evidence_id);

      return NextResponse.json({
        versions,
      });
    }

    if (action === "get_version") {
      const validated = getVersionSchema.parse(body);

      const version = await chainOfCustodyService.getVersion(
        validated.evidence_id,
        validated.version_number
      );

      if (!version) {
        return NextResponse.json(
          { error: "Version not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        version,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'verify', 'get_versions', or 'get_version'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Chain of custody API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
