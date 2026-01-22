/**
 * Signals Page Guide
 * Comprehensive guide for the Signals page
 */

import type { PageGuide } from "./types";

export const signalsGuide: PageGuide = {
  pageId: "signals",
  title: "Signals Feed",
  description: "Real-time streaming feed of ingested signals with evidence preview, AI-powered analysis, and cluster linking",
  
  quickStart: [
    {
      id: "signals-quick-1",
      type: "tooltip",
      title: "Welcome to Signals",
      description: "This page shows all ingested signals in real-time. Signals are evidence items from connected sources like RSS feeds, social media, support tickets, and more.",
      targetSelector: "[data-guide='signals-header']",
      position: "bottom",
    },
    {
      id: "signals-quick-2",
      type: "tooltip",
      title: "Filter Signals",
      description: "Use the filter bar to search, filter by source type, severity, language, and timeframe. Tabs show All Signals, High Risk, or Unclustered signals.",
      targetSelector: "[data-guide='signals-filters']",
      position: "bottom",
    },
  ],

  sections: [
    {
      id: "signal-list-section",
      title: "Understanding Signal Cards",
      description: "How to read and interact with signal cards",
      order: 1,
      steps: [
        {
          id: "signal-card-1",
          type: "tooltip",
          title: "Signal Information",
          description: "Each card shows: Source type (Reddit, Twitter, etc.), Signal type, Severity badge, Normalized content preview, and timestamp.",
          targetSelector: "[data-guide='signal-card']",
          position: "right",
        },
        {
          id: "signal-card-2",
          type: "tooltip",
          title: "AI Suggestions",
          description: "Look for 'Suggested Cluster' badges - these indicate AI-recommended cluster assignments. 'Dedup Likely' means the signal may be a duplicate.",
          targetSelector: "[data-guide='ai-suggestions']",
          position: "top",
        },
        {
          id: "signal-card-3",
          type: "tooltip",
          title: "Amplification Score",
          description: "Shows how much a signal is being amplified across channels. Higher scores indicate growing attention.",
          targetSelector: "[data-guide='amplification']",
          position: "left",
        },
      ],
    },
    {
      id: "filtering-section",
      title: "Filtering and Search",
      description: "How to find specific signals",
      order: 2,
      steps: [
        {
          id: "filter-1",
          type: "tooltip",
          title: "Search Bar",
          description: "Search across signal content and source types. Results update in real-time as you type.",
          targetSelector: "[data-guide='search-bar']",
          position: "bottom",
        },
        {
          id: "filter-2",
          type: "tooltip",
          title: "Source Filter",
          description: "Filter by source type: Reddit, Twitter/X, Reviews, Support Tickets, News, Forums, or All Sources.",
          targetSelector: "[data-guide='source-filter']",
          position: "bottom",
        },
        {
          id: "filter-3",
          type: "tooltip",
          title: "Severity Filter",
          description: "Filter by severity level: Critical, High, Medium, Low, or All Severities.",
          targetSelector: "[data-guide='severity-filter']",
          position: "bottom",
        },
        {
          id: "filter-4",
          type: "tooltip",
          title: "Timeframe Filter",
          description: "Filter by time: Last Hour, Last 24 Hours, Last 7 Days, or Last 30 Days.",
          targetSelector: "[data-guide='timeframe-filter']",
          position: "bottom",
        },
      ],
    },
    {
      id: "actions-section",
      title: "Signal Actions",
      description: "What you can do with signals",
      order: 3,
      steps: [
        {
          id: "action-1",
          type: "tooltip",
          title: "Link to Cluster",
          description: "Manually link a signal to an existing claim cluster. Useful when AI suggestions aren't accurate.",
          targetSelector: "[data-guide='link-cluster']",
          position: "top",
        },
        {
          id: "action-2",
          type: "tooltip",
          title: "Create Cluster",
          description: "Create a new claim cluster from this signal. The system will extract claims and create a new cluster.",
          targetSelector: "[data-guide='create-cluster']",
          position: "top",
        },
        {
          id: "action-3",
          type: "tooltip",
          title: "Mark High Risk",
          description: "Flag signals as high-risk for priority attention. High-risk signals appear in the High Risk tab.",
          targetSelector: "[data-guide='mark-high-risk']",
          position: "top",
        },
      ],
    },
    {
      id: "details-section",
      title: "Signal Details",
      description: "Exploring signal details and evidence",
      order: 4,
      steps: [
        {
          id: "details-1",
          type: "tooltip",
          title: "Open Details",
          description: "Click any signal card to open the details drawer on the right. This shows comprehensive information about the signal.",
          targetSelector: "[data-guide='signal-card']",
          position: "left",
        },
        {
          id: "details-2",
          type: "modal",
          title: "Details Tabs",
          description: "The details drawer has four tabs: Raw (original content), Normalized (processed content), Claims (extracted claims), and Evidence (source URLs and attachments).",
          content: "Use these tabs to understand the signal's origin, processed content, extracted claims, and source evidence. This helps verify accuracy and traceability.",
        },
        {
          id: "details-3",
          type: "tooltip",
          title: "Evidence Link",
          description: "Click 'View Evidence' to see the full evidence record with provenance, signatures, and audit trail.",
          targetSelector: "[data-guide='evidence-link']",
          position: "top",
        },
      ],
    },
    {
      id: "realtime-section",
      title: "Real-Time Updates",
      description: "How real-time streaming works",
      order: 5,
      steps: [
        {
          id: "realtime-1",
          type: "tooltip",
          title: "Connection Status",
          description: "The connection indicator shows if real-time updates are active. Green means connected, red means disconnected.",
          targetSelector: "[data-guide='connection-status']",
          position: "left",
        },
        {
          id: "realtime-2",
          type: "modal",
          title: "Server-Sent Events",
          description: "Signals update in real-time using Server-Sent Events (SSE). New signals appear automatically at the top of the feed without page refresh.",
          content: "The system maintains a persistent connection to /api/signals/stream. When new signals are ingested, they're immediately pushed to all connected clients.",
        },
        {
          id: "realtime-3",
          type: "tooltip",
          title: "Source Health",
          description: "Monitor source health indicators to see which data sources are active, degraded, or unhealthy.",
          targetSelector: "[data-guide='source-health']",
          position: "top",
        },
      ],
    },
  ],

  apiEndpoints: [
    {
      method: "GET",
      path: "/api/signals",
      description: "Fetch signals with optional filters (source, severity, language, timeframe, limit)",
      example: { query: "?source=reddit&severity=high&timeframe=24h&limit=100" },
    },
    {
      method: "GET",
      path: "/api/signals/stream",
      description: "Server-Sent Events stream for real-time signal updates",
    },
    {
      method: "GET",
      path: "/api/sources/health",
      description: "Get health status for all configured sources",
    },
    {
      method: "POST",
      path: "/api/signals/actions",
      description: "Perform actions on signals (link_to_cluster, create_cluster, mark_high_risk)",
      example: { action: "link_to_cluster", evidence_id: "...", cluster_id: "..." },
    },
    {
      method: "POST",
      path: "/api/signals/amplification",
      description: "Get amplification metrics for signals",
      example: { evidence_ids: ["..."] },
    },
  ],

  features: [
    {
      name: "Real-Time Streaming",
      description: "Live signal feed with Server-Sent Events for instant updates",
      icon: "Radio",
    },
    {
      name: "AI-Powered Analysis",
      description: "Automatic claim extraction, cluster suggestions, and duplicate detection",
      icon: "Sparkles",
    },
    {
      name: "Advanced Filtering",
      description: "Filter by source, severity, language, timeframe, and search content",
      icon: "Filter",
    },
    {
      name: "Cluster Linking",
      description: "Link signals to claim clusters or create new clusters",
      icon: "Link2",
    },
    {
      name: "Amplification Tracking",
      description: "Monitor how signals are amplified across channels",
      icon: "TrendingUp",
    },
    {
      name: "Source Health Monitoring",
      description: "Real-time health status for all data sources",
      icon: "Activity",
    },
  ],

  workflow: [
    {
      step: 1,
      title: "Monitor Feed",
      description: "Watch the real-time signal feed for new evidence from connected sources",
      action: "Review signals as they arrive",
    },
    {
      step: 2,
      title: "Filter and Search",
      description: "Use filters to find signals of interest (high severity, specific sources, etc.)",
      action: "Apply filters and search",
    },
    {
      step: 3,
      title: "Review Details",
      description: "Click signals to view details, extracted claims, and source evidence",
      action: "Open signal details drawer",
    },
    {
      step: 4,
      title: "Link to Clusters",
      description: "Link signals to existing claim clusters or create new clusters",
      action: "Use Link to Cluster or Create Cluster actions",
    },
    {
      step: 5,
      title: "Flag High Risk",
      description: "Mark important signals as high-risk for priority attention",
      action: "Click Mark High-Risk button",
    },
  ],
};
