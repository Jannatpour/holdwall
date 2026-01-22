/**
 * Forum Monitor
 * 
 * Monitors forums and community platforms for brand mentions and discussions.
 * Supports Reddit, HackerNews, Stack Overflow, Quora, and generic forums.
 */

import { WebCrawler } from "./web-crawler";
import { BrowserAutomation } from "./browser-automation";

export interface ForumPost {
  forum: string;
  postId: string;
  title: string;
  content: string;
  author: {
    username: string;
    reputation?: number;
  };
  timestamp: string;
  url: string;
  engagement: {
    upvotes?: number;
    downvotes?: number;
    replies?: number;
    views?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ForumMonitorOptions {
  forum: "reddit" | "hackernews" | "stackoverflow" | "quora" | "generic";
  query?: string;
  subforum?: string; // e.g., subreddit, Stack Overflow tag
  maxPosts?: number;
  since?: Date;
}

export class ForumMonitor {
  private crawler: WebCrawler;
  private browser: BrowserAutomation;

  constructor() {
    this.crawler = new WebCrawler();
    this.browser = new BrowserAutomation();
  }

  /**
   * Monitor Reddit
   */
  private async monitorReddit(
    options: ForumMonitorOptions
  ): Promise<ForumPost[]> {
    const posts: ForumPost[] = [];
    const { query, subforum, maxPosts = 50 } = options;

    try {
      let url: string;
      
      if (subforum) {
        url = `https://www.reddit.com/r/${subforum}/`;
        if (query) {
          url += `search/?q=${encodeURIComponent(query)}`;
        }
      } else if (query) {
        url = `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`;
      } else {
        throw new Error("Either query or subforum must be provided");
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

      // Parse Reddit posts
      const postRegex = /<div[^>]*data-testid="post-container"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      while ((match = postRegex.exec(result.text)) !== null && count < maxPosts) {
        const postHtml = match[1];
        
        // Extract title
        const titleMatch = postHtml.match(/<h3[^>]*>([^<]+)<\/h3>/i);
        const title = titleMatch ? titleMatch[1].trim() : "";

        // Extract author
        const authorMatch = postHtml.match(/<a[^>]*data-testid="post_author"[^>]*>([^<]+)<\/a>/i);
        const username = authorMatch ? authorMatch[1].trim() : "unknown";

        // Extract upvotes
        const upvoteMatch = postHtml.match(/(\d+)\s*upvotes?/i);
        const upvotes = upvoteMatch ? parseInt(upvoteMatch[1], 10) : 0;

        // Extract comments
        const commentMatch = postHtml.match(/(\d+)\s*comments?/i);
        const comments = commentMatch ? parseInt(commentMatch[1], 10) : 0;

        // Extract URL
        const urlMatch = postHtml.match(/<a[^>]*href="([^"]+)"[^>]*data-testid="post_title"/i);
        const postUrl = urlMatch 
          ? (urlMatch[1].startsWith("http") ? urlMatch[1] : `https://reddit.com${urlMatch[1]}`)
          : url;

        if (title) {
          posts.push({
            forum: "reddit",
            postId: `reddit-${Date.now()}-${count}`,
            title,
            content: title, // Reddit titles are often the full content
            author: {
              username,
            },
            timestamp: new Date().toISOString(),
            url: postUrl,
            engagement: {
              upvotes,
              replies: comments,
            },
            metadata: {
              subreddit: subforum,
            },
          });
          count++;
        }
      }
    } catch (error) {
      console.error("Reddit monitoring error:", error);
    }

    return posts;
  }

  /**
   * Monitor HackerNews
   */
  private async monitorHackerNews(
    options: ForumMonitorOptions
  ): Promise<ForumPost[]> {
    const posts: ForumPost[] = [];
    const { query, maxPosts = 50 } = options;

    try {
      let url: string;
      
      if (query) {
        url = `https://news.ycombinator.com/search?q=${encodeURIComponent(query)}`;
      } else {
        url = "https://news.ycombinator.com/";
      }

      const result = await this.crawler.crawlUrl({
        url,
        extractText: true,
        extractLinks: true,
      });

      if (result.error || !result.text) {
        throw new Error(result.error || "Failed to load HackerNews");
      }

      // Parse HackerNews posts (simplified - HN has specific structure)
      const postRegex = /<tr[^>]*class="athing"[^>]*>([\s\S]*?)<\/tr>/gi;
      let match;
      let count = 0;

      while ((match = postRegex.exec(result.text)) !== null && count < maxPosts) {
        const postHtml = match[1];
        
        // Extract title and URL
        const titleMatch = postHtml.match(/<a[^>]*class="titlelink"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
        
        if (titleMatch) {
          const postUrl = titleMatch[1].startsWith("http") 
            ? titleMatch[1] 
            : `https://news.ycombinator.com${titleMatch[1]}`;
          const title = titleMatch[2].trim();

          // Extract points (simplified)
          const pointsMatch = result.text.substring(match.index).match(/(\d+)\s*points?/i);
          const points = pointsMatch ? parseInt(pointsMatch[1], 10) : 0;

          // Extract comments
          const commentMatch = result.text.substring(match.index).match(/(\d+)\s*comments?/i);
          const comments = commentMatch ? parseInt(commentMatch[1], 10) : 0;

          posts.push({
            forum: "hackernews",
            postId: `hn-${Date.now()}-${count}`,
            title,
            content: title,
            author: {
              username: "unknown",
            },
            timestamp: new Date().toISOString(),
            url: postUrl,
            engagement: {
              upvotes: points,
              replies: comments,
            },
          });
          count++;
        }
      }
    } catch (error) {
      console.error("HackerNews monitoring error:", error);
    }

    return posts;
  }

  /**
   * Monitor Stack Overflow
   */
  private async monitorStackOverflow(
    options: ForumMonitorOptions
  ): Promise<ForumPost[]> {
    const posts: ForumPost[] = [];
    const { query, subforum, maxPosts = 50 } = options;

    try {
      let url: string;
      
      if (query) {
        url = `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`;
      } else if (subforum) {
        url = `https://stackoverflow.com/questions/tagged/${encodeURIComponent(subforum)}`;
      } else {
        throw new Error("Either query or subforum (tag) must be provided");
      }

      const result = await this.crawler.crawlUrl({
        url,
        extractText: true,
        extractLinks: true,
      });

      if (result.error || !result.text) {
        throw new Error(result.error || "Failed to load Stack Overflow");
      }

      // Parse Stack Overflow questions
      const questionRegex = /<div[^>]*class="question-summary"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      while ((match = questionRegex.exec(result.text)) !== null && count < maxPosts) {
        const questionHtml = match[1];
        
        // Extract title
        const titleMatch = questionHtml.match(/<a[^>]*class="question-hyperlink"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
        
        if (titleMatch) {
          const questionUrl = titleMatch[1].startsWith("http")
            ? titleMatch[1]
            : `https://stackoverflow.com${titleMatch[1]}`;
          const title = titleMatch[2].trim();

          // Extract votes
          const voteMatch = questionHtml.match(/(\d+)\s*votes?/i);
          const votes = voteMatch ? parseInt(voteMatch[1], 10) : 0;

          // Extract answers
          const answerMatch = questionHtml.match(/(\d+)\s*answers?/i);
          const answers = answerMatch ? parseInt(answerMatch[1], 10) : 0;

          // Extract views
          const viewMatch = questionHtml.match(/(\d+)\s*views?/i);
          const views = viewMatch ? parseInt(viewMatch[1], 10) : 0;

          posts.push({
            forum: "stackoverflow",
            postId: `so-${Date.now()}-${count}`,
            title,
            content: title,
            author: {
              username: "unknown",
            },
            timestamp: new Date().toISOString(),
            url: questionUrl,
            engagement: {
              upvotes: votes,
              replies: answers,
              views,
            },
            metadata: {
              tag: subforum,
            },
          });
          count++;
        }
      }
    } catch (error) {
      console.error("Stack Overflow monitoring error:", error);
    }

    return posts;
  }

  /**
   * Monitor Quora
   */
  private async monitorQuora(
    options: ForumMonitorOptions
  ): Promise<ForumPost[]> {
    const posts: ForumPost[] = [];
    const { query, maxPosts = 50 } = options;

    if (!this.browser.isAvailable()) {
      throw new Error("Browser automation required for Quora");
    }

    try {
      let url: string;
      
      if (query) {
        url = `https://www.quora.com/search?q=${encodeURIComponent(query)}`;
      } else {
        throw new Error("Query must be provided for Quora");
      }

      const result = await this.browser.navigate(url, {
        waitForSelector: ".q-box",
        timeout: 30000,
      });

      if (result.error || !result.content) {
        throw new Error(result.error || "Failed to load Quora");
      }

      // Parse Quora questions/answers
      const postRegex = /<div[^>]*class="q-box"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      while ((match = postRegex.exec(result.content)) !== null && count < maxPosts) {
        const postHtml = match[1];
        
        // Extract question/answer text
        const textMatch = postHtml.match(/<span[^>]*class="q-text"[^>]*>([\s\S]*?)<\/span>/i);
        const text = textMatch 
          ? this.extractTextFromHtml(textMatch[1])
          : "";

        // Extract upvotes
        const upvoteMatch = postHtml.match(/(\d+)\s*upvotes?/i);
        const upvotes = upvoteMatch ? parseInt(upvoteMatch[1], 10) : 0;

        if (text && text.length > 20) {
          posts.push({
            forum: "quora",
            postId: `quora-${Date.now()}-${count}`,
            title: text.substring(0, 100),
            content: text,
            author: {
              username: "unknown",
            },
            timestamp: new Date().toISOString(),
            url: url,
            engagement: {
              upvotes,
            },
          });
          count++;
        }
      }
    } catch (error) {
      console.error("Quora monitoring error:", error);
    }

    return posts;
  }

  /**
   * Monitor generic forum (RSS or HTML parsing)
   */
  private async monitorGeneric(
    options: ForumMonitorOptions & { forumUrl?: string }
  ): Promise<ForumPost[]> {
    const posts: ForumPost[] = [];
    const { forumUrl, maxPosts = 50 } = options;

    if (!forumUrl) {
      throw new Error("forumUrl must be provided for generic forum");
    }

    try {
      const result = await this.crawler.crawlUrl({
        url: forumUrl,
        extractText: true,
        extractLinks: true,
      });

      if (result.error || !result.text) {
        throw new Error(result.error || "Failed to load forum");
      }

      // Generic forum parsing - look for common patterns
      // This is a simplified implementation
      const postRegex = /<div[^>]*(?:class|id)=["'](?:post|thread|topic)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let count = 0;

      while ((match = postRegex.exec(result.text)) !== null && count < maxPosts) {
        const postHtml = match[1];
        const text = this.extractTextFromHtml(postHtml);

        if (text && text.length > 50) {
          posts.push({
            forum: "generic",
            postId: `generic-${Date.now()}-${count}`,
            title: text.substring(0, 100),
            content: text,
            author: {
              username: "unknown",
            },
            timestamp: new Date().toISOString(),
            url: forumUrl,
            engagement: {},
          });
          count++;
        }
      }
    } catch (error) {
      console.error("Generic forum monitoring error:", error);
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
   * Monitor forum for brand mentions
   */
  async monitor(options: ForumMonitorOptions): Promise<ForumPost[]> {
    const { forum } = options;

    switch (forum) {
      case "reddit":
        return await this.monitorReddit(options);
      case "hackernews":
        return await this.monitorHackerNews(options);
      case "stackoverflow":
        return await this.monitorStackOverflow(options);
      case "quora":
        return await this.monitorQuora(options);
      case "generic":
        return await this.monitorGeneric(options as ForumMonitorOptions & { forumUrl?: string });
      default:
        throw new Error(`Unsupported forum: ${forum}`);
    }
  }

  /**
   * Monitor multiple forums for brand mentions
   */
  async monitorMultipleForums(
    brandName: string,
    forums: Array<"reddit" | "hackernews" | "stackoverflow" | "quora"> = ["reddit", "hackernews"],
    maxPostsPerForum: number = 20
  ): Promise<ForumPost[]> {
    const allPosts: ForumPost[] = [];

    for (const forum of forums) {
      try {
        const posts = await this.monitor({
          forum,
          query: brandName,
          maxPosts: maxPostsPerForum,
        });
        allPosts.push(...posts);
      } catch (error) {
        console.warn(`Failed to monitor ${forum}:`, error);
      }
    }

    return allPosts;
  }
}
