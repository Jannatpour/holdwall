/**
 * Demo Data Generation Script
 * 
 * Generates realistic demo data for demonstrations
 * 
 * Usage:
 *   npm run tsx scripts/demo-data.ts -- --scenario=scam-cluster
 *   npm run tsx scripts/demo-data.ts -- --scenario=outage-response
 *   npm run tsx scripts/demo-data.ts -- --scenario=hidden-fees
 *   npm run tsx scripts/demo-data.ts -- --scenario=data-breach
 *   npm run tsx scripts/demo-data.ts -- --scenario=all
 */

import { db } from "../lib/db/client";
import { logger } from "../lib/logging/logger";

interface DemoScenario {
  name: string;
  description: string;
  generate: () => Promise<void>;
}

// Get tenant ID (create if doesn't exist)
async function getOrCreateTenant(name: string, slug: string) {
  let tenant = await db.tenant.findFirst({
    where: { slug },
  });

  if (!tenant) {
    tenant = await db.tenant.create({
      data: {
        name,
        slug,
      },
    });
    logger.info(`Created tenant: ${name}`);
  }

  return tenant;
}

// Generate signals for a scenario
async function createSignal(data: {
  tenantId: string;
  source: any;
  content: any;
  metadata?: any;
}) {
  // Create evidence first (signals are stored as evidence)
  const evidence = await db.evidence.create({
    data: {
      tenantId: data.tenantId,
      sourceType: data.source.type,
      sourceId: data.source.id || `source-${Date.now()}-${Math.random()}`,
      sourceUrl: data.source.url,
      rawContent: data.content.raw,
      normalizedContent: data.content.normalized || data.content.raw,
      language: data.content.language || "en",
      metadata: data.metadata || {},
      compliance: {
        source_allowed: true,
        collection_method: "api",
        retention_policy: "standard",
      },
    },
  });

  return evidence;
}

// Scenario 1: Scam Cluster
const scamClusterScenario: DemoScenario = {
  name: "scam-cluster",
  description: "Creates a 'scam' narrative cluster with 20 signals",
  generate: async () => {
    console.log("🎭 Generating 'scam' cluster scenario...\n");

    const tenant = await getOrCreateTenant("AcmeBank", "acmebank");
    const signals = [
      "AcmeBank is a total scam! They stole my money and won't respond to my emails.",
      "SCAM ALERT: Do not use AcmeBank. They charge hidden fees and refuse refunds.",
      "I've been scammed by AcmeBank. They promised no fees but charged me $50/month.",
      "AcmeBank is fraudulent. They took money from my account without permission.",
      "Avoid AcmeBank at all costs. This is a complete scam operation.",
      "AcmeBank scammed me out of $500. They won't return my calls or emails.",
      "This bank is a scam. They advertise free checking but charge hidden fees everywhere.",
      "I got scammed by AcmeBank. They said one thing but did another. Stay away!",
      "AcmeBank is running a scam. They're taking money from customers illegally.",
      "SCAM! AcmeBank charged me fees they never mentioned. This is fraud.",
      "I was scammed by AcmeBank. They promised refunds but never delivered.",
      "AcmeBank is a complete scam. They lie about their services and steal money.",
      "Don't trust AcmeBank. This is a scam operation that preys on customers.",
      "I got scammed by AcmeBank. They took my money and disappeared.",
      "AcmeBank is fraudulent. They charge fees without disclosure. This is a scam.",
      "SCAM ALERT: AcmeBank is stealing money from customers. Avoid them!",
      "I was scammed by AcmeBank. They promised one thing but delivered another.",
      "AcmeBank is a scam. They won't refund my money despite their guarantee.",
      "This bank is running a scam. They charge hidden fees and refuse to help.",
      "AcmeBank scammed me. They took money I never authorized them to take.",
    ];

    const sources = [
      { type: "reddit", subreddit: "banking" },
      { type: "reddit", subreddit: "personalfinance" },
      { type: "twitter", platform: "x" },
      { type: "review", platform: "google" },
      { type: "review", platform: "trustpilot" },
    ];

    let created = 0;
    for (let i = 0; i < signals.length; i++) {
      const source = sources[i % sources.length];
      const timestamp = new Date(Date.now() - i * 3600000); // Spread over 20 hours

      await createSignal({
        tenantId: tenant.id,
        source: {
          type: source.type,
          id: `${source.type}-scam-${i}`,
          url: `https://example.com/${source.type}/scam-${i}`,
          ...(source.subreddit && { subreddit: source.subreddit }),
          ...(source.platform && { platform: source.platform }),
          timestamp: timestamp.toISOString(),
        },
        content: {
          raw: signals[i],
          normalized: signals[i],
          language: "en",
          sentiment: -0.8 - Math.random() * 0.2, // Very negative
        },
        metadata: {
          upvotes: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 20),
          engagement_score: 0.5 + Math.random() * 0.3,
        },
      });

      created++;
      if (created % 5 === 0) {
        console.log(`  ✅ Created ${created}/${signals.length} signals...`);
      }
    }

    console.log(`\n✅ Created ${created} signals for 'scam' cluster\n`);
    console.log("Next steps:");
    console.log("  1. Navigate to /claims to see the cluster");
    console.log("  2. Navigate to /graph to see graph visualization");
    console.log("  3. Navigate to /forecasts to generate outbreak forecast\n");
  },
};

