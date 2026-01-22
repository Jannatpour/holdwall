/**
 * LLM Crawler Guidance
 * 
 * Creates llms.txt files and optimizes robots.txt for LLM crawlers
 * to provide explicit context and improve citation likelihood.
 */

export interface LLMCrawlerGuide {
  llmsTxt: string;
  robotsTxt: string;
  sitemap: string;
  canonicalRules: Array<{
    pattern: string;
    canonical: string;
  }>;
}

export interface LLMCrawlerGuideOptions {
  siteUrl: string;
  brandName: string;
  description: string;
  keyPages: Array<{
    path: string;
    title: string;
    description: string;
    priority: number;
  }>;
  contactInfo?: {
    email?: string;
    website?: string;
  };
}

export class LLMCrawlerGuide {
  /**
   * Generate llms.txt file content
   */
  generateLLMsTxt(options: LLMCrawlerGuideOptions): string {
    const { siteUrl, brandName, description, keyPages, contactInfo } = options;

    let llmsTxt = `# LLMs.txt for ${brandName}\n\n`;
    llmsTxt += `# This file provides explicit context for LLM crawlers\n\n`;
    llmsTxt += `Brand: ${brandName}\n`;
    llmsTxt += `Description: ${description}\n`;
    llmsTxt += `Website: ${siteUrl}\n\n`;

    if (contactInfo?.email) {
      llmsTxt += `Contact: ${contactInfo.email}\n`;
    }

    llmsTxt += `\n# Key Pages (in order of importance)\n\n`;

    // Sort by priority
    const sortedPages = [...keyPages].sort((a, b) => b.priority - a.priority);

    for (const page of sortedPages) {
      llmsTxt += `## ${page.title}\n`;
      llmsTxt += `URL: ${siteUrl}${page.path}\n`;
      llmsTxt += `Description: ${page.description}\n`;
      llmsTxt += `Priority: ${page.priority}\n\n`;
    }

    llmsTxt += `# Usage Guidelines\n\n`;
    llmsTxt += `- This content is publicly available for AI training and citation\n`;
    llmsTxt += `- Please cite sources when using this information\n`;
    llmsTxt += `- For questions, contact: ${contactInfo?.email || "see website"}\n`;

    return llmsTxt;
  }

  /**
   * Generate optimized robots.txt for LLMs
   */
  generateRobotsTxt(options: LLMCrawlerGuideOptions): string {
    const { siteUrl } = options;

    let robotsTxt = `# robots.txt optimized for LLM crawlers\n\n`;

    // Allow LLM crawlers
    robotsTxt += `User-agent: GPTBot\n`;
    robotsTxt += `Allow: /\n\n`;

    robotsTxt += `User-agent: ChatGPT-User\n`;
    robotsTxt += `Allow: /\n\n`;

    robotsTxt += `User-agent: anthropic-ai\n`;
    robotsTxt += `Allow: /\n\n`;

    robotsTxt += `User-agent: Claude-Web\n`;
    robotsTxt += `Allow: /\n\n`;

    robotsTxt += `User-agent: PerplexityBot\n`;
    robotsTxt += `Allow: /\n\n`;

    robotsTxt += `User-agent: Google-Extended\n`;
    robotsTxt += `Allow: /\n\n`;

    // Standard crawlers
    robotsTxt += `User-agent: *\n`;
    robotsTxt += `Allow: /\n`;
    robotsTxt += `Crawl-delay: 1\n\n`;

    // Sitemap
    robotsTxt += `Sitemap: ${siteUrl}/sitemap.xml\n`;

    return robotsTxt;
  }

  /**
   * Generate sitemap XML
   */
  generateSitemap(options: LLMCrawlerGuideOptions): string {
    const { siteUrl, keyPages } = options;

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    sitemap += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n`;

    // Add key pages
    for (const page of keyPages) {
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${siteUrl}${page.path}</loc>\n`;
      sitemap += `    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>\n`;
      sitemap += `    <changefreq>weekly</changefreq>\n`;
      sitemap += `    <priority>${(page.priority / 10).toFixed(1)}</priority>\n`;
      sitemap += `  </url>\n\n`;
    }

    sitemap += `</urlset>`;

    return sitemap;
  }

  /**
   * Generate canonical URL rules
   */
  generateCanonicalRules(options: LLMCrawlerGuideOptions): LLMCrawlerGuide["canonicalRules"] {
    const { siteUrl, keyPages } = options;

    return keyPages.map(page => ({
      pattern: page.path,
      canonical: `${siteUrl}${page.path}`,
    }));
  }

  /**
   * Generate complete LLM crawler guide
   */
  generateGuide(options: LLMCrawlerGuideOptions): {
    llmsTxt: string;
    robotsTxt: string;
    sitemap: string;
    canonicalRules: Array<{ pattern: string; canonical: string }>;
  } {
    return {
      llmsTxt: this.generateLLMsTxt(options),
      robotsTxt: this.generateRobotsTxt(options),
      sitemap: this.generateSitemap(options),
      canonicalRules: this.generateCanonicalRules(options),
    };
  }

  /**
   * Save guide files (would write to filesystem in production)
   */
  async saveGuide(
    options: LLMCrawlerGuideOptions,
    outputDir: string = "./public"
  ): Promise<void> {
    const guide = this.generateGuide(options);

    // In production, would write files:
    // - `${outputDir}/llms.txt`
    // - `${outputDir}/robots.txt`
    // - `${outputDir}/sitemap.xml`

    console.log("LLM crawler guide generated:", {
      llmsTxtLength: guide.llmsTxt.length,
      robotsTxtLength: guide.robotsTxt.length,
      sitemapLength: guide.sitemap.length,
      canonicalRules: guide.canonicalRules.length,
    });
  }
}
