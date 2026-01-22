/**
 * Dynamic OG Image Generation API
 * 
 * Generates OpenGraph images for all pages using @vercel/og
 * 
 * Note: Edge runtime is required for @vercel/og ImageResponse to work properly.
 * This disables static generation for this route, which is expected behavior.
 */

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createElement } from "react";

// Edge runtime required for @vercel/og - this warning is expected and acceptable
export const runtime = "edge";
// Explicitly mark as dynamic to suppress static generation warning
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Holdwall POS";
  const description = searchParams.get("description") || "Perception Operating System";
  const type = searchParams.get("type") || "default";
  try {

    return new ImageResponse(
      createElement(
        "div",
        {
          style: {
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            backgroundImage: "linear-gradient(to bottom, #0a0a0a, #1a1a1a)",
          },
        },
        createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px",
              maxWidth: "1200px",
            },
          },
          createElement(
            "div",
            {
              style: {
                fontSize: 72,
                fontWeight: 700,
                background: "linear-gradient(to right, #00d4ff, #7c3aed)",
                backgroundClip: "text",
                color: "transparent",
                marginBottom: 24,
                textAlign: "center",
              },
            },
            title
          ),
          createElement(
            "div",
            {
              style: {
                fontSize: 32,
                color: "#a1a1aa",
                textAlign: "center",
                maxWidth: "900px",
                lineHeight: 1.5,
              },
            },
            description
          ),
          createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                marginTop: 48,
                fontSize: 24,
                color: "#71717a",
              },
            },
            type === "default" ? "holdwall.com" : `holdwall.com • ${type}`
          )
        )
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    // Edge runtime doesn't support winston logger, use console instead
    console.error("OG image generation failed", {
      title,
      description,
      type,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
