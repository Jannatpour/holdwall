/**
 * Claims Page Guide
 * Comprehensive guide for the Claims & Clustering page
 */

import type { PageGuide } from "./types";

export const claimsGuide: PageGuide = {
  pageId: "claims",
  title: "Claims & Clustering",
  description: "Extract, verify, and cluster claims from evidence with AI-powered analysis using FactReasoner, VERITAS-NLI, and Belief Inference",
  
  quickStart: [
    {
      id: "claims-quick-1",
      type: "tooltip",
      title: "Welcome to Claims",
      description: "This page shows all extracted claims organized into clusters. Claims are extracted from signals and evidence using AI.",
      targetSelector: "[data-guide='claims-header']",
      position: "bottom",
    },
    {
      id: "claims-quick-2",
      type: "tooltip",
      title: "Claim Clusters",
      description: "Claims are automatically clustered by similarity. Each cluster represents a narrative theme or topic.",
      targetSelector: "[data-guide='clusters-list']",
      position: "top",
    },
  ],

  sections: [
    {
      id: "clusters-section",
      title: "Understanding Claim Clusters",
      description: "How claims are organized and what clusters mean",
      order: 1,
      steps: [
        {
          id: "cluster-1",
          type: "modal",
          title: "Claim Clustering",
          description: "Claims are automatically clustered using embedding-based similarity. Clusters group related claims that express similar narratives or themes.",
          content: "Each cluster has a primary claim (canonical representation) and may contain multiple variant claims. Clusters are ranked by decisiveness, which measures narrative impact.",
        },
        {
          id: "cluster-2",
          type: "tooltip",
          title: "Decisiveness Score",
          description: "Measures how strongly a cluster influences perception. Higher scores (>0.7) indicate high-impact narratives requiring attention.",
          targetSelector: "[data-guide='decisiveness']",
          position: "right",
        },
        {
          id: "cluster-3",
          type: "tooltip",
          title: "Cluster Size",
          description: "Number of claims in the cluster. Larger clusters indicate more widespread narratives.",
          targetSelector: "[data-guide='cluster-size']",
          position: "right",
        },
        {
          id: "cluster-4",
          type: "tooltip",
          title: "View Cluster Details",
          description: "Click any cluster to see all claims, evidence links, verification results, and related clusters.",
          targetSelector: "[data-guide='cluster-card']",
          position: "top",
        },
      ],
    },
    {
      id: "verification-section",
      title: "Claim Verification",
      description: "Understanding AI-powered claim verification",
      order: 2,
      steps: [
        {
          id: "verify-1",
          type: "modal",
          title: "Claim Verification",
          description: "Claims are verified using multiple AI systems: FactReasoner (factual accuracy), VERITAS-NLI (logical consistency), and Belief Inference (narrative coherence).",
          content: "Verification scores help assess claim reliability. High scores indicate well-supported claims, while low scores may indicate misinformation or unsubstantiated claims.",
        },
        {
          id: "verify-2",
          type: "tooltip",
          title: "FactReasoner Score",
          description: "Measures factual accuracy based on evidence. Scores >0.8 indicate well-supported factual claims.",
          targetSelector: "[data-guide='factreasoner-score']",
          position: "left",
        },
        {
          id: "verify-3",
          type: "tooltip",
          title: "VERITAS-NLI Score",
          description: "Measures logical consistency and coherence. Higher scores indicate logically sound claims.",
          targetSelector: "[data-guide='veritas-score']",
          position: "left",
        },
        {
          id: "verify-4",
          type: "tooltip",
          title: "Belief Inference",
          description: "Infers belief strength from evidence patterns. Shows how strongly evidence supports the claim.",
          targetSelector: "[data-guide='belief-inference']",
          position: "left",
        },
      ],
    },
    {
      id: "evidence-section",
      title: "Evidence Links",
      description: "Tracing claims back to evidence",
      order: 3,
      steps: [
        {
          id: "evidence-1",
          type: "tooltip",
          title: "Evidence Links",
          description: "Each claim is linked to source evidence. Click to view the original evidence with full provenance.",
          targetSelector: "[data-guide='evidence-links']",
          position: "top",
        },
        {
          id: "evidence-2",
          type: "modal",
          title: "Evidence Traceability",
          description: "All claims maintain full traceability to source evidence. This ensures accountability and allows verification of claim origins.",
          content: "Evidence includes source URLs, collection timestamps, collection methods, and compliance metadata. This traceability is essential for audit and compliance.",
        },
      ],
    },
    {
      id: "actions-section",
      title: "Cluster Actions",
      description: "What you can do with clusters",
      order: 4,
      steps: [
        {
          id: "action-1",
          type: "tooltip",
          title: "Create Artifact",
          description: "Create an AAAL artifact addressing this cluster. Use this to publish authoritative responses.",
          targetSelector: "[data-guide='create-artifact']",
          position: "top",
        },
        {
          id: "action-2",
          type: "tooltip",
          title: "View Graph",
          description: "View this cluster in the belief graph to see relationships and propagation paths.",
          targetSelector: "[data-guide='view-graph']",
          position: "top",
        },
        {
          id: "action-3",
          type: "tooltip",
          title: "Run Forecast",
          description: "Generate forecasts for this cluster to predict narrative evolution.",
          targetSelector: "[data-guide='run-forecast']",
          position: "top",
        },
      ],
    },
  ],

  apiEndpoints: [
    {
      method: "GET",
      path: "/api/claims",
      description: "Get all claims with optional filters (cluster_id, limit, offset)",
    },
    {
      method: "GET",
      path: "/api/claims/clusters",
      description: "Get all claim clusters with metadata",
    },
    {
      method: "GET",
      path: "/api/claim-clusters/top",
      description: "Get top clusters ranked by decisiveness",
    },
    {
      method: "POST",
      path: "/api/claims/cluster",
      description: "Manually cluster claims or update cluster assignments",
    },
    {
      method: "GET",
      path: "/api/claims/[id]",
      description: "Get detailed claim information including verification scores",
    },
  ],

  features: [
    {
      name: "Automatic Clustering",
      description: "AI-powered clustering groups similar claims into narrative themes",
      icon: "Network",
    },
    {
      name: "FactReasoner Verification",
      description: "Factual accuracy verification using advanced reasoning models",
      icon: "CheckCircle2",
    },
    {
      name: "VERITAS-NLI",
      description: "Logical consistency verification using natural language inference",
      icon: "FileCheck",
    },
    {
      name: "Belief Inference",
      description: "Infers belief strength from evidence patterns",
      icon: "Brain",
    },
    {
      name: "Evidence Traceability",
      description: "Full traceability from claims to source evidence with provenance",
      icon: "Link2",
    },
    {
      name: "Decisiveness Scoring",
      description: "Measures narrative impact and influence strength",
      icon: "TrendingUp",
    },
  ],

  workflow: [
    {
      step: 1,
      title: "Review Clusters",
      description: "Start by reviewing the top clusters ranked by decisiveness",
      action: "Review clusters list",
    },
    {
      step: 2,
      title: "Check Verification",
      description: "Review verification scores to assess claim reliability",
      action: "Check FactReasoner, VERITAS-NLI scores",
    },
    {
      step: 3,
      title: "Examine Evidence",
      description: "Review evidence links to verify claim sources",
      action: "Click evidence links",
    },
    {
      step: 4,
      title: "View Cluster Details",
      description: "Click a cluster to see all claims and detailed analysis",
      action: "Open cluster detail page",
    },
    {
      step: 5,
      title: "Take Action",
      description: "Create artifacts, view in graph, or run forecasts for important clusters",
      action: "Use cluster actions",
    },
  ],
};
