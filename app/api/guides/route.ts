/**
 * Guides API
 * Endpoints for guide management and retrieval
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getGuide, getAllGuides } from "@/lib/guides/registry";
import { loadGuide } from "@/lib/guides/loader";
import { logger } from "@/lib/logging/logger";
import type { GuideId } from "@/lib/guides/types";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get("pageId") as GuideId | null;

    if (pageId) {
      // Load specific guide
      const guide = getGuide(pageId) || loadGuide(pageId);
      if (!guide) {
        return NextResponse.json(
          { error: "Guide not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(guide);
    }

    // Return all guides
    const guides = getAllGuides();
    return NextResponse.json({ guides });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching guides", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
