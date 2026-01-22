/**
 * Robots.txt Generator
 * SEO robots configuration
 */

import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/overview/",
          "/signals/",
          "/claims/",
          "/graph/",
          "/forecasts/",
          "/studio/",
          "/governance/",
          "/trust/",
          "/funnel/",
          "/playbooks/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
