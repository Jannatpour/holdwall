/**
 * Regulatory Monitor
 * 
 * Monitors SEC filings, regulatory documents, and compliance-related content
 * for brand mentions and regulatory narratives.
 */

import { DocumentScraper, Document } from "./document-scraper";
import { WebCrawler } from "../monitoring/web-crawler";

export interface RegulatoryFiling {
  id: string;
  type: "sec-10k" | "sec-10q" | "sec-8k" | "sec-s1" | "other";
  company: string;
  title: string;
  filedDate: string;
  url: string;
  content?: string;
  mentions?: Array<{
    text: string;
    context: string;
    page?: number;
  }>;
}

export interface RegulatoryMonitorOptions {
  companyName?: string;
  cik?: string; // SEC CIK number
  filingTypes?: RegulatoryFiling["type"][];
  since?: Date;
  maxFilings?: number;
}

export class RegulatoryMonitor {
  private documentScraper: DocumentScraper;
  private crawler: WebCrawler;

  constructor() {
    this.documentScraper = new DocumentScraper();
    this.crawler = new WebCrawler();
  }

  /**
   * Monitor SEC filings
   */
  async monitorSECFilings(
    options: RegulatoryMonitorOptions
  ): Promise<RegulatoryFiling[]> {
    const { companyName, cik, filingTypes = ["sec-10k", "sec-10q", "sec-8k"], maxFilings = 50 } = options;

    const filings: RegulatoryFiling[] = [];

    try {
      // SEC EDGAR search (simplified - in production use SEC API)
      let searchUrl: string;

      if (cik) {
        searchUrl = `https://www.sec.gov/cgi-bin/browse-edgar?CIK=${cik}&type=&count=${maxFilings}`;
      } else if (companyName) {
        // Would need to search by company name first to get CIK
        // For now, use simplified approach
        searchUrl = `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(companyName)}&count=${maxFilings}`;
      } else {
        throw new Error("Either companyName or cik must be provided");
      }

      const result = await this.crawler.crawlUrl({
        url: searchUrl,
        extractText: true,
        extractLinks: true,
      });

      if (result.error || !result.text) {
        throw new Error(result.error || "Failed to load SEC filings");
      }

      // Parse filing links (simplified - SEC HTML structure)
      const filingRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      let count = 0;

      while ((match = filingRegex.exec(result.text)) !== null && count < maxFilings) {
        const href = match[1];
        const title = match[2].trim();

        // Determine filing type from title/URL
        const filingType = this.determineFilingType(title, href);

        if (filingTypes.includes(filingType)) {
          // Construct full URL
          const filingUrl = href.startsWith("http")
            ? href
            : `https://www.sec.gov${href}`;

          // Extract filing date (simplified)
          const dateMatch = result.text.substring(match.index).match(/(\d{4}-\d{2}-\d{2})/);
          const filedDate = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0];

          filings.push({
            id: `sec-${Date.now()}-${count}`,
            type: filingType,
            company: companyName || "Unknown",
            title,
            filedDate,
            url: filingUrl,
          });

          count++;
        }
      }
    } catch (error) {
      console.error("SEC filing monitoring error:", error);
    }

    return filings;
  }

  /**
   * Determine filing type from title/URL
   */
  private determineFilingType(title: string, url: string): RegulatoryFiling["type"] {
    const lower = (title + " " + url).toLowerCase();

    if (lower.includes("10-k") || lower.includes("10k")) {
      return "sec-10k";
    } else if (lower.includes("10-q") || lower.includes("10q")) {
      return "sec-10q";
    } else if (lower.includes("8-k") || lower.includes("8k")) {
      return "sec-8k";
    } else if (lower.includes("s-1") || lower.includes("s1")) {
      return "sec-s1";
    } else {
      return "other";
    }
  }

  /**
   * Extract content from filing
   */
  async extractFilingContent(filing: RegulatoryFiling): Promise<RegulatoryFiling> {
    try {
      // SEC filings are typically in HTML or text format
      const result = await this.crawler.crawlUrl({
        url: filing.url,
        extractText: true,
      });

      if (result.text) {
        filing.content = result.text;
      }
    } catch (error) {
      console.warn(`Failed to extract content from ${filing.url}:`, error);
    }

    return filing;
  }

  /**
   * Search for brand mentions in filings
   */
  async searchBrandInFilings(
    brandName: string,
    filings: RegulatoryFiling[]
  ): Promise<RegulatoryFiling[]> {
    const relevantFilings: RegulatoryFiling[] = [];

    for (const filing of filings) {
      // Extract content if not already extracted
      if (!filing.content) {
        await this.extractFilingContent(filing);
      }

      if (filing.content && filing.content.toLowerCase().includes(brandName.toLowerCase())) {
        // Extract mentions with context
        filing.mentions = this.extractMentions(filing.content, brandName);
        relevantFilings.push(filing);
      }
    }

    return relevantFilings;
  }

  /**
   * Extract mentions with context
   */
  private extractMentions(
    content: string,
    brandName: string
  ): RegulatoryFiling["mentions"] {
    const mentions: RegulatoryFiling["mentions"] = [];
    const lower = content.toLowerCase();
    const brandLower = brandName.toLowerCase();
    const contextWindow = 100;

    let index = 0;
    while ((index = lower.indexOf(brandLower, index)) !== -1) {
      const start = Math.max(0, index - contextWindow);
      const end = Math.min(content.length, index + brandName.length + contextWindow);
      const context = content.substring(start, end);

      mentions.push({
        text: brandName,
        context: context.trim(),
      });

      index += brandName.length;
    }

    return mentions;
  }

  /**
   * Monitor regulatory filings for a company
   */
  async monitorCompany(
    companyName: string,
    options?: Omit<RegulatoryMonitorOptions, "companyName">
  ): Promise<RegulatoryFiling[]> {
    return await this.monitorSECFilings({
      ...options,
      companyName,
    });
  }
}
