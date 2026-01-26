/**
 * Backlink Strategy
 * 
 * Intelligent backlink building through content partnerships
 * and strategic link placement.
 */

import { WebCrawler } from "@/lib/monitoring/web-crawler";
import { db } from "@/lib/db/client";

export interface BacklinkOpportunity {
  targetUrl: string;
  targetDomain: string;
  authority: number; // 0-1
  opportunity: string;
  suggestedAnchorText: string;
  confidence: number; // 0-1
}

export interface Backlink {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  establishedAt: string;
  status: "pending" | "live" | "removed";
}

export class BacklinkStrategy {
  private backlinks: Map<string, Backlink> = new Map();
  private targetDomains: Set<string> = new Set();
  private crawler: WebCrawler;

  constructor() {
    this.crawler = new WebCrawler();
  }

  /**
   * Register target domain
   */
  registerTargetDomain(domain: string): void {
    this.targetDomains.add(domain);
  }

  /**
   * Find backlink opportunities
   */
  async findOpportunities(
    targetUrl: string,
    content: string,
    tenantId?: string
  ): Promise<BacklinkOpportunity[]> {
    const opportunities: BacklinkOpportunity[] = [];
    const targetDomain = new URL(targetUrl).hostname;

    // 1. Search for sites that link to similar content
    const similarContentSites = await this.findSimilarContentSites(content, targetDomain);
    opportunities.push(...similarContentSites);

    // 2. Find guest post opportunities (high-authority blogs in same niche)
    const guestPostOpportunities = await this.findGuestPostOpportunities(content, targetDomain);
    opportunities.push(...guestPostOpportunities);

    // 3. Find resource page opportunities
    const resourcePageOpportunities = await this.findResourcePageOpportunities(targetUrl, content);
    opportunities.push(...resourcePageOpportunities);

    // 4. Find broken link opportunities
    const brokenLinkOpportunities = await this.findBrokenLinkOpportunities(targetUrl, content);
    opportunities.push(...brokenLinkOpportunities);

    // If tenantId provided, check database for existing backlinks and opportunities
    if (tenantId) {
      const existingOpportunities = await this.fetchStoredOpportunities(tenantId, targetUrl);
      opportunities.push(...existingOpportunities);
    }

    // Sort by authority and confidence
    return opportunities.sort((a, b) => {
      const scoreA = a.authority * a.confidence;
      const scoreB = b.authority * b.confidence;
      return scoreB - scoreA;
    });
  }

