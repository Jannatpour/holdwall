#!/usr/bin/env tsx
/**
 * API Key Validation Script
 * 
 * Validates that required API keys are configured for AI models:
 * - FactReasoner (requires OPENAI_API_KEY)
 * - VERITAS-NLI (requires OPENAI_API_KEY)
 * - BeliefInference (requires OPENAI_API_KEY)
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local if it exists
config({ path: resolve(process.cwd(), ".env.local") });
// Also load .env as fallback
config({ path: resolve(process.cwd(), ".env") });

interface ApiKeyStatus {
  model: string;
  requiredKey: string;
  configured: boolean;
  value?: string;
}

function validateApiKeys(): {
  allConfigured: boolean;
  statuses: ApiKeyStatus[];
  missing: string[];
} {
  const statuses: ApiKeyStatus[] = [
    {
      model: "FactReasoner",
      requiredKey: "OPENAI_API_KEY",
      configured: !!process.env.OPENAI_API_KEY,
      value: process.env.OPENAI_API_KEY
        ? `${process.env.OPENAI_API_KEY.substring(0, 7)}...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4)}`
        : undefined,
    },
    {
      model: "VERITAS-NLI",
      requiredKey: "OPENAI_API_KEY",
      configured: !!process.env.OPENAI_API_KEY,
      value: process.env.OPENAI_API_KEY
        ? `${process.env.OPENAI_API_KEY.substring(0, 7)}...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4)}`
        : undefined,
    },
    {
      model: "BeliefInference",
      requiredKey: "OPENAI_API_KEY",
      configured: !!process.env.OPENAI_API_KEY,
      value: process.env.OPENAI_API_KEY
        ? `${process.env.OPENAI_API_KEY.substring(0, 7)}...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4)}`
        : undefined,
    },
  ];

  const missing = statuses
    .filter(s => !s.configured)
    .map(s => `${s.model} (requires ${s.requiredKey})`);

  const allConfigured = missing.length === 0;

  return {
    allConfigured,
    statuses,
    missing,
  };
}

function main() {
  console.log("🔑 Validating API Keys for Claim Analysis Models\n");
  console.log("=" .repeat(60));

  const result = validateApiKeys();

  console.log("\n📋 Status:\n");
  result.statuses.forEach(status => {
    const icon = status.configured ? "✅" : "❌";
    console.log(`${icon} ${status.model}`);
    console.log(`   Required: ${status.requiredKey}`);
    if (status.configured) {
      console.log(`   Value: ${status.value}`);
    } else {
      console.log(`   Status: NOT CONFIGURED`);
    }
    console.log();
  });

  if (result.allConfigured) {
    console.log("✅ All API keys are configured!");
    console.log("\nAll three models (FactReasoner, VERITAS-NLI, BeliefInference)");
    console.log("are ready to use with OpenAI API.\n");
    process.exit(0);
  } else {
    console.log("❌ Missing API keys detected!\n");
    console.log("Missing configurations:");
    result.missing.forEach(m => console.log(`  - ${m}`));
    console.log("\n📝 To configure:");
    console.log("1. Create or update your .env.local file:");
    console.log("   OPENAI_API_KEY=sk-your-key-here");
    console.log("\n2. Or set the environment variable:");
    console.log("   export OPENAI_API_KEY=sk-your-key-here");
    console.log("\n3. Get your API key from: https://platform.openai.com/api-keys");
    console.log("\n⚠️  Note: These models will show warnings in tests if API keys are missing.");
    console.log("   They will gracefully handle missing keys but won't function fully.\n");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { validateApiKeys };
