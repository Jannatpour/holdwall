"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight, Play, Pause, RotateCcw, ExternalLink, ChevronRight, ChevronDown, HelpCircle, Clock, Sparkles, BookOpen, Zap, Target, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DemoStep {
  id: string;
  section: string;
  title: string;
  description: string;
  page: string;
  pageUrl: string;
  actions: string[];
  expectedResults: string[];
  duration: number;
  order: number;
}

interface SectionInfo {
  name: string;
  description: string;
  icon: string;
  estimatedTime: number;
  importance: "essential" | "important" | "optional";
}

// Complete list of 52 categorized demo steps across 18 sections
const DEMO_STEPS: DemoStep[] = [
  // ========== CATEGORY 1: AUTHENTICATION & ONBOARDING ==========
  {
    id: "auth-signup",
    section: "Authentication & Onboarding",
    title: "User Signup & Account Creation",
    description: "Create a new account and complete the onboarding process",
    page: "Signup Page",
    pageUrl: "/auth/signup",
    actions: [
      "Fill in name, email, and password",
      "Submit signup form",
      "Complete email verification (if enabled)",
      "Start onboarding wizard"
    ],
    expectedResults: [
      "User account created successfully",
      "Redirected to onboarding flow",
      "Onboarding wizard displayed"
    ],
    duration: 120,
    order: 1
  },
  {
    id: "onboarding-sku",
    section: "Authentication & Onboarding",
    title: "SKU Selection",
    description: "Choose your primary use case (SKU A, B, C, or D)",
    page: "Onboarding - SKU Selection",
    pageUrl: "/onboarding",
    actions: [
      "Review SKU options (AI Answer Monitoring, Narrative Risk, Evidence Intake, Security Incidents)",
      "Select appropriate SKU for your use case",
      "Click 'Continue'"
    ],
    expectedResults: [
      "SKU selected and saved",
      "Proceed to data sources configuration"
    ],
    duration: 60,
    order: 2
  },
  {
    id: "onboarding-sources",
    section: "Authentication & Onboarding",
    title: "Connect Data Sources",
    description: "Connect your first 3-5 data sources",
    page: "Onboarding - Data Sources",
    pageUrl: "/onboarding/[sku]/sources",
    actions: [
      "Add Reddit sources (subreddits)",
      "Add Twitter/X mentions",
      "Connect support system (Zendesk/Intercom)",
      "Add review platforms (Google, Trustpilot)",
      "Save configuration"
    ],
    expectedResults: [
      "Data sources connected",
      "Initial sync triggered",
      "Proceed to policy configuration"
    ],
    duration: 180,
    order: 3
  },
  {
    id: "onboarding-policy",
    section: "Authentication & Onboarding",
    title: "Define Risk Policy",
    description: "Configure risk thresholds and escalation rules",
    page: "Onboarding - Risk Policy",
    pageUrl: "/onboarding/[sku]/policy",
    actions: [
      "Set high severity keywords (fraud, scam, data breach)",
      "Set medium severity keywords (hidden fees, poor service)",
      "Configure escalation rules",
      "Define non-starters",
      "Save policy"
    ],
    expectedResults: [
      "Risk policy saved",
      "Escalation rules active",
      "Proceed to first brief"
    ],
    duration: 120,
    order: 4
  },
  {
    id: "onboarding-brief",
    section: "Authentication & Onboarding",
    title: "Generate First Perception Brief",
    description: "Run your first perception brief to see baseline metrics",
    page: "Onboarding - First Brief",
    pageUrl: "/onboarding/[sku]/brief",
    actions: [
      "Click 'Generate Brief'",
      "Review top claim clusters",
      "Review outbreak probability indicators",
      "Review evidence availability",
      "Complete onboarding"
    ],
    expectedResults: [
      "Perception brief generated",
      "Baseline metrics displayed",
      "Redirected to overview dashboard"
    ],
    duration: 90,
    order: 5
  },

  // ========== CATEGORY 2: OVERVIEW & DASHBOARD ==========
  {
    id: "overview-dashboard",
    section: "Overview & Dashboard",
    title: "View Overview Dashboard",
    description: "See complete overview with all key metrics",
    page: "Overview Page",
    pageUrl: "/overview",
    actions: [
      "Navigate to Overview page",
      "View perception health score",
      "Check outbreak probability",
      "Review top claim clusters",
      "See recommendations",
      "View narrative risk brief"
    ],
    expectedResults: [
      "Overview dashboard displayed",
      "All metrics visible",
      "Recommendations shown",
      "Risk brief accessible"
    ],
    duration: 120,
    order: 6
  },
  {
    id: "metrics-tracking",
    section: "Overview & Dashboard",
    title: "Track Metrics Over Time",
    description: "View metrics trends and improvements",
    page: "Overview Page",
    pageUrl: "/overview",
    actions: [
      "View metrics charts",
      "Change time range (7d, 30d, 90d)",
      "Compare metrics",
      "View trend lines",
      "Check ROI indicators"
    ],
    expectedResults: [
      "Metrics charts displayed",
      "Trends visible",
      "Comparisons working",
      "ROI indicators shown"
    ],
    duration: 90,
    order: 7
  },

  // ========== CATEGORY 3: SIGNAL INGESTION & PROCESSING ==========
  {
    id: "signals-overview",
    section: "Signal Ingestion & Processing",
    title: "View Signals Dashboard",
    description: "Explore the signals page and see ingested data",
    page: "Signals Page",
    pageUrl: "/signals",
    actions: [
      "Navigate to Signals page",
      "View signal list",
      "Filter by source type",
      "View signal details",
      "Check processing status"
    ],
    expectedResults: [
      "Signals list displayed",
      "Filters working",
      "Signal details accessible",
      "Processing status visible"
    ],
    duration: 90,
    order: 8
  },
  {
    id: "signal-ingest",
    section: "Signal Ingestion & Processing",
    title: "Ingest New Signal",
    description: "Manually ingest a signal or view connector sync",
    page: "Signals Page",
    pageUrl: "/signals",
    actions: [
      "Click 'Add Signal' or view connector sync",
      "Select source type (Reddit, Twitter, Support, etc.)",
      "Enter signal content",
      "Submit signal",
      "Watch real-time processing"
    ],
    expectedResults: [
      "Signal ingested successfully",
      "Evidence created automatically",
      "Claims extracted",
      "Cluster suggestions appear"
    ],
    duration: 120,
    order: 9
  },
  {
    id: "signal-stream",
    section: "Signal Ingestion & Processing",
    title: "Real-Time Signal Stream",
    description: "View live signal ingestion via WebSocket/SSE",
    page: "Signals Page",
    pageUrl: "/signals",
    actions: [
      "Enable 'Live Stream' toggle",
      "Watch signals appear in real-time",
      "See processing status updates",
      "View claim extraction happening"
    ],
    expectedResults: [
      "WebSocket connection established",
      "Signals appear in real-time (< 1 second)",
      "Processing visible",
      "No page refresh needed"
    ],
    duration: 90,
    order: 10
  },

  // ========== CATEGORY 4: INTEGRATIONS & CONNECTORS ==========
  {
    id: "integrations-overview",
    section: "Integrations & Connectors",
    title: "View Integrations Dashboard",
    description: "Explore connected data sources and connectors",
    page: "Integrations Page",
    pageUrl: "/integrations",
    actions: [
      "Navigate to Integrations page",
      "View connectors list",
      "Check connector status",
      "View sync history",
      "Check API keys"
    ],
    expectedResults: [
      "Integrations dashboard displayed",
      "Connectors list visible",
      "Status indicators shown",
      "Sync history accessible"
    ],
    duration: 90,
    order: 11
  },
  {
    id: "connector-create",
    section: "Integrations & Connectors",
    title: "Create New Connector",
    description: "Add a new data source connector",
    page: "Integrations Page",
    pageUrl: "/integrations",
    actions: [
      "Click 'Add Connector'",
      "Select connector type (Reddit, Twitter, Zendesk, etc.)",
      "Fill in configuration",
      "Test connection",
      "Save connector"
    ],
    expectedResults: [
      "Connector created",
      "Connection tested successfully",
      "Connector appears in list",
      "Initial sync triggered"
    ],
    duration: 180,
    order: 12
  },
  {
    id: "connector-sync",
    section: "Integrations & Connectors",
    title: "Sync Connector",
    description: "Manually trigger connector sync",
    page: "Integrations Page",
    pageUrl: "/integrations",
    actions: [
      "Select a connector",
      "Click 'Sync' button",
      "Watch sync progress",
      "View sync results",
      "Check new signals ingested"
    ],
    expectedResults: [
      "Sync initiated",
      "Progress visible",
      "Sync completed",
      "New signals appear in Signals page"
    ],
    duration: 120,
    order: 13
  },

  // ========== CATEGORY 5: EVIDENCE VAULT & PROVENANCE ==========
  {
    id: "evidence-overview",
    section: "Evidence Vault & Provenance",
    title: "Explore Evidence Vault",
    description: "View all evidence items with provenance",
    page: "Evidence Page",
    pageUrl: "/evidence",
    actions: [
      "Navigate to Evidence page (via Signals or direct)",
      "View evidence list",
      "Filter by source, date, type",
      "View evidence details",
      "Check provenance chain"
    ],
    expectedResults: [
      "Evidence list displayed",
      "Provenance information visible",
      "Filters working",
      "Details accessible"
    ],
    duration: 90,
    order: 14
  },
  {
    id: "evidence-detail",
    section: "Evidence Vault & Provenance",
    title: "View Evidence Detail",
    description: "Explore individual evidence item with full provenance",
    page: "Evidence Detail",
    pageUrl: "/evidence/[id]",
    actions: [
      "Open an evidence item",
      "View full content",
      "Check source metadata",
      "View provenance chain",
      "See linked claims"
    ],
    expectedResults: [
      "Evidence detail displayed",
      "Complete provenance visible",
      "Source metadata shown",
      "Linked claims accessible"
    ],
    duration: 90,
    order: 15
  },
  {
    id: "evidence-bundle-create",
    section: "Evidence Vault & Provenance",
    title: "Create Evidence Bundle",
    description: "Create a bundle of evidence items with Merkle tree",
    page: "Evidence Page",
    pageUrl: "/evidence",
    actions: [
      "Select multiple evidence items",
      "Click 'Create Bundle'",
      "Add bundle metadata",
      "Generate Merkle tree",
      "Save bundle"
    ],
    expectedResults: [
      "Bundle created successfully",
      "Merkle tree generated",
      "Bundle ID assigned",
      "Ready for export"
    ],
    duration: 120,
    order: 16
  },
  {
    id: "evidence-bundle-export",
    section: "Evidence Vault & Provenance",
    title: "Export Evidence Bundle",
    description: "Export bundle with C2PA manifest for legal use",
    page: "Evidence Detail",
    pageUrl: "/evidence/[id]",
    actions: [
      "Open evidence bundle",
      "Click 'Export'",
      "Select format (Legal Export with C2PA)",
      "Download bundle",
      "Verify C2PA manifest"
    ],
    expectedResults: [
      "Bundle exported successfully",
      "C2PA manifest included",
      "File downloadable",
      "Third-party verifiable"
    ],
    duration: 90,
    order: 17
  },

  // ========== SECTION 6: CLAIM EXTRACTION & CLUSTERING ==========
  {
    id: "claims-overview",
    section: "Claim Extraction & Clustering",
    title: "View Claim Clusters",
    description: "Explore claim clusters and decisiveness scores",
    page: "Claims Page",
    pageUrl: "/claims",
    actions: [
      "Navigate to Claims page",
      "View claim clusters list",
      "Sort by decisiveness, velocity, date",
      "View cluster details",
      "Check linked evidence"
    ],
    expectedResults: [
      "Clusters displayed",
      "Decisiveness scores visible",
      "Velocity indicators shown",
      "Evidence links accessible"
    ],
    duration: 90,
    order: 18
  },
  {
    id: "claim-detail",
    section: "Claim Extraction & Clustering",
    title: "Explore Claim Details",
    description: "View detailed claim information and verification",
    page: "Claim Detail",
    pageUrl: "/claims/[id]",
    actions: [
      "Open a claim cluster",
      "View all signals in cluster",
      "Check sub-claims",
      "View verification score",
      "See linked evidence"
    ],
    expectedResults: [
      "Claim details displayed",
      "All signals visible",
      "Verification score shown",
      "Evidence links working"
    ],
    duration: 90,
    order: 19
  },
  {
    id: "claim-verify",
    section: "Claim Extraction & Clustering",
    title: "Verify Claim Against Evidence",
    description: "Run verification and see recommendations",
    page: "Claim Detail",
    pageUrl: "/claims/[id]",
    actions: [
      "Click 'Verify Claim'",
      "View evidence search results",
      "See supporting vs conflicting evidence",
      "Review verification score",
      "Check recommendations"
    ],
    expectedResults: [
      "Verification completed",
      "Score calculated",
      "Recommendations displayed",
      "Actionable insights shown"
    ],
    duration: 120,
    order: 20
  },

  // ========== SECTION 7: BELIEF GRAPH ENGINEERING ==========
  {
    id: "graph-overview",
    section: "Belief Graph Engineering",
    title: "Explore Belief Graph",
    description: "View the belief graph visualization",
    page: "Graph Page",
    pageUrl: "/graph",
    actions: [
      "Navigate to Graph page",
      "View graph visualization",
      "Zoom and pan",
      "Click on nodes",
      "View node details"
    ],
    expectedResults: [
      "Graph displayed",
      "Interactive visualization",
      "Node details accessible",
      "Smooth navigation"
    ],
    duration: 90,
    order: 21
  },
  {
    id: "graph-paths",
    section: "Belief Graph Engineering",
    title: "Find Narrative Paths",
    description: "Discover how narratives connect through the graph",
    page: "Graph Page",
    pageUrl: "/graph",
    actions: [
      "Select a claim node",
      "Click 'Find Paths'",
      "Select another node",
      "View path visualization",
      "See reinforcement/contradiction edges"
    ],
    expectedResults: [
      "Paths found and displayed",
      "Visualization clear",
      "Edge types visible",
      "Activation scores shown"
    ],
    duration: 120,
    order: 22
  },
  {
    id: "bge-cycle",
    section: "Belief Graph Engineering",
    title: "Execute BGE Cycle",
    description: "Run Belief Graph Engineering to neutralize weak nodes",
    page: "POS Dashboard",
    pageUrl: "/pos",
    actions: [
      "Navigate to POS dashboard",
      "Go to 'Belief Graph' tab",
      "View current BGE metrics",
      "Click 'Execute BGE Cycle'",
      "Watch weak nodes neutralized"
    ],
    expectedResults: [
      "BGE cycle executed",
      "Weak nodes detected",
      "Decay edges created",
      "Metrics improved"
    ],
    duration: 120,
    order: 23
  },

  // ========== SECTION 8: NARRATIVE OUTBREAK FORECASTING ==========
  {
    id: "forecasts-overview",
    section: "Narrative Outbreak Forecasting",
    title: "View Forecasts Dashboard",
    description: "Explore outbreak forecasts and predictions",
    page: "Forecasts Page",
    pageUrl: "/forecasts",
    actions: [
      "Navigate to Forecasts page",
      "View forecast list",
      "Filter by type, date, cluster",
      "View forecast details",
      "Check outbreak probability"
    ],
    expectedResults: [
      "Forecasts displayed",
      "Outbreak probabilities visible",
      "Filters working",
      "Details accessible"
    ],
    duration: 90,
    order: 24
  },
  {
    id: "forecast-generate",
    section: "Narrative Outbreak Forecasting",
    title: "Generate Outbreak Forecast",
    description: "Create a new forecast using Hawkes process",
    page: "Forecasts Page",
    pageUrl: "/forecasts",
    actions: [
      "Select a claim cluster",
      "Click 'Generate Forecast'",
      "Set horizon (7 days, 14 days, 30 days)",
      "Select forecast type (OUTBREAK)",
      "View forecast results"
    ],
    expectedResults: [
      "Forecast generated",
      "Outbreak probability calculated",
      "Hawkes parameters shown",
      "Timeline visualization displayed"
    ],
    duration: 120,
    order: 25
  },
  {
    id: "forecast-intervention",
    section: "Narrative Outbreak Forecasting",
    title: "Simulate Intervention",
    description: "See how interventions affect outbreak probability",
    page: "Forecasts Page",
    pageUrl: "/forecasts",
    actions: [
      "Open a forecast",
      "Click 'Simulate Intervention'",
      "Select intervention type (publish rebuttal, etc.)",
      "View updated forecast",
      "Compare before/after"
    ],
    expectedResults: [
      "Intervention simulated",
      "Outbreak probability updated",
      "Before/after comparison shown",
      "ROI calculated"
    ],
    duration: 120,
    order: 26
  },

  // ========== SECTION 9: AI ANSWER AUTHORITY LAYER (AAAL) ==========
  {
    id: "studio-overview",
    section: "AI Answer Authority Layer (AAAL)",
    title: "Explore AAAL Studio",
    description: "View the artifact creation interface",
    page: "Studio Page",
    pageUrl: "/studio",
    actions: [
      "Navigate to Studio page",
      "View existing artifacts",
      "Check artifact status",
      "View artifact details",
      "See approval workflow"
    ],
    expectedResults: [
      "Studio interface displayed",
      "Artifacts list visible",
      "Status indicators shown",
      "Details accessible"
    ],
    duration: 90,
    order: 27
  },
  {
    id: "artifact-create",
    section: "AI Answer Authority Layer (AAAL)",
    title: "Create Rebuttal Artifact",
    description: "Create a new AI-citable artifact",
    page: "Studio Page",
    pageUrl: "/studio",
    actions: [
      "Click 'Create Artifact'",
      "Select claim cluster",
      "Choose artifact type (REBUTTAL)",
      "Fill in content (or use AI generation)",
      "Add evidence citations",
      "Preview structured data (JSON-LD)"
    ],
    expectedResults: [
      "Artifact created",
      "Content saved",
      "Evidence linked",
      "JSON-LD generated",
      "Ready for policy check"
    ],
    duration: 180,
    order: 28
  },
  {
    id: "artifact-policy",
    section: "AI Answer Authority Layer (AAAL)",
    title: "Check Policies",
    description: "Verify artifact meets policy requirements",
    page: "Studio Page",
    pageUrl: "/studio",
    actions: [
      "Open artifact draft",
      "Click 'Check Policies'",
      "Review policy check results",
      "Fix any violations",
      "Re-check policies"
    ],
    expectedResults: [
      "Policy check completed",
      "Violations identified (if any)",
      "Error messages actionable",
      "All policies pass"
    ],
    duration: 120,
    order: 29
  },

  // ========== SECTION 10: GOVERNANCE & APPROVALS ==========
  {
    id: "governance-overview",
    section: "Governance & Approvals",
    title: "View Governance Dashboard",
    description: "Explore approvals and governance features",
    page: "Governance Page",
    pageUrl: "/governance",
    actions: [
      "Navigate to Governance page",
      "View pending approvals",
      "Check approval history",
      "View audit trails",
      "See policy violations"
    ],
    expectedResults: [
      "Governance dashboard displayed",
      "Approvals list visible",
      "History accessible",
      "Audit trails shown"
    ],
    duration: 90,
    order: 30
  },
  {
    id: "approval-workflow",
    section: "Governance & Approvals",
    title: "Multi-Stage Approval Workflow",
    description: "Complete an approval workflow",
    page: "Governance Page",
    pageUrl: "/governance",
    actions: [
      "Select pending approval",
      "Review artifact content",
      "Add comments (if needed)",
      "Approve or request changes",
      "View updated status",
      "Check audit trail"
    ],
    expectedResults: [
      "Approval processed",
      "Status updated",
      "Comments saved",
      "Audit trail updated",
      "Next approver notified"
    ],
    duration: 120,
    order: 31
  },
  {
    id: "audit-bundle",
    section: "Governance & Approvals",
    title: "Export Audit Bundle",
    description: "Create complete audit bundle with provenance",
    page: "Governance Page",
    pageUrl: "/governance",
    actions: [
      "Select artifact or incident",
      "Click 'Export Audit Bundle'",
      "Review bundle contents",
      "Download bundle",
      "Verify provenance chain"
    ],
    expectedResults: [
      "Audit bundle created",
      "Complete provenance included",
      "Downloadable",
      "Verifiable"
    ],
    duration: 90,
    order: 32
  },

  // ========== SECTION 11: PUBLISHING & DISTRIBUTION (PADL) ==========
  {
    id: "publish-artifact",
    section: "Publishing & Distribution (PADL)",
    title: "Publish Artifact",
    description: "Publish approved artifact to multiple channels",
    page: "Studio/Governance",
    pageUrl: "/studio",
    actions: [
      "Open approved artifact",
      "Click 'Publish'",
      "Select channels (trust center, knowledge base, structured data)",
      "Confirm publishing",
      "View published artifact"
    ],
    expectedResults: [
      "Artifact published",
      "Multiple channels updated",
      "URLs generated",
      "C2PA manifest attached (if enabled)",
      "Publicly accessible"
    ],
    duration: 120,
    order: 33
  },
  {
    id: "padl-view",
    section: "Publishing & Distribution (PADL)",
    title: "View Published Artifact (PADL)",
    description: "View published artifact in PADL format",
    page: "PADL Page",
    pageUrl: "/padl/[artifactId]",
    actions: [
      "Navigate to PADL URL",
      "View published artifact",
      "Check structured data (JSON-LD)",
      "Verify C2PA manifest",
      "Test AI citation format"
    ],
    expectedResults: [
      "Artifact visible publicly",
      "Structured data correct",
      "C2PA manifest valid",
      "AI-citable format"
    ],
    duration: 90,
    order: 34
  },

  // ========== SECTION 12: POS COMPONENTS ==========
  {
    id: "pos-overview",
    section: "POS Components",
    title: "View POS Dashboard",
    description: "Explore the complete POS dashboard",
    page: "POS Dashboard",
    pageUrl: "/pos",
    actions: [
      "Navigate to POS page",
      "View overall POS score",
      "Check component scores (BGE, CH, AAAL, NPE, TSM, DFD)",
      "View recommendations",
      "Check metrics trends"
    ],
    expectedResults: [
      "POS dashboard displayed",
      "All component scores visible",
      "Recommendations shown",
      "Metrics accessible"
    ],
    duration: 90,
    order: 35
  },
  {
    id: "pos-cycle",
    section: "POS Components",
    title: "Execute Complete POS Cycle",
    description: "Run full POS cycle and see all components work",
    page: "POS Dashboard",
    pageUrl: "/pos",
    actions: [
      "Click 'Execute POS Cycle'",
      "Watch each component execute",
      "View actions taken",
      "Check updated metrics",
      "Review recommendations"
    ],
    expectedResults: [
      "POS cycle executed",
      "All components ran",
      "Actions taken logged",
      "Metrics improved",
      "New recommendations generated"
    ],
    duration: 180,
    order: 36
  },
  {
    id: "pos-components",
    section: "POS Components",
    title: "Explore Individual Components",
    description: "View details of each POS component",
    page: "POS Dashboard",
    pageUrl: "/pos",
    actions: [
      "Navigate to each component tab",
      "View BGE metrics and actions",
      "View Consensus Hijacking signals",
      "View AAAL citation scores",
      "View NPE preemptive actions",
      "View TSM trust substitution",
      "View DFD funnel control"
    ],
    expectedResults: [
      "All components accessible",
      "Metrics displayed",
      "Actions visible",
      "Recommendations shown"
    ],
    duration: 180,
    order: 37
  },

  // ========== SECTION 13: TRUST ASSETS ==========
  {
    id: "trust-overview",
    section: "Trust Assets",
    title: "View Trust Assets Dashboard",
    description: "Explore trust assets and gap mapping",
    page: "Trust Assets Page",
    pageUrl: "/trust",
    actions: [
      "Navigate to Trust Assets page",
      "View trust assets list",
      "Check trust scores",
      "View gap mapping",
      "See recommendations"
    ],
    expectedResults: [
      "Trust dashboard displayed",
      "Assets list visible",
      "Trust scores shown",
      "Gap mapping accessible"
    ],
    duration: 90,
    order: 38
  },
  {
    id: "trust-create",
    section: "Trust Assets",
    title: "Create Trust Asset",
    description: "Add a new trust asset (certification, audit, etc.)",
    page: "Trust Assets Page",
    pageUrl: "/trust",
    actions: [
      "Click 'Create Trust Asset'",
      "Select asset type (SOC2, ISO, Audit, etc.)",
      "Fill in asset details",
      "Upload documentation",
      "Map to claim clusters",
      "Save asset"
    ],
    expectedResults: [
      "Trust asset created",
      "Documentation uploaded",
      "Mapped to clusters",
      "Trust score updated"
    ],
    duration: 150,
    order: 39
  },
  {
    id: "trust-gaps",
    section: "Trust Assets",
    title: "View Trust Gaps",
    description: "Identify trust gaps and map assets",
    page: "Trust Assets Page",
    pageUrl: "/trust",
    actions: [
      "View trust gap map",
      "Identify clusters with trust gaps",
      "Map existing assets to gaps",
      "Create new assets for gaps",
      "View trust substitution score"
    ],
    expectedResults: [
      "Trust gaps identified",
      "Assets mapped",
      "Gap coverage improved",
      "Trust substitution score updated"
    ],
    duration: 120,
    order: 40
  },

  // ========== SECTION 14: FUNNEL MAP ==========
  {
    id: "funnel-overview",
    section: "Funnel Map",
    title: "View Decision Funnel Map",
    description: "Explore the customer decision funnel",
    page: "Funnel Map Page",
    pageUrl: "/funnel",
    actions: [
      "Navigate to Funnel Map page",
      "View funnel stages (Awareness, Research, Comparison, Decision)",
      "Check control points",
      "View narrative framing",
      "See reinforcement loops"
    ],
    expectedResults: [
      "Funnel map displayed",
      "All stages visible",
      "Control points shown",
      "Narrative framing accessible"
    ],
    duration: 90,
    order: 41
  },
  {
    id: "funnel-simulate",
    section: "Funnel Map",
    title: "Simulate Funnel Scenarios",
    description: "Test different funnel scenarios",
    page: "Funnel Map Page",
    pageUrl: "/funnel",
    actions: [
      "Click 'Simulate Scenario'",
      "Select funnel stage",
      "Input scenario parameters",
      "Run simulation",
      "View results and recommendations"
    ],
    expectedResults: [
      "Simulation completed",
      "Results displayed",
      "Recommendations shown",
      "Actionable insights provided"
    ],
    duration: 120,
    order: 42
  },

  // ========== SECTION 15: PLAYBOOKS ==========
  {
    id: "playbooks-overview",
    section: "Playbooks",
    title: "View Playbooks Dashboard",
    description: "Explore automated playbooks and templates",
    page: "Playbooks Page",
    pageUrl: "/playbooks",
    actions: [
      "Navigate to Playbooks page",
      "View playbook catalog",
      "Check active runs",
      "View run history",
      "See autopilot settings"
    ],
    expectedResults: [
      "Playbooks dashboard displayed",
      "Catalog visible",
      "Active runs shown",
      "History accessible"
    ],
    duration: 90,
    order: 43
  },
  {
    id: "playbook-create",
    section: "Playbooks",
    title: "Create New Playbook",
    description: "Create an automated response playbook",
    page: "Playbooks Page",
    pageUrl: "/playbooks",
    actions: [
      "Click 'Create Playbook'",
      "Select playbook type",
      "Define triggers",
      "Configure actions",
      "Set approval gates",
      "Save playbook"
    ],
    expectedResults: [
      "Playbook created",
      "Triggers configured",
      "Actions defined",
      "Approval gates set"
    ],
    duration: 180,
    order: 44
  },
  {
    id: "playbook-execute",
    section: "Playbooks",
    title: "Execute Playbook",
    description: "Run a playbook manually or view automatic execution",
    page: "Playbooks Page",
    pageUrl: "/playbooks",
    actions: [
      "Select a playbook",
      "Click 'Run' or view automatic execution",
      "Watch playbook steps execute",
      "View execution results",
      "Check approval gates"
    ],
    expectedResults: [
      "Playbook executed",
      "Steps completed",
      "Results visible",
      "Approval gates respected"
    ],
    duration: 120,
    order: 45
  },

  // ========== SECTION 16: AI ANSWER MONITOR ==========
  {
    id: "ai-monitor-overview",
    section: "AI Answer Monitor",
    title: "View AI Answer Monitor",
    description: "Monitor how AI systems cite your content",
    page: "AI Answer Monitor",
    pageUrl: "/ai-answer-monitor",
    actions: [
      "Navigate to AI Answer Monitor page",
      "View citation metrics",
      "Check citation rate",
      "See top queries",
      "View citation history"
    ],
    expectedResults: [
      "AI Monitor dashboard displayed",
      "Citation metrics visible",
      "Citation rate shown",
      "Query history accessible"
    ],
    duration: 90,
    order: 46
  },
  {
    id: "ai-monitor-query",
    section: "AI Answer Monitor",
    title: "Monitor AI Query",
    description: "Monitor a specific query across AI providers",
    page: "AI Answer Monitor",
    pageUrl: "/ai-answer-monitor",
    actions: [
      "Enter a query to monitor",
      "Select AI providers (OpenAI, Anthropic, Google)",
      "Click 'Monitor Query'",
      "View results from each provider",
      "Check if your artifact was cited"
    ],
    expectedResults: [
      "Query monitored",
      "Results from all providers shown",
      "Citation status visible",
      "Citation rate tracked"
    ],
    duration: 120,
    order: 47
  },
  {
    id: "ai-monitor-metrics",
    section: "AI Answer Monitor",
    title: "View Citation Metrics",
    description: "Track citation improvements over time",
    page: "AI Answer Monitor",
    pageUrl: "/ai-answer-monitor",
    actions: [
      "View citation metrics dashboard",
      "Check citation rate trends",
      "See sentiment shift",
      "View coverage metrics",
      "Check ROI indicators"
    ],
    expectedResults: [
      "Metrics displayed",
      "Trends visible",
      "Sentiment shift shown",
      "Coverage metrics accessible",
      "ROI indicators displayed"
    ],
    duration: 90,
    order: 48
  },

  // ========== SECTION 17: FINANCIAL SERVICES ==========
  {
    id: "financial-services-overview",
    section: "Financial Services",
    title: "View Financial Services Dashboard",
    description: "Explore financial services-specific features",
    page: "Financial Services Page",
    pageUrl: "/financial-services",
    actions: [
      "Navigate to Financial Services page",
      "View perception brief",
      "Check narrative clusters",
      "View preemption playbooks",
      "See monthly reports"
    ],
    expectedResults: [
      "Financial Services dashboard displayed",
      "Perception brief visible",
      "Narrative clusters shown",
      "Playbooks accessible"
    ],
    duration: 90,
    order: 49
  },
  {
    id: "financial-services-brief",
    section: "Financial Services",
    title: "Generate Perception Brief",
    description: "Create a financial services perception brief",
    page: "Financial Services Page",
    pageUrl: "/financial-services",
    actions: [
      "Click 'Generate Brief'",
      "Select time range",
      "Review narrative clusters",
      "Check outbreak probabilities",
      "View recommendations",
      "Export brief"
    ],
    expectedResults: [
      "Brief generated",
      "Clusters analyzed",
      "Outbreak probabilities shown",
      "Recommendations displayed",
      "Brief exportable"
    ],
    duration: 120,
    order: 50
  },
  {
    id: "financial-services-preemption",
    section: "Financial Services",
    title: "Configure Preemption Playbooks",
    description: "Set up preemptive response playbooks",
    page: "Financial Services Page",
    pageUrl: "/financial-services",
    actions: [
      "Navigate to Preemption section",
      "View existing playbooks",
      "Create new preemption playbook",
      "Configure triggers",
      "Set response actions",
      "Save playbook"
    ],
    expectedResults: [
      "Playbooks configured",
      "Triggers set",
      "Response actions defined",
      "Playbook active"
    ],
    duration: 150,
    order: 51
  },

  // ========== SECTION 18: METERING ==========
  {
    id: "metering-overview",
    section: "Metering",
    title: "View Metering Dashboard",
    description: "Monitor usage and billing metrics",
    page: "Metering Page",
    pageUrl: "/metering",
    actions: [
      "Navigate to Metering page",
      "View usage metrics",
      "Check API call counts",
      "View storage usage",
      "See billing information"
    ],
    expectedResults: [
      "Metering dashboard displayed",
      "Usage metrics visible",
      "API counts shown",
      "Storage usage accessible"
    ],
    duration: 90,
    order: 52
  }
];

