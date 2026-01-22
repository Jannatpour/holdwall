/**
 * Content Adapter
 * 
 * Automatically adapts content length, tone, format for each platform
 * to maximize engagement and citation potential.
 */

import { PlatformAdapter } from "./platform-adapter";

export interface ContentAdaptation {
  platform: string;
  original: string;
  adapted: string;
  changes: Array<{
    type: "length" | "tone" | "format" | "structure";
    description: string;
  }>;
}

export class ContentAdapter {
  private platformAdapter: PlatformAdapter;

  constructor() {
    this.platformAdapter = new PlatformAdapter();
  }

  /**
   * Adapt content for platform
   */
  adapt(
    content: string,
    platform: string,
    options?: {
      tone?: "professional" | "casual" | "friendly";
      includeHashtags?: boolean;
      includeLink?: boolean;
    }
  ): ContentAdaptation {
    const changes: ContentAdaptation["changes"] = [];

    // 1. Platform-specific length and format
    const platformAdaptation = this.platformAdapter.adaptContent(
      content,
      platform,
      {
        hashtags: options?.includeHashtags ? this.extractHashtags(content) : undefined,
        link: options?.includeLink ? this.extractLink(content) : undefined,
      }
    );

    changes.push(...platformAdaptation.changes.map(c => ({
      type: (c.type === "links" || c.type === "mentions" || c.type === "hashtags") ? "format" : c.type,
      description: c.description,
    })));

    // 2. Tone adaptation
    let adapted = platformAdaptation.adapted;
    if (options?.tone) {
      const toneAdapted = this.adaptTone(adapted, options.tone, platform);
      if (toneAdapted !== adapted) {
        adapted = toneAdapted;
        changes.push({
          type: "tone",
          description: `Adapted tone to ${options.tone} for ${platform}`,
        });
      }
    }

    // 3. Structure adaptation
    adapted = this.adaptStructure(adapted, platform);
    if (adapted !== platformAdaptation.adapted) {
      changes.push({
        type: "structure",
        description: `Adapted structure for ${platform}`,
      });
    }

    return {
      platform,
      original: content,
      adapted,
      changes,
    };
  }

  /**
   * Adapt tone
   */
  private adaptTone(
    content: string,
    targetTone: "professional" | "casual" | "friendly",
    platform: string
  ): string {
    let adapted = content;

    switch (targetTone) {
      case "casual":
        // Make more casual
        adapted = adapted.replace(/We are/gi, "We're");
        adapted = adapted.replace(/It is/gi, "It's");
        adapted = adapted.replace(/You are/gi, "You're");
        break;

      case "friendly":
        // Add friendly elements
        if (!adapted.toLowerCase().includes("thanks") && !adapted.toLowerCase().includes("thank you")) {
          adapted = `Thanks for your question! ${adapted}`;
        }
        break;

      case "professional":
        // Ensure professional tone
        adapted = adapted.replace(/gonna/gi, "going to");
        adapted = adapted.replace(/wanna/gi, "want to");
        break;
    }

    return adapted;
  }

  /**
   * Adapt structure
   */
  private adaptStructure(content: string, platform: string): string {
    switch (platform) {
      case "twitter":
        // Twitter: Short paragraphs, line breaks
        return content.replace(/\n\n+/g, "\n");

      case "linkedin":
        // LinkedIn: Paragraphs with spacing
        return content.replace(/\n\n+/g, "\n\n");

      case "reddit":
        // Reddit: Markdown formatting preserved
        return content;

      case "medium":
        // Medium: Rich formatting
        return content;

      default:
        return content;
    }
  }

  /**
   * Extract hashtags from content
   */
  private extractHashtags(content: string): string[] {
    const matches = content.match(/#\w+/g);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Extract link from content
   */
  private extractLink(content: string): string | undefined {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = content.match(urlRegex);
    return matches ? matches[0] : undefined;
  }

  /**
   * Adapt for multiple platforms
   */
  adaptForMultiple(
    content: string,
    platforms: string[],
    options?: {
      tone?: "professional" | "casual" | "friendly";
      includeHashtags?: boolean;
      includeLink?: boolean;
    }
  ): ContentAdaptation[] {
    return platforms.map(platform => 
      this.adapt(content, platform, options)
    );
  }
}
