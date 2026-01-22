/**
 * Financial Services Playbook API
 * 
 * Provides access to the complete Financial Services operating playbook
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { playbookService } from "@/lib/financial-services/playbook";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("section");
    const subsectionId = searchParams.get("subsection");
    const stepId = searchParams.get("step");

    // Get specific step
    if (sectionId && subsectionId && stepId) {
      const step = playbookService.getStep(sectionId, subsectionId, stepId);
      if (!step) {
        return NextResponse.json({ error: "Step not found" }, { status: 404 });
      }
      return NextResponse.json({ step });
    }

    // Get specific subsection
    if (sectionId && subsectionId) {
      const section = playbookService.getSection(sectionId);
      if (!section || !section.subsections) {
        return NextResponse.json({ error: "Subsection not found" }, { status: 404 });
      }
      const subsection = section.subsections.find((s) => s.id === subsectionId);
      if (!subsection) {
        return NextResponse.json({ error: "Subsection not found" }, { status: 404 });
      }
      return NextResponse.json({ subsection });
    }

    // Get specific section
    if (sectionId) {
      const section = playbookService.getSection(sectionId);
      if (!section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }
      return NextResponse.json({ section });
    }

    // Get full playbook
    const playbook = playbookService.getPlaybook();
    return NextResponse.json({ playbook });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching Financial Services playbook", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