// Scenario 2: Outage Response
const outageResponseScenario: DemoScenario = {
  name: "outage-response",
  description: "Creates an outage scenario with support tickets and social media",
  generate: async () => {
    console.log("🎭 Generating 'outage response' scenario...\n");

    const tenant = await getOrCreateTenant("TechCorp", "techcorp");
    const signals = [
      "Service is down! Can't access my account. What's going on?",
      "Is anyone else experiencing issues? The app won't load.",
      "TechCorp is completely down. This is unacceptable for a paid service.",
      "Service outage for 3 hours now. When will this be fixed?",
      "Can't log in. Is there a status page I can check?",
      "TechCorp down again? This is the third time this month!",
      "Service is completely broken. Can't do anything.",
      "Outage affecting all users. No communication from TechCorp.",
      "When will service be restored? This is costing me money.",
      "TechCorp reliability is terrible. Constant outages.",
    ];

    let created = 0;
    for (let i = 0; i < signals.length; i++) {
      const timestamp = new Date(Date.now() - i * 1800000); // Spread over 5 hours

      await createSignal({
        tenantId: tenant.id,
        source: {
          type: i < 5 ? "support" : "twitter",
          id: `outage-${i}`,
          url: `https://example.com/outage-${i}`,
          timestamp: timestamp.toISOString(),
        },
        content: {
          raw: signals[i],
          normalized: signals[i],
          language: "en",
          sentiment: -0.6 - Math.random() * 0.2,
        },
        metadata: {
          priority: i < 3 ? "high" : "normal",
          status: "open",
        },
      });

      created++;
    }

    console.log(`\n✅ Created ${created} signals for outage scenario\n`);
    console.log("Next steps:");
    console.log("  1. Navigate to /signals to see outage signals");
    console.log("  2. Navigate to /claims to see outage cluster");
    console.log("  3. Navigate to /studio to create incident response\n");
  },
};

// Scenario 3: Hidden Fees
const hiddenFeesScenario: DemoScenario = {
  name: "hidden-fees",
  description: "Creates a 'hidden fees' narrative with gradual escalation",
  generate: async () => {
    console.log("🎭 Generating 'hidden fees' scenario...\n");

    const tenant = await getOrCreateTenant("AcmeBank", "acmebank");
    const signals = [
      "Just noticed a $5 monthly fee I wasn't told about. Is this normal?",
      "Hidden fees are appearing on my statement. This wasn't disclosed.",
      "Charged a maintenance fee I never agreed to. This is sneaky.",
      "Why am I being charged fees that weren't mentioned when I signed up?",
      "Hidden fees everywhere! This is deceptive business practice.",
      "I was never told about these fees. This feels like a scam.",
      "Fees keep appearing that weren't in the original agreement.",
      "This is ridiculous. Hidden fees should be illegal.",
      "AcmeBank is charging fees they never disclosed. This is fraud.",
      "I'm being charged for things I never agreed to. This is a scam.",
    ];

    let created = 0;
    for (let i = 0; i < signals.length; i++) {
      const timestamp = new Date(Date.now() - (signals.length - i) * 86400000); // Spread over 10 days

      await createSignal({
        tenantId: tenant.id,
        source: {
          type: "reddit",
          id: `hidden-fees-${i}`,
          url: `https://reddit.com/hidden-fees-${i}`,
          timestamp: timestamp.toISOString(),
        },
        content: {
          raw: signals[i],
          normalized: signals[i],
          language: "en",
          sentiment: -0.5 - (i / signals.length) * 0.3, // Escalating negativity
        },
        metadata: {
          upvotes: Math.floor(10 + i * 5),
          comments: Math.floor(2 + i),
          engagement_score: 0.4 + (i / signals.length) * 0.3,
        },
      });

      created++;
    }

    console.log(`\n✅ Created ${created} signals for 'hidden fees' scenario\n`);
    console.log("Next steps:");
    console.log("  1. Navigate to /claims to see the cluster");
    console.log("  2. Navigate to /forecasts to see outbreak probability");
    console.log("  3. Navigate to /studio to create rebuttal artifact\n");
  },
};

