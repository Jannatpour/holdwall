/**
 * Studio Page Guide
 * Comprehensive guide for the AAAL Studio page
 */

import type { PageGuide } from "./types";

export const studioGuide: PageGuide = {
  pageId: "studio",
  title: "AAAL Studio",
  description: "Traceability-first authoring with evidence picker, policy checker, and AI-powered assistance. Create authoritative artifacts designed to be cited by AI systems",
  
  quickStart: [
    {
      id: "studio-quick-1",
      type: "tooltip",
      title: "Welcome to AAAL Studio",
      description: "This is where you author evidence-backed artifacts. AAAL (Authoritative Artifact Authoring Language) ensures traceability and AI-citability.",
      targetSelector: "[data-guide='studio-header']",
      position: "bottom",
    },
    {
      id: "studio-quick-2",
      type: "tooltip",
      title: "Editor",
      description: "The editor supports markdown with special AAAL syntax for citations, evidence links, and traceability markers.",
      targetSelector: "[data-guide='editor']",
      position: "top",
    },
  ],

  sections: [
    {
      id: "authoring-section",
      title: "Authoring Artifacts",
      description: "How to create evidence-backed artifacts",
      order: 1,
      steps: [
        {
          id: "author-1",
          type: "modal",
          title: "AAAL Artifacts",
          description: "AAAL (Authoritative Artifact Authoring Language) artifacts are designed to be cited by AI systems. They maintain full traceability to source evidence and include structured metadata.",
          content: "Artifacts can be responses to narratives, authoritative statements, fact sheets, or any content you want AI systems to cite. They're published via PADL (Public Artifact Delivery Layer) for AI discovery.",
        },
        {
          id: "author-2",
          type: "tooltip",
          title: "Editor",
          description: "Write your artifact content in markdown. Use AAAL syntax for citations: [[evidence-id]] or [[claim-id]] to link to evidence or claims.",
          targetSelector: "[data-guide='editor']",
          position: "right",
        },
        {
          id: "author-3",
          type: "tooltip",
          title: "Evidence Picker",
          description: "Click 'Add Evidence' to browse and select evidence to cite. Selected evidence is automatically linked and included in artifact metadata.",
          targetSelector: "[data-guide='evidence-picker']",
          position: "top",
        },
        {
          id: "author-4",
          type: "tooltip",
          title: "AI Assistance",
          description: "Use AI assistance to enhance your artifact. Options include GraphRAG (graph-augmented generation), semantic search, and AI orchestration.",
          targetSelector: "[data-guide='ai-assist']",
          position: "top",
        },
      ],
    },
    {
      id: "policy-section",
      title: "Policy Checking",
      description: "Ensuring compliance with source policies",
      order: 2,
      steps: [
        {
          id: "policy-1",
          type: "tooltip",
          title: "Policy Checker",
          description: "Before publishing, the artifact is checked against source policies to ensure compliance with data usage, attribution, and retention requirements.",
          targetSelector: "[data-guide='policy-check']",
          position: "right",
        },
        {
          id: "policy-2",
          type: "modal",
          title: "Source Policies",
          description: "Source policies define how evidence from different sources can be used. They include attribution requirements, usage restrictions, and retention policies.",
          content: "Policy violations prevent publishing until resolved. This ensures compliance with GDPR, CCPA, and other regulations, as well as source-specific requirements.",
        },
        {
          id: "policy-3",
          type: "tooltip",
          title: "Policy Status",
          description: "View policy check status: Pass (green), Warnings (yellow), or Failures (red). Fix any failures before publishing.",
          targetSelector: "[data-guide='policy-status']",
          position: "left",
        },
      ],
    },
    {
      id: "approval-section",
      title: "Approval Workflow",
      description: "Getting approval before publishing",
      order: 3,
      steps: [
        {
          id: "approval-1",
          type: "tooltip",
          title: "Approval Required",
          description: "Artifacts may require approval before publishing, depending on governance settings. High-risk content or policy violations trigger approval workflows.",
          targetSelector: "[data-guide='approval-status']",
          position: "top",
        },
        {
          id: "approval-2",
          type: "modal",
          title: "Approval Workflow",
          description: "When approval is required, the artifact is submitted to the approvals queue. Approvers review content, evidence links, and policy compliance before approving.",
          content: "Approval ensures human oversight of published content. Once approved, artifacts can be published to PADL for public access and AI citation.",
        },
      ],
    },
    {
      id: "publishing-section",
      title: "Publishing Artifacts",
      description: "Publishing to PADL for AI discovery",
      order: 4,
      steps: [
        {
          id: "publish-1",
          type: "tooltip",
          title: "Publish Button",
          description: "Click 'Publish' to publish the artifact to PADL (Public Artifact Delivery Layer). Published artifacts are discoverable by AI systems.",
          targetSelector: "[data-guide='publish-button']",
          position: "top",
        },
        {
          id: "publish-2",
          type: "modal",
          title: "PADL Publishing",
          description: "PADL makes artifacts publicly accessible with structured metadata, evidence links, and traceability information. AI systems can discover and cite these artifacts.",
          content: "Published artifacts get a public URL and are indexed for AI discovery. They include structured data (JSON-LD) for easy parsing by AI systems.",
        },
        {
          id: "publish-3",
          type: "tooltip",
          title: "Public URL",
          description: "After publishing, you'll get a public URL for the artifact. Share this URL or use it for AI citation.",
          targetSelector: "[data-guide='public-url']",
          position: "top",
        },
      ],
    },
    {
      id: "ai-features-section",
      title: "AI-Powered Features",
      description: "Using AI to enhance artifacts",
      order: 5,
      steps: [
        {
          id: "ai-1",
          type: "tooltip",
          title: "GraphRAG",
          description: "Use GraphRAG to enhance content with knowledge from the belief graph. Provides context-aware suggestions based on narrative relationships.",
          targetSelector: "[data-guide='graphrag']",
          position: "right",
        },
        {
          id: "ai-2",
          type: "tooltip",
          title: "Semantic Search",
          description: "Search for relevant evidence, claims, or content using semantic search. Finds related content even without exact keyword matches.",
          targetSelector: "[data-guide='semantic-search']",
          position: "right",
        },
        {
          id: "ai-3",
          type: "tooltip",
          title: "AI Orchestration",
          description: "Use AI orchestration for content generation, summarization, or enhancement. Coordinates multiple AI models for best results.",
          targetSelector: "[data-guide='ai-orchestrate']",
          position: "right",
        },
      ],
    },
  ],

  apiEndpoints: [
    {
      method: "GET",
      path: "/api/aaal",
      description: "Get all artifacts or specific artifact by ID",
    },
    {
      method: "POST",
      path: "/api/aaal",
      description: "Create new artifact",
    },
    {
      method: "PUT",
      path: "/api/aaal/[id]",
      description: "Update existing artifact",
    },
    {
      method: "POST",
      path: "/api/aaal/check-policies",
      description: "Check artifact against source policies",
    },
    {
      method: "POST",
      path: "/api/aaal/publish",
      description: "Publish artifact to PADL",
    },
    {
      method: "POST",
      path: "/api/ai/orchestrate",
      description: "Use AI orchestration for content enhancement",
    },
  ],

  features: [
    {
      name: "Traceability-First",
      description: "All content maintains full traceability to source evidence",
      icon: "Link2",
    },
    {
      name: "Evidence Picker",
      description: "Browse and select evidence to cite in artifacts",
      icon: "FileSearch",
    },
    {
      name: "Policy Checking",
      description: "Automatic compliance checking against source policies",
      icon: "Shield",
    },
    {
      name: "AI Assistance",
      description: "GraphRAG, semantic search, and AI orchestration",
      icon: "Sparkles",
    },
    {
      name: "Approval Workflow",
      description: "Human-gated publishing with approval workflows",
      icon: "CheckCircle2",
    },
    {
      name: "PADL Publishing",
      description: "Publish to Public Artifact Delivery Layer for AI discovery",
      icon: "Globe",
    },
  ],

  workflow: [
    {
      step: 1,
      title: "Create Artifact",
      description: "Start by creating a new artifact or opening an existing one",
      action: "Click 'New Artifact' or open existing",
    },
    {
      step: 2,
      title: "Write Content",
      description: "Write your artifact content in markdown with AAAL syntax for citations",
      action: "Use editor to write content",
    },
    {
      step: 3,
      title: "Add Evidence",
      description: "Use evidence picker to add citations and evidence links",
      action: "Click 'Add Evidence'",
    },
    {
      step: 4,
      title: "Use AI Assistance",
      description: "Optionally use AI features to enhance content (GraphRAG, semantic search)",
      action: "Use AI assistance features",
    },
    {
      step: 5,
      title: "Check Policies",
      description: "Run policy checker to ensure compliance",
      action: "Click 'Check Policies'",
    },
    {
      step: 6,
      title: "Submit for Approval",
      description: "If required, submit for approval. Otherwise, publish directly",
      action: "Submit or publish",
    },
    {
      step: 7,
      title: "Publish to PADL",
      description: "Publish to PADL for public access and AI discovery",
      action: "Click 'Publish'",
    },
  ],
};
