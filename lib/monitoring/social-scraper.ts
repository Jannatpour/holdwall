/**
 * Social Media Scraper
 * 
 * Scrapes social media platforms without requiring API access.
 * Handles Twitter/X, Reddit, LinkedIn, Facebook public posts.
 */

import { WebCrawler } from "./web-crawler";
import { BrowserAutomation } from "./browser-automation";

export interface SocialPost {
  platform: string;
  postId: string;
  author: {
    username: string;
    displayName?: string;
    verified?: boolean;
  };
  content: string;
  timestamp: string;
  engagement: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
  url: string;
  metadata?: Record<string, unknown>;
}

export interface SocialScrapeOptions {
  platform: "twitter" | "reddit" | "linkedin" | "facebook";
  query?: string; // Search query or hashtag
  username?: string; // Specific user to scrape
  maxPosts?: number;
  since?: Date; // Only posts after this date
  useBrowser?: boolean; // Use browser automation for JS-heavy sites
}

export class SocialScraper {
  private crawler: WebCrawler;
  private browser: BrowserAutomation;

  constructor() {
    this.crawler = new WebCrawler();
    this.browser = new BrowserAutomation();
  }

  /**
   * Scrape Twitter/X posts
   */
  private async scrapeTwitter(
    options: SocialScrapeOptions
  ): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];
    const { query, username, maxPosts = 50 } = options;

    // Twitter/X requires browser automation due to heavy JS
    if (!this.browser.isAvailable()) {
      throw new Error("Browser automation required for Twitter scraping");
    }

    try {
      let url: string;
      
      if (username) {
        url = `https://twitter.com/${username}`;
      } else if (query) {
        url = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query`;
      } else {
        throw new Error("Either query or username must be provided");
      }

      const result = await this.browser.navigate(url, {
        waitForSelector: '[data-testid="tweet"]',
        timeout: 30000,
      });

      if (result.error || !result.content) {
        throw new Error(result.error || "Failed to load Twitter");
      }

      // Parse tweets from HTML
      const tweetRegex = /<article[^>]*data-testid="tweet"[^>]*>([\s\S]*?)<\/article>/gi;
      let match;
      let count = 0;

      while ((match = tweetRegex.exec(result.content)) !== null && count < maxPosts) {
        const tweetHtml = match[1];
        
        // Extract tweet text
        const textMatch = tweetHtml.match(/<div[^>]*data-testid="tweetText"[^>]*>([\s\S]*?)<\/div>/i);
        const text = textMatch 
          ? this.extractTextFromHtml(textMatch[1])
          : "";

        // Extract author
        const authorMatch = tweetHtml.match(/<a[^>]*href="\/\/([^"]+)"[^>]*>/i);
        const authorUrl = authorMatch ? authorMatch[1] : "";
        const username = authorUrl.split("/").pop() || "";

        // Extract timestamp
        const timeMatch = tweetHtml.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i);
        const timestamp = timeMatch ? timeMatch[1] : new Date().toISOString();

        // Extract engagement (simplified)
        const likeMatch = tweetHtml.match(/(\d+)\s*likes?/i);
        const retweetMatch = tweetHtml.match(/(\d+)\s*retweets?/i);
        const replyMatch = tweetHtml.match(/(\d+)\s*replies?/i);

        if (text) {
          posts.push({
            platform: "twitter",
            postId: `${username}-${timestamp}`,
            author: {
              username,
            },
            content: text,
            timestamp,
            engagement: {
              likes: likeMatch ? parseInt(likeMatch[1], 10) : 0,
              shares: retweetMatch ? parseInt(retweetMatch[1], 10) : 0,
              comments: replyMatch ? parseInt(replyMatch[1], 10) : 0,
            },
            url: `https://twitter.com${authorUrl}/status/${timestamp}`,
          });
          count++;
        }
      }
    } catch (error) {
      console.error("Twitter scraping error:", error);
    }

    return posts;
  }

  /**
   * Scrape Reddit posts
   */
  private async scrapeReddit(
    options: SocialScrapeOptions
  ): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];
    const { query, maxPosts = 50 } = options;

    try {
      let url: string;
      
      if (query) {
        url = `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`;
      } else {
        throw new Error("Query must be provided for Reddit");
      }

      const result = await this.crawler.crawlUrl({
        url,
        extractText: true,
        extractLinks: true,
        extractMetadata: true,
      });

      if (result.error || !result.text) {
        throw new Error(result.error || "Failed to load Reddit");
      }

      // Parse Reddit posts (simplified - Reddit has JSON API we could use)
      // For now, extract from HTML
      const postRegex = /<div[^>]*data-testid="post-container"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      while ((match = postRegex.exec(result.text)) !== null && count < maxPosts) {
        const postHtml = match[1];
        
        // Extract title and content
        const titleMatch = postHtml.match(/<h3[^>]*>([^<]+)<\/h3>/i);
        const title = titleMatch ? titleMatch[1].trim() : "";

        // Extract author
        const authorMatch = postHtml.match(/<a[^>]*data-testid="post_author"[^>]*>([^<]+)<\/a>/i);
        const username = authorMatch ? authorMatch[1].trim() : "unknown";

        // Extract subreddit
        const subredditMatch = postHtml.match(/r\/(\w+)/);
        const subreddit = subredditMatch ? subredditMatch[1] : "";

        // Extract upvotes (simplified)
        const upvoteMatch = postHtml.match(/(\d+)\s*upvotes?/i);
        const upvotes = upvoteMatch ? parseInt(upvoteMatch[1], 10) : 0;

        if (title) {
          posts.push({
            platform: "reddit",
            postId: `${subreddit}-${Date.now()}-${count}`,
            author: {
              username,
            },
            content: title,
            timestamp: new Date().toISOString(),
            engagement: {
              likes: upvotes,
            },
            url: `https://reddit.com/r/${subreddit}`,
            metadata: {
              subreddit,
            },
          });
          count++;
        }
      }
    } catch (error) {
      console.error("Reddit scraping error:", error);
    }

    return posts;
  }

  /**
   * Scrape LinkedIn posts
   */
  private async scrapeLinkedIn(
    options: SocialScrapeOptions
  ): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];
    const { query, maxPosts = 50 } = options;

    // LinkedIn requires browser automation and authentication
    if (!this.browser.isAvailable()) {
      throw new Error("Browser automation required for LinkedIn scraping");
    }

    try {
      let url: string;
      
      if (query) {
        url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}`;
      } else {
        throw new Error("Query must be provided for LinkedIn");
      }

      // Note: LinkedIn requires authentication for most content
      // This is a simplified version that may not work without auth
      const result = await this.browser.navigate(url, {
        waitForSelector: ".feed-shared-update-v2",
        timeout: 30000,
      });

      if (result.error || !result.content) {
        throw new Error(result.error || "Failed to load LinkedIn");
      }

      // Parse LinkedIn posts (simplified)
      const postRegex = /<div[^>]*class="feed-shared-update-v2"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      while ((match = postRegex.exec(result.content)) !== null && count < maxPosts) {
        const postHtml = match[1];
        
        // Extract post text
        const textMatch = postHtml.match(/<span[^>]*class="break-words"[^>]*>([\s\S]*?)<\/span>/i);
        const text = textMatch 
          ? this.extractTextFromHtml(textMatch[1])
          : "";

        // Extract author
        const authorMatch = postHtml.match(/<a[^>]*href="\/in\/([^"]+)"[^>]*>/i);
        const username = authorMatch ? authorMatch[1] : "unknown";

        if (text) {
          posts.push({
            platform: "linkedin",
            postId: `${username}-${Date.now()}-${count}`,
            author: {
              username,
            },
            content: text,
            timestamp: new Date().toISOString(),
            engagement: {},
            url: `https://linkedin.com/in/${username}`,
          });
          count++;
        }
      }
    } catch (error) {
      console.error("LinkedIn scraping error:", error);
    }

    return posts;
  }

  /**
   * Scrape Facebook posts (public only)
   */
  private async scrapeFacebook(
    options: SocialScrapeOptions
  ): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];
    const { query, maxPosts = 50 } = options;

    // Facebook requires browser automation
    if (!this.browser.isAvailable()) {
      throw new Error("Browser automation required for Facebook scraping");
    }

    try {
      let url: string;
      
      if (query) {
        url = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(query)}`;
      } else {
        throw new Error("Query must be provided for Facebook");
      }

      const result = await this.browser.navigate(url, {
        waitForSelector: '[data-pagelet="SearchResults"]',
        timeout: 30000,
      });

      if (result.error || !result.content) {
        throw new Error(result.error || "Failed to load Facebook");
      }

      // Parse Facebook posts (simplified - Facebook has strict anti-scraping)
      // This is a basic implementation
      const postRegex = /<div[^>]*role="article"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      while ((match = postRegex.exec(result.content)) !== null && count < maxPosts) {
        const postHtml = match[1];
        
        // Extract post text
        const text = this.extractTextFromHtml(postHtml);

        if (text && text.length > 20) {
          posts.push({
            platform: "facebook",
            postId: `fb-${Date.now()}-${count}`,
            author: {
              username: "unknown",
            },
            content: text,
            timestamp: new Date().toISOString(),
            engagement: {},
            url: url,
          });
          count++;
        }
      }
    } catch (error) {
      console.error("Facebook scraping error:", error);
    }

    return posts;
  }

  /**
   * Extract text from HTML
   */
  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Scrape social media posts
   */
  async scrape(options: SocialScrapeOptions): Promise<SocialPost[]> {
    const { platform } = options;

    switch (platform) {
      case "twitter":
        return await this.scrapeTwitter(options);
      case "reddit":
        return await this.scrapeReddit(options);
      case "linkedin":
        return await this.scrapeLinkedIn(options);
      case "facebook":
        return await this.scrapeFacebook(options);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Search for brand mentions across platforms
   */
  async searchBrandMentions(
    brandName: string,
    platforms: Array<"twitter" | "reddit" | "linkedin" | "facebook"> = ["twitter", "reddit"],
    maxPostsPerPlatform: number = 20
  ): Promise<SocialPost[]> {
    const allPosts: SocialPost[] = [];

    for (const platform of platforms) {
      try {
        const posts = await this.scrape({
          platform,
          query: brandName,
          maxPosts: maxPostsPerPlatform,
        });
        allPosts.push(...posts);
      } catch (error) {
        console.warn(`Failed to scrape ${platform}:`, error);
      }
    }

    return allPosts;
  }
}
