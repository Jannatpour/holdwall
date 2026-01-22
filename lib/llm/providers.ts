/**
 * LLM Providers
 * Multi-provider LLM integration (OpenAI, Anthropic, etc.)
 */

export interface LLMRequest {
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
}

export interface LLMResponse {
  text: string;
  tokens_used: number;
  cost: number;
  model: string;
}

export interface LLMStreamOptions {
  signal?: AbortSignal;
  /**
   * Called with incremental text deltas as they arrive from the provider.
   * Must be fast and non-blocking.
   */
  onDelta: (delta: string) => void;
}

export class LLMProvider {
  private openaiApiKey: string | null = null;
  private anthropicApiKey: string | null = null;
  private cache = new Map<string, LLMResponse>();

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || null;
  }

  /**
   * Call LLM
   */
  async call(request: LLMRequest): Promise<LLMResponse> {
    // Check cache
    const cacheKey = `${request.model}:${request.prompt.substring(0, 100)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const provider = this.detectProvider(request.model);

    let response: LLMResponse;
    switch (provider) {
      case "openai":
        response = await this.callOpenAI(request);
        break;
      case "anthropic":
        response = await this.callAnthropic(request);
        break;
      default:
        response = await this.callGeneric(request);
    }

    // Cache response
    this.cache.set(cacheKey, response);
    return response;
  }

  private detectProvider(model: string): "openai" | "anthropic" | "generic" {
    if (model.startsWith("gpt-") || model.startsWith("o1-") || model.startsWith("o3-")) {
      return "openai";
    }
    if (model.startsWith("claude-")) {
      return "anthropic";
    }
    return "generic";
  }

  /**
   * Stream LLM output.
   *
   * This is used by AG-UI SSE/WS streaming endpoints to provide true token
   * streaming (not post-hoc chunking).
   */
  async callStream(request: LLMRequest, options: LLMStreamOptions): Promise<LLMResponse> {
    const provider = this.detectProvider(request.model);
    switch (provider) {
      case "openai":
        return await this.callOpenAIStream(request, options);
      case "anthropic":
        return await this.callAnthropicStream(request, options);
      default:
        // Generic providers are not supported for streaming in this repo yet.
        return await this.callGeneric(request);
    }
  }

  private async callOpenAIStream(request: LLMRequest, options: LLMStreamOptions): Promise<LLMResponse> {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: options.signal,
      headers: {
        "Authorization": `Bearer ${this.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        stream: true,
        // Request usage in the stream where supported
        stream_options: { include_usage: true },
        messages: [
          ...(request.system_prompt
            ? [{ role: "system", content: request.system_prompt }]
            : []),
          { role: "user", content: request.prompt },
        ],
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 2000,
      }),
    });

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI API streaming error: ${response.status} ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let tokensUsed = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by double newline
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n").filter((l) => l.startsWith("data:"));
        for (const line of lines) {
          const data = line.slice("data:".length).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta: string = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              text += delta;
              options.onDelta(delta);
            }
            const usage = parsed.usage;
            if (usage && typeof usage.total_tokens === "number") {
              tokensUsed = usage.total_tokens;
            }
          } catch {
            // Ignore malformed chunks
          }
        }
      }
    }

    const cost = tokensUsed > 0 ? this.calculateOpenAICost(request.model, tokensUsed) : 0;
    return { text, tokens_used: tokensUsed, cost, model: request.model };
  }

  private async callAnthropicStream(request: LLMRequest, options: LLMStreamOptions): Promise<LLMResponse> {
    if (!this.anthropicApiKey) {
      throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: options.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        stream: true,
        max_tokens: request.max_tokens || 2000,
        temperature: request.temperature || 0.7,
        messages: [{
          role: "user",
          content: request.system_prompt
            ? `${request.system_prompt}\n\n${request.prompt}`
            : request.prompt,
        }],
      }),
    });

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`Anthropic API streaming error: ${response.status} ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n").filter((l) => l.startsWith("data:"));
        for (const line of lines) {
          const data = line.slice("data:".length).trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);

            // Anthropic streaming uses event-like payloads with types.
            if (parsed.type === "content_block_delta") {
              const deltaText: string = parsed.delta?.text ?? "";
              if (deltaText) {
                text += deltaText;
                options.onDelta(deltaText);
              }
            }

            if (parsed.type === "message_start") {
              inputTokens = parsed.message?.usage?.input_tokens ?? 0;
              outputTokens = parsed.message?.usage?.output_tokens ?? 0;
            }

            if (parsed.type === "message_delta") {
              // usage can be updated here
              if (parsed.usage) {
                inputTokens = typeof parsed.usage.input_tokens === "number" ? parsed.usage.input_tokens : inputTokens;
                outputTokens = typeof parsed.usage.output_tokens === "number" ? parsed.usage.output_tokens : outputTokens;
              }
            }

            if (parsed.type === "message_stop") {
              // end
            }
          } catch {
            // ignore
          }
        }
      }
    }

    const tokensUsed = inputTokens + outputTokens;
    const cost = tokensUsed > 0 ? this.calculateAnthropicCost(request.model, tokensUsed) : 0;
    return { text, tokens_used: tokensUsed, cost, model: request.model };
  }

  private async callOpenAI(request: LLMRequest): Promise<LLMResponse> {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            ...(request.system_prompt ? [{
              role: "system",
              content: request.system_prompt,
            }] : []),
            {
              role: "user",
              content: request.prompt,
            },
          ],
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 2000,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || "";
      const tokensUsed = data.usage?.total_tokens || 0;

      // Calculate cost (approximate)
      const cost = this.calculateOpenAICost(request.model, tokensUsed);

      return {
        text,
        tokens_used: tokensUsed,
        cost,
        model: data.model || request.model,
      };
    } catch (error) {
      console.error("OpenAI API call failed:", error);
      throw error;
    }
  }

  private async callAnthropic(request: LLMRequest): Promise<LLMResponse> {
    if (!this.anthropicApiKey) {
      throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.");
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.max_tokens || 2000,
          temperature: request.temperature || 0.7,
          messages: [{
            role: "user",
            content: request.system_prompt
              ? `${request.system_prompt}\n\n${request.prompt}`
              : request.prompt,
          }],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.content[0]?.text || "";
      const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

      // Calculate cost (approximate)
      const cost = this.calculateAnthropicCost(request.model, tokensUsed);

      return {
        text,
        tokens_used: tokensUsed,
        cost,
        model: data.model?.id || request.model,
      };
    } catch (error) {
      console.error("Anthropic API call failed:", error);
      throw error;
    }
  }

  private async callGeneric(request: LLMRequest): Promise<LLMResponse> {
    throw new Error(
      `Unsupported model/provider for model "${request.model}". Configure a supported provider (OpenAI or Anthropic) or use a supported model name.`
    );
  }

  /**
   * Calculate OpenAI cost (approximate, based on pricing as of 2024)
   */
  private calculateOpenAICost(model: string, tokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4o": { input: 0.0025 / 1000, output: 0.01 / 1000 },
      "gpt-4-turbo": { input: 0.01 / 1000, output: 0.03 / 1000 },
      "gpt-4": { input: 0.03 / 1000, output: 0.06 / 1000 },
      "gpt-3.5-turbo": { input: 0.0005 / 1000, output: 0.0015 / 1000 },
    };

    const modelPricing = pricing[model] || pricing["gpt-3.5-turbo"];
    // Assume 50/50 input/output split for simplicity
    return (tokens / 2) * modelPricing.input + (tokens / 2) * modelPricing.output;
  }

  /**
   * Calculate Anthropic cost (approximate, based on pricing as of 2024)
   */
  private calculateAnthropicCost(model: string, tokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-3-opus-20240229": { input: 0.015 / 1000, output: 0.075 / 1000 },
      "claude-3-sonnet-20240229": { input: 0.003 / 1000, output: 0.015 / 1000 },
      "claude-3-haiku-20240307": { input: 0.00025 / 1000, output: 0.00125 / 1000 },
    };

    const modelPricing = pricing[model] || pricing["claude-3-sonnet-20240229"];
    // Assume 50/50 input/output split for simplicity
    return (tokens / 2) * modelPricing.input + (tokens / 2) * modelPricing.output;
  }
}
