/**
 * RSS/Atom Feed Connector
 * Ingests content from RSS and Atom feeds
 */

import type { ConnectorExecutor, ConnectorConfig, ConnectorResult } from "./base";
import type { Signal } from "@/lib/signals/ingestion";

export class RSSConnector implements ConnectorExecutor {
  async sync(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<ConnectorResult> {
    const feedUrl = config.url as string;
    if (!feedUrl) {
      throw new Error("RSS feed URL is required");
    }

    const tenantId = config.tenantId as string;
    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    // Fetch RSS feed
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Holdwall-RSS-Connector/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const feed = this.parseFeed(xmlText);
    const signals: Signal[] = [];

    // Filter by cursor (only process items after cursor date)
    const cursorDate = cursor ? new Date(cursor) : null;
    let latestDate = cursorDate || new Date(0);

    for (const item of feed.items) {
      const itemDate = new Date(item.pubDate || item.updated || Date.now());
      
      // Skip items we've already processed
      if (cursorDate && itemDate <= cursorDate) {
        continue;
      }

      if (itemDate > latestDate) {
        latestDate = itemDate;
      }

      signals.push({
        signal_id: crypto.randomUUID(),
        tenant_id: tenantId,
        source: {
          type: "rss",
          id: item.id || item.link || crypto.randomUUID(),
          url: item.link,
        },
        content: {
          raw: item.content || item.description || "",
          normalized: this.normalizeContent(item.content || item.description || ""),
        },
        metadata: {
          author: item.author,
          timestamp: item.pubDate || item.updated,
          title: item.title,
        },
        compliance: {
          source_allowed: true,
          collection_method: "rss",
          retention_policy: config.retentionPolicy as string || "90 days",
        },
        created_at: new Date().toISOString(),
      });
    }

    return {
      signals,
      cursor: latestDate.toISOString(),
      metadata: {
        feedTitle: feed.title,
        feedDescription: feed.description,
        itemsProcessed: signals.length,
      },
    };
  }

  async validate(config: ConnectorConfig): Promise<{ valid: boolean; error?: string }> {
    if (!config.url) {
      return { valid: false, error: "RSS feed URL is required" };
    }

    try {
      new URL(config.url as string);
    } catch {
      return { valid: false, error: "Invalid RSS feed URL" };
    }

    return { valid: true };
  }

  async test(config: ConnectorConfig): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const response = await fetch(config.url as string, {
        headers: {
          "User-Agent": "Holdwall-RSS-Connector/1.0",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const text = await response.text();
      if (!text.includes("<rss") && !text.includes("<feed")) {
        return { success: false, error: "Response does not appear to be an RSS/Atom feed" };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Parse RSS/Atom feed XML
   */
  private parseFeed(xmlText: string): {
    title: string;
    description: string;
    items: Array<{
      id?: string;
      title?: string;
      link?: string;
      description?: string;
      content?: string;
      author?: string;
      pubDate?: string;
      updated?: string;
    }>;
  } {
    // Simple XML parsing (in production, use a proper XML parser like fast-xml-parser)
    const items: Array<{
      id?: string;
      title?: string;
      link?: string;
      description?: string;
      content?: string;
      author?: string;
      pubDate?: string;
      updated?: string;
    }> = [];

    // Extract feed title
    const titleMatch = xmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract feed description
    const descMatch = xmlText.match(/<description[^>]*>([^<]+)<\/description>/i) ||
                     xmlText.match(/<subtitle[^>]*>([^<]+)<\/subtitle>/i);
    const description = descMatch ? descMatch[1].trim() : "";

    // Extract items (RSS <item> or Atom <entry>)
    const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      const item: any = {};

      // Extract fields
      const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) item.title = this.stripTags(titleMatch[1]);

      const linkMatch = itemXml.match(/<link[^>]*(?:href=["']([^"']+)["']|>([^<]+)<\/link>)/i);
      if (linkMatch) item.link = linkMatch[1] || linkMatch[2];

      const idMatch = itemXml.match(/<(?:id|guid)[^>]*>([^<]+)<\/(?:id|guid)>/i);
      if (idMatch) item.id = idMatch[1].trim();

      const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      if (descMatch) item.description = this.stripTags(descMatch[1]);

      const contentMatch = itemXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ||
                           itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
      if (contentMatch) item.content = this.stripTags(contentMatch[1]);

      const authorMatch = itemXml.match(/<author[^>]*>[\s\S]*?<name[^>]*>([^<]+)<\/name>/i) ||
                         itemXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
      if (authorMatch) item.author = authorMatch[1].trim();

      const pubDateMatch = itemXml.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i) ||
                          itemXml.match(/<published[^>]*>([^<]+)<\/published>/i);
      if (pubDateMatch) item.pubDate = pubDateMatch[1].trim();

      const updatedMatch = itemXml.match(/<updated[^>]*>([^<]+)<\/updated>/i);
      if (updatedMatch) item.updated = updatedMatch[1].trim();

      if (item.title || item.description || item.content) {
        items.push(item);
      }
    }

    return { title, description, items };
  }

  /**
   * Strip HTML tags from text
   */
  private stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  /**
   * Normalize content
   */
  private normalizeContent(content: string): string {
    return content
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
