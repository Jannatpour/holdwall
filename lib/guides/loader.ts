/**
 * Guide Loader
 * Loads and initializes guides for pages
 */

import { registerGuide } from "./registry";
import { forecastsGuide } from "./forecasts";
import { signalsGuide } from "./signals";
import { overviewGuide } from "./overview";
import { claimsGuide } from "./claims";
import { graphGuide } from "./graph";
import { studioGuide } from "./studio";
import { logger } from "@/lib/logging/logger";
import type { PageGuide, GuideId } from "./types";

// Import all guides
const guideModules: Record<GuideId, () => PageGuide> = {
  forecasts: () => forecastsGuide,
  signals: () => signalsGuide,
  overview: () => overviewGuide,
  claims: () => claimsGuide,
  graph: () => graphGuide,
  studio: () => studioGuide,
  playbooks: () => ({
    pageId: "playbooks",
    title: "Playbooks",
    description: "Automated workflows and templates",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  }),
  funnel: () => ({
    pageId: "funnel",
    title: "Funnel Analysis",
    description: "Analyze buyer journey impact",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  }),
  trust: () => ({
    pageId: "trust",
    title: "Trust Assets",
    description: "Manage trust signals",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  }),
  governance: () => ({
    pageId: "governance",
    title: "Governance & Compliance",
    description: "Approvals and audit management",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  }),
  integrations: () => ({
    pageId: "integrations",
    title: "Integrations",
    description: "Connect data sources",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  }),
  metering: () => ({
    pageId: "metering",
    title: "Usage Metering",
    description: "Monitor API usage",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  }),
  "ai-answer-monitor": () => ({
    pageId: "ai-answer-monitor",
    title: "AI Answer Monitor",
    description: "Monitor AI citations",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  }),
};

/**
 * Initialize all guides
 */
export function initializeGuides(): void {
  for (const [pageId, loader] of Object.entries(guideModules)) {
    try {
      const guide = loader();
      registerGuide(guide);
    } catch (error) {
      logger.error(`Failed to load guide for ${pageId}`, {
        error: error instanceof Error ? error.message : String(error),
        pageId,
      });
    }
  }
}

/**
 * Load a specific guide
 */
export function loadGuide(pageId: GuideId): PageGuide | undefined {
  const loader = guideModules[pageId];
  if (!loader) {
    return undefined;
  }
  
  try {
    const guide = loader();
    registerGuide(guide);
    return guide;
  } catch (error) {
    logger.error(`Failed to load guide for ${pageId}`, {
      error: error instanceof Error ? error.message : String(error),
      pageId,
    });
    return undefined;
  }
}

// Auto-initialize on module load
if (typeof window === "undefined") {
  // Server-side: initialize immediately
  initializeGuides();
}
