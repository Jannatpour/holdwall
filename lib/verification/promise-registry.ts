/**
 * Promise Registry
 * Machine-readable contracts mapping every landing-page promise and SKU claim
 * to executable verification methods, SLOs, and evidence artifacts.
 * 
 * This drives CI gates, production canaries, and Status UI.
 */

export interface PromiseContract {
  id: string;
  promise: string; // Human-readable promise (from landing page)
  sku?: string; // SKU identifier (A, B, C, D)
  capability: {
    route?: string; // UI route
    api?: string; // API endpoint
    workflow?: string; // Workflow identifier
  };
  acceptance_criteria: {
    measurable: string; // What to measure
    threshold?: number; // Numeric threshold if applicable
    unit?: string; // Unit of measurement
  };
  verification_method: {
    api_verifier?: string; // Function name in EndToEndVerifier
    playwright_test?: string; // Test file path
    db_assertion?: string; // Database query/check description
  };
  slo?: {
    latency_ms?: number; // P95 latency target
    error_budget?: number; // Error rate threshold (0-1)
    freshness_seconds?: number; // Data freshness requirement
  };
  evidence_artifact: {
    type: "audit_bundle" | "event_trail" | "report_output" | "api_response" | "db_snapshot";
    format?: "json" | "pdf" | "zip";
    description: string;
  };
  tags?: string[]; // For filtering (e.g., "compliance", "ai", "real-time")
}

/**
 * Promise Registry: All customer-facing promises mapped to executable checks
 */
