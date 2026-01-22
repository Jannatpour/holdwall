/**
 * PADL Multi-Channel Distributor
 * 
 * Distributes published artifacts across multiple channels (PADL, Medium, LinkedIn, etc.)
 * for maximum visibility and citation potential.
 * 
 * Autonomous publishing capabilities:
 * - Automatic channel selection based on content type and engagement prediction
 * - Optimal timing coordination across platforms
 * - Schema-rich content generation for AI discovery
 * - Multi-attribute content adaptation
 */

import { DomainPublisher } from "./domain-publisher";
import { ThirdPartyPublisher } from "./third-party-publisher";
import { PRDistributor } from "./pr-distributor";
import { SocialPublisher } from "./social-publisher";
import { Scheduler } from "./scheduler";
import { EngagementPredictor } from "./engagement-predictor";
import { TimingOptimizer } from "./timing-optimizer";
import { ContentAdapter } from "./content-adapter";
import { HashtagOptimizer } from "./hashtag-optimizer";
import { SchemaGenerator } from "../seo/schema-generator";

export interface PADLDistributionOptions {
  artifactId: string;
  content: string;
  title: string;
  channels: Array<"padl" | "medium" | "linkedin" | "substack" | "pr" | "social">;
  padlUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface DistributionResult {
  channel: string;
  success: boolean;
  url?: string;
  error?: string;
}

export interface AutonomousPublishingOptions {
  artifactId: string;
  content: string;
  title: string;
  contentType?: "article" | "faq" | "howto" | "explainer" | "rebuttal" | "incident-response";
  urgency?: "low" | "medium" | "high" | "critical";
  targetAudience?: string[];
  autoSelectChannels?: boolean;
  autoOptimizeTiming?: boolean;
  autoAdaptContent?: boolean;
  policyConstraints?: {
    requireApproval?: boolean;
    maxChannels?: number;
    allowedChannels?: string[];
    minEngagementPrediction?: number;
  };
}

export interface AutonomousPublishingResult {
  decisions: {
    selectedChannels: string[];
    timing: Record<string, string>;
    contentAdaptations: Record<string, string>;
    engagementPredictions: Record<string, number>;
  };
  distributionResults: DistributionResult[];
  schemaGenerated: boolean;
  totalEngagementPredicted: number;
}

export class PADLDistributor {
  private domainPublisher: DomainPublisher;
  private thirdPartyPublisher: ThirdPartyPublisher;
  private prDistributor: PRDistributor;
  private socialPublisher: SocialPublisher;
  private scheduler: Scheduler;
  private engagementPredictor: EngagementPredictor;
  private timingOptimizer: TimingOptimizer;
  private contentAdapter: ContentAdapter;
  private hashtagOptimizer: HashtagOptimizer;
  private schemaGenerator: SchemaGenerator;

  constructor() {
    this.domainPublisher = new DomainPublisher();
    this.thirdPartyPublisher = new ThirdPartyPublisher();
    this.prDistributor = new PRDistributor();
    this.socialPublisher = new SocialPublisher();
    this.scheduler = new Scheduler();
    this.engagementPredictor = new EngagementPredictor();
    this.timingOptimizer = new TimingOptimizer();
    this.contentAdapter = new ContentAdapter();
    this.hashtagOptimizer = new HashtagOptimizer();
    this.schemaGenerator = new SchemaGenerator();
  }

