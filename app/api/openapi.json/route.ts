/**
 * OpenAPI JSON endpoint
 * Serve OpenAPI specification
 */

import { NextResponse } from "next/server";
import { generateOpenAPISpec } from "@/lib/api/openapi";

export async function GET() {
  const spec = generateOpenAPISpec();
  return new NextResponse(spec, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
