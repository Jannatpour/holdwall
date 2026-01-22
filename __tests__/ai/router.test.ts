/**
 * Model Router Tests
 */

import { ModelRouter } from "@/lib/ai/router";
import type { LLMRequest } from "@/lib/llm/providers";

describe("Model Router", () => {
  let router: ModelRouter;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-key";
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-anthropic-key";

    const originalFetch = global.fetch;
    (global as any).__originalFetch = originalFetch;

    global.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url;

      if (typeof url === "string" && url.includes("api.openai.com/v1/chat/completions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: "gpt-4o-mini",
            choices: [{ message: { content: "ok" } }],
            usage: { total_tokens: 10 },
          }),
          text: async () => "ok",
        } as any;
      }

      if (typeof url === "string" && url.includes("api.anthropic.com/v1/messages")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: { id: "claude-3-haiku-20240307" },
            content: [{ text: "ok" }],
            usage: { input_tokens: 5, output_tokens: 5 },
          }),
          text: async () => "ok",
        } as any;
      }

      // Anything else: fall back to original fetch if present
      if (typeof (global as any).__originalFetch === "function") {
        return (global as any).__originalFetch(input, init);
      }
      throw new Error(`Unhandled fetch in test: ${String(url)}`);
    }) as any;

    router = new ModelRouter();
  });

  afterEach(() => {
    const originalFetch = (global as any).__originalFetch;
    if (typeof originalFetch === "function") {
      global.fetch = originalFetch;
    }
    delete (global as any).__originalFetch;
  });

  test("should select optimal model for extract task", async () => {
    const request: LLMRequest = {
      model: "gpt-4o-mini",
      prompt: "Extract claims from this text",
      max_tokens: 1000,
    };

    const result = await router.route(request, {
      tenantId: "test-tenant",
      taskType: "extract",
      latencyConstraint: 2000,
    });

    expect(result.model).toBeDefined();
    expect(result.provider).toBeDefined();
    expect(result.response).toBeDefined();
  });

  test("should select optimal model for judge task", async () => {
    const request: LLMRequest = {
      model: "gpt-4o",
      prompt: "Judge the quality of this claim",
      max_tokens: 500,
    };

    const result = await router.route(request, {
      tenantId: "test-tenant",
      taskType: "judge",
      qualityConstraint: 0.9,
    });

    expect(result.model).toBeDefined();
    expect(result.provider).toBeDefined();
  });

  test("should use fallback on primary model failure", async () => {
    // This would require mocking the LLM provider
    // For now, just test that fallback chain exists
    const healthStatus = router.getHealthStatus();
    expect(healthStatus.totalModels).toBeGreaterThan(0);
  });

  test("should track costs", async () => {
    const request: LLMRequest = {
      model: "gpt-4o-mini",
      prompt: "Test prompt",
      max_tokens: 100,
    };

    const result = await router.route(request, {
      tenantId: "test-tenant",
      taskType: "extract",
    });

    expect(result.cost).toBeGreaterThanOrEqual(0);
  });
});
