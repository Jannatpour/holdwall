/**
 * OpenAPI JSON endpoint
 * Serve OpenAPI specification
 */

import { NextResponse } from "next/server";
import { generateOpenAPISpec } from "@/lib/api/openapi";

export async function GET() {
  try {
    const spec = generateOpenAPISpec();
    return new NextResponse(spec, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate OpenAPI spec",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
