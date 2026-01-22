/**
 * Sitemap Generator
 * Dynamic sitemap for SEO
 */

import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com";

  const routes = [
    // Homepage
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    
    // Demo page
    { path: "/demo", priority: 0.9, changeFrequency: "weekly" as const },
    
    // Product pages
    { path: "/product", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/product/pipeline", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/product/claims", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/product/graph", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/product/forecasting", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/product/aaal", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/product/governance", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/product/agents", priority: 0.8, changeFrequency: "weekly" as const },
    
    // Solutions pages
    { path: "/solutions", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/solutions/comms", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/solutions/security", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/solutions/procurement", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/solutions/support", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/solutions/financial-services", priority: 0.9, changeFrequency: "weekly" as const },
    
    // Trust pages
    { path: "/security", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/ethics", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/compliance", priority: 0.7, changeFrequency: "monthly" as const },
    
    // Resources pages
    { path: "/resources", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/resources/docs", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/resources/blog", priority: 0.7, changeFrequency: "daily" as const },
    { path: "/resources/cases", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/resources/playbooks", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/resources/playbooks/financial-services", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/resources/templates", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/resources/changelog", priority: 0.6, changeFrequency: "weekly" as const },
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
