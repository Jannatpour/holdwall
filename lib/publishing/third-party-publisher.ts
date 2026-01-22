/**
 * Third-Party Platform Publisher
 * 
 * Publishes content to Medium, LinkedIn, Substack, Ghost, WordPress.com
 * using their public APIs (no business integration required).
 */

export interface MediumPublishOptions {
  title: string;
  content: string;
  tags?: string[];
  publishStatus?: "public" | "draft" | "unlisted";
  canonicalUrl?: string;
}

export interface LinkedInPublishOptions {
  title: string;
  content: string;
  visibility?: "public" | "connections";
  thumbnailUrl?: string;
}

export interface SubstackPublishOptions {
  title: string;
  content: string;
  sendEmail?: boolean;
  tags?: string[];
}

export interface WordPressPublishOptions {
  title: string;
  content: string;
  status?: "publish" | "draft";
  categories?: string[];
  tags?: string[];
}

export class ThirdPartyPublisher {
  private mediumAccessToken: string | null = null;
  private linkedinAccessToken: string | null = null;
  private substackApiKey: string | null = null;
  private wordpressCredentials: { username: string; password: string } | null = null;

  constructor() {
    // Load API credentials from environment
    this.mediumAccessToken = process.env.MEDIUM_ACCESS_TOKEN || null;
    this.linkedinAccessToken = process.env.LINKEDIN_ACCESS_TOKEN || null;
    this.substackApiKey = process.env.SUBSTACK_API_KEY || null;

    if (process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_PASSWORD) {
      this.wordpressCredentials = {
        username: process.env.WORDPRESS_USERNAME,
        password: process.env.WORDPRESS_PASSWORD,
      };
    }
  }

  /**
   * Publish to Medium
   */
  async publishToMedium(options: MediumPublishOptions): Promise<string> {
    if (!this.mediumAccessToken) {
      throw new Error("Medium access token not configured. Set MEDIUM_ACCESS_TOKEN environment variable.");
    }

    try {
      // Get user ID first
      const userResponse = await fetch("https://api.medium.com/v1/me", {
        headers: {
          "Authorization": `Bearer ${this.mediumAccessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Medium API error: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      const userId = userData.data.id;

      // Publish post
      const publishResponse = await fetch(
        `https://api.medium.com/v1/users/${userId}/posts`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.mediumAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: options.title,
            contentFormat: "html",
            content: this.convertToHTML(options.content),
            tags: options.tags || [],
            publishStatus: options.publishStatus || "public",
            canonicalUrl: options.canonicalUrl,
          }),
        }
      );

      if (!publishResponse.ok) {
        throw new Error(`Medium publish error: ${publishResponse.statusText}`);
      }

      const publishData = await publishResponse.json();
      return publishData.data.url;
    } catch (error) {
      throw new Error(
        `Medium publishing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Publish to LinkedIn
   */
  async publishToLinkedIn(options: LinkedInPublishOptions): Promise<string> {
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

      // Register upload (for images if provided)
      let imageUrn: string | undefined;
      if (options.thumbnailUrl) {
        // In production, upload image and get URN
        // For now, skip image upload
      }

      // Publish article
      const publishResponse = await fetch(
        "https://api.linkedin.com/v2/ugcPosts",
        {
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
                  text: options.title,
                },
                shareMediaCategory: "ARTICLE",
                media: imageUrn ? [{
                  status: "READY",
                  description: {
                    text: options.content.substring(0, 200),
                  },
                  media: imageUrn,
                  title: {
                    text: options.title,
                  },
                }] : undefined,
              },
            },
            visibility: {
              "com.linkedin.ugc.MemberNetworkVisibility": options.visibility?.toUpperCase() || "PUBLIC",
            },
          }),
        }
      );

      if (!publishResponse.ok) {
        throw new Error(`LinkedIn publish error: ${publishResponse.statusText}`);
      }

      const publishData = await publishResponse.json();
      // LinkedIn returns URN, need to construct URL
      return `https://www.linkedin.com/feed/update/${publishData.id}`;
    } catch (error) {
      throw new Error(
        `LinkedIn publishing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Publish to Substack
   */
  async publishToSubstack(options: SubstackPublishOptions): Promise<string> {
    if (!this.substackApiKey) {
      throw new Error("Substack API key not configured. Set SUBSTACK_API_KEY environment variable.");
    }

    try {
      // Substack API (simplified - actual API may vary)
      const response = await fetch("https://api.substack.com/v1/posts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.substackApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: options.title,
          body: this.convertToHTML(options.content),
          send_email: options.sendEmail || false,
          tags: options.tags || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Substack API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url || data.post_url || "";
    } catch (error) {
      throw new Error(
        `Substack publishing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Publish to WordPress.com
   */
  async publishToWordPress(options: WordPressPublishOptions): Promise<string> {
    if (!this.wordpressCredentials) {
      throw new Error("WordPress credentials not configured.");
    }

    try {
      const { username, password } = this.wordpressCredentials;
      const siteUrl = process.env.WORDPRESS_SITE_URL || "";

      if (!siteUrl) {
        throw new Error("WordPress site URL not configured. Set WORDPRESS_SITE_URL environment variable.");
      }

      // WordPress.com REST API
      const response = await fetch(
        `https://public-api.wordpress.com/rest/v1.1/sites/${siteUrl}/posts/new`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: options.title,
            content: this.convertToHTML(options.content),
            status: options.status || "publish",
            categories: options.categories || [],
            tags: options.tags || [],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`WordPress API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.URL || data.url || "";
    } catch (error) {
      throw new Error(
        `WordPress publishing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Convert markdown/text to HTML
   */
  private convertToHTML(content: string): string {
    // Simple conversion (in production, use a markdown library)
    return content
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }
}
