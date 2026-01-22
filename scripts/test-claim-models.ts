#!/usr/bin/env tsx
/**
 * Quick Test Script for Claim Analysis Models
 * 
 * Tests FactReasoner, VERITAS-NLI, and BeliefInference with the configured API key
 */

import { config } from "dotenv";
import { resolve } from "path";
import { FactReasoner } from "@/lib/claims/factreasoner";
import { VERITASNLI } from "@/lib/claims/veritas-nli";
import { BeliefInference } from "@/lib/claims/belief-inference";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const testClaim = "The product has hidden fees that customers are not aware of";

async function testFactReasoner() {
  console.log("\n🧪 Testing FactReasoner...");
  try {
    const factReasoner = new FactReasoner();
    const result = await factReasoner.decompose(testClaim);
    
    console.log("✅ FactReasoner: SUCCESS");
    console.log(`   - Atomic claims: ${result.atomicClaims.length}`);
    console.log(`   - Overall confidence: ${result.overallConfidence.toFixed(2)}`);
    console.log(`   - Evidence gaps: ${result.evidenceGaps.length}`);
    return true;
  } catch (error) {
    console.log("❌ FactReasoner: FAILED");
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testVERITASNLI() {
  console.log("\n🧪 Testing VERITAS-NLI...");
  try {
    const veritas = new VERITASNLI();
    const result = await veritas.verify(testClaim, {
      maxSources: 3, // Reduced for faster testing
    });
    
    console.log("✅ VERITAS-NLI: SUCCESS");
    console.log(`   - Verified: ${result.verified}`);
    console.log(`   - Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`   - Supporting evidence: ${result.supportingEvidence.length}`);
    console.log(`   - Contradicting evidence: ${result.contradictingEvidence.length}`);
    return true;
  } catch (error) {
    console.log("❌ VERITAS-NLI: FAILED");
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testBeliefInference() {
  console.log("\n🧪 Testing BeliefInference...");
  try {
    const beliefInference = new BeliefInference();
    const testClaims = [{
      claim_id: 'test-1',
      tenant_id: 'test-tenant',
      canonical_text: testClaim,
      variants: [testClaim],
      evidence_refs: [],
      decisiveness: 0.7,
      cluster_id: undefined,
      created_at: new Date().toISOString(),
    }];
    
    const result = await beliefInference.inferBeliefNetwork(testClaims);
    
    console.log("✅ BeliefInference: SUCCESS");
    console.log(`   - Network nodes: ${result.nodes.size}`);
    console.log(`   - Clusters: ${result.clusters.length}`);
    return true;
  } catch (error) {
    console.log("❌ BeliefInference: FAILED");
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log("=" .repeat(60));
  console.log("Testing Claim Analysis Models with OpenAI API");
  console.log("=" .repeat(60));
  console.log(`Test Claim: "${testClaim}"`);
  
  const results = {
    factReasoner: await testFactReasoner(),
    veritasNLI: await testVERITASNLI(),
    beliefInference: await testBeliefInference(),
  };
  
  console.log("\n" + "=" .repeat(60));
  console.log("Test Summary");
  console.log("=" .repeat(60));
  console.log(`FactReasoner:     ${results.factReasoner ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`VERITAS-NLI:      ${results.veritasNLI ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`BeliefInference:  ${results.beliefInference ? "✅ PASS" : "❌ FAIL"}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log("\n" + (allPassed ? "✅ All models working correctly!" : "❌ Some models failed"));
  console.log("=" .repeat(60) + "\n");
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
