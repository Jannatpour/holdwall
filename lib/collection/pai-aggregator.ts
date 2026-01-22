/**
 * Publicly Available Information (PAI) Aggregator
 * 
 * Aggregates massive amounts of public data from various sources
 * for comprehensive brand monitoring and analysis.
 */

import { WebCrawler } from "../monitoring/web-crawler";
import { SocialScraper } from "../monitoring/social-scraper";
import { ForumMonitor } from "../monitoring/forum-monitor";
import { NewsMonitor } from "../monitoring/news-monitor";
import { AIAnswerScraper } from "../monitoring/ai-answer-scraper";

export interface PAISource {
  type: "web" | "social" | "forum" | "news" | "ai-answer";
  url?: string;
  query?: string;
  platform?: string;
  enabled: boolean;
}

export interface PAIData {
  source: PAISource;
  content: string;
  metadata: {
    author?: string;
    timestamp: string;
    url?: string;
    platform?: string;
    engagement?: Record<string, number>;
    [key: string]: unknown;
  };
  relevance: number; // 0-1
}

export interface PAIAggregationOptions {
  brandName: string;
  sources: PAISource[];
  maxItemsPerSource?: number;
  minRelevance?: number;
  since?: Date;
}

export class PAIAggregator {
  private crawler: WebCrawler;
  private socialScraper: SocialScraper;
  private forumMonitor: ForumMonitor;
  private newsMonitor: NewsMonitor;
  private aiAnswerScraper: AIAnswerScraper;

  constructor() {
    this.crawler = new WebCrawler();
    this.socialScraper = new SocialScraper();
    this.forumMonitor = new ForumMonitor();
    this.newsMonitor = new NewsMonitor();
    this.aiAnswerScraper = new AIAnswerScraper();
  }

  /**
   * Aggregate PAI from all enabled sources
   */
  async aggregate(options: PAIAggregationOptions): Promise<PAIData[]> {
    const allData: PAIData[] = [];
    const { brandName, sources, maxItemsPerSource = 50, minRelevance = 0.3 } = options;

    // Process sources in parallel
    const promises = sources
      .filter(s => s.enabled)
      .map(source => this.collectFromSource(source, brandName, maxItemsPerSource));

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled") {
        const data = result.value;
        
        // Filter by relevance
        const relevant = data.filter(d => d.relevance >= minRelevance);
        allData.push(...relevant);
      } else {
        console.warn("Failed to collect from source:", result.reason);
      }
    }

    // Sort by relevance and timestamp
    return allData.sort((a, b) => {
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      return new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime();
    });
  }

  /**
   * Collect data from a single source
   */
  private async collectFromSource(
    source: PAISource,
    brandName: string,
    maxItems: number
  ): Promise<PAIData[]> {
    const data: PAIData[] = [];

    try {
      switch (source.type) {
        case "web":
          if (source.url) {
            const result = await this.crawler.crawlUrl({
              url: source.url,
              extractText: true,
              extractMetadata: true,
            });

            if (result.text) {
              data.push({
                source,
                content: result.text,
                metadata: {
                  timestamp: result.timestamp,
                  url: source.url,
                  ...result.metadata,
                },
                relevance: this.calculateRelevance(result.text, brandName),
              });
            }
          }
          break;

        case "social":
          if (source.platform && source.query) {
            const posts = await this.socialScraper.scrape({
              platform: source.platform as any,
              query: source.query,
              maxPosts: maxItems,
            });

            for (const post of posts) {
              data.push({
                source,
                content: post.content,
                metadata: {
                  author: post.author.username,
                  timestamp: post.timestamp,
                  url: post.url,
                  platform: source.platform,
                  engagement: post.engagement,
                },
                relevance: this.calculateRelevance(post.content, brandName),
              });
            }
          }
          break;

        case "forum":
          if (source.platform && source.query) {
            const posts = await this.forumMonitor.monitor({
              forum: source.platform as any,
              query: source.query,
              maxPosts: maxItems,
            });

            for (const post of posts) {
              data.push({
                source,
                content: post.content,
                metadata: {
                  author: post.author.username,
                  timestamp: post.timestamp,
                  url: post.url,
                  platform: source.platform,
                  engagement: post.engagement,
                },
                relevance: this.calculateRelevance(post.content, brandName),
              });
            }
          }
          break;

        case "news":
          if (source.query) {
            const articles = await this.newsMonitor.monitor({
              source: "google-news",
              query: source.query,
              maxArticles: maxItems,
            });

            for (const article of articles) {
              data.push({
                source,
                content: article.content,
                metadata: {
                  author: article.author,
                  timestamp: article.publishedDate,
                  url: article.url,
                  source: article.source,
                },
                relevance: this.calculateRelevance(article.content, brandName),
              });
            }
          }
          break;

        case "ai-answer":
          if (source.query) {
            const answers = await this.aiAnswerScraper.queryMultipleEngines(
              source.query,
              ["perplexity", "gemini"]
            );

            for (const answer of answers) {
              data.push({
                source,
                content: answer.answer,
                metadata: {
                  timestamp: answer.timestamp,
                  engine: answer.engine,
                  tone: answer.tone,
                  citations: answer.citations,
                },
                relevance: this.calculateRelevance(answer.answer, brandName),
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error(`Error collecting from ${source.type}:`, error);
    }

    return data;
  }

  /**
   * Calculate relevance score (0-1) for content
   */
  private calculateRelevance(content: string, brandName: string): number {
    const lower = content.toLowerCase();
    const brandLower = brandName.toLowerCase();

    // Exact match
    if (lower.includes(brandLower)) {
      let score = 0.7;

      // Increase score if brand appears multiple times
      const occurrences = (lower.match(new RegExp(brandLower, "g")) || []).length;
      score += Math.min(0.2, occurrences * 0.05);

      // Increase score if brand is mentioned prominently (near start)
      const firstIndex = lower.indexOf(brandLower);
      if (firstIndex < 100) {
        score += 0.1;
      }

      return Math.min(1.0, score);
    }

    // Fuzzy match (simplified)
    const words = brandLower.split(/\s+/);
    const matchingWords = words.filter(word => lower.includes(word)).length;
    const wordMatchRatio = matchingWords / words.length;

    return wordMatchRatio * 0.5; // Lower confidence for fuzzy matches
  }

  /**
   * Aggregate from default sources for a brand
   */
  async aggregateDefaultSources(brandName: string): Promise<PAIData[]> {
    const defaultSources: PAISource[] = [
      {
        type: "social",
        platform: "twitter",
        query: brandName,
        enabled: true,
      },
      {
        type: "social",
        platform: "reddit",
        query: brandName,
        enabled: true,
      },
      {
        type: "forum",
        platform: "reddit",
        query: brandName,
        enabled: true,
      },
      {
        type: "news",
        query: brandName,
        enabled: true,
      },
      {
        type: "ai-answer",
        query: `What is ${brandName}?`,
        enabled: true,
      },
    ];

    return await this.aggregate({
      brandName,
      sources: defaultSources,
      maxItemsPerSource: 20,
    });
  }
}
