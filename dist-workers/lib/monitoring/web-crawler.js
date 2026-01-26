"use strict";
/**
 * Advanced Web Crawler
 *
 * Sophisticated web crawling engine for autonomous public surface monitoring.
 * Respectful crawling with robots.txt compliance, distributed scraping, and intelligent rate limiting.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebCrawler = void 0;
const rate_limit_manager_1 = require("./rate-limit-manager");
const content_change_detector_1 = require("./content-change-detector");
class WebCrawler {
    constructor() {
        this.currentUserAgentIndex = 0;
        this.rateLimitManager = new rate_limit_manager_1.RateLimitManager();
        this.changeDetector = new content_change_detector_1.ContentChangeDetector();
        // Rotating user agents to avoid detection
        this.userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
        ];
    }
    /**
     * Get next user agent in rotation
     */
    getNextUserAgent() {
        const agent = this.userAgents[this.currentUserAgentIndex];
        this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
        return agent;
    }
    /**
     * Parse robots.txt file
     */
    async parseRobotsTxt(robotsUrl) {
        try {
            const response = await fetch(robotsUrl, {
                headers: {
                    "User-Agent": this.getNextUserAgent(),
                },
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                return [];
            }
            const text = await response.text();
            const rules = [];
            let currentRule = null;
            for (const line of text.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#"))
                    continue;
                const [key, ...valueParts] = trimmed.split(":");
                const value = valueParts.join(":").trim();
                if (key.toLowerCase() === "user-agent") {
                    if (currentRule) {
                        rules.push(currentRule);
                    }
                    currentRule = {
                        userAgent: value,
                        allow: [],
                        disallow: [],
                    };
                }
                else if (currentRule) {
                    if (key.toLowerCase() === "allow") {
                        if (!currentRule.allow) {
                            currentRule.allow = [];
                        }
                        currentRule.allow.push(value);
                    }
                    else if (key.toLowerCase() === "disallow") {
                        if (!currentRule.disallow) {
                            currentRule.disallow = [];
                        }
                        currentRule.disallow.push(value);
                    }
                    else if (key.toLowerCase() === "crawl-delay") {
                        currentRule.crawlDelay = parseInt(value, 10);
                    }
                }
            }
            if (currentRule) {
                rules.push(currentRule);
            }
            return rules;
        }
        catch (error) {
            console.warn("Failed to parse robots.txt:", error);
            return [];
        }
    }
    /**
     * Check if URL is allowed by robots.txt
     */
    async isUrlAllowed(url, robotsRules) {
        if (robotsRules.length === 0)
            return true;
        const urlPath = new URL(url).pathname;
        for (const rule of robotsRules) {
            // Check if rule applies (wildcard matching)
            const applies = rule.userAgent === "*" ||
                this.userAgents.some(ua => ua.includes(rule.userAgent));
            if (!applies)
                continue;
            // Check disallow rules
            for (const disallow of rule.disallow) {
                if (this.matchesPattern(urlPath, disallow)) {
                    // Check if there's an allow rule that overrides
                    const hasAllow = rule.allow.some(allow => this.matchesPattern(urlPath, allow));
                    if (!hasAllow) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    /**
     * Simple pattern matching for robots.txt rules
     */
    matchesPattern(path, pattern) {
        if (pattern === "/")
            return true;
        if (pattern === "")
            return false;
        const regexPattern = pattern
            .replace(/\*/g, ".*")
            .replace(/\$/g, "$");
        try {
            const regex = new RegExp(`^${regexPattern}`);
            return regex.test(path);
        }
        catch {
            return path.startsWith(pattern);
        }
    }
    /**
     * Crawl a single URL
     */
    async crawlUrl(options) {
        const { url, respectRobots = true, userAgent, timeout = 30000, followRedirects = true, extractLinks = true, extractText = true, extractMetadata = true, } = options;
        // Check rate limits
        await this.rateLimitManager.checkAndWait(url);
        // Parse robots.txt if needed
        let robotsRules = [];
        if (respectRobots) {
            try {
                const robotsUrl = new URL("/robots.txt", url).toString();
                robotsRules = await this.parseRobotsTxt(robotsUrl);
                if (!(await this.isUrlAllowed(url, robotsRules))) {
                    return {
                        url,
                        statusCode: 403,
                        error: "Disallowed by robots.txt",
                        timestamp: new Date().toISOString(),
                    };
                }
            }
            catch (error) {
                console.warn("Robots.txt check failed, proceeding:", error);
            }
        }
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": userAgent || this.getNextUserAgent(),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                redirect: followRedirects ? "follow" : "manual",
                signal: AbortSignal.timeout(timeout),
            });
            const statusCode = response.status;
            const contentType = response.headers.get("content-type") || "";
            if (!response.ok) {
                return {
                    url,
                    statusCode,
                    contentType,
                    error: `HTTP ${statusCode}`,
                    timestamp: new Date().toISOString(),
                };
            }
            // Only process HTML/text content
            if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
                return {
                    url,
                    statusCode,
                    contentType,
                    error: "Not HTML/text content",
                    timestamp: new Date().toISOString(),
                };
            }
            const content = await response.text();
            // Extract text, links, and metadata
            const result = {
                url,
                statusCode,
                contentType,
                timestamp: new Date().toISOString(),
            };
            if (extractText) {
                result.text = this.extractText(content);
            }
            if (extractLinks) {
                result.links = this.extractLinks(content, url);
            }
            if (extractMetadata) {
                result.metadata = this.extractMetadata(content);
            }
            // Store content for change detection
            if (extractText) {
                await this.changeDetector.recordContent(url, content);
            }
            return result;
        }
        catch (error) {
            return {
                url,
                statusCode: 0,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString(),
            };
        }
    }
    /**
     * Extract plain text from HTML
     */
    extractText(html) {
        // Remove script and style tags
        let text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        // Decode HTML entities (basic)
        text = text
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        return text;
    }
    /**
     * Extract links from HTML
     */
    extractLinks(html, baseUrl) {
        const links = [];
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
        let match;
        try {
            const base = new URL(baseUrl);
            while ((match = linkRegex.exec(html)) !== null) {
                const href = match[1];
                try {
                    const absoluteUrl = new URL(href, base).toString();
                    links.push(absoluteUrl);
                }
                catch {
                    // Invalid URL, skip
                }
            }
        }
        catch {
            // Invalid base URL
        }
        return [...new Set(links)]; // Deduplicate
    }
    /**
     * Extract metadata from HTML
     */
    extractMetadata(html) {
        const metadata = {};
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            metadata.title = titleMatch[1].trim();
        }
        // Extract meta tags
        const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
        let metaMatch;
        while ((metaMatch = metaRegex.exec(html)) !== null) {
            const name = metaMatch[1].toLowerCase();
            const content = metaMatch[2];
            if (name === "description") {
                metadata.description = content;
            }
            else if (name === "author") {
                metadata.author = content;
            }
            else if (name === "keywords") {
                metadata.keywords = content.split(",").map(k => k.trim());
            }
            else if (name.startsWith("article:") || name.startsWith("og:")) {
                metadata[name] = content;
            }
        }
        // Extract published date
        const dateRegex = /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i;
        const dateMatch = html.match(dateRegex);
        if (dateMatch) {
            metadata.publishedDate = dateMatch[1];
        }
        return metadata;
    }
    /**
     * Check if content has changed since last crawl
     */
    async hasContentChanged(url, newContent) {
        return this.changeDetector.hasChanged(url, newContent);
    }
}
exports.WebCrawler = WebCrawler;