export const PROMISE_REGISTRY: PromiseContract[] = [
  // SKU A: AI Answer Monitoring & Authority
  {
    id: "sku-a-monitor",
    promise: "Monitor AI answer snapshots in real-time",
    sku: "A",
    capability: {
      route: "/solutions/comms",
      api: "/api/ai-answer-monitor",
    },
    acceptance_criteria: {
      measurable: "AI answer snapshots can be created and retrieved",
      threshold: 1,
      unit: "snapshot",
    },
    verification_method: {
      api_verifier: "verifyAIAnswerMonitoring",
      playwright_test: "__tests__/e2e/sku-a-monitoring.test.ts",
    },
    slo: {
      latency_ms: 2000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "api_response",
      format: "json",
      description: "Snapshot creation and retrieval API responses",
    },
    tags: ["ai", "monitoring", "real-time"],
  },
  {
    id: "sku-a-rebuttal",
    promise: "Generate evidence-backed rebuttal artifacts",
    sku: "A",
    capability: {
      route: "/solutions/comms",
      api: "/api/aaal",
    },
    acceptance_criteria: {
      measurable: "Rebuttal artifacts can be created with evidence citations",
      threshold: 1,
      unit: "artifact",
    },
    verification_method: {
      api_verifier: "verifyAAALArtifactCreation",
      db_assertion: "Artifact has valid evidence references",
    },
    slo: {
      latency_ms: 5000,
      error_budget: 0.02,
    },
    evidence_artifact: {
      type: "audit_bundle",
      format: "json",
      description: "Artifact creation audit trail with evidence references",
    },
    tags: ["ai", "aaal", "evidence"],
  },
  {
    id: "sku-a-publish",
    promise: "Publish artifacts via PADL for AI citation tracking",
    sku: "A",
    capability: {
      route: "/padl/[artifactId]",
      api: "/api/aaal/publish",
    },
    acceptance_criteria: {
      measurable: "Artifacts can be published and accessed via PADL",
      threshold: 1,
      unit: "published_artifact",
    },
    verification_method: {
      api_verifier: "verifyPADLPublishing",
      playwright_test: "__tests__/e2e/padl-publishing.test.ts",
    },
    slo: {
      latency_ms: 3000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "api_response",
      format: "json",
      description: "PADL artifact URL and metadata",
    },
    tags: ["publishing", "padl", "ai"],
  },

  // SKU B: Narrative Risk Early Warning
  {
    id: "sku-b-signal-ingest",
    promise: "Ingest signals from multiple sources with validation",
    sku: "B",
    capability: {
      route: "/solutions/security",
      api: "/api/signals",
    },
    acceptance_criteria: {
      measurable: "Signals can be ingested with idempotency and error recovery",
      threshold: 1,
      unit: "signal",
    },
    verification_method: {
      api_verifier: "verifySignalIngestionFlow",
      db_assertion: "Signal stored in Evidence table with proper metadata",
    },
    slo: {
      latency_ms: 1000,
      error_budget: 0.01,
      freshness_seconds: 60,
    },
    evidence_artifact: {
      type: "event_trail",
      format: "json",
      description: "Signal ingestion event trail with idempotency keys",
    },
    tags: ["ingestion", "real-time", "idempotency"],
  },
  {
    id: "sku-b-claim-extract",
    promise: "Extract and cluster claims from evidence",
    sku: "B",
    capability: {
      api: "/api/claims",
    },
    acceptance_criteria: {
      measurable: "Claims extracted and clustered with embeddings",
      threshold: 1,
      unit: "claim_cluster",
    },
    verification_method: {
      api_verifier: "verifyClaimExtractionFlow",
      db_assertion: "Claims exist with clusterId and embeddings",
    },
    slo: {
      latency_ms: 10000,
      error_budget: 0.05,
    },
    evidence_artifact: {
      type: "db_snapshot",
      format: "json",
      description: "Claim extraction results with cluster assignments",
    },
    tags: ["ai", "claims", "clustering"],
  },
  {
    id: "sku-b-forecast",
    promise: "Generate narrative risk forecasts (drift, anomaly, outbreak)",
    sku: "B",
    capability: {
      api: "/api/forecasts",
    },
    acceptance_criteria: {
      measurable: "Forecasts generated with probability scores",
      threshold: 1,
      unit: "forecast",
    },
    verification_method: {
      api_verifier: "verifyForecastGeneration",
      db_assertion: "Forecast records exist with probability scores",
    },
    slo: {
      latency_ms: 15000,
      error_budget: 0.05,
    },
    evidence_artifact: {
      type: "report_output",
      format: "json",
      description: "Forecast report with probability scores and risk levels",
    },
    tags: ["forecasting", "risk", "ai"],
  },
  {
    id: "sku-b-playbook",
    promise: "Execute preemption playbooks with approvals",
    sku: "B",
    capability: {
      api: "/api/playbooks",
    },
    acceptance_criteria: {
      measurable: "Playbooks can be executed with approval workflows",
      threshold: 1,
      unit: "playbook_execution",
    },
    verification_method: {
      api_verifier: "verifyPlaybookExecution",
      playwright_test: "__tests__/e2e/playbooks.test.ts",
    },
    slo: {
      latency_ms: 5000,
      error_budget: 0.02,
    },
    evidence_artifact: {
      type: "audit_bundle",
      format: "json",
      description: "Playbook execution audit with approval steps",
    },
    tags: ["playbooks", "approvals", "automation"],
  },

  // SKU C: Evidence-Backed Intake & Case Triage
  {
    id: "sku-c-evidence-vault",
    promise: "Store evidence in immutable vault with provenance",
    sku: "C",
    capability: {
      api: "/api/evidence",
    },
    acceptance_criteria: {
      measurable: "Evidence stored with signatures and chain of custody",
      threshold: 1,
      unit: "evidence_item",
    },
    verification_method: {
      api_verifier: "verifyEvidenceVault",
      db_assertion: "Evidence has signatureValue and chain of custody records",
    },
    slo: {
      latency_ms: 2000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "audit_bundle",
      format: "json",
      description: "Evidence creation audit with signatures and chain of custody",
    },
    tags: ["evidence", "immutability", "compliance"],
  },
  {
    id: "sku-c-case-triage",
    promise: "Create verifiable case files from evidence",
    sku: "C",
    capability: {
      route: "/cases",
      api: "/api/cases",
    },
    acceptance_criteria: {
      measurable: "Cases created with evidence references and structured data",
      threshold: 1,
      unit: "case",
    },
    verification_method: {
      api_verifier: "verifyCaseCreation",
      playwright_test: "__tests__/e2e/cases.test.ts",
    },
    slo: {
      latency_ms: 3000,
      error_budget: 0.02,
    },
    evidence_artifact: {
      type: "audit_bundle",
      format: "zip",
      description: "Case audit bundle with evidence references",
    },
    tags: ["cases", "triage", "compliance"],
  },
  {
    id: "sku-c-audit-export",
    promise: "Export audit bundles for compliance (one-click)",
    sku: "C",
    capability: {
      api: "/api/governance/audit-bundle",
    },
    acceptance_criteria: {
      measurable: "Audit bundles exported with all required data (JSON/PDF/ZIP)",
      threshold: 1,
      unit: "bundle",
    },
    verification_method: {
      api_verifier: "verifyAuditBundleExport",
      db_assertion: "Bundle contains audit entries, events, evidence, access logs",
    },
    slo: {
      latency_ms: 10000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "audit_bundle",
      format: "zip",
      description: "Complete audit bundle with PDF executive summary",
    },
    tags: ["compliance", "audit", "export"],
  },

  // SKU D: Security Incident Narrative Management
  {
    id: "sku-d-incident-ingest",
    promise: "Ingest security incidents via webhook",
    sku: "D",
    capability: {
      api: "/api/security-incidents/webhook",
    },
    acceptance_criteria: {
      measurable: "Security incidents can be ingested and stored",
      threshold: 1,
      unit: "incident",
    },
    verification_method: {
      api_verifier: "verifySecurityIncidentIngestion",
      db_assertion: "SecurityIncident record created with proper metadata",
    },
    slo: {
      latency_ms: 2000,
      error_budget: 0.01,
      freshness_seconds: 30,
    },
    evidence_artifact: {
      type: "event_trail",
      format: "json",
      description: "Incident ingestion event trail",
    },
    tags: ["security", "incidents", "webhooks"],
  },
  {
    id: "sku-d-narrative-risk",
    promise: "Assess narrative risk for security incidents",
    sku: "D",
    capability: {
      api: "/api/security-incidents/[id]/narrative-risk",
    },
    acceptance_criteria: {
      measurable: "Narrative risk score calculated and returned",
      threshold: 0,
      unit: "risk_score",
    },
    verification_method: {
      api_verifier: "verifyNarrativeRiskAssessment",
      db_assertion: "Incident has narrativeRiskScore field populated",
    },
    slo: {
      latency_ms: 5000,
      error_budget: 0.05,
    },
    evidence_artifact: {
      type: "api_response",
      format: "json",
      description: "Narrative risk assessment with score and analysis",
    },
    tags: ["security", "risk", "ai"],
  },
  {
    id: "sku-d-explanation",
    promise: "Generate AI-governed incident explanations with citations",
    sku: "D",
    capability: {
      api: "/api/security-incidents/[id]/explanation",
    },
    acceptance_criteria: {
      measurable: "AI-generated explanations with citations and approvals",
      threshold: 1,
      unit: "explanation",
    },
    verification_method: {
      api_verifier: "verifyIncidentExplanation",
      db_assertion: "IncidentExplanation record with citations",
    },
    slo: {
      latency_ms: 10000,
      error_budget: 0.05,
    },
    evidence_artifact: {
      type: "report_output",
      format: "json",
      description: "AI-generated explanation with citations and approval status",
    },
    tags: ["ai", "explanations", "governance"],
  },

  // Compliance promises
  {
    id: "compliance-gdpr-access",
    promise: "GDPR Article 15: Right of Access - users can access all their data",
    capability: {
      api: "/api/compliance/gdpr/access",
    },
    acceptance_criteria: {
      measurable: "GDPR access request returns all user data (user, claims, evidence, artifacts, events)",
      threshold: 1,
      unit: "data_export",
    },
    verification_method: {
      api_verifier: "verifyGDPRAccess",
      db_assertion: "Response contains user data, claims, evidence, artifacts, events",
    },
    slo: {
      latency_ms: 5000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "api_response",
      format: "json",
      description: "GDPR access response with all user data",
    },
    tags: ["compliance", "gdpr", "data-access"],
  },
  {
    id: "compliance-gdpr-export",
    promise: "GDPR Article 20: Data Portability - users can export their data",
    capability: {
      api: "/api/compliance/gdpr/export",
    },
    acceptance_criteria: {
      measurable: "GDPR export request creates downloadable export (JSON/S3)",
      threshold: 1,
      unit: "export",
    },
    verification_method: {
      api_verifier: "verifyGDPRExport",
      db_assertion: "Export requestId created, Event table has gdpr.export_created event",
    },
    slo: {
      latency_ms: 10000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "api_response",
      format: "json",
      description: "GDPR export requestId and download URL",
    },
    tags: ["compliance", "gdpr", "data-export"],
  },
  {
    id: "compliance-gdpr-delete",
    promise: "GDPR Article 17: Right to Erasure - users can delete/anonymize their data",
    capability: {
      api: "/api/compliance/gdpr/delete",
    },
    acceptance_criteria: {
      measurable: "GDPR deletion anonymizes user data while preserving referential integrity",
      threshold: 1,
      unit: "deletion",
    },
    verification_method: {
      api_verifier: "verifyGDPRDeletion",
      db_assertion: "User email anonymized, evidence metadata marked anonymized, claims anonymized",
    },
    slo: {
      latency_ms: 5000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "event_trail",
      format: "json",
      description: "GDPR deletion event trail with anonymization details",
    },
    tags: ["compliance", "gdpr", "data-deletion"],
  },
  {
    id: "compliance-audit-bundle",
    promise: "SOC2-ready audit bundle export with complete audit trail",
    capability: {
      api: "/api/governance/audit-bundle",
    },
    acceptance_criteria: {
      measurable: "Audit bundle contains audit entries, events, evidence, chain of custody, access logs, version IDs",
      threshold: 1,
      unit: "bundle",
    },
    verification_method: {
      api_verifier: "verifyAuditBundleIntegrity",
      db_assertion: "Bundle contains all required sections with immutable version IDs",
    },
    slo: {
      latency_ms: 15000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "audit_bundle",
      format: "zip",
      description: "Complete audit bundle (JSON + PDF) with Merkle bundle if enabled",
    },
    tags: ["compliance", "soc2", "audit"],
  },
  {
    id: "compliance-access-logs",
    promise: "Evidence access logs track all READ/WRITE/DELETE/EXPORT/REDACT operations",
    capability: {
      api: "/api/evidence/access-log",
    },
    acceptance_criteria: {
      measurable: "Access logs record all evidence access operations with actor, timestamp, IP, reason",
      threshold: 1,
      unit: "access_log_entry",
    },
    verification_method: {
      api_verifier: "verifyAccessLogging",
      db_assertion: "EvidenceAccessLog entries exist for evidence access operations",
    },
    slo: {
      latency_ms: 100,
      error_budget: 0.001,
    },
    evidence_artifact: {
      type: "db_snapshot",
      format: "json",
      description: "Evidence access log entries",
    },
    tags: ["compliance", "audit", "access-control"],
  },

  // Authentication promises
  {
    id: "auth-signup",
    promise: "Users can create accounts with email and password",
    capability: {
      route: "/auth/signup",
      api: "/api/auth/signup",
    },
    acceptance_criteria: {
      measurable: "User account created with hashed password, default tenant assigned",
      threshold: 1,
      unit: "user_account",
    },
    verification_method: {
      playwright_test: "__tests__/e2e/authentication.test.ts",
      db_assertion: "User record created with passwordHash, tenantId, role=USER",
    },
    slo: {
      latency_ms: 2000,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "api_response",
      format: "json",
      description: "User creation response (without password)",
    },
    tags: ["authentication", "user-management"],
  },
  {
    id: "auth-signin",
    promise: "Users can sign in with credentials and maintain session",
    capability: {
      route: "/auth/signin",
      api: "/api/auth/[...nextauth]",
    },
    acceptance_criteria: {
      measurable: "User can sign in and access protected routes with valid session",
      threshold: 1,
      unit: "session",
    },
    verification_method: {
      playwright_test: "__tests__/e2e/authentication.test.ts",
      db_assertion: "Session cookie set, /api/auth/session returns user data",
    },
    slo: {
      latency_ms: 1500,
      error_budget: 0.01,
    },
    evidence_artifact: {
      type: "api_response",
      format: "json",
      description: "Session response with user data",
    },
    tags: ["authentication", "session"],
  },

  // Multi-tenant isolation promise
  {
    id: "tenant-isolation",
    promise: "Tenant data is completely isolated - no cross-tenant data access",
    capability: {
      api: "all",
    },
    acceptance_criteria: {
      measurable: "User from Tenant A cannot access data from Tenant B",
      threshold: 0,
      unit: "cross_tenant_access_attempt",
    },
    verification_method: {
      api_verifier: "verifyTenantIsolation",
      db_assertion: "All queries include tenantId filter, cross-tenant queries return 403/empty",
    },
    slo: {
      error_budget: 0, // Zero tolerance for isolation breaches
    },
    evidence_artifact: {
      type: "audit_bundle",
      format: "json",
      description: "Tenant isolation test results with query audit logs",
    },
    tags: ["security", "multi-tenant", "isolation"],
  },
];

/**
 * Get promises by SKU
 */
export function getPromisesBySKU(sku: string): PromiseContract[] {
  return PROMISE_REGISTRY.filter((p) => p.sku === sku);
}

/**
 * Get promises by tag
 */
export function getPromisesByTag(tag: string): PromiseContract[] {
  return PROMISE_REGISTRY.filter((p) => p.tags?.includes(tag));
}

/**
 * Get all compliance promises
 */
export function getCompliancePromises(): PromiseContract[] {
  return getPromisesByTag("compliance");
}

/**
 * Get promise by ID
 */
export function getPromiseById(id: string): PromiseContract | undefined {
  return PROMISE_REGISTRY.find((p) => p.id === id);
}

/**
 * Get all SKU promises
 */
export function getAllSKUPromises(): PromiseContract[] {
  return PROMISE_REGISTRY.filter((p) => !!p.sku);
}