  /**
   * Find sites with similar content that could link to target
   */
  private async findSimilarContentSites(
    content: string,
    targetDomain: string
  ): Promise<BacklinkOpportunity[]> {
    const opportunities: BacklinkOpportunity[] = [];
    
    // Extract key phrases from content
    const keyPhrases = this.extractKeyPhrases(content);
    
    // Search for sites discussing similar topics
    for (const phrase of keyPhrases.slice(0, 3)) {
      try {
        // Use search to find relevant sites
        const searchQuery = `"${phrase}" site:blog OR site:news`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        const result = await this.crawler.crawlUrl({
          url: searchUrl,
          extractLinks: true,
          extractText: true,
        });

        if (result.links) {
          for (const link of result.links.slice(0, 5)) {
            try {
              const linkUrl = new URL(link);
              if (linkUrl.hostname !== targetDomain && !this.targetDomains.has(linkUrl.hostname)) {
                // Estimate authority (in production, would use domain authority API)
                const authority = this.estimateDomainAuthority(linkUrl.hostname);
                
                if (authority > 0.5) {
                  opportunities.push({
                    targetUrl: link,
                    targetDomain: linkUrl.hostname,
                    authority,
                    opportunity: `Similar content site discussing "${phrase}"`,
                    suggestedAnchorText: phrase,
                    confidence: 0.6,
                  });
                }
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to find similar content sites for "${phrase}":`, error);
      }
    }

    return opportunities;
  }

  /**
   * Find guest post opportunities
   */
  private async findGuestPostOpportunities(
    content: string,
    targetDomain: string
  ): Promise<BacklinkOpportunity[]> {
    const opportunities: BacklinkOpportunity[] = [];
    
    // Search for guest post opportunities
    const topics = this.extractKeyPhrases(content);
    const mainTopic = topics[0] || "industry insights";
    
    try {
      const searchQuery = `"write for us" OR "guest post" OR "contribute" ${mainTopic}`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      const result = await this.crawler.crawlUrl({
        url: searchUrl,
        extractLinks: true,
        extractText: true,
      });

      if (result.links) {
        for (const link of result.links.slice(0, 10)) {
          try {
            const linkUrl = new URL(link);
            if (linkUrl.hostname !== targetDomain) {
              const authority = this.estimateDomainAuthority(linkUrl.hostname);
              
              if (authority > 0.6) {
                opportunities.push({
                  targetUrl: link,
                  targetDomain: linkUrl.hostname,
                  authority,
                  opportunity: "Guest post opportunity",
                  suggestedAnchorText: mainTopic,
                  confidence: 0.7,
                });
              }
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    } catch (error) {
      console.warn("Failed to find guest post opportunities:", error);
    }

    return opportunities;
  }

  /**
   * Find resource page opportunities
   */
  private async findResourcePageOpportunities(
    targetUrl: string,
    content: string
  ): Promise<BacklinkOpportunity[]> {
    const opportunities: BacklinkOpportunity[] = [];
    const topics = this.extractKeyPhrases(content);
    
    // Search for resource pages that list similar content
    for (const topic of topics.slice(0, 2)) {
      try {
        const searchQuery = `"resources" OR "tools" OR "links" ${topic}`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        const result = await this.crawler.crawlUrl({
          url: searchUrl,
          extractLinks: true,
        });

        if (result.links) {
          for (const link of result.links.slice(0, 5)) {
            try {
              const linkUrl = new URL(link);
              const authority = this.estimateDomainAuthority(linkUrl.hostname);
              
              if (authority > 0.5) {
                opportunities.push({
                  targetUrl: link,
                  targetDomain: linkUrl.hostname,
                  authority,
                  opportunity: `Resource page listing for "${topic}"`,
                  suggestedAnchorText: topic,
                  confidence: 0.65,
                });
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to find resource page opportunities for "${topic}":`, error);
      }
    }

    return opportunities;
  }

  /**
   * Find broken link opportunities
   * Uses WebCrawler to identify 404 links that could be replaced with targetUrl
   */
  private async findBrokenLinkOpportunities(
    targetUrl: string,
    content: string
  ): Promise<BacklinkOpportunity[]> {
    const opportunities: BacklinkOpportunity[] = [];
    
    try {
      const crawler = new WebCrawler();
      const targetDomain = new URL(targetUrl).hostname;
      
      // Extract potential target domains from content (simplified - in production would use NLP)
      const urlPattern = /https?:\/\/([^\s"<>]+)/gi;
      const urls = Array.from(content.matchAll(urlPattern)).map(match => match[0]);
      const uniqueDomains = new Set(urls.map(url => {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      }).filter(Boolean) as string[]);
      
      // For each domain, check for broken links (limited to avoid excessive crawling)
      const maxDomainsToCheck = 5;
      const domainsToCheck = Array.from(uniqueDomains).slice(0, maxDomainsToCheck);
      
      for (const domain of domainsToCheck) {
        try {
          // Crawl domain's sitemap or main page to find links
          const crawlResult = await crawler.crawlUrl({
            url: `https://${domain}`,
            depth: 1,
            maxPages: 10,
            extractLinks: true,
            respectRobots: true,
          });
          
          if (crawlResult.links && crawlResult.links.length > 0) {
            // Check each link for 404 status
            for (const link of crawlResult.links.slice(0, 20)) { // Limit to 20 links per domain
              try {
                const response = await fetch(link, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
                if (response.status === 404) {
                  // Found a broken link - potential opportunity
                  const opportunity: BacklinkOpportunity = {
                    targetUrl,
                    targetDomain,
                    authority: this.estimateDomainAuthority(domain),
                    opportunity: `Broken link on ${domain} could be replaced with ${targetUrl}`,
                    suggestedAnchorText: this.extractKeyPhrases(content)[0] || 'Learn more',
                    confidence: 0.6, // Moderate confidence
                  };
                  opportunities.push(opportunity);
                }
              } catch {
                // Link check failed - skip
                continue;
              }
            }
          }
        } catch (error) {
          // Domain crawl failed - skip
          continue;
        }
      }
    } catch (error) {
      // Crawling infrastructure unavailable - return empty array
      // This is acceptable as broken link detection requires significant infrastructure
    }
    
    return opportunities;
  }

  /**
   * Extract key phrases from content
   */
  private extractKeyPhrases(content: string): string[] {
    // Simple extraction - in production, would use NLP
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"]);
    
    const phrases: string[] = [];
    const wordFreq: Record<string, number> = {};
    
    for (const word of words) {
      const cleaned = word.replace(/[^\w]/g, "");
      if (cleaned.length > 4 && !stopWords.has(cleaned)) {
        wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1;
      }
    }
    
    // Get top phrases
    const sorted = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    return sorted;
  }

  /**
   * Estimate domain authority (simplified - in production would use API)
   */
  private estimateDomainAuthority(domain: string): number {
    // Simplified estimation based on domain characteristics
    // In production, would use Moz, Ahrefs, or similar API
    
    // Higher authority for .edu, .gov, .org
    if (domain.endsWith(".edu") || domain.endsWith(".gov")) {
      return 0.9;
    }
    if (domain.endsWith(".org")) {
      return 0.7;
    }
    
    // Estimate based on domain length and structure
    const parts = domain.split(".");
    if (parts.length === 2) {
      return 0.6; // Main domain
    }
    
    return 0.5; // Default
  }

  /**
   * Fetch stored opportunities from database
   */
  private async fetchStoredOpportunities(
    tenantId: string,
    targetUrl: string
  ): Promise<BacklinkOpportunity[]> {
    try {
      // Query evidence or signals that mention similar content
      const evidence = await (db as any).evidence.findMany({
        where: {
          tenantId,
          source: {
            url: {
              not: targetUrl,
            },
          },
        },
        take: 10,
        select: {
          source: true,
        },
      });

      return evidence.map((e: any) => ({
        targetUrl: e.source?.url || "",
        targetDomain: e.source?.url ? new URL(e.source.url).hostname : "",
        authority: 0.6,
        opportunity: "Content mention opportunity",
        suggestedAnchorText: this.extractAnchorText(""),
        confidence: 0.5,
      })).filter((opp: BacklinkOpportunity) => opp.targetUrl);
    } catch (error) {
      console.warn("Failed to fetch stored opportunities:", error);
      return [];
    }
  }

  /**
   * Extract anchor text from content
   */
  private extractAnchorText(content: string): string {
    // Extract first sentence or key phrase
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences[0]?.trim() || "Learn more";
  }

  /**
   * Record backlink
   */
  recordBacklink(backlink: Omit<Backlink, "id" | "establishedAt">): Backlink {
    const fullBacklink: Backlink = {
      id: crypto.randomUUID(),
      ...backlink,
      establishedAt: new Date().toISOString(),
    };

    this.backlinks.set(fullBacklink.id, fullBacklink);
    return fullBacklink;
  }

  /**
   * Get backlinks
   */
  getBacklinks(targetUrl?: string): Backlink[] {
    const all = Array.from(this.backlinks.values());
    
    if (targetUrl) {
      return all.filter(b => b.targetUrl === targetUrl);
    }

    return all;
  }

  /**
   * Get backlink count
   */
  getBacklinkCount(targetUrl: string): number {
    return this.getBacklinks(targetUrl).filter(b => b.status === "live").length;
  }
}