// Section metadata for better user guidance
const SECTION_INFO: Record<string, SectionInfo> = {
  "Authentication & Onboarding": {
    name: "Authentication & Onboarding",
    description: "Get started with account creation, SKU selection, and initial setup",
    icon: "🚀",
    estimatedTime: 570, // 5 steps * ~114 seconds avg
    importance: "essential"
  },
  "Overview & Dashboard": {
    name: "Overview & Dashboard",
    description: "Understand your narrative health and key metrics at a glance",
    icon: "📊",
    estimatedTime: 210,
    importance: "essential"
  },
  "Signal Ingestion & Processing": {
    name: "Signal Ingestion & Processing",
    description: "Learn how to ingest and process signals from various sources",
    icon: "📡",
    estimatedTime: 300,
    importance: "essential"
  },
  "Integrations & Connectors": {
    name: "Integrations & Connectors",
    description: "Connect data sources and manage integrations",
    icon: "🔌",
    estimatedTime: 390,
    importance: "important"
  },
  "Evidence Vault & Provenance": {
    name: "Evidence Vault & Provenance",
    description: "Manage evidence with full provenance and chain of custody",
    icon: "🔒",
    estimatedTime: 390,
    importance: "essential"
  },
  "Claim Extraction & Clustering": {
    name: "Claim Extraction & Clustering",
    description: "Extract and cluster claims from signals for analysis",
    icon: "🎯",
    estimatedTime: 300,
    importance: "essential"
  },
  "Belief Graph Engineering": {
    name: "Belief Graph Engineering",
    description: "Explore narrative connections and neutralize weak nodes",
    icon: "🕸️",
    estimatedTime: 330,
    importance: "important"
  },
  "Narrative Outbreak Forecasting": {
    name: "Narrative Outbreak Forecasting",
    description: "Forecast narrative outbreaks using advanced models",
    icon: "📈",
    estimatedTime: 330,
    importance: "important"
  },
  "AI Answer Authority Layer (AAAL)": {
    name: "AI Answer Authority Layer (AAAL)",
    description: "Create AI-citable artifacts and rebuttals",
    icon: "🤖",
    estimatedTime: 390,
    importance: "essential"
  },
  "Governance & Approvals": {
    name: "Governance & Approvals",
    description: "Manage approvals, audits, and compliance workflows",
    icon: "✅",
    estimatedTime: 300,
    importance: "important"
  },
  "Publishing & Distribution (PADL)": {
    name: "Publishing & Distribution (PADL)",
    description: "Publish artifacts to multiple channels with structured data",
    icon: "📤",
    estimatedTime: 210,
    importance: "essential"
  },
  "POS Components": {
    name: "POS Components",
    description: "Explore all Perception Operating System components",
    icon: "⚙️",
    estimatedTime: 450,
    importance: "important"
  },
  "Trust Assets": {
    name: "Trust Assets",
    description: "Manage trust assets and identify trust gaps",
    icon: "🛡️",
    estimatedTime: 360,
    importance: "important"
  },
  "Funnel Map": {
    name: "Funnel Map",
    description: "Visualize and control customer decision funnels",
    icon: "🗺️",
    estimatedTime: 210,
    importance: "optional"
  },
  "Playbooks": {
    name: "Playbooks",
    description: "Create and execute automated response playbooks",
    icon: "📋",
    estimatedTime: 390,
    importance: "important"
  },
  "AI Answer Monitor": {
    name: "AI Answer Monitor",
    description: "Monitor how AI systems cite your content",
    icon: "👁️",
    estimatedTime: 300,
    importance: "important"
  },
  "Financial Services": {
    name: "Financial Services",
    description: "Financial services-specific features and workflows",
    icon: "💳",
    estimatedTime: 360,
    importance: "optional"
  },
  "Metering": {
    name: "Metering",
    description: "Monitor usage, billing, and resource consumption",
    icon: "📊",
    estimatedTime: 90,
    importance: "optional"
  }
};

