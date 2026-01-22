/**
 * SEO & Metadata
 * Structured data, meta tags, sitemap generation
 */

import type { Metadata } from "next";

export function generateMetadata(
  title: string,
  description: string,
  path: string,
  options?: {
    ogImage?: string;
    type?: "website" | "article";
    publishedTime?: string;
    modifiedTime?: string;
  }
): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com";
  const ogImage = options?.ogImage || `${baseUrl}/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description.substring(0, 100))}`;

  return {
    title: `${title} | Holdwall POS`,
    description,
    openGraph: {
      title: `${title} | Holdwall POS`,
      description,
      url: `${baseUrl}${path}`,
      siteName: "Holdwall POS",
      type: options?.type || "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(options?.publishedTime && { publishedTime: options.publishedTime }),
      ...(options?.modifiedTime && { modifiedTime: options.modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Holdwall POS`,
      description,
      images: [ogImage],
      creator: "@holdwall",
    },
    alternates: {
      canonical: `${baseUrl}${path}`,
    },
  };
}

/**
 * Generate structured data (JSON-LD)
 */
export function generateStructuredData(data: {
  type: "Organization" | "WebApplication" | "Article" | "Product" | "FAQPage" | "HowTo" | "SoftwareApplication";
  name: string;
  description: string;
  url?: string;
  [key: string]: unknown;
}): object {
  const base = {
    "@context": "https://schema.org",
    "@type": data.type,
    name: data.name,
    description: data.description,
  };

  if (data.url) {
    return { ...base, url: data.url, ...data };
  }

  return { ...base, ...data };
}
