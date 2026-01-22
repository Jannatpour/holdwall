/**
 * PWA Manifest
 * Progressive Web App configuration
 */

import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
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
}
