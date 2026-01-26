"use strict";
/**
 * Browser Automation
 *
 * Headless browser automation for JavaScript-rendered content and SPAs.
 * Uses Puppeteer/Playwright for dynamic content extraction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAutomation = void 0;
class BrowserAutomation {
    constructor() {
        this.puppeteer = null;
        this.playwright = null;
        this.preferredEngine = null;
        this.currentPage = null;
        // Try to load Puppeteer
        try {
            this.puppeteer = require("puppeteer");
            this.preferredEngine = "puppeteer";
        }
        catch {
            // Puppeteer not available
        }
        // Try to load Playwright if Puppeteer not available
        if (!this.puppeteer) {
            try {
                this.playwright = require("playwright");
                this.preferredEngine = "playwright";
            }
            catch {
                // Playwright not available
            }
        }
    }
    /**
     * Check if browser automation is available
     */
    isAvailable() {
        return this.preferredEngine !== null;
    }
    /**
     * Navigate to URL and extract content using Puppeteer
     */
    async navigateWithPuppeteer(url, options) {
        if (!this.puppeteer) {
            throw new Error("Puppeteer not available");
        }
        const browser = await this.puppeteer.launch({
            headless: options.headless !== false,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        try {
            const page = await browser.newPage();
            if (options.viewport) {
                await page.setViewport(options.viewport);
            }
            if (options.userAgent) {
                await page.setUserAgent(options.userAgent);
            }
            const consoleLogs = [];
            page.on("console", (msg) => {
                consoleLogs.push(`${msg.type()}: ${msg.text()}`);
            });
            const networkRequests = [];
            page.on("request", (request) => {
                networkRequests.push({
                    url: request.url(),
                    method: request.method(),
                    status: 0,
                });
            });
            page.on("response", (response) => {
                const request = networkRequests.find(r => r.url === response.url());
                if (request) {
                    request.status = response.status();
                }
            });
            const timeout = options.timeout || 30000;
            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout,
            });
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, {
                    timeout: options.waitForTimeout || 5000,
                });
            }
            const content = await page.content();
            const screenshot = await page.screenshot({ encoding: "base64" });
            return {
                url,
                content,
                screenshot: screenshot.toString(),
                consoleLogs,
                networkRequests,
            };
        }
        finally {
            await browser.close();
        }
    }
    /**
     * Navigate to URL and extract content using Playwright
     */
    async navigateWithPlaywright(url, options) {
        if (!this.playwright) {
            throw new Error("Playwright not available");
        }
        const browser = await this.playwright.chromium.launch({
            headless: options.headless !== false,
        });
        try {
            const context = await browser.newContext({
                viewport: options.viewport || { width: 1920, height: 1080 },
                userAgent: options.userAgent,
            });
            const page = await context.newPage();
            const consoleLogs = [];
            page.on("console", (msg) => {
                consoleLogs.push(`${msg.type()}: ${msg.text()}`);
            });
            const networkRequests = [];
            page.on("request", (request) => {
                networkRequests.push({
                    url: request.url(),
                    method: request.method(),
                    status: 0,
                });
            });
            page.on("response", (response) => {
                const request = networkRequests.find(r => r.url === response.url());
                if (request) {
                    request.status = response.status();
                }
            });
            const timeout = options.timeout || 30000;
            await page.goto(url, {
                waitUntil: "networkidle",
                timeout,
            });
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, {
                    timeout: options.waitForTimeout || 5000,
                });
            }
            const content = await page.content();
            const screenshot = await page.screenshot({ encoding: "base64" });
            return {
                url,
                content,
                screenshot: screenshot.toString(),
                consoleLogs,
                networkRequests,
            };
        }
        finally {
            await browser.close();
        }
    }
    /**
     * Navigate to URL and extract rendered content
     */
    async navigate(url, options = {}) {
        if (!this.isAvailable()) {
            throw new Error("Browser automation not available. Install puppeteer or playwright.");
        }
        try {
            if (this.preferredEngine === "puppeteer") {
                return await this.navigateWithPuppeteer(url, options);
            }
            else if (this.preferredEngine === "playwright") {
                return await this.navigateWithPlaywright(url, options);
            }
            else {
                throw new Error("No browser engine available");
            }
        }
        catch (error) {
            return {
                url,
                content: "",
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    /**
     * Extract text content from rendered page
     */
    async extractText(url, options = {}) {
        const result = await this.navigate(url, options);
        if (result.error || !result.content) {
            return "";
        }
        // Extract text from HTML (same logic as web-crawler)
        const text = result.content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return text;
    }
    /**
     * Get page instance for form interaction (Puppeteer)
     */
    async getPage(url, options = {}) {
        if (!this.isAvailable()) {
            throw new Error("Browser automation not available");
        }
        if (this.preferredEngine === "puppeteer" && this.puppeteer) {
            const browser = await this.puppeteer.launch({
                headless: options.headless !== false,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
            const page = await browser.newPage();
            if (options.viewport) {
                await page.setViewport(options.viewport);
            }
            if (options.userAgent) {
                await page.setUserAgent(options.userAgent);
            }
            const timeout = options.timeout || 30000;
            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout,
            });
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, {
                    timeout: options.waitForTimeout || 5000,
                });
            }
            // Store browser reference for cleanup
            page._browser = browser;
            this.currentPage = page;
            return page;
        }
        else if (this.preferredEngine === "playwright" && this.playwright) {
            const browser = await this.playwright.chromium.launch({
                headless: options.headless !== false,
            });
            const page = await browser.newPage();
            if (options.viewport) {
                await page.setViewportSize(options.viewport);
            }
            if (options.userAgent) {
                await page.setExtraHTTPHeaders({ "User-Agent": options.userAgent });
            }
            const timeout = options.timeout || 30000;
            await page.goto(url, {
                waitUntil: "networkidle",
                timeout,
            });
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, {
                    timeout: options.waitForTimeout || 5000,
                });
            }
            // Store browser reference for cleanup
            page._browser = browser;
            this.currentPage = page;
            return page;
        }
        throw new Error("No browser engine available");
    }
    /**
     * Get current page instance (if available)
     */
    get page() {
        return this.currentPage;
    }
    /**
     * Close page and browser
     */
    async closePage(page) {
        if (page && page._browser) {
            await page._browser.close();
        }
        if (page === this.currentPage) {
            this.currentPage = null;
        }
    }
}
exports.BrowserAutomation = BrowserAutomation;
