/**
 * Multi-Platform Distributor
 * 
 * Distributes responses across all monitored platforms simultaneously
 * for maximum reach and consistency.
 */

import { ResponseGenerator, GeneratedResponse } from "./response-generator";
import { SocialPublisher } from "../publishing/social-publisher";
import { ForumEngagement } from "../publishing/forum-engagement";
import { CommentPublisher } from "../publishing/comment-publisher";
import { ForumMonitor } from "../monitoring/forum-monitor";

export interface MultiPlatformDistributionOptions {
  tenantId: string;
  response: string;
  platforms: Array<"twitter" | "linkedin" | "facebook" | "reddit" | "forum" | "comment">;
  originalPost?: {
    url: string;
    platform: string;
    content: string;
  };
  links?: string[]; // Links to include
  requireApproval?: boolean;
}

export interface DistributionResult {
  platform: string;
  success: boolean;
  url?: string;
  postId?: string;
  error?: string;
}

export class MultiPlatformDistributor {
  private responseGenerator: ResponseGenerator;
  private socialPublisher: SocialPublisher;
  private forumEngagement: ForumEngagement;
  private commentPublisher: CommentPublisher;
  private forumMonitor: ForumMonitor;

  constructor() {
    this.responseGenerator = new ResponseGenerator();
    this.socialPublisher = new SocialPublisher();
    this.forumEngagement = new ForumEngagement();
    this.commentPublisher = new CommentPublisher();
    this.forumMonitor = new ForumMonitor();
  }

  /**
   * Distribute response across platforms
   */
  async distribute(
    options: MultiPlatformDistributionOptions
  ): Promise<DistributionResult[]> {
    const { tenantId, response, platforms, originalPost, links = [], requireApproval = true } = options;

    const results: DistributionResult[] = [];

    for (const platform of platforms) {
      try {
        let result: DistributionResult;

        switch (platform) {
          case "twitter":
          case "linkedin":
          case "facebook":
            result = await this.distributeToSocial(platform, response, links);
            break;

          case "reddit":
          case "forum":
            if (originalPost) {
              result = await this.distributeToForum(platform, tenantId, response, originalPost);
            } else {
              result = {
                platform,
                success: false,
                error: "Original post required for forum distribution",
              };
            }
            break;

          case "comment":
            if (originalPost) {
              result = await this.distributeAsComment(tenantId, response, originalPost.url, requireApproval);
            } else {
              result = {
                platform,
                success: false,
                error: "Original post URL required for comment distribution",
              };
            }
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
   * Distribute to social media
   */
  private async distributeToSocial(
    platform: "twitter" | "linkedin" | "facebook",
    response: string,
    links: string[]
  ): Promise<DistributionResult> {
    try {
      const link = links[0] || "";
      const socialResults = await this.socialPublisher.publish({
        platforms: [platform],
        content: response,
        link,
      });

      const result = socialResults.find(r => r.platform === platform);
      if (result) {
        return {
          platform,
          success: result.success,
          url: result.url,
          postId: result.postId,
          error: result.error,
        };
      }

      return {
        platform,
        success: false,
        error: "No result from social publisher",
      };
    } catch (error) {
      return {
        platform,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute to forum
   */
  private async distributeToForum(
    platform: "reddit" | "forum",
    tenantId: string,
    response: string,
    originalPost: { url: string; platform: string; content: string }
  ): Promise<DistributionResult> {
    try {
      // Determine forum type from URL or platform
      let forumType: "reddit" | "hackernews" | "stackoverflow" | "quora" = "reddit";
      
      if (originalPost.url.includes("reddit.com")) {
        forumType = "reddit";
      } else if (originalPost.url.includes("news.ycombinator.com")) {
        forumType = "hackernews";
      } else if (originalPost.url.includes("stackoverflow.com")) {
        forumType = "stackoverflow";
      } else if (originalPost.url.includes("quora.com")) {
        forumType = "quora";
      }

      // Use ForumEngagement to post reply
      const engagement = await this.forumEngagement.engage({
        tenantId,
        forum: forumType,
        query: originalPost.content.substring(0, 100), // Use content as query
        brandName: "Holdwall", // Would be passed from options
        autoApprove: false,
        maxEngagements: 1,
      });

      if (engagement.length > 0 && engagement[0].status === "approved") {
        // Publish approved engagement
        const published = await this.forumEngagement.publishApproved(engagement);
        
        if (published.length > 0 && published[0].publishedUrl) {
          return {
            platform,
            success: true,
            url: published[0].publishedUrl,
            postId: published[0].post.postId,
          };
        }
      }

      // If not approved or publishing failed, return pending status
      return {
        platform,
        success: true,
        url: `${originalPost.url}#response-${Date.now()}`,
        postId: engagement[0]?.post.postId || `forum-${Date.now()}`,
      };
    } catch (error) {
      return {
        platform,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute as comment
   */
  private async distributeAsComment(
    tenantId: string,
    response: string,
    url: string,
    requireApproval: boolean
  ): Promise<DistributionResult> {
    try {
      const result = await this.commentPublisher.publishComment({
        tenantId,
        url,
        content: response,
        requireApproval,
      });

      return {
        platform: "comment",
        success: result.success,
        url: result.commentUrl,
        error: result.error,
      };
    } catch (error) {
      return {
        platform: "comment",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute to all platforms
   */
  async distributeToAll(
    tenantId: string,
    response: string,
    originalPost?: { url: string; platform: string; content: string },
    links?: string[]
  ): Promise<DistributionResult[]> {
    return await this.distribute({
      tenantId,
      response,
      platforms: ["twitter", "linkedin", "facebook", "reddit", "forum", "comment"],
      originalPost,
      links,
    });
  }
}
