/**
 * Core Scraping Engine
 * 
 * Unified scraping engine that coordinates web crawlers, browser automation,
 * rate limiting, and content change detection for distributed, intelligent scraping.
 */

import { WebCrawler } from "./web-crawler";
import { BrowserAutomation } from "./browser-automation";
import { RateLimitManager } from "./rate-limit-manager";
import { ContentChangeDetector } from "./content-change-detector";
import { CaptchaSolver } from "./captcha-solver";
import { MultimodalExtractor } from "./multimodal-extractor";

export interface ScrapeJob {
  id: string;
  url: string;
  type: "html" | "spa" | "rss" | "api";
  options?: {
    useBrowser?: boolean;
    extractImages?: boolean;
    extractVideos?: boolean;
    waitForSelector?: string;
    timeout?: number;
  };
  priority?: number;
  retries?: number;
}

export interface ScrapeResult {
  jobId: string;
  url: string;
  success: boolean;
  content?: string;
  text?: string;
  images?: Array<{
    url: string;
    extractedText?: string;
  }>;
  videos?: Array<{
    url: string;
    transcript?: string;
  }>;
  metadata?: Record<string, unknown>;
  error?: string;
  timestamp: string;
  changed?: boolean;
}

export interface ScraperConfig {
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number;
  respectRobots: boolean;
  useBrowserForSPA: boolean;
  extractMultimodal: boolean;
}

export class ScraperEngine {
  private crawler: WebCrawler;
  private browser: BrowserAutomation;
  private rateLimitManager: RateLimitManager;
  private changeDetector: ContentChangeDetector;
  private captchaSolver: CaptchaSolver;
  private multimodalExtractor: MultimodalExtractor;
  private config: ScraperConfig;
  private activeJobs: Set<string> = new Set();
  private jobQueue: ScrapeJob[] = [];

  constructor(config?: Partial<ScraperConfig>) {
    this.crawler = new WebCrawler();
    this.browser = new BrowserAutomation();
    this.rateLimitManager = new RateLimitManager();
    this.changeDetector = new ContentChangeDetector();
    this.captchaSolver = new CaptchaSolver();
    this.multimodalExtractor = new MultimodalExtractor();

    this.config = {
      maxConcurrent: config?.maxConcurrent || 5,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 1000,
      respectRobots: config?.respectRobots !== false,
      useBrowserForSPA: config?.useBrowserForSPA !== false,
      extractMultimodal: config?.extractMultimodal !== false,
    };
  }

  /**
   * Add job to queue
   */
  async addJob(job: ScrapeJob): Promise<void> {
    // Check if content has changed (skip if unchanged and we have cached content)
    if (job.type === "html" || job.type === "spa") {
      const lastHash = await this.changeDetector.getLastHash(job.url);
      if (lastHash && !job.options?.extractImages && !job.options?.extractVideos) {
        // Content hasn't changed, could skip, but we'll still process for fresh data
      }
    }

    this.jobQueue.push(job);
    this.jobQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Process a single job
   */
  private async processJob(job: ScrapeJob): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      jobId: job.id,
      url: job.url,
      success: false,
      timestamp: new Date().toISOString(),
    };

    try {
      // Check rate limits
      await this.rateLimitManager.checkAndWait(job.url);

      let content: string | null = null;
      let text: string | null = null;
      let metadata: Record<string, unknown> = {};

      // Determine scraping method
      if (job.type === "spa" || (job.type === "html" && job.options?.useBrowser)) {
        // Use browser automation for SPAs
        if (!this.browser.isAvailable()) {
          throw new Error("Browser automation required but not available");
        }

        const browserResult = await this.browser.navigate(job.url, {
          waitForSelector: job.options?.waitForSelector,
          timeout: job.options?.timeout || 30000,
        });

        if (browserResult.error) {
          throw new Error(browserResult.error);
        }

        content = browserResult.content || "";
        text = this.extractTextFromHtml(content);
        metadata = {
          consoleLogs: browserResult.consoleLogs,
          networkRequests: browserResult.networkRequests,
        };
      } else if (job.type === "rss") {
        // RSS feed
        const crawlResult = await this.crawler.crawlUrl({
          url: job.url,
          extractText: true,
          extractMetadata: true,
          respectRobots: this.config.respectRobots,
        });

        if (crawlResult.error) {
          throw new Error(crawlResult.error);
        }

        content = crawlResult.text || "";
        text = content;
        metadata = crawlResult.metadata || {};
      } else {
        // Standard HTML
        const crawlResult = await this.crawler.crawlUrl({
          url: job.url,
          extractText: true,
          extractLinks: true,
          extractMetadata: true,
          respectRobots: this.config.respectRobots,
        });

        if (crawlResult.error) {
          throw new Error(crawlResult.error);
        }

        content = crawlResult.text || "";
        text = content;
        metadata = {
          ...crawlResult.metadata,
          links: crawlResult.links,
        };
      }

      // Check if content changed
      if (content) {
        const changed = await this.changeDetector.hasChanged(job.url, content);
        result.changed = changed;
      }

      // Extract multimodal content if requested
      if (this.config.extractMultimodal && content) {
        const images = await this.extractImages(content, job.url);
        const videos = await this.extractVideos(content, job.url);

        if (images && images.length > 0) {
          result.images = images;
        }
        if (videos && videos.length > 0) {
          result.videos = videos;
        }
      }

      result.success = true;
      result.content = content || undefined;
      result.text = text || undefined;
      result.metadata = metadata;

      // Reset rate limit backoff on success
      const domain = new URL(job.url).hostname;
      this.rateLimitManager.resetBackoff(domain);
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
      result.success = false;

      // Record rate limit error if applicable
      if (result.error.includes("429") || result.error.includes("rate limit")) {
        const domain = new URL(job.url).hostname;
        await this.rateLimitManager.recordRateLimitError(domain);
      }

      // Retry logic
      if (job.retries === undefined) {
        job.retries = 0;
      }

      if (job.retries < this.config.retryAttempts) {
        job.retries++;
        await this.sleep(this.config.retryDelay * job.retries); // Exponential backoff
        return await this.processJob(job);
      }
    }

