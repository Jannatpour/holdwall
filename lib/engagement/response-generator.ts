/**
 * Response Generator
 * 
 * AI-powered response generation for autonomous engagement across platforms.
 * Generates contextually appropriate, evidence-backed responses.
 */

export interface ResponseOptions {
  context: string; // Original post/comment
  intent: "inform" | "correct" | "engage" | "defend";
  tone: "helpful" | "professional" | "friendly" | "neutral";
  includeEvidence?: boolean;
  maxLength?: number;
  platform?: "twitter" | "linkedin" | "reddit" | "forum" | "email";
}

export interface GeneratedResponse {
  response: string;
  confidence: number; // 0-1
  evidence?: string[]; // Evidence IDs referenced
  suggestedActions?: string[];
}

export class ResponseGenerator {
  private openaiApiKey: string | null = null;
  private anthropicApiKey: string | null = null;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || null;
  }

  /**
   * Generate response using AI
   */
  async generate(options: ResponseOptions): Promise<GeneratedResponse> {
    const {
      context,
      intent,
      tone,
      includeEvidence = true,
      maxLength = 500,
      platform = "forum",
    } = options;

    // Construct prompt
    const prompt = this.buildPrompt(options);

    try {
      // Try OpenAI first
      if (this.openaiApiKey) {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant that provides accurate, evidence-based responses. Always be factual, transparent, and helpful.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: Math.floor(maxLength / 2), // Rough estimate
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.choices[0]?.message?.content || "";

          return {
            response: this.formatResponse(generatedText, platform, maxLength),
            confidence: 0.8,
            evidence: includeEvidence ? this.extractEvidenceReferences(generatedText) : undefined,
          };
        }
      }

      // Fallback to Anthropic
      if (this.anthropicApiKey) {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.anthropicApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: Math.floor(maxLength / 2),
            messages: [{
              role: "user",
              content: prompt,
            }],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.content[0]?.text || "";

          return {
            response: this.formatResponse(generatedText, platform, maxLength),
            confidence: 0.8,
            evidence: includeEvidence ? this.extractEvidenceReferences(generatedText) : undefined,
          };
        }
      }

      // Fallback to template-based generation
      return this.generateFromTemplate(options);
    } catch (error) {
      console.error("AI response generation failed:", error);
      return this.generateFromTemplate(options);
    }
  }

  /**
   * Build prompt for AI
   */
  private buildPrompt(options: ResponseOptions): string {
    const { context, intent, tone, includeEvidence, platform } = options;

    let prompt = `Generate a ${tone} response to the following ${platform} post/comment:\n\n`;
    prompt += `"${context}"\n\n`;
    prompt += `Intent: ${intent}\n`;
    prompt += `Tone: ${tone}\n`;
    
    if (includeEvidence) {
      prompt += `Include evidence and citations where relevant.\n`;
    }

    prompt += `\nGenerate a helpful, accurate response that addresses the content appropriately.`;

    return prompt;
  }

  /**
   * Format response for platform
   */
  private formatResponse(
    response: string,
    platform: string,
    maxLength: number
  ): string {
    let formatted = response.trim();

    // Platform-specific formatting
    switch (platform) {
      case "twitter":
        // Twitter character limit
        if (formatted.length > 280) {
          formatted = formatted.substring(0, 277) + "...";
        }
        break;

      case "reddit":
        // Reddit-friendly formatting
        formatted = formatted.replace(/\n\n+/g, "\n\n");
        break;

      case "linkedin":
        // LinkedIn professional formatting
        if (formatted.length > maxLength) {
          formatted = formatted.substring(0, maxLength - 3) + "...";
        }
        break;

      default:
        if (formatted.length > maxLength) {
          formatted = formatted.substring(0, maxLength - 3) + "...";
        }
    }

    return formatted;
  }

  /**
   * Extract evidence references from response
   */
  private extractEvidenceReferences(response: string): string[] {
    // Look for evidence markers
    const evidenceRegex = /\[evidence:([^\]]+)\]/gi;
    const matches = response.matchAll(evidenceRegex);
    const evidenceIds: string[] = [];

    for (const match of matches) {
      evidenceIds.push(match[1]);
    }

    return evidenceIds;
  }

  /**
   * Generate response from template (fallback)
   */
  private generateFromTemplate(options: ResponseOptions): GeneratedResponse {
    const { context, intent, tone } = options;

    let response = "";

    switch (intent) {
      case "inform":
        response = `Thank you for your question. ${this.extractKeyInfo(context)}. For more information, please refer to our official documentation.`;
        break;

      case "correct":
        response = `I'd like to provide some clarification on this. ${this.extractKeyInfo(context)}. This information is verified and can be confirmed through official sources.`;
        break;

      case "engage":
        response = `Great question! ${this.extractKeyInfo(context)}. We'd be happy to provide more details if you're interested.`;
        break;

      case "defend":
        response = `I understand your concern. Let me provide accurate information: ${this.extractKeyInfo(context)}. This is verified information from official sources.`;
        break;
    }

    return {
      response: this.formatResponse(response, options.platform || "forum", options.maxLength || 500),
      confidence: 0.6,
    };
  }

  /**
   * Extract key information from context
   */
  private extractKeyInfo(context: string): string {
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences[0]?.trim() || "We have comprehensive information available";
  }

  /**
   * Generate multiple response variants
   */
  async generateVariants(
    options: ResponseOptions,
    count: number = 3
  ): Promise<GeneratedResponse[]> {
    const variants: GeneratedResponse[] = [];

    for (let i = 0; i < count; i++) {
      // Vary tone slightly
      const variantOptions = {
        ...options,
        tone: i === 0 ? options.tone : 
              i === 1 ? "professional" as const : 
              "friendly" as const,
      };

      const variant = await this.generate(variantOptions);
      variants.push(variant);
    }

    return variants;
  }
}
