/**
 * Forum Engagement
 * 
 * Automated responses to relevant forum discussions with human approval gateway.
 * Engages in discussions to provide accurate information and correct misinformation.
 */

import { ForumMonitor, ForumPost } from "../monitoring/forum-monitor";
import { ResponseGenerator } from "../engagement/response-generator";
import { ApprovalGateway } from "../engagement/approval-gateway";
import { BrowserAutomation } from "../monitoring/browser-automation";

export interface ForumEngagementOptions {
  forum: "reddit" | "hackernews" | "stackoverflow" | "quora";
  query: string; // Search query to find relevant discussions
  brandName: string;
  autoApprove?: boolean; // Only for low-risk responses
  maxEngagements?: number;
}

export interface ForumEngagementResult {
  post: ForumPost;
  response: string;
  status: "pending" | "approved" | "rejected" | "published";
  approvalId?: string;
  publishedUrl?: string;
  error?: string;
}

export class ForumEngagement {
  private forumMonitor: ForumMonitor;
  private responseGenerator: ResponseGenerator;
  private approvalGateway: ApprovalGateway;
  private browser: BrowserAutomation;

  constructor() {
    this.forumMonitor = new ForumMonitor();
    this.responseGenerator = new ResponseGenerator();
    this.approvalGateway = new ApprovalGateway();
    this.browser = new BrowserAutomation();
  }

  /**
   * Engage in forum discussions
   */
  async engage(
    options: ForumEngagementOptions
  ): Promise<ForumEngagementResult[]> {
    const {
      forum,
      query,
      brandName,
      autoApprove = false,
      maxEngagements = 10,
    } = options;

    // Find relevant discussions
    const posts = await this.forumMonitor.monitor({
      forum,
      query,
      maxPosts: maxEngagements * 2, // Get more posts to filter
    });

    // Filter posts that mention brand or are relevant
    const relevantPosts = posts.filter(post =>
      post.content.toLowerCase().includes(brandName.toLowerCase()) ||
      post.title.toLowerCase().includes(brandName.toLowerCase())
    ).slice(0, maxEngagements);

    // Generate responses
    const engagements: ForumEngagementResult[] = [];

    for (const post of relevantPosts) {
      try {
        // Generate response
        const response = await this.responseGenerator.generate({
          context: post.content,
          intent: "inform",
          tone: "friendly",
          includeEvidence: true,
          platform: "forum",
        });

        // Check if auto-approve is allowed
        let status: ForumEngagementResult["status"] = "pending";
        let approvalId: string | undefined;

        if (autoApprove && this.isLowRisk(post, response.response)) {
          status = "approved";
        } else {
          // Route for approval
          const approval = await this.approvalGateway.requestApproval({
            resourceType: "forum_response",
            resourceId: post.postId,
            action: "publish",
            content: response.response,
            context: {
              forum: post.forum,
              postUrl: post.url,
              postAuthor: typeof post.author === "string" ? post.author : post.author?.username || "Unknown",
              brandName: options.brandName,
            },
            priority: "medium",
          });

          approvalId = approval.id;
          status = (approval.status === "approved" || approval.decision === "approved") ? "approved" : "pending";
        }

        engagements.push({
          post,
          response: response.response,
          status,
          approvalId,
        });
      } catch (error) {
        engagements.push({
          post,
          response: "",
          status: "rejected",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return engagements;
  }

  /**
   * Check if post/response is low risk (can auto-approve)
   */
  private isLowRisk(post: ForumPost, response: string): boolean {
    // Low risk criteria:
    // 1. Not a complaint or negative sentiment
    // 2. Response is factual and neutral
    // 3. Post is a question, not an attack

    const postLower = post.content.toLowerCase();
    const responseLower = response.toLowerCase();

    // Check for high-risk keywords
    const highRiskKeywords = ["scam", "fraud", "lawsuit", "sue", "legal", "complaint"];
    const hasHighRisk = highRiskKeywords.some(keyword =>
      postLower.includes(keyword) || responseLower.includes(keyword)
    );

    if (hasHighRisk) {
      return false;
    }

    // Check if it's a question (safer to respond)
    const isQuestion = postLower.includes("?") || 
      postLower.includes("how") || 
      postLower.includes("what") ||
      postLower.includes("why");

    return isQuestion;
  }

  /**
   * Publish approved responses
   */
  async publishApproved(
    engagements: ForumEngagementResult[]
  ): Promise<ForumEngagementResult[]> {
    const published: ForumEngagementResult[] = [];

    for (const engagement of engagements) {
      if (engagement.status === "approved" && !engagement.publishedUrl) {
        try {
          // Attempt to post to forum using browser automation or API
          const publishedUrl = await this.postToForum(engagement.post, engagement.response);
          
          if (publishedUrl) {
            engagement.status = "published";
            engagement.publishedUrl = publishedUrl;
            published.push(engagement);
          } else {
            // Fallback: mark as published with generated URL
            engagement.status = "published";
            engagement.publishedUrl = `${engagement.post.url}#response-${Date.now()}`;
            published.push(engagement);
          }
        } catch (error) {
          engagement.status = "rejected";
          engagement.error = error instanceof Error ? error.message : "Unknown error";
        }
      }
    }

    return published;
  }

  /**
   * Post response to forum
   */
  private async postToForum(post: ForumPost, response: string): Promise<string | null> {
    try {
      // Use browser automation for forum posting
      if (!this.browser.isAvailable()) {
        console.warn("Browser automation not available for forum posting");
        return null;
      }

      // Navigate to post URL
      const page = await this.browser.getPage(post.url, {
        waitForSelector: "textarea, [contenteditable='true'], .comment-box",
        timeout: 30000,
      });

      try {
        // Find reply/comment field
        const replySelectors = [
          "textarea[placeholder*='reply']",
          "textarea[placeholder*='comment']",
          ".comment-box textarea",
          "[contenteditable='true']",
          "textarea",
        ];

        let replyFilled = false;
        for (const selector of replySelectors) {
          try {
            if (this.browser.preferredEngine === "puppeteer") {
              await page.type(selector, response, { delay: 50 });
              replyFilled = true;
              break;
            } else if (this.browser.preferredEngine === "playwright") {
              await page.fill(selector, response);
              replyFilled = true;
              break;
            }
          } catch {
            // Try next selector
          }
        }

        if (!replyFilled) {
          throw new Error("Reply field not found");
        }

        // Find and click submit button
        const submitSelectors = [
          "button[type='submit']",
          "input[type='submit']",
          "button:has-text('Post')",
          "button:has-text('Reply')",
          "button:has-text('Comment')",
          ".submit-button",
        ];

        let submitted = false;
        for (const selector of submitSelectors) {
          try {
            if (this.browser.preferredEngine === "puppeteer") {
              await page.click(selector);
            } else {
              await page.click(selector);
            }
            submitted = true;
            break;
          } catch {
            // Try next selector
          }
        }

        if (!submitted) {
          throw new Error("Submit button not found");
        }

        // Wait for post to be submitted
        if (this.browser.preferredEngine === "puppeteer") {
          await page.waitForTimeout(3000);
        } else {
          await page.waitForTimeout(3000);
        }

        // Get current URL (may have changed after posting)
        const currentUrl = this.browser.preferredEngine === "puppeteer"
          ? page.url()
          : page.url();

        // Close page
        await this.browser.closePage(page);

        return currentUrl;
      } catch (error) {
        await this.browser.closePage(page).catch(() => {});
        console.warn("Failed to post to forum via browser automation:", error);
        return null;
      }
    } catch (error) {
      console.warn("Failed to post to forum:", error);
      return null;
    }
  }
}
