/**
 * Financial Services Playbook API
 * Serves the complete Financial Services operating playbook
 */

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { logger } from "@/lib/logging/logger";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "docs", "playbooks", "financial-services.md");
    const content = await readFile(filePath, "utf-8");
    
    return NextResponse.json(
      { content, title: "POS for Financial Services", subtitle: "Banks · FinTech · Payments · Insurance" },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  } catch (error) {
    logger.error("Error reading financial services playbook", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Playbook not found" },
      { status: 404 }
    );
  }
}
