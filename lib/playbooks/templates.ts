/**
 * Playbook Templates Library
 * Predefined templates for common playbook scenarios
 */

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  type: "aaal_publish" | "signal_response" | "claim_analysis" | "security_incident_response" | "payment_dispute" | "fraud_ato" | "transaction_outage" | "default";
  template: Record<string, unknown>;
  recommendedAutopilotMode: "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH";
  category: "publishing" | "response" | "analysis" | "security" | "financial_services" | "custom";
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
    id: "security_incident_response",
    name: "Security Incident Narrative Response",
    description: "Automated response workflow for security incidents: assess narrative risk, generate explanation, route approvals, publish",
    type: "security_incident_response",
    template: {
      type: "security_incident_response",
      steps: [
        {
          step: "assess_risk",
          action: "Assess narrative risk and outbreak probability for security incident",
        },
        {
          step: "generate_explanation",
          action: "Generate evidence-backed incident explanation using AI",
        },
        {
          step: "route_approvals",
          action: "Route explanation through Legal, Comms, and Executive approvals",
        },
        {
          step: "publish",
          action: "Publish explanation to trust center and monitor AI citations",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_ROUTE",
    category: "security",
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
  {
    id: "payment_dispute",
    name: "Payment Dispute Resolution",
    description: "Autonomous resolution workflow for payment disputes and chargebacks: triage, evidence gathering, merchant response generation, chargeback readiness assessment, resolution plan",
    type: "payment_dispute",
    template: {
      type: "payment_dispute",
      steps: [
        {
          step: "triage",
          action: "Autonomous triage: assess severity, priority, evidence completeness, chargeback risk",
        },
        {
          step: "evidence_gathering",
          action: "Autonomous evidence gathering: fetch transaction logs, customer history, merchant records, payment processor data",
        },
        {
          step: "generate_resolution",
          action: "Generate customer-facing resolution plan and internal action plan using multi-agent collaboration",
        },
        {
          step: "chargeback_assessment",
          action: "Assess chargeback readiness: evidence strength, win probability, merchant response quality, deadline tracking",
        },
        {
          step: "route_approvals",
          action: "Route for legal/compliance approval if high-risk or regulatory sensitivity",
        },
        {
          step: "execute_resolution",
          action: "Execute resolution plan: customer communication, internal actions, chargeback response if needed",
        },
        {
          step: "track_outcome",
          action: "Track resolution outcome and feed back to learning system for continuous improvement",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_ROUTE",
    category: "financial_services",
  },
  {
    id: "fraud_ato",
    name: "Fraud & Account Takeover Resolution",
    description: "Autonomous resolution workflow for fraud and account takeover cases: immediate security actions, investigation, customer communication, resolution plan",
    type: "fraud_ato",
    template: {
      type: "fraud_ato",
      steps: [
        {
          step: "immediate_safety",
          action: "Autonomous safety steps: freeze account, reset credentials, invalidate sessions, review transactions",
        },
        {
          step: "triage",
          action: "Autonomous triage: assess fraud type, severity, customer impact, regulatory requirements",
        },
        {
          step: "investigation",
          action: "Autonomous investigation: analyze transaction patterns, identify fraud vectors, gather evidence",
        },
        {
          step: "generate_resolution",
          action: "Generate customer-facing resolution plan with safety steps and internal investigation plan",
        },
        {
          step: "customer_communication",
          action: "Notify customer of security incident, steps taken, and next actions",
        },
        {
          step: "route_approvals",
          action: "Route for security/compliance approval if high-risk or regulatory reporting required",
        },
        {
          step: "execute_resolution",
          action: "Execute resolution: restore account access if safe, reimburse if applicable, implement prevention measures",
        },
        {
          step: "track_outcome",
          action: "Track resolution outcome and feed back to learning system for fraud pattern recognition",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_ROUTE",
    category: "financial_services",
  },
  {
    id: "transaction_outage",
    name: "Transaction Delay & Outage Resolution",
    description: "Autonomous resolution workflow for transaction delays and service outages: incident assessment, root cause analysis, customer communication, service restoration, resolution plan",
    type: "transaction_outage",
    template: {
      type: "transaction_outage",
      steps: [
        {
          step: "incident_assessment",
          action: "Assess incident: scope, impact, affected customers, service degradation level",
        },
        {
          step: "triage",
          action: "Autonomous triage: severity, priority, SLA breach risk, regulatory impact",
        },
        {
          step: "root_cause_analysis",
          action: "Autonomous root cause analysis: investigate system logs, infrastructure, dependencies, external factors",
        },
        {
          step: "service_restoration",
          action: "Execute service restoration: implement fixes, restore services, verify functionality",
        },
        {
          step: "generate_resolution",
          action: "Generate customer-facing resolution plan with timeline, root cause explanation, and prevention measures",
        },
        {
          step: "customer_communication",
          action: "Communicate with affected customers: incident explanation, resolution status, compensation if applicable",
        },
        {
          step: "route_approvals",
          action: "Route for executive/compliance approval if major incident or regulatory reporting required",
        },
        {
          step: "execute_resolution",
          action: "Execute resolution: process refunds if applicable, update customers, implement prevention measures",
        },
        {
          step: "track_outcome",
          action: "Track resolution outcome and feed back to learning system for outage prevention",
        },
      ],
    },
    recommendedAutopilotMode: "AUTO_ROUTE",
    category: "financial_services",
  },
];

export function getTemplateById(id: string): PlaybookTemplate | undefined {
  return PLAYBOOK_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: PlaybookTemplate["category"]): PlaybookTemplate[] {
  return PLAYBOOK_TEMPLATES.filter((t) => t.category === category);
}
