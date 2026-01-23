/**
 * PWA Manifest Route Handler
 * Serves the web manifest at /manifest.webmanifest
 * This route file is required by Vercel to apply function configs from vercel.json
 */

import { MetadataRoute } from "next";
import { NextResponse } from "next/server";

export async function GET() {
  const manifest: MetadataRoute.Manifest = {
    name: "Holdwall POS",
    short_name: "Holdwall",
    description: "Evidence-first, agentic perception engineering for the AI era",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#00d4ff",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
}
