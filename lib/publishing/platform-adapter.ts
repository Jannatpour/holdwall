/**
 * Platform Adapter
 * 
 * Adapts content for each platform's algorithm and format requirements
 * to maximize visibility and engagement.
 */

export interface PlatformAdaptation {
  platform: string;
  original: string;
  adapted: string;
  changes: Array<{
    type: "length" | "format" | "hashtags" | "mentions" | "links";
    description: string;
  }>;
}

export interface PlatformSpecs {
  maxLength: number;
  supportsHashtags: boolean;
  supportsMentions: boolean;
  supportsLinks: boolean;
  supportsImages: boolean;
  supportsVideos: boolean;
  optimalLength?: number;
  hashtagLimit?: number;
}

export class PlatformAdapter {
  private platformSpecs: Map<string, PlatformSpecs> = new Map();

  constructor() {
    this.initializePlatformSpecs();
  }

  /**
   * Initialize platform specifications
   */
  private initializePlatformSpecs(): void {
    this.platformSpecs.set("twitter", {
      maxLength: 280,
      supportsHashtags: true,
      supportsMentions: true,
      supportsLinks: true,
      supportsImages: true,
      supportsVideos: true,
      optimalLength: 240, // Leave room for links
      hashtagLimit: 2,
    });

    this.platformSpecs.set("linkedin", {
      maxLength: 3000,
      supportsHashtags: true,
      supportsMentions: true,
      supportsLinks: true,
      supportsImages: true,
      supportsVideos: true,
      optimalLength: 1500,
      hashtagLimit: 5,
    });

    this.platformSpecs.set("facebook", {
      maxLength: 63206,
      supportsHashtags: true,
      supportsMentions: true,
      supportsLinks: true,
      supportsImages: true,
      supportsVideos: true,
      optimalLength: 250,
      hashtagLimit: 3,
    });

    this.platformSpecs.set("medium", {
      maxLength: Infinity,
      supportsHashtags: false,
      supportsMentions: false,
      supportsLinks: true,
      supportsImages: true,
      supportsVideos: false,
      optimalLength: 1500,
    });

    this.platformSpecs.set("reddit", {
      maxLength: 40000,
      supportsHashtags: false,
      supportsMentions: true,
      supportsLinks: true,
      supportsImages: true,
      supportsVideos: true,
      optimalLength: 500,
    });
  }

  /**
   * Adapt content for platform
   */
  adaptContent(
    content: string,
    platform: string,
    options?: {
      hashtags?: string[];
      mentions?: string[];
      link?: string;
      imageUrl?: string;
    }
  ): PlatformAdaptation {
    const specs = this.platformSpecs.get(platform);
    if (!specs) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    let adapted = content;
    const changes: PlatformAdaptation["changes"] = [];

    // 1. Adjust length
    if (adapted.length > specs.maxLength) {
      const originalLength = adapted.length;
      adapted = adapted.substring(0, specs.maxLength - 3) + "...";
      changes.push({
        type: "length",
        description: `Truncated from ${originalLength} to ${specs.maxLength} characters`,
      });
    } else if (specs.optimalLength && adapted.length < specs.optimalLength) {
      // Could extend, but usually not needed
    }

    // 2. Add hashtags if supported
    if (specs.supportsHashtags && options?.hashtags) {
      const hashtags = options.hashtags
        .slice(0, specs.hashtagLimit || 5)
        .map(h => h.startsWith("#") ? h : `#${h}`)
        .join(" ");

      const hashtagText = ` ${hashtags}`;
      if (adapted.length + hashtagText.length <= specs.maxLength) {
        adapted += hashtagText;
        changes.push({
          type: "hashtags",
          description: `Added ${options.hashtags.length} hashtags`,
        });
      }
    }

    // 3. Add mentions if supported
    if (specs.supportsMentions && options?.mentions) {
      const mentions = options.mentions
        .map(m => m.startsWith("@") ? m : `@${m}`)
        .join(" ");

      const mentionText = ` ${mentions}`;
      if (adapted.length + mentionText.length <= specs.maxLength) {
        adapted = `${mentions} ${adapted}`;
        changes.push({
          type: "mentions",
          description: `Added ${options.mentions.length} mentions`,
        });
      }
    }

    // 4. Add link if supported
    if (specs.supportsLinks && options?.link) {
      const linkText = ` ${options.link}`;
      if (adapted.length + linkText.length <= specs.maxLength) {
        adapted += linkText;
        changes.push({
          type: "links",
          description: "Added link",
        });
      }
    }

    // 5. Platform-specific formatting
    adapted = this.applyPlatformFormatting(adapted, platform);

    return {
      platform,
      original: content,
      adapted,
      changes,
    };
  }

  /**
   * Apply platform-specific formatting
   */
  private applyPlatformFormatting(content: string, platform: string): string {
    switch (platform) {
      case "twitter":
        // Twitter: Use line breaks for readability
        return content.replace(/\n\n+/g, "\n");

      case "linkedin":
        // LinkedIn: Use paragraphs
        return content.replace(/\n\n+/g, "\n\n");

      case "reddit":
        // Reddit: Markdown formatting
        return content;

      case "medium":
        // Medium: Rich text formatting
        return content;

      default:
        return content;
    }
  }

  /**
   * Adapt content for multiple platforms
   */
  adaptForMultiple(
    content: string,
    platforms: string[],
    options?: {
      hashtags?: string[];
      mentions?: string[];
      link?: string;
    }
  ): PlatformAdaptation[] {
    return platforms.map(platform => 
      this.adaptContent(content, platform, options)
    );
  }

  /**
   * Get platform specs
   */
  getPlatformSpecs(platform: string): PlatformSpecs | null {
    return this.platformSpecs.get(platform) || null;
  }
}
