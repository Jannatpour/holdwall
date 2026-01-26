/**
 * API Documentation Page
 * Serve interactive API documentation
 * 
 * Public endpoint - intentionally no authentication required
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logging/logger";

async function generateAPIDocumentationHTML(): Promise<string> {
  try {
    const { generateAPIDocumentationHTML } = await import("@/lib/api/documentation");
    return generateAPIDocumentationHTML();
  } catch (error) {
    logger.error("Failed to generate API documentation", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return basic HTML fallback
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>API Documentation</title>
          <style>
            body { font-family: system-ui; padding: 2rem; max-width: 1200px; margin: 0 auto; }
            h1 { color: #333; }
            .error { color: #d32f2f; padding: 1rem; background: #ffebee; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>API Documentation</h1>
          <div class="error">
            <p>API documentation is temporarily unavailable. Please check the logs or contact support.</p>
          </div>
        </body>
      </html>
    `;
  }
}

export async function GET() {
  try {
    const html = await generateAPIDocumentationHTML();
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    logger.error("Error serving API documentation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse(
      "<html><body><h1>API Documentation Unavailable</h1><p>Please try again later.</p></body></html>",
      {
        status: 500,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  }
}