  /**
   * Distribute artifact across multiple channels
   */
  async distribute(
    options: PADLDistributionOptions
  ): Promise<DistributionResult[]> {
    const results: DistributionResult[] = [];

    for (const channel of options.channels) {
      try {
        let result: DistributionResult;

        switch (channel) {
          case "padl":
            result = await this.distributeToPADL(options);
            break;
          case "medium":
            result = await this.distributeToMedium(options);
            break;
          case "linkedin":
            result = await this.distributeToLinkedIn(options);
            break;
          case "substack":
            result = await this.distributeToSubstack(options);
            break;
          case "pr":
            result = await this.distributeToPR(options);
            break;
          case "social":
            result = await this.distributeToSocial(options);
            break;
          default:
            result = {
              channel,
              success: false,
              error: `Unknown channel: ${channel}`,
            };
        }

        results.push(result);
      } catch (error) {
        results.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Distribute to PADL (Public Artifact Delivery Layer)
   */
  private async distributeToPADL(
    options: PADLDistributionOptions
  ): Promise<DistributionResult> {
    try {
      const url = await this.domainPublisher.publish({
        artifactId: options.artifactId,
        content: options.content,
        title: options.title,
        url: options.padlUrl,
        metadata: options.metadata,
      });

      return {
        channel: "padl",
        success: true,
        url,
      };
    } catch (error) {
      return {
        channel: "padl",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute to Medium
   */
  private async distributeToMedium(
    options: PADLDistributionOptions
  ): Promise<DistributionResult> {
    try {
      const url = await this.thirdPartyPublisher.publishToMedium({
        title: options.title,
        content: options.content,
        tags: options.metadata?.tags as string[] || [],
        publishStatus: "public",
      });

      return {
        channel: "medium",
        success: true,
        url,
      };
    } catch (error) {
      return {
        channel: "medium",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute to LinkedIn
   */
  private async distributeToLinkedIn(
    options: PADLDistributionOptions
  ): Promise<DistributionResult> {
    try {
      const url = await this.thirdPartyPublisher.publishToLinkedIn({
        title: options.title,
        content: options.content,
        visibility: "public",
      });

      return {
        channel: "linkedin",
        success: true,
        url,
      };
    } catch (error) {
      return {
        channel: "linkedin",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute to Substack
   */
  private async distributeToSubstack(
    options: PADLDistributionOptions
  ): Promise<DistributionResult> {
    try {
      const url = await this.thirdPartyPublisher.publishToSubstack({
        title: options.title,
        content: options.content,
        sendEmail: false,
      });

      return {
        channel: "substack",
        success: true,
        url,
      };
    } catch (error) {
      return {
        channel: "substack",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute via PR
   */
  private async distributeToPR(
    options: PADLDistributionOptions
  ): Promise<DistributionResult> {
    try {
      const results = await this.prDistributor.distribute({
        title: options.title,
        content: options.content,
        services: ["prnewswire", "businesswire"],
      });

      // Return first successful result
      const success = results.find(r => r.success);
      if (success) {
        return {
          channel: "pr",
          success: true,
          url: success.url,
        };
      } else {
        return {
          channel: "pr",
          success: false,
          error: "All PR services failed",
        };
      }
    } catch (error) {
      return {
        channel: "pr",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Distribute to social media
   */
  private async distributeToSocial(
    options: PADLDistributionOptions
  ): Promise<DistributionResult> {
    try {
      const results = await this.socialPublisher.publish({
        platforms: ["twitter", "linkedin"],
        content: this.createSocialContent(options),
        link: options.padlUrl,
      });

      // Return aggregated result
      const successCount = results.filter(r => r.success).length;
      
      return {
        channel: "social",
        success: successCount > 0,
        url: results.find(r => r.url)?.url,
      };
    } catch (error) {
      return {
        channel: "social",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create social media optimized content
   */
  private createSocialContent(options: PADLDistributionOptions): string {
    // Create a concise, engaging social post
    const maxLength = 280; // Twitter limit
    const excerpt = options.content.substring(0, 200).trim();
    const ellipsis = excerpt.length < options.content.length ? "..." : "";
    
    return `${options.title}\n\n${excerpt}${ellipsis}`;
  }

  /**
   * Distribute to all available channels
   */
  async distributeToAll(
    options: PADLDistributionOptions
  ): Promise<DistributionResult[]> {
    return await this.distribute({
      ...options,
      channels: ["padl", "medium", "linkedin", "substack", "pr", "social"],
    });
  }

  /**
   * Autonomous publishing with automatic channel selection, timing optimization, and content adaptation
   */
  async publishAutonomously(
    options: AutonomousPublishingOptions
  ): Promise<AutonomousPublishingResult> {
    const {
      artifactId,
      content,
      title,
      contentType = "article",
      urgency = "medium",
      autoSelectChannels = true,
      autoOptimizeTiming = true,
      autoAdaptContent = true,
      policyConstraints = {},
    } = options;

    // Step 1: Auto-select optimal channels
    const selectedChannels = autoSelectChannels
      ? await this.selectOptimalChannels(content, title, contentType, urgency, policyConstraints)
      : (policyConstraints.allowedChannels || ["padl"]);

    // Step 2: Generate schema-rich content
    const schemaTypes = this.determineSchemaTypes(contentType);
    const schema = this.schemaGenerator.generate({
      type: schemaTypes[0] as any,
      title,
      content,
      url: "", // Will be set after publishing
    });

    // Step 3: Optimize timing for each channel
    const timing: Record<string, string> = {};
    if (autoOptimizeTiming) {
      for (const channel of selectedChannels) {
        const optimalTiming = this.timingOptimizer.getOptimalTiming(channel);
        timing[channel] = optimalTiming.recommendedTime;
      }
    } else {
      // Use immediate timing
      const now = new Date().toISOString();
      for (const channel of selectedChannels) {
        timing[channel] = now;
      }
    }

    // Step 4: Adapt content for each channel
    const contentAdaptations: Record<string, string> = {};
    const engagementPredictions: Record<string, number> = {};

    if (autoAdaptContent) {
      for (const channel of selectedChannels) {
        const adapted = this.contentAdapter.adapt(content, channel, {
          tone: this.determineTone(contentType, urgency),
          includeHashtags: ["twitter", "linkedin", "facebook"].includes(channel),
          includeLink: true,
        });

        contentAdaptations[channel] = adapted.adapted;

        // Predict engagement
        const factors = this.extractEngagementFactors(adapted.adapted, channel, new Date(timing[channel]));
        const prediction = this.engagementPredictor.predict(channel, factors);
        engagementPredictions[channel] = prediction.predictedEngagement;
      }
    } else {
      // Use original content for all channels
      for (const channel of selectedChannels) {
        contentAdaptations[channel] = content;
        const factors = this.extractEngagementFactors(content, channel, new Date(timing[channel]));
        const prediction = this.engagementPredictor.predict(channel, factors);
        engagementPredictions[channel] = prediction.predictedEngagement;
      }
    }

    // Step 5: Optimize hashtags for social channels
    const socialChannels = selectedChannels.filter(c => 
      ["twitter", "linkedin", "facebook", "social"].includes(c)
    );
    for (const channel of socialChannels) {
      const recommendations = this.hashtagOptimizer.recommendHashtags(
        contentAdaptations[channel],
        channel,
        5
      );
      if (recommendations.length > 0) {
        const selectedHashtags = recommendations
          .slice(0, 5)
          .map(r => r.hashtag);
        contentAdaptations[channel] = `${contentAdaptations[channel]}\n\n${selectedHashtags.map(h => `#${h}`).join(" ")}`;
      }
    }

    // Step 6: Execute distribution
    const distributionResults: DistributionResult[] = [];
    for (const channel of selectedChannels) {
      try {
        const result = await this.distribute({
          artifactId,
          content: contentAdaptations[channel],
          title,
          channels: [channel as any],
          metadata: {
            contentType,
            urgency,
            schema,
            engagementPrediction: engagementPredictions[channel],
            publishedAt: timing[channel],
          },
        });
        distributionResults.push(...result);
      } catch (error) {
        distributionResults.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const totalEngagementPredicted = Object.values(engagementPredictions).reduce((sum, pred) => sum + pred, 0);

    return {
      decisions: {
        selectedChannels,
        timing,
        contentAdaptations,
        engagementPredictions,
      },
      distributionResults,
      schemaGenerated: true,
      totalEngagementPredicted,
    };
  }

  /**
   * Select optimal channels based on content type, urgency, and engagement predictions
   */
  private async selectOptimalChannels(
    content: string,
    title: string,
    contentType: string,
    urgency: string,
    policyConstraints: AutonomousPublishingOptions["policyConstraints"]
  ): Promise<string[]> {
    const allChannels = ["padl", "medium", "linkedin", "substack", "pr", "social"];
    const allowedChannels = policyConstraints?.allowedChannels || allChannels;
    const maxChannels = policyConstraints?.maxChannels || 6;

    // Content type recommendations
    const channelRecommendations: Record<string, string[]> = {
      article: ["padl", "medium", "linkedin"],
      faq: ["padl", "medium"],
      howto: ["padl", "medium", "linkedin"],
      explainer: ["padl", "medium", "substack"],
      rebuttal: ["padl", "pr", "social"],
      "incident-response": ["padl", "pr", "social", "linkedin"],
    };

    const recommended = channelRecommendations[contentType] || ["padl"];

    // Urgency adjustments
    let selected: string[] = [...recommended];
    if (urgency === "critical" || urgency === "high") {
      // Add PR and social for urgent content
      if (!selected.includes("pr")) selected.push("pr");
      if (!selected.includes("social")) selected.push("social");
    }

    // Filter by allowed channels
    selected = selected.filter(c => allowedChannels.includes(c));

    // Predict engagement and select top channels
    if (selected.length > maxChannels) {
      const predictions = await Promise.all(
        selected.map(async (channel) => {
          const factors = this.extractEngagementFactors(content, channel, new Date());
          const prediction = this.engagementPredictor.predict(channel, factors);
          return { channel, engagement: prediction.predictedEngagement };
        })
      );

      // Sort by engagement and take top N
      selected = predictions
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, maxChannels)
        .map(p => p.channel);
    }

    // Apply minimum engagement threshold if set
    if (policyConstraints?.minEngagementPrediction) {
      const filtered: string[] = [];
      for (const channel of selected) {
        const factors = this.extractEngagementFactors(content, channel, new Date());
        const prediction = this.engagementPredictor.predict(channel, factors);
        if (prediction.predictedEngagement >= policyConstraints.minEngagementPrediction!) {
          filtered.push(channel);
        }
      }
      selected = filtered;
    }

    // Always include PADL if allowed
    if (allowedChannels.includes("padl") && !selected.includes("padl")) {
      selected.unshift("padl");
    }

    return selected.length > 0 ? selected : ["padl"];
  }

  /**
   * Determine schema types based on content type
   */
  private determineSchemaTypes(contentType: string): string[] {
    const mapping: Record<string, string[]> = {
      article: ["Article"],
      faq: ["FAQPage"],
      howto: ["HowTo"],
      explainer: ["Article"],
      rebuttal: ["Article"],
      "incident-response": ["Article"],
    };

    return mapping[contentType] || ["Article"];
  }

  /**
   * Determine tone based on content type and urgency
   */
  private determineTone(
    contentType: string,
    urgency: string
  ): "professional" | "casual" | "friendly" {
    if (urgency === "critical") {
      return "professional";
    }

    switch (contentType) {
      case "faq":
      case "howto":
        return "friendly";
      case "rebuttal":
      case "incident-response":
        return "professional";
      default:
        return "professional";
    }
  }

  /**
   * Extract engagement factors from content
   */
  private extractEngagementFactors(
    content: string,
    platform: string,
    time: Date
  ): {
    contentLength: number;
    hashtagCount: number;
    linkCount: number;
    sentiment: "positive" | "negative" | "neutral";
    timing: string;
    dayOfWeek: number;
    hourOfDay: number;
  } {
    return {
      contentLength: content.length,
      hashtagCount: (content.match(/#\w+/g) || []).length,
      linkCount: (content.match(/https?:\/\//g) || []).length,
      sentiment: this.detectSentiment(content),
      timing: time.toISOString(),
      dayOfWeek: time.getDay(),
      hourOfDay: time.getHours(),
    };
  }

  /**
   * Detect sentiment
   */
  private detectSentiment(content: string): "positive" | "negative" | "neutral" {
    const lower = content.toLowerCase();
    const positiveWords = ["good", "great", "excellent", "amazing", "success", "improve"];
    const negativeWords = ["bad", "terrible", "awful", "problem", "issue", "fail"];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount) {
      return "positive";
    } else if (negativeCount > positiveCount) {
      return "negative";
    } else {
      return "neutral";
    }
  }
}
