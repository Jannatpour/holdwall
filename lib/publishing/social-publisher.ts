/**
 * Social Media Publisher
 * 
 * Publishes content to social media platforms (Twitter, LinkedIn, Facebook)
 * using public APIs for maximum reach and engagement.
 */

export interface SocialPublishOptions {
  platforms: Array<"twitter" | "linkedin" | "facebook">;
  content: string;
  link?: string;
  images?: string[];
  hashtags?: string[];
  scheduledTime?: string;
}

export interface SocialPublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

export class SocialPublisher {
  private twitterBearerToken: string | null = null;
  private linkedinAccessToken: string | null = null;
  private facebookAccessToken: string | null = null;

  constructor() {
    // Load API tokens from environment
    this.twitterBearerToken = process.env.TWITTER_BEARER_TOKEN || null;
    this.linkedinAccessToken = process.env.LINKEDIN_ACCESS_TOKEN || null;
    this.facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
  }

  /**
   * Publish to Twitter/X
   */
  private async publishToTwitter(
    options: SocialPublishOptions
  ): Promise<SocialPublishResult> {
    if (!this.twitterBearerToken) {
      throw new Error("Twitter bearer token not configured. Set TWITTER_BEARER_TOKEN environment variable.");
    }

    try {
      // Construct tweet text
      let tweetText = options.content;
      if (options.link) {
        tweetText += ` ${options.link}`;
      }
      if (options.hashtags && options.hashtags.length > 0) {
        tweetText += ` ${options.hashtags.map(h => `#${h}`).join(" ")}`;
      }

      // Twitter API v2
      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.twitterBearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: tweetText.substring(0, 280), // Twitter character limit
        }),
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        platform: "twitter",
        success: true,
        postId: data.data.id,
        url: `https://twitter.com/i/web/status/${data.data.id}`,
      };
    } catch (error) {
      return {
        platform: "twitter",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Publish to LinkedIn
   */
  private async publishToLinkedIn(
    options: SocialPublishOptions
  ): Promise<SocialPublishResult> {
    if (!this.linkedinAccessToken) {
      throw new Error("LinkedIn access token not configured. Set LINKEDIN_ACCESS_TOKEN environment variable.");
    }

    try {
      // Get user profile
      const profileResponse = await fetch("https://api.linkedin.com/v2/me", {
        headers: {
          "Authorization": `Bearer ${this.linkedinAccessToken}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error(`LinkedIn API error: ${profileResponse.statusText}`);
      }

      const profileData = await profileResponse.json();
      const authorUrn = `urn:li:person:${profileData.id}`;

      // Construct post text
      let postText = options.content;
      if (options.link) {
        postText += `\n\n${options.link}`;
      }

      // Publish post
      const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.linkedinAccessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: {
                text: postText,
              },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`LinkedIn publish error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        platform: "linkedin",
        success: true,
        postId: data.id,
        url: `https://www.linkedin.com/feed/update/${data.id}`,
      };
    } catch (error) {
      return {
        platform: "linkedin",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Publish to Facebook
   */
  private async publishToFacebook(
    options: SocialPublishOptions
  ): Promise<SocialPublishResult> {
    if (!this.facebookAccessToken) {
      throw new Error("Facebook access token not configured. Set FACEBOOK_ACCESS_TOKEN environment variable.");
    }

    try {
      const pageId = process.env.FACEBOOK_PAGE_ID;
      if (!pageId) {
        throw new Error("Facebook page ID not configured. Set FACEBOOK_PAGE_ID environment variable.");
      }

      // Construct post message
      let message = options.content;
      if (options.link) {
        message += `\n\n${options.link}`;
      }

      // Publish to Facebook Page
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            access_token: this.facebookAccessToken,
            link: options.link,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        platform: "facebook",
        success: true,
        postId: data.id,
        url: `https://www.facebook.com/${pageId}/posts/${data.id.split("_")[1]}`,
      };
    } catch (error) {
      return {
        platform: "facebook",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Publish to multiple platforms
   */
  async publish(options: SocialPublishOptions): Promise<SocialPublishResult[]> {
    const results: SocialPublishResult[] = [];

    for (const platform of options.platforms) {
      try {
        let result: SocialPublishResult;

        switch (platform) {
          case "twitter":
            result = await this.publishToTwitter(options);
            break;
          case "linkedin":
            result = await this.publishToLinkedIn(options);
            break;
          case "facebook":
            result = await this.publishToFacebook(options);
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
   * Publish to all available platforms
   */
  async publishToAll(
    content: string,
    link?: string
  ): Promise<SocialPublishResult[]> {
    return await this.publish({
      platforms: ["twitter", "linkedin", "facebook"],
      content,
      link,
    });
  }
}
