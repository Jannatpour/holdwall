/**
 * API Documentation Page
 * Serve interactive API documentation
 */

import { NextResponse } from "next/server";
import { generateAPIDocumentationHTML } from "@/lib/api/documentation";

export async function GET() {
  const html = generateAPIDocumentationHTML();
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
