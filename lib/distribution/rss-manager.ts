/**
 * RSS Feed Manager
 * 
 * Creates and manages RSS feeds for content distribution
 * to increase discoverability and citation potential.
 */

export interface RSSFeed {
  title: string;
  description: string;
  link: string;
  items: Array<{
    title: string;
    link: string;
    description: string;
    pubDate: string;
    guid: string;
  }>;
}

export class RSSManager {
  private feeds: Map<string, RSSFeed> = new Map();

  /**
   * Create RSS feed
   */
  createFeed(
    title: string,
    description: string,
    link: string
  ): RSSFeed {
    const feed: RSSFeed = {
      title,
      description,
      link,
      items: [],
    };

    this.feeds.set(link, feed);
    return feed;
  }

  /**
   * Add item to feed
   */
  addItem(
    feedLink: string,
    item: {
      title: string;
      link: string;
      description: string;
      pubDate: string;
    }
  ): void {
    const feed = this.feeds.get(feedLink);
    if (!feed) {
      throw new Error(`Feed ${feedLink} not found`);
    }

    feed.items.push({
      ...item,
      guid: item.link, // Use link as GUID
    });
  }

  /**
   * Generate RSS XML
   */
  generateXML(feedLink: string): string {
    const feed = this.feeds.get(feedLink);
    if (!feed) {
      throw new Error(`Feed ${feedLink} not found`);
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
    xml += `  <channel>\n`;
    xml += `    <title>${this.escapeXml(feed.title)}</title>\n`;
    xml += `    <description>${this.escapeXml(feed.description)}</description>\n`;
    xml += `    <link>${this.escapeXml(feed.link)}</link>\n`;
    xml += `    <atom:link href="${this.escapeXml(feed.link)}/rss.xml" rel="self" type="application/rss+xml" />\n`;
    xml += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n\n`;

    // Add items
    for (const item of feed.items) {
      xml += `    <item>\n`;
      xml += `      <title>${this.escapeXml(item.title)}</title>\n`;
      xml += `      <link>${this.escapeXml(item.link)}</link>\n`;
      xml += `      <description>${this.escapeXml(item.description)}</description>\n`;
      xml += `      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>\n`;
      xml += `      <guid isPermaLink="true">${this.escapeXml(item.guid)}</guid>\n`;
      xml += `    </item>\n`;
    }

    xml += `  </channel>\n`;
    xml += `</rss>`;

    return xml;
  }

  /**
   * Escape XML
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Get feed
   */
  getFeed(feedLink: string): RSSFeed | null {
    return this.feeds.get(feedLink) || null;
  }
}
