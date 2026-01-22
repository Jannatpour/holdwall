/**
 * Overview Page Guide
 * Comprehensive guide for the Overview dashboard page
 */

import type { PageGuide } from "./types";

export const overviewGuide: PageGuide = {
  pageId: "overview",
  title: "Overview Dashboard",
  description: "Your command center for narrative risk monitoring and strategic intelligence with AI-powered insights",
  
  quickStart: [
    {
      id: "overview-quick-1",
      type: "tooltip",
      title: "Welcome to Overview",
      description: "This is your command center. Start by reviewing the Narrative Risk Brief and KPI cards to understand your current narrative health.",
      targetSelector: "[data-guide='overview-header']",
      position: "bottom",
    },
    {
      id: "overview-quick-2",
      type: "tooltip",
      title: "Key Metrics",
      description: "Monitor four key metrics: Perception Health, Outbreak Probability, AI Citation Coverage, and Trust Coverage.",
      targetSelector: "[data-guide='kpi-cards']",
      position: "top",
    },
  ],

  sections: [
    {
      id: "kpi-section",
      title: "Key Performance Indicators",
      description: "Understanding the four core metrics",
      order: 1,
      steps: [
        {
          id: "kpi-1",
          type: "tooltip",
          title: "Perception Health",
          description: "Overall health score of your narrative perception. Higher scores (80+) indicate strong, positive perception.",
          targetSelector: "[data-guide='perception-health']",
          position: "right",
        },
        {
          id: "kpi-2",
          type: "tooltip",
          title: "Outbreak Probability",
          description: "Risk of narrative going viral. Values >0.7 indicate high risk requiring immediate attention.",
          targetSelector: "[data-guide='outbreak-probability']",
          position: "right",
        },
        {
          id: "kpi-3",
          type: "tooltip",
          title: "AI Citation Coverage",
          description: "Percentage of AI systems citing your authoritative content. Higher coverage means better AI visibility.",
          targetSelector: "[data-guide='ai-citation']",
          position: "right",
        },
        {
          id: "kpi-4",
          type: "tooltip",
          title: "Trust Coverage",
          description: "Extent of trust signals and authoritative content across channels. Higher coverage builds credibility.",
          targetSelector: "[data-guide='trust-coverage']",
          position: "right",
        },
      ],
    },
    {
      id: "risk-brief-section",
      title: "Narrative Risk Brief",
      description: "AI-powered risk assessment and recommendations",
      order: 2,
      steps: [
        {
          id: "brief-1",
          type: "modal",
          title: "Narrative Risk Brief",
          description: "The Narrative Risk Brief provides AI-powered analysis of your current narrative landscape, identifying risks, opportunities, and recommended actions.",
          content: "Updated daily, the brief analyzes signals, claims, forecasts, and trust metrics to provide actionable intelligence. Use it to prioritize your narrative management efforts.",
        },
        {
          id: "brief-2",
          type: "tooltip",
          title: "Risk Summary",
          description: "High-level summary of current narrative risks, including outbreak probability, sentiment drift, and emerging threats.",
          targetSelector: "[data-guide='risk-summary']",
          position: "top",
        },
        {
          id: "brief-3",
          type: "tooltip",
          title: "Recommended Actions",
          description: "Prioritized list of actions based on AI analysis. Actions are ranked by urgency and impact.",
          targetSelector: "[data-guide='recommended-actions']",
          position: "right",
        },
      ],
    },
    {
      id: "clusters-section",
      title: "Top Claim Clusters",
      description: "Understanding your most important narrative clusters",
      order: 3,
      steps: [
        {
          id: "clusters-1",
          type: "tooltip",
          title: "Claim Clusters",
          description: "Top claim clusters ranked by decisiveness. Higher decisiveness means stronger narrative impact.",
          targetSelector: "[data-guide='top-clusters']",
          position: "top",
        },
        {
          id: "clusters-2",
          type: "tooltip",
          title: "Decisiveness Score",
          description: "Measures how strongly a cluster influences perception. Scores >0.7 indicate high-impact narratives.",
          targetSelector: "[data-guide='decisiveness-score']",
          position: "left",
        },
        {
          id: "clusters-3",
          type: "tooltip",
          title: "View Details",
          description: "Click any cluster to view detailed analysis, evidence links, and related claims.",
          targetSelector: "[data-guide='cluster-link']",
          position: "top",
        },
      ],
    },
    {
      id: "ops-feed-section",
      title: "Operations Feed",
      description: "Real-time operational events and updates",
      order: 4,
      steps: [
        {
          id: "ops-1",
          type: "tooltip",
          title: "Ops Feed",
          description: "Real-time feed of operational events: signal ingestion, claim extraction, forecast generation, and system updates.",
          targetSelector: "[data-guide='ops-feed']",
          position: "left",
        },
        {
          id: "ops-2",
          type: "modal",
          title: "Event Types",
          description: "Events include: signal.ingested, claim.extracted, graph.updated, forecast.created, approval.pending, and more.",
          content: "The feed helps you stay informed about system activity and can alert you to important events requiring attention.",
        },
      ],
    },
    {
      id: "approvals-section",
      title: "Pending Approvals",
      description: "Managing approval workflows",
      order: 5,
      steps: [
        {
          id: "approvals-1",
          type: "tooltip",
          title: "Approvals Queue",
          description: "Items requiring human approval before execution. This includes artifact publishing, high-risk actions, and policy changes.",
          targetSelector: "[data-guide='approvals-queue']",
          position: "top",
        },
        {
          id: "approvals-2",
          type: "tooltip",
          title: "Review and Approve",
          description: "Click any approval to review details and approve or reject. Approvals ensure human oversight of critical actions.",
          targetSelector: "[data-guide='approval-item']",
          position: "right",
        },
      ],
    },
  ],

  apiEndpoints: [
    {
      method: "GET",
      path: "/api/overview",
      description: "Get overview dashboard data including KPIs, risk brief, and recommendations",
    },
    {
      method: "GET",
      path: "/api/narrative-risk-brief",
      description: "Get detailed narrative risk brief with AI-powered analysis",
    },
    {
      method: "GET",
      path: "/api/metrics/summary",
      description: "Get aggregated metrics for KPI cards",
    },
    {
      method: "GET",
      path: "/api/claim-clusters/top",
      description: "Get top claim clusters ranked by decisiveness",
    },
    {
      method: "GET",
      path: "/api/recommendations",
      description: "Get prioritized action recommendations",
    },
    {
      method: "GET",
      path: "/api/events/recent",
      description: "Get recent operational events for ops feed",
    },
    {
      method: "GET",
      path: "/api/approvals",
      description: "Get pending approvals requiring action",
    },
  ],

  features: [
    {
      name: "Narrative Risk Brief",
      description: "AI-powered daily brief analyzing narrative landscape and risks",
      icon: "FileText",
    },
    {
      name: "KPI Dashboard",
      description: "Four key metrics: Perception Health, Outbreak Probability, AI Citations, Trust Coverage",
      icon: "BarChart3",
    },
    {
      name: "Top Clusters",
      description: "Most important claim clusters ranked by decisiveness",
      icon: "Network",
    },
    {
      name: "Recommended Actions",
      description: "Prioritized actions based on AI analysis",
      icon: "Zap",
    },
    {
      name: "Ops Feed",
      description: "Real-time operational events and system updates",
      icon: "Radio",
    },
    {
      name: "Approvals Queue",
      description: "Pending approvals requiring human review",
      icon: "CheckCircle2",
    },
  ],

  workflow: [
    {
      step: 1,
      title: "Review KPIs",
      description: "Start by checking the four KPI cards to understand overall narrative health",
      action: "Review KPI cards",
    },
    {
      step: 2,
      title: "Read Risk Brief",
      description: "Review the Narrative Risk Brief for AI-powered insights and recommendations",
      action: "Read risk brief",
    },
    {
      step: 3,
      title: "Check Top Clusters",
      description: "Review top claim clusters to identify high-impact narratives",
      action: "Review clusters table",
    },
    {
      step: 4,
      title: "Review Recommendations",
      description: "Check recommended actions and prioritize based on urgency",
      action: "Review recommendations list",
    },
    {
      step: 5,
      title: "Handle Approvals",
      description: "Review and approve pending items requiring human oversight",
      action: "Process approvals queue",
    },
    {
      step: 6,
      title: "Monitor Ops Feed",
      description: "Watch the ops feed for real-time system updates and events",
      action: "Monitor ops feed",
    },
  ],
};