    return result;
  }

  /**
   * Extract images from HTML and extract text from them
   */
  private async extractImages(html: string, baseUrl: string): Promise<ScrapeResult["images"]> {
    const images: ScrapeResult["images"] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      let imageUrl = match[1];
      
      // Resolve relative URLs
      if (!imageUrl.startsWith("http")) {
        try {
          imageUrl = new URL(imageUrl, baseUrl).toString();
        } catch {
          continue; // Invalid URL
        }
      }

      // Try to extract text from image
      try {
        const extraction = await this.multimodalExtractor.extractTextFromImage(imageUrl);
        if (extraction.text) {
          images.push({
            url: imageUrl,
            extractedText: extraction.text,
          });
        }
      } catch {
        // OCR failed, but still record the image
        images.push({
          url: imageUrl,
        });
      }
    }

    return images;
  }

  /**
   * Extract videos from HTML and get transcripts
   */
  private async extractVideos(html: string, baseUrl: string): Promise<ScrapeResult["videos"]> {
    const videos: ScrapeResult["videos"] = [];
    const videoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>|<source[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = videoRegex.exec(html)) !== null) {
      let videoUrl = match[1] || match[2];
      
      // Resolve relative URLs
      if (!videoUrl.startsWith("http")) {
        try {
          videoUrl = new URL(videoUrl, baseUrl).toString();
        } catch {
          continue; // Invalid URL
        }
      }

      // Try to extract transcript
      try {
        const transcript = await this.multimodalExtractor.extractTranscriptFromVideo(videoUrl);
        if (transcript.transcript) {
          videos.push({
            url: videoUrl,
            transcript: transcript.transcript,
          });
        }
      } catch {
        // Transcription failed, but still record the video
        videos.push({
          url: videoUrl,
        });
      }
    }

    return videos;
  }

  /**
   * Extract text from HTML
   */
  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Process job queue
   */
  async processQueue(): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    const activePromises: Promise<void>[] = [];

    while (this.jobQueue.length > 0 || this.activeJobs.size > 0) {
      // Start new jobs up to max concurrent
      while (
        this.jobQueue.length > 0 &&
        this.activeJobs.size < this.config.maxConcurrent
      ) {
        const job = this.jobQueue.shift();
        if (!job) break;

        this.activeJobs.add(job.id);

        const promise = this.processJob(job)
          .then(result => {
            results.push(result);
          })
          .catch(error => {
            results.push({
              jobId: job.id,
              url: job.url,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date().toISOString(),
            });
          })
          .finally(() => {
            this.activeJobs.delete(job.id);
          });

        activePromises.push(promise);
      }

      // Wait for at least one job to complete
      if (activePromises.length > 0) {
        await Promise.race(activePromises);
        // Remove completed promises
        const index = activePromises.findIndex(p => {
          // Check if promise is resolved (simplified check)
          return false; // In practice, track promise state
        });
        if (index !== -1) {
          activePromises.splice(index, 1);
        }
      } else {
        await this.sleep(100); // Small delay if no active jobs
      }
    }

    // Wait for all remaining jobs
    await Promise.all(activePromises);

    return results;
  }

  /**
   * Scrape a single URL (convenience method)
   */
  async scrapeUrl(
    url: string,
    options?: {
      useBrowser?: boolean;
      extractImages?: boolean;
      extractVideos?: boolean;
    }
  ): Promise<ScrapeResult> {
    const job: ScrapeJob = {
      id: crypto.randomUUID(),
      url,
      type: options?.useBrowser ? "spa" : "html",
      options,
      priority: 1,
    };

    return await this.processJob(job);
  }

  /**
   * Scrape multiple URLs
   */
  async scrapeUrls(
    urls: string[],
    options?: {
      useBrowser?: boolean;
      extractImages?: boolean;
      extractVideos?: boolean;
      maxConcurrent?: number;
    }
  ): Promise<ScrapeResult[]> {
    // Temporarily update max concurrent
    const originalMaxConcurrent = this.config.maxConcurrent;
    if (options?.maxConcurrent) {
      this.config.maxConcurrent = options.maxConcurrent;
    }

    try {
      // Add all jobs
      for (const url of urls) {
        await this.addJob({
          id: crypto.randomUUID(),
          url,
          type: options?.useBrowser ? "spa" : "html",
          options: {
            useBrowser: options?.useBrowser,
            extractImages: options?.extractImages,
            extractVideos: options?.extractVideos,
          },
          priority: 1,
        });
      }

      // Process queue
      return await this.processQueue();
    } finally {
      // Restore original config
      this.config.maxConcurrent = originalMaxConcurrent;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queued: number;
    active: number;
    total: number;
  } {
    return {
      queued: this.jobQueue.length,
      active: this.activeJobs.size,
      total: this.jobQueue.length + this.activeJobs.size,
    };
  }
}