// Scenario 4: Data Breach
const dataBreachScenario: DemoScenario = {
  name: "data-breach",
  description: "Creates a data breach narrative with high severity",
  generate: async () => {
    console.log("🎭 Generating 'data breach' scenario...\n");

    const tenant = await getOrCreateTenant("HealthCare Inc", "healthcare");
    const signals = [
      "Heard HealthCare Inc had a data breach. Is my information safe?",
      "Data breach at HealthCare Inc. When will they notify customers?",
      "My personal information may have been compromised. This is serious.",
      "HealthCare Inc data breach affects thousands. This is unacceptable.",
      "Why wasn't I notified about the data breach immediately?",
      "Data breach exposed patient records. This is a HIPAA violation.",
      "HealthCare Inc failed to protect our data. This is negligence.",
      "My medical records may have been leaked. This is a disaster.",
      "Data breach at HealthCare Inc. When will they take responsibility?",
      "This data breach is a serious security failure. Heads should roll.",
    ];

    let created = 0;
    for (let i = 0; i < signals.length; i++) {
      const timestamp = new Date(Date.now() - i * 3600000); // Last 10 hours

      await createSignal({
        tenantId: tenant.id,
        source: {
          type: i < 3 ? "news" : "reddit",
          id: `data-breach-${i}`,
          url: `https://example.com/data-breach-${i}`,
          timestamp: timestamp.toISOString(),
        },
        content: {
          raw: signals[i],
          normalized: signals[i],
          language: "en",
          sentiment: -0.9, // Very negative
        },
        metadata: {
          severity: "high",
          amplification: 0.8 + Math.random() * 0.2,
        },
      });

      created++;
    }

    console.log(`\n✅ Created ${created} signals for 'data breach' scenario\n`);
    console.log("Next steps:");
    console.log("  1. Navigate to /signals to see high-severity signals");
    console.log("  2. Navigate to /forecasts to see outbreak probability");
    console.log("  3. Navigate to /governance to see escalation alerts\n");
  },
};

// All scenarios
const allScenarios: DemoScenario = {
  name: "all",
  description: "Generates all demo scenarios",
  generate: async () => {
    console.log("🎭 Generating all demo scenarios...\n");
    await scamClusterScenario.generate();
    await outageResponseScenario.generate();
    await hiddenFeesScenario.generate();
    await dataBreachScenario.generate();
    console.log("✅ All demo scenarios generated!\n");
  },
};

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args.find((arg) => arg.startsWith("--scenario="));
  const scenarioName = scenarioArg ? scenarioArg.split("=")[1] : "all";

  const scenarios: Record<string, DemoScenario> = {
    "scam-cluster": scamClusterScenario,
    "outage-response": outageResponseScenario,
    "hidden-fees": hiddenFeesScenario,
    "data-breach": dataBreachScenario,
    all: allScenarios,
  };

  const scenario = scenarios[scenarioName];

  if (!scenario) {
    console.error(`❌ Unknown scenario: ${scenarioName}\n`);
    console.log("Available scenarios:");
    Object.keys(scenarios).forEach((name) => {
      console.log(`  - ${name}: ${scenarios[name].description}`);
    });
    process.exit(1);
  }

  try {
    await scenario.generate();
    console.log("✅ Demo data generation complete!\n");
  } catch (error) {
    console.error("❌ Error generating demo data:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
