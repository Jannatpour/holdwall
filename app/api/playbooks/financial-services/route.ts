/**
 * Financial Services Playbook API
 * Serves the complete Financial Services operating playbook
 */

import { NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import { join } from "path";
import { constants } from "fs";
import { logger } from "@/lib/logging/logger";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "docs", "playbooks", "financial-services.md");
    
    // Check if file exists before reading
    try {
      await access(filePath, constants.F_OK);
    } catch (accessError) {
      logger.warn("Financial services playbook file not found", {
        filePath,
        error: accessError instanceof Error ? accessError.message : String(accessError),
      });
      return NextResponse.json(
        { 
          error: "Playbook not found",
          message: "The financial services playbook file is not available",
          content: "",
          title: "POS for Financial Services",
          subtitle: "Banks · FinTech · Payments · Insurance"
        },
        { 
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
    
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
    // Log error but ensure we always return JSON
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    try {
      logger.error("Error reading financial services playbook", {
        error: errorMessage,
        stack: errorStack,
      });
    } catch (logError) {
      // If logger fails, continue without logging
      console.error("Error reading financial services playbook:", errorMessage);
    }
    
    // Always return JSON, never HTML
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: "Failed to read playbook file",
        content: "",
        title: "POS for Financial Services",
        subtitle: "Banks · FinTech · Payments · Insurance"
      },
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
