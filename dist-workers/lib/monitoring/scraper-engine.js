"use strict";
/**
 * Core Scraping Engine
 *
 * Unified scraping engine that coordinates web crawlers, browser automation,
 * rate limiting, and content change detection for distributed, intelligent scraping.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperEngine = void 0;
const web_crawler_1 = require("./web-crawler");
const browser_automation_1 = require("./browser-automation");
const rate_limit_manager_1 = require("./rate-limit-manager");
const content_change_detector_1 = require("./content-change-detector");
const captcha_solver_1 = require("./captcha-solver");
const multimodal_extractor_1 = require("./multimodal-extractor");
class ScraperEngine {
    constructor(config) {
        this.activeJobs = new Set();
        this.jobQueue = [];
        this.crawler = new web_crawler_1.WebCrawler();
        this.browser = new browser_automation_1.BrowserAutomation();
        this.rateLimitManager = new rate_limit_manager_1.RateLimitManager();
        this.changeDetector = new content_change_detector_1.ContentChangeDetector();
        this.captchaSolver = new captcha_solver_1.CaptchaSolver();
        this.multimodalExtractor = new multimodal_extractor_1.MultimodalExtractor();
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
    async addJob(job) {
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
    async processJob(job) {
        const result = {
            jobId: job.id,
            url: job.url,
            success: false,
            timestamp: new Date().toISOString(),
        };
        try {
            // Check rate limits
            await this.rateLimitManager.checkAndWait(job.url);
            let content = null;
            let text = null;
            let metadata = {};
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
            }
            else if (job.type === "rss") {
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
            }
            else {
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
        }
        catch (error) {
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
    async extractImages(html, baseUrl) {
        const images = [];
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
            let imageUrl = match[1];
            // Resolve relative URLs
            if (!imageUrl.startsWith("http")) {
                try {
                    imageUrl = new URL(imageUrl, baseUrl).toString();
                }
                catch {
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
            }
            catch {
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
    async extractVideos(html, baseUrl) {
        const videos = [];
        const videoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>|<source[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = videoRegex.exec(html)) !== null) {
            let videoUrl = match[1] || match[2];
            // Resolve relative URLs
            if (!videoUrl.startsWith("http")) {
                try {
                    videoUrl = new URL(videoUrl, baseUrl).toString();
                }
                catch {
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
            }
            catch {
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
    extractTextFromHtml(html) {
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
    async processQueue() {
        const results = [];
        const activePromises = [];
        while (this.jobQueue.length > 0 || this.activeJobs.size > 0) {
            // Start new jobs up to max concurrent
            while (this.jobQueue.length > 0 &&
                this.activeJobs.size < this.config.maxConcurrent) {
                const job = this.jobQueue.shift();
                if (!job)
                    break;
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
            }
            else {
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
    async scrapeUrl(url, options) {
        const job = {
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
    async scrapeUrls(urls, options) {
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
        }
        finally {
            // Restore original config
            this.config.maxConcurrent = originalMaxConcurrent;
        }
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queued: this.jobQueue.length,
            active: this.activeJobs.size,
            total: this.jobQueue.length + this.activeJobs.size,
        };
    }
}
exports.ScraperEngine = ScraperEngine;
