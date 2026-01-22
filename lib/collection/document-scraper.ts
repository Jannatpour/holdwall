/**
 * Document Scraper
 * 
 * Collects public documents, reports, filings, and other structured content
 * for evidence and context.
 */

import { WebCrawler } from "../monitoring/web-crawler";
import { ScraperEngine } from "../monitoring/scraper-engine";

export interface Document {
  id: string;
  type: "pdf" | "html" | "word" | "excel" | "presentation" | "other";
  title: string;
  content: string;
  url: string;
  source: string;
  publishedDate?: string;
  author?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentScrapeOptions {
  url: string;
  type?: "pdf" | "html" | "auto";
  extractText?: boolean;
}

export class DocumentScraper {
  private crawler: WebCrawler;
  private scraper: ScraperEngine;

  constructor() {
    this.crawler = new WebCrawler();
    this.scraper = new ScraperEngine();
  }

  /**
   * Scrape document from URL
   */
  async scrapeDocument(options: DocumentScrapeOptions): Promise<Document> {
    const { url, type = "auto", extractText = true } = options;

    // Detect document type from URL
    const detectedType = type === "auto" ? this.detectDocumentType(url) : type;

    let content = "";
    let title = "";
    let publishedDate: string | undefined;
    let author: string | undefined;

    try {
      if (detectedType === "pdf") {
        // PDF scraping (would use pdf-parse or similar in production)
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        // In production, use pdf-parse library
        // For now, return metadata
        content = `[PDF content extraction requires pdf-parse library]`;
        title = url.split("/").pop() || "Untitled PDF";
      } else {
        // HTML document
        const result = await this.crawler.crawlUrl({
          url,
          extractText: extractText,
          extractMetadata: true,
        });

        if (result.error) {
          throw new Error(result.error);
        }

        content = result.text || "";
        title = result.metadata?.title as string || url.split("/").pop() || "Untitled";
        publishedDate = result.metadata?.publishedDate as string;
        author = result.metadata?.author as string;
      }
    } catch (error) {
      throw new Error(
        `Document scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return {
      id: crypto.randomUUID(),
      type: detectedType,
      title,
      content,
      url,
      source: new URL(url).hostname,
      publishedDate,
      author,
    };
  }

  /**
   * Detect document type from URL
   */
  private detectDocumentType(url: string): Document["type"] {
    const lower = url.toLowerCase();

    if (lower.endsWith(".pdf")) {
      return "pdf";
    } else if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
      return "word";
    } else if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) {
      return "excel";
    } else if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) {
      return "presentation";
    } else {
      return "html";
    }
  }

  /**
   * Scrape multiple documents
   */
  async scrapeDocuments(urls: string[]): Promise<Document[]> {
    const documents: Document[] = [];

    for (const url of urls) {
      try {
        const doc = await this.scrapeDocument({ url });
        documents.push(doc);
      } catch (error) {
        console.warn(`Failed to scrape document ${url}:`, error);
      }
    }

    return documents;
  }

  /**
   * Scrape documents from a directory/listing page
   */
  async scrapeDocumentDirectory(directoryUrl: string): Promise<Document[]> {
    // Crawl directory page to find document links
    const result = await this.crawler.crawlUrl({
      url: directoryUrl,
      extractLinks: true,
    });

    if (result.error || !result.links) {
      throw new Error(result.error || "Failed to extract links");
    }

    // Filter document links
    const documentUrls = result.links.filter(link => {
      const lower = link.toLowerCase();
      return (
        lower.endsWith(".pdf") ||
        lower.endsWith(".doc") ||
        lower.endsWith(".docx") ||
        lower.endsWith(".xls") ||
        lower.endsWith(".xlsx") ||
        lower.endsWith(".ppt") ||
        lower.endsWith(".pptx")
      );
    });

    // Scrape documents
    return await this.scrapeDocuments(documentUrls);
  }
}
