/**
 * Playbook Templates Library
 * Predefined templates for common playbook scenarios
 */

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  type: "aaal_publish" | "signal_response" | "claim_analysis" | "default";
  template: Record<string, unknown>;
  recommendedAutopilotMode: "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH";
  category: "publishing" | "response" | "analysis" | "custom";
}

export const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    id: "aaal_publish",
    name: "AAAL Publish",
    description: "Publish an AAAL artifact to domain and distribution channels",
    type: "aaal_publish",
    template: {
      type: "aaal_publish",
      steps: [
        {
          step: "validate",
          action: "Validate artifact content and metadata",
        },
        {
          step: "approve",
          action: "Request approval if required by autopilot mode",
        },
        {
          step: "publish",
          action: "Publish to domain",
        },
        {
          step: "distribute",
          action: "Distribute to configured channels (PADL, Medium, LinkedIn, etc.)",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_ROUTE",
    category: "publishing",
  },
  {
    id: "signal_response",
    name: "Signal Response",
    description: "Generate and publish a response to an incoming signal",
    type: "signal_response",
    template: {
      type: "signal_response",
      steps: [
        {
          step: "analyze",
          action: "Analyze signal content and context using AI",
        },
        {
          step: "generate",
          action: "Generate response using RAG/KAG pipelines",
        },
        {
          step: "review",
          action: "Review generated response",
        },
        {
          step: "publish",
          action: "Publish response based on autopilot mode",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_DRAFT",
    category: "response",
  },
  {
    id: "claim_analysis",
    name: "Claim Analysis",
    description: "Analyze a claim and generate insights using AI",
    type: "claim_analysis",
    template: {
      type: "claim_analysis",
      steps: [
        {
          step: "extract",
          action: "Extract claim details and evidence",
        },
        {
          step: "analyze",
          action: "Analyze claim using AI orchestration",
        },
        {
          step: "generate",
          action: "Generate analysis report with citations",
        },
        {
          step: "review",
          action: "Review analysis results",
        },
      ],
    },
    recommendedAutopilotMode: "RECOMMEND_ONLY",
    category: "analysis",
  },
  {
    id: "narrative_preemption",
    name: "Narrative Preemption",
    description: "Preemptive response to emerging narrative risks",
    type: "default",
    template: {
      type: "default",
      steps: [
        {
          step: "detect",
          action: "Detect narrative drift or emerging risk",
        },
        {
          step: "forecast",
          action: "Generate forecast for narrative outbreak probability",
        },
        {
          step: "generate",
          action: "Generate preemptive explanation and support playbooks",
        },
        {
          step: "publish",
          action: "Publish preemptive content based on autopilot mode",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_ROUTE",
    category: "response",
  },
  {
    id: "crisis_response",
    name: "Crisis Response",
    description: "Automated crisis response workflow",
    type: "default",
    template: {
      type: "default",
      steps: [
        {
          step: "alert",
          action: "Receive crisis alert",
        },
        {
          step: "assess",
          action: "Assess severity and impact",
        },
        {
          step: "generate",
          action: "Generate crisis response using templates",
        },
        {
          step: "approve",
          action: "Route for approval",
        },
        {
          step: "publish",
          action: "Publish response across platforms",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_ROUTE",
    category: "response",
  },
  {
    id: "custom",
    name: "Custom Playbook",
    description: "Create a custom playbook from scratch",
    type: "default",
    template: {
      type: "default",
      steps: [],
    },
    recommendedAutopilotMode: "RECOMMEND_ONLY",
    category: "custom",
  },
];

export function getTemplateById(id: string): PlaybookTemplate | undefined {
  return PLAYBOOK_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: PlaybookTemplate["category"]): PlaybookTemplate[] {
  return PLAYBOOK_TEMPLATES.filter((t) => t.category === category);
}
