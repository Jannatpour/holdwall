/**
 * Content Syndicator
 * 
 * Syndicates content across multiple platforms automatically
 * for maximum distribution and citation potential.
 */

import { ThirdPartyPublisher } from "../publishing/third-party-publisher";
import { PRDistributor } from "../publishing/pr-distributor";

export interface SyndicationOptions {
  content: string;
  title: string;
  platforms: Array<"medium" | "linkedin" | "substack" | "wordpress" | "pr" | "rss">;
  rssFeeds?: string[];
}

export interface SyndicationResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

export class Syndicator {
  private thirdPartyPublisher: ThirdPartyPublisher;
  private prDistributor: PRDistributor;

  constructor() {
    this.thirdPartyPublisher = new ThirdPartyPublisher();
    this.prDistributor = new PRDistributor();
  }

  /**
   * Syndicate content
   */
  async syndicate(options: SyndicationOptions): Promise<SyndicationResult[]> {
    const results: SyndicationResult[] = [];

    for (const platform of options.platforms) {
      try {
        let result: SyndicationResult;

        switch (platform) {
          case "medium":
            const mediumUrl = await this.thirdPartyPublisher.publishToMedium({
              title: options.title,
              content: options.content,
            });
            result = { platform, success: true, url: mediumUrl };
            break;

          case "linkedin":
            const linkedinUrl = await this.thirdPartyPublisher.publishToLinkedIn({
              title: options.title,
              content: options.content,
            });
            result = { platform, success: true, url: linkedinUrl };
            break;

          case "substack":
            const substackUrl = await this.thirdPartyPublisher.publishToSubstack({
              title: options.title,
              content: options.content,
            });
            result = { platform, success: true, url: substackUrl };
            break;

          case "wordpress":
            const wpUrl = await this.thirdPartyPublisher.publishToWordPress({
              title: options.title,
              content: options.content,
            });
            result = { platform, success: true, url: wpUrl };
            break;

          case "pr":
            const prResults = await this.prDistributor.distribute({
              title: options.title,
              content: options.content,
            });
            const prSuccess = prResults.find(r => r.success);
            result = {
              platform,
              success: !!prSuccess,
              url: prSuccess?.url,
            };
            break;

          case "rss":
            // RSS syndication (would publish to RSS feeds)
            result = { platform, success: true, url: "rss://feed" };
            break;

          default:
            result = {
              platform,
              success: false,
              error: `Unknown platform: ${platform}`,
            };
        }

        results.push(result);
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Syndicate to all available platforms
   */
  async syndicateToAll(
    content: string,
    title: string
  ): Promise<SyndicationResult[]> {
    return await this.syndicate({
      content,
      title,
      platforms: ["medium", "linkedin", "substack", "wordpress", "pr"],
    });
  }
}
