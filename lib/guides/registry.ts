/**
 * Guide Registry
 * Central registry for all page guides
 */

import type { PageGuide, GuideId } from "./types";

const guides: Record<GuideId, PageGuide> = {
  overview: {
    pageId: "overview",
    title: "Overview Dashboard",
    description: "Your command center for narrative risk monitoring and strategic intelligence",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  signals: {
    pageId: "signals",
    title: "Signals Feed",
    description: "Real-time streaming feed of ingested signals with AI-powered analysis",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  claims: {
    pageId: "claims",
    title: "Claims & Clustering",
    description: "Extract, verify, and cluster claims from evidence with AI-powered analysis",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  graph: {
    pageId: "graph",
    title: "Belief Graph",
    description: "Explore the belief graph to understand narrative evolution and relationships",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  forecasts: {
    pageId: "forecasts",
    title: "Forecasts & Predictions",
    description: "AI-powered forecasting for narrative drift, outbreak probability, and what-if simulations",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  studio: {
    pageId: "studio",
    title: "AAAL Studio",
    description: "Author evidence-backed artifacts designed to be cited by AI systems",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  playbooks: {
    pageId: "playbooks",
    title: "Playbooks",
    description: "Automated workflows and response templates for common scenarios",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  funnel: {
    pageId: "funnel",
    title: "Funnel Analysis",
    description: "Analyze buyer journey and narrative impact on conversion",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  trust: {
    pageId: "trust",
    title: "Trust Assets",
    description: "Manage and monitor trust signals and authoritative content",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  governance: {
    pageId: "governance",
    title: "Governance & Compliance",
    description: "Approvals, audit logs, and compliance management",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  integrations: {
    pageId: "integrations",
    title: "Integrations",
    description: "Connect external data sources and configure connectors",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  metering: {
    pageId: "metering",
    title: "Usage Metering",
    description: "Monitor API usage, quotas, and billing information",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
  "ai-answer-monitor": {
    pageId: "ai-answer-monitor",
    title: "AI Answer Monitor",
    description: "Monitor how AI systems cite and reference your authoritative content",
    sections: [],
    quickStart: [],
    apiEndpoints: [],
    features: [],
    workflow: [],
  },
};

export function getGuide(pageId: GuideId): PageGuide | undefined {
  return guides[pageId];
}

export function getAllGuides(): PageGuide[] {
  return Object.values(guides);
}

export function registerGuide(guide: PageGuide): void {
  guides[guide.pageId] = guide;
}
