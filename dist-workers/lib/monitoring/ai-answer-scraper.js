"use strict";
/**
 * AI Answer Scraper
 *
 * Monitors AI answer engines (ChatGPT, Perplexity, Gemini, Claude) for brand mentions
 * and tracks how AI systems cite and represent brands in their responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnswerScraper = void 0;
const browser_automation_1 = require("./browser-automation");
class AIAnswerScraper {
    constructor() {
        this.openaiApiKey = null;
        this.anthropicApiKey = null;
        this.googleApiKey = null;
        this.browser = new browser_automation_1.BrowserAutomation();
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
        this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || null;
        this.googleApiKey = process.env.GOOGLE_API_KEY || null;
    }
    /**
     * Scrape ChatGPT answer (via browser - ChatGPT web interface)
     */
    async scrapeChatGPT(options) {
        const { query } = options;
        if (!this.browser.isAvailable()) {
            throw new Error("Browser automation required for ChatGPT scraping");
        }
        try {
            // Note: ChatGPT requires authentication, this is a simplified version
            // In production, you'd need to handle login/session management
            const url = "https://chat.openai.com/";
            const result = await this.browser.navigate(url, {
                waitForSelector: '[data-testid="chat-input"]',
                timeout: 30000,
            });
            if (result.error) {
                throw new Error(result.error);
            }
            // ChatGPT web scraping requires authenticated session management
            // This is intentionally limited - use OpenAI API for production programmatic access
            // Browser scraping would require:
            // 1. Session cookie management and refresh
            // 2. CSRF token handling
            // 3. Rate limiting compliance
            // 4. CAPTCHA solving
            // 5. Response streaming and extraction
            // Return structured response indicating the limitation and recommended approach
            return {
                engine: "chatgpt",
                query,
                answer: "ChatGPT web scraping requires authenticated session management. For production use, integrate with OpenAI API (https://platform.openai.com/docs/api-reference) for reliable programmatic access.",
                timestamp: new Date().toISOString(),
                metadata: {
                    note: "Browser scraping of ChatGPT requires authentication and session management",
                    recommended: "Use OpenAI API for programmatic access",
                    apiUrl: "https://platform.openai.com/docs/api-reference",
                },
            };
        }
        catch (error) {
            throw new Error(`ChatGPT scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Scrape Perplexity answer
     */
    async scrapePerplexity(options) {
        const { query } = options;
        if (!this.browser.isAvailable()) {
            throw new Error("Browser automation required for Perplexity scraping");
        }
        try {
            const url = `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
            const result = await this.browser.navigate(url, {
                waitForSelector: ".prose",
                timeout: 30000,
            });
            if (result.error || !result.content) {
                throw new Error(result.error || "Failed to load Perplexity");
            }
            // Extract answer
            const answerMatch = result.content.match(/<div[^>]*class="prose"[^>]*>([\s\S]*?)<\/div>/i);
            const answer = answerMatch
                ? this.extractTextFromHtml(answerMatch[1])
                : "";
            // Extract citations
            const citations = [];
            const citationRegex = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*citation[^"]*"[^>]*>([^<]+)<\/a>/gi;
            let citationMatch;
            while ((citationMatch = citationRegex.exec(result.content)) !== null) {
                citations.push({
                    url: citationMatch[1],
                    title: citationMatch[2],
                });
            }
            // Analyze tone (simplified)
            const tone = this.analyzeTone(answer);
            return {
                engine: "perplexity",
                query,
                answer,
                citations,
                timestamp: new Date().toISOString(),
                tone,
            };
        }
        catch (error) {
            throw new Error(`Perplexity scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Scrape Gemini answer (via API or browser)
     */
    async scrapeGemini(options) {
        const { query } = options;
        // Try API first if available
        if (this.googleApiKey) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.googleApiKey}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [{
                                parts: [{
                                        text: query,
                                    }],
                            }],
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Gemini API error: ${response.statusText}`);
                }
                const data = await response.json();
                const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                return {
                    engine: "gemini",
                    query,
                    answer,
                    timestamp: new Date().toISOString(),
                    model: "gemini-pro",
                    tone: this.analyzeTone(answer),
                };
            }
            catch (error) {
                console.warn("Gemini API failed, falling back to browser:", error);
            }
        }
        // Fallback to browser scraping
        if (!this.browser.isAvailable()) {
            throw new Error("Browser automation required for Gemini scraping");
        }
        try {
            const url = `https://gemini.google.com/app?q=${encodeURIComponent(query)}`;
            const result = await this.browser.navigate(url, {
                waitForSelector: ".response-text",
                timeout: 30000,
            });
            if (result.error || !result.content) {
                throw new Error(result.error || "Failed to load Gemini");
            }
            // Extract answer
            const answerMatch = result.content.match(/<div[^>]*class="response-text"[^>]*>([\s\S]*?)<\/div>/i);
            const answer = answerMatch
                ? this.extractTextFromHtml(answerMatch[1])
                : "";
            return {
                engine: "gemini",
                query,
                answer,
                timestamp: new Date().toISOString(),
                tone: this.analyzeTone(answer),
            };
        }
        catch (error) {
            throw new Error(`Gemini scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Scrape Claude answer (via API or browser)
     */
    async scrapeClaude(options) {
        const { query } = options;
        // Try API first if available
        if (this.anthropicApiKey) {
            try {
                const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": this.anthropicApiKey,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: "claude-3-opus-20240229",
                        max_tokens: 1024,
                        messages: [{
                                role: "user",
                                content: query,
                            }],
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Claude API error: ${response.statusText}`);
                }
                const data = await response.json();
                const answer = data.content?.[0]?.text || "";
                return {
                    engine: "claude",
                    query,
                    answer,
                    timestamp: new Date().toISOString(),
                    model: "claude-3-opus",
                    tone: this.analyzeTone(answer),
                };
            }
            catch (error) {
                console.warn("Claude API failed, falling back to browser:", error);
            }
        }
        // Fallback to browser scraping
        if (!this.browser.isAvailable()) {
            throw new Error("Browser automation required for Claude scraping");
        }
        try {
            const url = "https://claude.ai/";
            const result = await this.browser.navigate(url, {
                waitForSelector: ".message-content",
                timeout: 30000,
            });
            if (result.error || !result.content) {
                throw new Error(result.error || "Failed to load Claude");
            }
            // Claude web interface requires authentication
            // Attempt to detect if user is logged in by checking for auth indicators
            const authIndicators = [
                ".user-menu",
                "[data-testid='user-menu']",
                ".account-menu",
                "button[aria-label*='account']",
                "button[aria-label*='user']",
            ];
            // Check authentication by looking for auth indicators in the page content
            let isAuthenticated = false;
            try {
                const pageContent = await this.browser.extractText(url);
                for (const selector of authIndicators) {
                    // Simple check - if selector text appears in content or URL contains auth indicators
                    if (pageContent.toLowerCase().includes(selector.toLowerCase().replace(/[\[\]()]/g, '')) ||
                        url.includes('account') || url.includes('user') || url.includes('login')) {
                        isAuthenticated = true;
                        break;
                    }
                }
            }
            catch {
                // Continue without authentication check
            }
            if (!isAuthenticated) {
                // Return informative message about authentication requirement
                return {
                    engine: "claude",
                    query,
                    answer: "Claude web interface requires authentication. Please authenticate in the browser first, or use the Anthropic API (ANTHROPIC_API_KEY) for programmatic access.",
                    timestamp: new Date().toISOString(),
                    metadata: {
                        note: "Browser scraping of Claude requires prior authentication. Use Anthropic API for programmatic access.",
                        requiresAuth: true,
                        alternative: "Set ANTHROPIC_API_KEY environment variable for API access",
                    },
                };
            }
            // If authenticated, attempt to interact with Claude interface
            // This would require specific selectors for Claude's UI
            // For now, return a message indicating authentication was detected but interaction needs implementation
            return {
                engine: "claude",
                query,
                answer: "Authentication detected, but Claude web interface interaction requires specific UI selectors. Use Anthropic API (ANTHROPIC_API_KEY) for reliable programmatic access.",
                timestamp: new Date().toISOString(),
                metadata: {
                    note: "Claude web UI interaction requires implementation of specific selectors. Use API for production.",
                    authenticated: true,
                    alternative: "Set ANTHROPIC_API_KEY environment variable for API access",
                },
            };
        }
        catch (error) {
            throw new Error(`Claude scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Extract text from HTML
     */
    extractTextFromHtml(html) {
        return html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
    /**
     * Analyze tone of answer (simplified sentiment analysis)
     */
    analyzeTone(text) {
        const lowerText = text.toLowerCase();
        const positiveWords = ["good", "great", "excellent", "best", "amazing", "wonderful", "positive", "successful"];
        const negativeWords = ["bad", "terrible", "worst", "awful", "negative", "failed", "problem", "issue", "scam"];
        const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
        if (positiveCount > negativeCount && positiveCount > 0) {
            return "positive";
        }
        else if (negativeCount > positiveCount && negativeCount > 0) {
            return "negative";
        }
        else if (positiveCount > 0 && negativeCount > 0) {
            return "mixed";
        }
        else {
            return "neutral";
        }
    }
    /**
     * Scrape AI answer from specified engine
     */
    async scrape(options) {
        const { engine } = options;
        switch (engine) {
            case "chatgpt":
                return await this.scrapeChatGPT(options);
            case "perplexity":
                return await this.scrapePerplexity(options);
            case "gemini":
                return await this.scrapeGemini(options);
            case "claude":
                return await this.scrapeClaude(options);
            default:
                throw new Error(`Unsupported AI engine: ${engine}`);
        }
    }
    /**
     * Query multiple AI engines for the same query
     */
    async queryMultipleEngines(query, engines = ["perplexity", "gemini"]) {
        const answers = [];
        for (const engine of engines) {
            try {
                const answer = await this.scrape({
                    engine,
                    query,
                });
                answers.push(answer);
            }
            catch (error) {
                console.warn(`Failed to scrape ${engine}:`, error);
            }
        }
        return answers;
    }
    /**
     * Monitor brand mentions across AI engines
     */
    async monitorBrandMentions(brandName, queries = [
        `What is ${brandName}?`,
        `Is ${brandName} legitimate?`,
        `${brandName} reviews`,
        `${brandName} scam`,
    ], engines = ["perplexity", "gemini"]) {
        const allAnswers = [];
        for (const query of queries) {
            try {
                const answers = await this.queryMultipleEngines(query, engines);
                allAnswers.push(...answers);
            }
            catch (error) {
                console.warn(`Failed to query: ${query}`, error);
            }
        }
        return allAnswers;
    }
}
exports.AIAnswerScraper = AIAnswerScraper;
