"use strict";
/**
 * News Monitor
 *
 * Monitors news sites, RSS feeds, and media platforms for brand mentions.
 * Supports RSS feeds, news aggregators, and direct news site scraping.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsMonitor = void 0;
const web_crawler_1 = require("./web-crawler");
class NewsMonitor {
    constructor() {
        this.newsApiKey = null;
        this.crawler = new web_crawler_1.WebCrawler();
        this.newsApiKey = process.env.NEWS_API_KEY || null;
    }
    /**
     * Monitor RSS feed
     */
    async monitorRSS(options) {
        const articles = [];
        const { rssUrl, maxArticles = 50 } = options;
        if (!rssUrl) {
            throw new Error("rssUrl must be provided for RSS monitoring");
        }
        try {
            const result = await this.crawler.crawlUrl({
                url: rssUrl,
                extractText: true,
                extractMetadata: true,
            });
            if (result.error || !result.text) {
                throw new Error(result.error || "Failed to load RSS feed");
            }
            // Parse RSS XML (simplified)
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            let count = 0;
            while ((match = itemRegex.exec(result.text)) !== null && count < maxArticles) {
                const itemXml = match[1];
                // Extract title
                const titleMatch = itemXml.match(/<title[^>]*><!\[CDATA\[([^\]]+)\]\]><\/title>|<title[^>]*>([^<]+)<\/title>/i);
                const title = titleMatch ? (titleMatch[1] || titleMatch[2]).trim() : "";
                // Extract link
                const linkMatch = itemXml.match(/<link[^>]*>([^<]+)<\/link>/i);
                const url = linkMatch ? linkMatch[1].trim() : "";
                // Extract description/content
                const descMatch = itemXml.match(/<description[^>]*><!\[CDATA\[([^\]]+)\]\]><\/description>|<description[^>]*>([^<]+)<\/description>/i);
                const content = descMatch
                    ? (descMatch[1] || descMatch[2]).trim()
                    : "";
                // Extract published date
                const dateMatch = itemXml.match(/<pubDate[^>]*>([^<]+)<\/pubDate>|<dc:date[^>]*>([^<]+)<\/dc:date>/i);
                const publishedDate = dateMatch
                    ? new Date(dateMatch[1] || dateMatch[2]).toISOString()
                    : new Date().toISOString();
                // Extract author
                const authorMatch = itemXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>|<author[^>]*>([^<]+)<\/author>/i);
                const author = authorMatch ? (authorMatch[1] || authorMatch[2]).trim() : undefined;
                if (title && url) {
                    articles.push({
                        source: "rss",
                        articleId: `rss-${Date.now()}-${count}`,
                        title,
                        content: content || title,
                        author,
                        publishedDate,
                        url,
                    });
                    count++;
                }
            }
        }
        catch (error) {
            console.error("RSS monitoring error:", error);
        }
        return articles;
    }
    /**
     * Monitor Google News
     */
    async monitorGoogleNews(options) {
        const articles = [];
        const { query, maxArticles = 50, language = "en" } = options;
        if (!query) {
            throw new Error("Query must be provided for Google News");
        }
        try {
            const url = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=${language}`;
            const result = await this.crawler.crawlUrl({
                url,
                extractText: true,
                extractLinks: true,
                extractMetadata: true,
            });
            if (result.error || !result.text) {
                throw new Error(result.error || "Failed to load Google News");
            }
            // Parse Google News articles (simplified - Google News structure changes frequently)
            const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
            let match;
            let count = 0;
            while ((match = articleRegex.exec(result.text)) !== null && count < maxArticles) {
                const articleHtml = match[1];
                // Extract title
                const titleMatch = articleHtml.match(/<h3[^>]*>([^<]+)<\/h3>|<h4[^>]*>([^<]+)<\/h4>/i);
                const title = titleMatch ? (titleMatch[1] || titleMatch[2]).trim() : "";
                // Extract link (Google News uses encoded URLs)
                const linkMatch = articleHtml.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
                let url = linkMatch ? linkMatch[1] : "";
                // Decode Google News URL if needed
                if (url.startsWith("./")) {
                    url = `https://news.google.com${url.substring(1)}`;
                }
                // Extract source
                const sourceMatch = articleHtml.match(/<span[^>]*>([^<]+)<\/span>/i);
                const source = sourceMatch ? sourceMatch[1].trim() : "Google News";
                // Extract time
                const timeMatch = articleHtml.match(/(\d+)\s*(?:hours?|days?|minutes?)\s*ago/i);
                const publishedDate = timeMatch
                    ? this.calculateDateFromRelative(timeMatch[0])
                    : new Date().toISOString();
                if (title && url) {
                    articles.push({
                        source: "google-news",
                        articleId: `gn-${Date.now()}-${count}`,
                        title,
                        content: title, // Google News shows snippets, full content requires visiting URL
                        publishedDate,
                        url,
                        metadata: {
                            sourceName: source,
                        },
                    });
                    count++;
                }
            }
        }
        catch (error) {
            console.error("Google News monitoring error:", error);
        }
        return articles;
    }
    /**
     * Monitor using NewsAPI
     */
    async monitorNewsAPI(options) {
        const articles = [];
        const { query, maxArticles = 50, language = "en" } = options;
        if (!this.newsApiKey) {
            throw new Error("NewsAPI key not configured. Set NEWS_API_KEY environment variable.");
        }
        if (!query) {
            throw new Error("Query must be provided for NewsAPI");
        }
        try {
            const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${language}&sortBy=publishedAt&apiKey=${this.newsApiKey}&pageSize=${maxArticles}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NewsAPI error: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.status === "ok" && data.articles) {
                for (const article of data.articles) {
                    articles.push({
                        source: "newsapi",
                        articleId: `na-${Date.now()}-${articles.length}`,
                        title: article.title || "",
                        content: article.description || article.content || "",
                        author: article.author,
                        publishedDate: article.publishedAt || new Date().toISOString(),
                        url: article.url || "",
                        imageUrl: article.urlToImage,
                        metadata: {
                            sourceName: article.source?.name,
                        },
                    });
                }
            }
        }
        catch (error) {
            console.error("NewsAPI monitoring error:", error);
        }
        return articles;
    }
    /**
     * Monitor direct news site
     */
    async monitorDirect(options) {
        const articles = [];
        const { newsSiteUrl, maxArticles = 50 } = options;
        if (!newsSiteUrl) {
            throw new Error("newsSiteUrl must be provided for direct monitoring");
        }
        try {
            const result = await this.crawler.crawlUrl({
                url: newsSiteUrl,
                extractText: true,
                extractLinks: true,
                extractMetadata: true,
            });
            if (result.error || !result.text) {
                throw new Error(result.error || "Failed to load news site");
            }
            // Parse news articles (generic approach)
            // Look for common article patterns
            const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>|<div[^>]*(?:class|id)=["'](?:article|story|post)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
            let match;
            let count = 0;
            while ((match = articleRegex.exec(result.text)) !== null && count < maxArticles) {
                const articleHtml = match[1] || match[2];
                // Extract title
                const titleMatch = articleHtml.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
                const title = titleMatch ? titleMatch[1].trim() : "";
                // Extract link
                const linkMatch = articleHtml.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
                let url = linkMatch ? linkMatch[1] : "";
                if (url && !url.startsWith("http")) {
                    const baseUrl = new URL(newsSiteUrl);
                    url = new URL(url, baseUrl).toString();
                }
                // Extract content snippet
                const contentMatch = articleHtml.match(/<p[^>]*>([^<]+)<\/p>/i);
                const content = contentMatch ? contentMatch[1].trim() : title;
                if (title && url) {
                    articles.push({
                        source: "direct",
                        articleId: `direct-${Date.now()}-${count}`,
                        title,
                        content,
                        publishedDate: new Date().toISOString(),
                        url,
                        metadata: {
                            sourceUrl: newsSiteUrl,
                        },
                    });
                    count++;
                }
            }
        }
        catch (error) {
            console.error("Direct news monitoring error:", error);
        }
        return articles;
    }
    /**
     * Calculate date from relative time string
     */
    calculateDateFromRelative(relative) {
        const now = new Date();
        const match = relative.match(/(\d+)\s*(hour|day|minute|week|month)/i);
        if (!match) {
            return now.toISOString();
        }
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        const date = new Date(now);
        switch (unit) {
            case "minute":
                date.setMinutes(date.getMinutes() - amount);
                break;
            case "hour":
                date.setHours(date.getHours() - amount);
                break;
            case "day":
                date.setDate(date.getDate() - amount);
                break;
            case "week":
                date.setDate(date.getDate() - amount * 7);
                break;
            case "month":
                date.setMonth(date.getMonth() - amount);
                break;
        }
        return date.toISOString();
    }
    /**
     * Monitor news for brand mentions
     */
    async monitor(options) {
        const { source } = options;
        switch (source) {
            case "rss":
                return await this.monitorRSS(options);
            case "google-news":
                return await this.monitorGoogleNews(options);
            case "newsapi":
                return await this.monitorNewsAPI(options);
            case "direct":
                return await this.monitorDirect(options);
            default:
                throw new Error(`Unsupported news source: ${source}`);
        }
    }
    /**
     * Search for brand mentions across multiple news sources
     */
    async searchBrandMentions(brandName, sources = ["google-news"], maxArticlesPerSource = 20, rssUrls) {
        const allArticles = [];
        for (const source of sources) {
            try {
                let articles;
                if (source === "rss" && rssUrls) {
                    // Monitor multiple RSS feeds
                    for (const rssUrl of rssUrls) {
                        const feedArticles = await this.monitor({
                            source: "rss",
                            rssUrl,
                            query: brandName,
                            maxArticles: maxArticlesPerSource,
                        });
                        allArticles.push(...feedArticles);
                    }
                }
                else {
                    articles = await this.monitor({
                        source,
                        query: brandName,
                        maxArticles: maxArticlesPerSource,
                    });
                    allArticles.push(...articles);
                }
            }
            catch (error) {
                console.warn(`Failed to monitor ${source}:`, error);
            }
        }
        return allArticles;
    }
}
exports.NewsMonitor = NewsMonitor;