export function DemoWalkthroughClient() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("demo-welcome-dismissed");
    }
    return true;
  });
  const [tourMode, setTourMode] = useState<"guided" | "explore" | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  const currentStep = DEMO_STEPS[currentStepIndex] || DEMO_STEPS[0];
  const progress = ((currentStepIndex + 1) / DEMO_STEPS.length) * 100;
  const sections = Array.from(new Set(DEMO_STEPS.map(s => s.section)));

  // Group steps by section
  const stepsBySection = sections.reduce((acc, section) => {
    acc[section] = DEMO_STEPS.filter(s => s.section === section);
    return acc;
  }, {} as Record<string, DemoStep[]>);

  // Initialize all sections as expanded by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(sections));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleNext = useCallback(() => {
    setCurrentStepIndex(prev => {
      if (prev < DEMO_STEPS.length - 1) {
        return prev + 1;
      } else {
        setIsPlaying(false);
        return prev;
      }
    });
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentStepIndex(prev => prev > 0 ? prev - 1 : prev);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setIsPlaying(false);
  }, []);

  const handleComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    handleNext();
  };

  useEffect(() => {
    if (isPlaying && currentStep) {
      const timer = setTimeout(() => {
        handleNext();
      }, currentStep.duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentStepIndex, currentStep]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (currentStepIndex < DEMO_STEPS.length - 1) {
            handleNext();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentStepIndex > 0) {
            handlePrevious();
          }
          break;
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'r':
        case 'R':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleReset();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentStepIndex, isPlaying, handleNext, handlePrevious, handlePlayPause, handleReset]);

  const handleNavigateToPage = () => {
    if (currentStep) {
      router.push(currentStep.pageUrl);
    }
  };

  const handleJumpToStep = (index: number) => {
    setCurrentStepIndex(index);
    setIsPlaying(false);
  };

  const getSectionProgress = (section: string) => {
    const sectionSteps = stepsBySection[section];
    const completed = sectionSteps.filter(s => completedSteps.has(s.id)).length;
    return (completed / sectionSteps.length) * 100;
  };

  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = () => {
    const remainingSteps = DEMO_STEPS.slice(currentStepIndex);
    const totalSeconds = remainingSteps.reduce((sum, step) => sum + step.duration, 0);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  // Get next step preview
  const nextStep = currentStepIndex < DEMO_STEPS.length - 1 ? DEMO_STEPS[currentStepIndex + 1] : null;
  
  // Get current section info
  const currentSectionInfo = SECTION_INFO[currentStep.section];

  // Handle welcome dialog actions
  const handleStartGuidedTour = () => {
    setTourMode("guided");
    setShowWelcome(false);
    setIsPlaying(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("demo-welcome-dismissed", "true");
    }
  };

  const handleStartExplore = () => {
    setTourMode("explore");
    setShowWelcome(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("demo-welcome-dismissed", "true");
    }
  };

  const handleSkipWelcome = () => {
    setShowWelcome(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("demo-welcome-dismissed", "true");
    }
  };

  // Check for completion
  useEffect(() => {
    if (completedSteps.size === DEMO_STEPS.length && DEMO_STEPS.length > 0) {
      setShowCompletion(true);
      setIsPlaying(false);
    }
  }, [completedSteps.size]);

  if (!currentStep) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>No demo steps available. Please check configuration.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalEstimatedTime = Math.floor(DEMO_STEPS.reduce((sum, step) => sum + step.duration, 0) / 60);

  return (
    <>
      {/* Completion Celebration */}
      <Dialog open={showCompletion} onOpenChange={setShowCompletion}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Congratulations! 🎉</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              You've completed all <strong>52 steps</strong> across <strong>18 categories</strong>!
              <br />
              You now have a complete understanding of the Holdwall POS platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCompletion(false)} className="w-full sm:w-auto">
              Close
            </Button>
            <Button onClick={() => {
              setShowCompletion(false);
              handleReset();
            }} className="w-full sm:w-auto">
              Start Over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Welcome Dialog */}
      <Dialog open={showWelcome} onOpenChange={(open) => {
        setShowWelcome(open);
        if (!open && typeof window !== "undefined") {
          localStorage.setItem("demo-welcome-dismissed", "true");
        }
      }}>
        <DialogContent className="max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl">Welcome to Holdwall POS Demo</DialogTitle>
            </div>
            <DialogDescription className="text-base pt-2">
              Experience the complete platform with <strong>52 comprehensive steps</strong> organized into <strong>18 categories</strong>. 
              Choose how you'd like to explore:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Guided Tour Option */}
              <Card className="border-2 border-primary/20 hover:border-primary transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    onClick={handleStartGuidedTour}>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Guided Tour</CardTitle>
                  </div>
                  <CardDescription>
                    Auto-play through all steps with automatic progression. Perfect for a complete overview.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>~{totalEstimatedTime} minutes total</span>
                  </div>
                </CardContent>
              </Card>

              {/* Explore Option */}
              <Card className="border-2 hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    onClick={handleStartExplore}>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">Explore on Your Own</CardTitle>
                  </div>
                  <CardDescription>
                    Navigate at your own pace. Jump to any category or step. Perfect for focused learning.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    <span>Jump to any section</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Complete Coverage:</strong> All 52 steps ensure nothing is missed. You can always switch between modes, 
                skip steps, or jump to specific sections using the sidebar.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleSkipWelcome} className="w-full sm:w-auto">
              Skip Introduction
            </Button>
            <Button onClick={handleStartExplore} className="w-full sm:w-auto">
              Start Exploring
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
      {/* Header with Controls and Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">Interactive Platform Demo</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Complete walkthrough of all 52 steps across 18 categories. 
                    Use auto-play for guided tour or explore at your own pace.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>~{getEstimatedTimeRemaining()} remaining</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{completedSteps.size} completed</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset progress and start from beginning</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant={isPlaying ? "secondary" : "default"}
            size="sm"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Auto-Play
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Enhanced Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="font-medium">
                  Step {currentStepIndex + 1} of {DEMO_STEPS.length}
                </span>
                <Badge variant="outline" className="text-xs">
                  {currentStep.section}
                </Badge>
                {currentSectionInfo && (
                  <span className="text-lg">{currentSectionInfo.icon}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {Math.round(progress)}% Complete
                </span>
              </div>
            </div>
            <Progress value={progress} className="h-3" />
            {currentSectionInfo && (
              <p className="text-xs text-muted-foreground">
                {currentSectionInfo.description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Current Step - Matching platform card style */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next Step Preview */}
          {nextStep && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <ArrowRight className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm">
                <strong>Next:</strong> {nextStep.title} ({nextStep.section})
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-2 border-primary shadow-lg transition-all duration-200 hover:shadow-xl">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{currentStep.section}</Badge>
                    <Badge variant="secondary">Step {currentStep.order}</Badge>
                  </div>
                  <CardTitle className="text-2xl mb-2">{currentStep.title}</CardTitle>
                  <CardDescription className="text-base">
                    {currentStep.description}
                  </CardDescription>
                </div>
                {completedSteps.has(currentStep.id) && (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Page Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium mb-1">Target Page:</p>
                    <p className="text-sm text-muted-foreground">{currentStep.page}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNavigateToPage}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Navigate
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="font-semibold mb-3">Actions to Perform:</h3>
                <ul className="space-y-2">
                  {currentStep.actions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Circle className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Expected Results */}
              <div>
                <h3 className="font-semibold mb-3">Expected Results:</h3>
                <ul className="space-y-2">
                  {currentStep.expectedResults.map((result, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-1 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{result}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Duration and Tips */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Estimated duration: {currentStep.duration} seconds</span>
                  {isPlaying && (
                    <>
                      <span>•</span>
                      <span className="text-primary font-medium">Auto-advancing in {currentStep.duration}s</span>
                    </>
                  )}
                </div>
                {currentSectionInfo && currentSectionInfo.importance === "essential" && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs">
                      <strong>Essential Step:</strong> This is a core feature that's important to understand.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              {/* Keyboard Shortcuts Hint */}
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <strong>Keyboard shortcuts:</strong> ← Previous | → Next | Space Play/Pause | Ctrl+R Reset
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStepIndex === 0}
                >
                  Previous
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleComplete(currentStep.id)}
                  >
                    Mark Complete
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={currentStepIndex === DEMO_STEPS.length - 1}
                  >
                    Next Step
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Navigation & Progress */}
        <div className="space-y-6">
          {/* Section Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Sections Progress
              </CardTitle>
              <CardDescription className="text-xs">
                Track your progress across all categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.map((section) => {
                const sectionProgress = getSectionProgress(section);
                const sectionSteps = stepsBySection[section];
                const isCurrent = currentStep.section === section;
                const sectionInfo = SECTION_INFO[section];
                const completedCount = sectionSteps.filter(s => completedSteps.has(s.id)).length;
                const isComplete = completedCount === sectionSteps.length;
                
                return (
                  <div
                    key={section}
                    className={`p-3 rounded-lg border transition-all ${
                      isCurrent 
                        ? "border-primary bg-primary/5 shadow-sm" 
                        : isComplete
                        ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {sectionInfo && <span className="text-base">{sectionInfo.icon}</span>}
                          <span className="text-sm font-medium truncate">{section}</span>
                          {isComplete && (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        {sectionInfo && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {sectionInfo.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium">
                          {completedCount}/{sectionSteps.length}
                        </span>
                        {sectionInfo && (
                          <span className="text-xs text-muted-foreground">
                            ~{Math.floor(sectionInfo.estimatedTime / 60)}m
                          </span>
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={sectionProgress} 
                      className={`h-1.5 ${isComplete ? "bg-green-200" : ""}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Step Navigation - Click to jump to any step with collapsible categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                All Steps by Category
              </CardTitle>
              <CardDescription className="text-sm">
                <span className="font-medium">52 steps</span> organized into <span className="font-medium">18 categories</span>
                <br />
                Click categories to expand/collapse • Click steps to jump
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {sections.map((section) => {
                  const sectionSteps = stepsBySection[section];
                  const isExpanded = expandedSections.has(section);
                  const isCurrentSection = currentStep.section === section;
                  const completedCount = sectionSteps.filter(s => completedSteps.has(s.id)).length;
                  
                  return (
                    <div key={section} className="space-y-1">
                      <button
                        onClick={() => toggleSection(section)}
                        className={`w-full flex items-center justify-between px-2 py-2 rounded text-sm font-semibold transition-all duration-200 ${
                          isCurrentSection
                            ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                            : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="truncate text-xs uppercase tracking-wide">
                            {section}
                          </span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {completedCount}/{sectionSteps.length}
                          </Badge>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="ml-4 space-y-0.5 border-l-2 border-muted pl-2">
                          {sectionSteps.map((step) => {
                            const stepIndex = DEMO_STEPS.findIndex(s => s.id === step.id);
                            const isCurrent = stepIndex === currentStepIndex;
                            const isCompleted = completedSteps.has(step.id);
                            return (
                          <button
                            key={step.id}
                            onClick={() => handleJumpToStep(stepIndex)}
                            className={`w-full text-left p-2 rounded text-sm transition-all duration-200 ${
                              isCurrent
                                ? "bg-primary text-primary-foreground font-medium shadow-sm"
                                : isCompleted
                                ? "bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 hover:shadow-sm"
                                : "hover:bg-muted hover:shadow-sm"
                            }`}
                          >
                                <div className="flex items-center gap-2">
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Circle className={`h-4 w-4 flex-shrink-0 ${isCurrent ? "text-primary-foreground" : "text-muted-foreground"}`} />
                                  )}
                                  <span className="truncate">
                                    {step.order}. {step.title}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </>
  );
}
