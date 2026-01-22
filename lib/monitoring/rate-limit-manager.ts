/**
 * Intelligent Rate Limit Manager
 * 
 * Adaptive rate limiting to avoid overwhelming target sites while maximizing coverage.
 * Respects robots.txt crawl-delay directives and implements exponential backoff.
 */

import Redis from "ioredis";

interface RateLimitConfig {
  domain: string;
  requestsPerSecond: number;
  crawlDelay?: number; // From robots.txt
  backoffMultiplier: number;
  maxBackoff: number;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export class RateLimitManager {
  private redis: Redis | null;
  private configs: Map<string, RateLimitConfig> = new Map();
  private memoryCache: Map<string, RequestRecord[]> = new Map();

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl);
      } catch (error) {
        console.warn("Redis not available, using memory cache for rate limiting:", error);
        this.redis = null;
      }
    } else {
      this.redis = null;
    }
  }

  /**
   * Get domain from URL
   */
  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  /**
   * Get or create rate limit config for domain
   */
  private getConfig(domain: string): RateLimitConfig {
    if (!this.configs.has(domain)) {
      this.configs.set(domain, {
        domain,
        requestsPerSecond: 1, // Conservative default
        backoffMultiplier: 1.5,
        maxBackoff: 60, // Max 60 seconds
      });
    }
    return this.configs.get(domain)!;
  }

  /**
   * Update crawl delay from robots.txt
   */
  updateCrawlDelay(domain: string, crawlDelay: number): void {
    const config = this.getConfig(domain);
    config.crawlDelay = crawlDelay;
    this.configs.set(domain, config);
  }

  /**
   * Check if we can make a request and wait if needed
   */
  async checkAndWait(url: string): Promise<void> {
    const domain = this.getDomain(url);
    const config = this.getConfig(domain);

    // Check recent requests
    const now = Date.now();
    const windowMs = 1000; // 1 second window
    const key = `rate_limit:${domain}`;

    if (this.redis) {
      // Use Redis for distributed rate limiting
      const count = await this.redis.incr(key);
      
      if (count === 1) {
        await this.redis.expire(key, 1);
      }

      const delay = config.crawlDelay 
        ? config.crawlDelay * 1000 
        : (1000 / config.requestsPerSecond);

      if (count > config.requestsPerSecond) {
        // Rate limit exceeded, wait
        await this.sleep(delay);
        // Reset counter
        await this.redis.del(key);
      } else if (config.crawlDelay) {
        // Respect crawl delay
        await this.sleep(delay);
      }
    } else {
      // Use memory cache
      const records = this.memoryCache.get(domain) || [];
      
      // Remove old records
      const recentRecords = records.filter(
        r => now - r.timestamp < windowMs
      );

      // Check if we're at the limit
      const totalRequests = recentRecords.reduce((sum, r) => sum + r.count, 0);
      
      if (totalRequests >= config.requestsPerSecond) {
        // Calculate wait time
        const oldestRecord = recentRecords[0];
        const waitTime = windowMs - (now - oldestRecord.timestamp);
        if (waitTime > 0) {
          await this.sleep(waitTime);
        }
        // Clear old records
        this.memoryCache.set(domain, []);
      } else {
        // Record this request
        recentRecords.push({ timestamp: now, count: 1 });
        this.memoryCache.set(domain, recentRecords);
      }

      // Apply crawl delay if set
      if (config.crawlDelay) {
        await this.sleep(config.crawlDelay * 1000);
      }
    }
  }

  /**
   * Record a rate limit error and increase backoff
   */
  async recordRateLimitError(domain: string): Promise<void> {
    const config = this.getConfig(domain);
    
    // Increase backoff
    const currentDelay = config.crawlDelay || (1000 / config.requestsPerSecond);
    const newDelay = Math.min(
      currentDelay * config.backoffMultiplier,
      config.maxBackoff * 1000
    );

    config.crawlDelay = newDelay / 1000;
    this.configs.set(domain, config);
  }

  /**
   * Reset backoff after successful requests
   */
  resetBackoff(domain: string): void {
    const config = this.getConfig(domain);
    if (config.crawlDelay && config.crawlDelay > 1) {
      // Gradually reduce backoff
      config.crawlDelay = Math.max(1, config.crawlDelay / config.backoffMultiplier);
      this.configs.set(domain, config);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup old memory cache entries
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    for (const [domain, records] of this.memoryCache.entries()) {
      const recentRecords = records.filter(
        r => now - r.timestamp < maxAge
      );

      if (recentRecords.length === 0) {
        this.memoryCache.delete(domain);
      } else {
        this.memoryCache.set(domain, recentRecords);
      }
    }
  }
}
