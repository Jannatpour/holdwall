"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, Circle, ArrowRight, Play, Pause, RotateCcw, ExternalLink, ChevronRight, ChevronDown, HelpCircle, Clock, Sparkles, BookOpen, Zap, Target, Info, Trophy, Star, TrendingUp, ChevronLeft, SkipForward, CheckCircle
} from "lucide-react";
import {
  AuthOnboardingIcon,
  OverviewAnalyticsIcon,
  DataIngestionIcon,
  EvidenceVaultIcon,
  ClaimExtractionIcon,
  BeliefGraphIcon,
  NarrativeForecastingIcon,
  AAALIcon,
  GovernanceIcon,
  PublishingIcon,
  POSComponentsIcon,
  TrustAssetsIcon,
  PlaybooksIcon,
  AIAnswerMonitorIcon,
  FinancialServicesIcon
} from "@/components/demo-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

interface CategoryInfo {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  estimatedTime: number;
  importance: "essential" | "important" | "optional";
  order: number;
}

// Consolidated to 15 categories by merging related sections
const CATEGORIES: CategoryInfo[] = [
  {
    name: "Authentication & Onboarding",
    description: "Get started with account creation, SKU selection, and initial setup",
    icon: AuthOnboardingIcon,
    estimatedTime: 570,
    importance: "essential",
    order: 1
  },
  {
    name: "Overview & Analytics",
    description: "Understand your narrative health, key metrics, and usage analytics",
    icon: OverviewAnalyticsIcon,
    estimatedTime: 300,
    importance: "essential",
    order: 2
  },
  {
    name: "Data Ingestion & Integrations",
    description: "Ingest signals, connect data sources, and manage integrations",
    icon: DataIngestionIcon,
    estimatedTime: 690,
    importance: "essential",
    order: 3
  },
  {
    name: "Evidence Vault & Provenance",
    description: "Manage evidence with full provenance and chain of custody",
    icon: EvidenceVaultIcon,
    estimatedTime: 390,
    importance: "essential",
    order: 4
  },
  {
    name: "Claim Extraction & Clustering",
    description: "Extract and cluster claims from signals for analysis",
    icon: ClaimExtractionIcon,
    estimatedTime: 300,
    importance: "essential",
    order: 5
  },
  {
    name: "Belief Graph Engineering",
    description: "Explore narrative connections and neutralize weak nodes",
    icon: BeliefGraphIcon,
    estimatedTime: 330,
    importance: "important",
    order: 6
  },
  {
    name: "Narrative Outbreak Forecasting",
    description: "Forecast narrative outbreaks using advanced models",
    icon: NarrativeForecastingIcon,
    estimatedTime: 330,
    importance: "important",
    order: 7
  },
  {
    name: "AI Answer Authority Layer (AAAL)",
    description: "Create AI-citable artifacts and rebuttals",
    icon: AAALIcon,
    estimatedTime: 390,
    importance: "essential",
    order: 8
  },
  {
    name: "Governance & Approvals",
    description: "Manage approvals, audits, and compliance workflows",
    icon: GovernanceIcon,
    estimatedTime: 300,
    importance: "important",
    order: 9
  },
  {
    name: "Publishing & Distribution (PADL)",
    description: "Publish artifacts to multiple channels with structured data",
    icon: PublishingIcon,
    estimatedTime: 210,
    importance: "essential",
    order: 10
  },
  {
    name: "POS Components",
    description: "Explore all Perception Operating System components",
    icon: POSComponentsIcon,
    estimatedTime: 450,
    importance: "important",
    order: 11
  },
  {
    name: "Trust Assets & Funnel Map",
    description: "Manage trust assets, identify gaps, and visualize decision funnels",
    icon: TrustAssetsIcon,
    estimatedTime: 570,
    importance: "important",
    order: 12
  },
  {
    name: "Playbooks",
    description: "Create and execute automated response playbooks",
    icon: PlaybooksIcon,
    estimatedTime: 390,
    importance: "important",
    order: 13
  },
  {
    name: "AI Answer Monitor",
    description: "Monitor how AI systems cite your content",
    icon: AIAnswerMonitorIcon,
    estimatedTime: 300,
    importance: "important",
    order: 14
  },
  {
    name: "Financial Services",
    description: "Financial services-specific features and workflows",
    icon: FinancialServicesIcon,
    estimatedTime: 360,
    importance: "optional",
    order: 15
  }
];

// Map old section names to new category names
const SECTION_TO_CATEGORY: Record<string, string> = {
  "Authentication & Onboarding": "Authentication & Onboarding",
  "Overview & Dashboard": "Overview & Analytics",
  "Metering": "Overview & Analytics",
  "Signal Ingestion & Processing": "Data Ingestion & Integrations",
  "Integrations & Connectors": "Data Ingestion & Integrations",
  "Evidence Vault & Provenance": "Evidence Vault & Provenance",
  "Claim Extraction & Clustering": "Claim Extraction & Clustering",
  "Belief Graph Engineering": "Belief Graph Engineering",
  "Narrative Outbreak Forecasting": "Narrative Outbreak Forecasting",
  "AI Answer Authority Layer (AAAL)": "AI Answer Authority Layer (AAAL)",
  "Governance & Approvals": "Governance & Approvals",
  "Publishing & Distribution (PADL)": "Publishing & Distribution (PADL)",
  "POS Components": "POS Components",
  "Trust Assets": "Trust Assets & Funnel Map",
  "Funnel Map": "Trust Assets & Funnel Map",
  "Playbooks": "Playbooks",
  "AI Answer Monitor": "AI Answer Monitor",
  "Financial Services": "Financial Services"
};

// Import all demo steps - keeping the same structure
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

  // ========== CATEGORY 2: OVERVIEW & ANALYTICS ==========
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
    order: 8
  },

  // ========== CATEGORY 3: DATA INGESTION & INTEGRATIONS ==========
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
    order: 9
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
    order: 10
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
    order: 11
  },
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
    order: 12
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
    order: 13
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
    order: 14
  },

  // ========== CATEGORY 4: EVIDENCE VAULT & PROVENANCE ==========
  {
    id: "evidence-overview",
    section: "Evidence Vault & Provenance",
    title: "Explore Evidence Vault",
    description: "View all evidence items with provenance",
    page: "Evidence Page",
    pageUrl: "/evidence",
    actions: [
      "Navigate to Evidence page",
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
    order: 15
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
    order: 16
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
    order: 17
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
    order: 18
  },

  // ========== CATEGORY 5: CLAIM EXTRACTION & CLUSTERING ==========
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
    order: 19
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
    order: 20
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
    order: 21
  },

  // ========== CATEGORY 6: BELIEF GRAPH ENGINEERING ==========
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
    order: 22
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
    order: 23
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
    order: 24
  },

  // ========== CATEGORY 7: NARRATIVE OUTBREAK FORECASTING ==========
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
    order: 25
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
    order: 26
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
    order: 27
  },

  // ========== CATEGORY 8: AI ANSWER AUTHORITY LAYER (AAAL) ==========
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
    order: 28
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
    order: 29
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
    order: 30
  },

  // ========== CATEGORY 9: GOVERNANCE & APPROVALS ==========
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
    order: 31
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
    order: 32
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
    order: 33
  },

  // ========== CATEGORY 10: PUBLISHING & DISTRIBUTION (PADL) ==========
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
    order: 34
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
    order: 35
  },

  // ========== CATEGORY 11: POS COMPONENTS ==========
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
    order: 36
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
    order: 37
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
    order: 38
  },

  // ========== CATEGORY 12: TRUST ASSETS & FUNNEL MAP ==========
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
    order: 39
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
    order: 40
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
    order: 41
  },
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
    order: 42
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
    order: 43
  },

  // ========== CATEGORY 13: PLAYBOOKS ==========
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
    order: 44
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
    order: 45
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
    order: 46
  },

  // ========== CATEGORY 14: AI ANSWER MONITOR ==========
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
    order: 47
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
    order: 48
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
    order: 49
  },

  // ========== CATEGORY 15: FINANCIAL SERVICES ==========
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
    order: 50
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
    order: 51
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
    order: 52
  }
];

// Helper functions
const getCategoryForStep = (step: DemoStep): string => {
  return SECTION_TO_CATEGORY[step.section] || step.section;
};

const getStepsForCategory = (categoryName: string): DemoStep[] => {
  return DEMO_STEPS.filter(step => getCategoryForStep(step) === categoryName);
};

const getCategoryInfo = (categoryName: string): CategoryInfo | undefined => {
  return CATEGORIES.find(cat => cat.name === categoryName);
};

// Progress Ring Component
const ProgressRing = ({ progress, size = 60, strokeWidth = 6, className }: { progress: number; size?: number; strokeWidth?: number; className?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-foreground">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export function DemoWalkthroughClient() {
  const router = useRouter();
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedCategories, setCompletedCategories] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("demo-welcome-dismissed");
    }
    return true;
  });
  const [showCompletion, setShowCompletion] = useState(false);
  const [showCategoryComplete, setShowCategoryComplete] = useState(false);
  const [justCompletedCategory, setJustCompletedCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  const currentCategory = CATEGORIES[currentCategoryIndex] || CATEGORIES[0];
  const categorySteps = getStepsForCategory(currentCategory.name);
  const currentStep = categorySteps[currentStepIndex] || categorySteps[0];
  
  const categoryProgress = ((currentCategoryIndex + 1) / CATEGORIES.length) * 100;
  const stepProgressInCategory = categorySteps.length > 0 
    ? ((currentStepIndex + 1) / categorySteps.length) * 100 
    : 0;

  const isCategoryComplete = (categoryName: string): boolean => {
    const steps = getStepsForCategory(categoryName);
    return steps.every(step => completedSteps.has(step.id));
  };

  const getCategoryProgress = (categoryName: string): number => {
    const steps = getStepsForCategory(categoryName);
    if (steps.length === 0) return 0;
    const completed = steps.filter(s => completedSteps.has(s.id)).length;
    return (completed / steps.length) * 100;
  };

  const completedCategoriesCount = CATEGORIES.filter(cat => isCategoryComplete(cat.name)).length;
  const overallProgress = (completedCategoriesCount / CATEGORIES.length) * 100;

  const handleNextCategory = useCallback(() => {
    if (currentCategoryIndex < CATEGORIES.length - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
      setCurrentStepIndex(0);
      setIsPlaying(false);
    }
  }, [currentCategoryIndex]);

  const handlePreviousCategory = useCallback(() => {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(prev => prev - 1);
      const prevCategory = CATEGORIES[currentCategoryIndex - 1];
      const prevSteps = getStepsForCategory(prevCategory.name);
      setCurrentStepIndex(prevSteps.length - 1);
      setIsPlaying(false);
    }
  }, [currentCategoryIndex]);

  const handleNextStep = useCallback(() => {
    if (currentStepIndex < categorySteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleNextCategory();
    }
  }, [currentStepIndex, categorySteps.length, handleNextCategory]);

  const handlePreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    } else {
      handlePreviousCategory();
    }
  }, [currentStepIndex, handlePreviousCategory]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentCategoryIndex(0);
    setCurrentStepIndex(0);
    setCompletedCategories(new Set());
    setCompletedSteps(new Set());
    setIsPlaying(false);
  }, []);

  const handleCompleteStep = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    
    const categoryName = getCategoryForStep(DEMO_STEPS.find(s => s.id === stepId)!);
    const wasComplete = isCategoryComplete(categoryName);
    
    if (!wasComplete && isCategoryComplete(categoryName)) {
      setCompletedCategories(prev => new Set([...prev, categoryName]));
      setJustCompletedCategory(categoryName);
      setShowCategoryComplete(true);
      setTimeout(() => {
        setShowCategoryComplete(false);
        setJustCompletedCategory(null);
      }, 3000);
    }
    
    handleNextStep();
  };

  const handleSkipCategory = () => {
    const remainingSteps = categorySteps.filter(s => !completedSteps.has(s.id));
    remainingSteps.forEach(step => {
      setCompletedSteps(prev => new Set([...prev, step.id]));
    });
    if (remainingSteps.length > 0) {
      const categoryName = currentCategory.name;
      setCompletedCategories(prev => new Set([...prev, categoryName]));
    }
    handleNextCategory();
  };

  const handleMarkAllComplete = () => {
    categorySteps.forEach(step => {
      if (!completedSteps.has(step.id)) {
        setCompletedSteps(prev => new Set([...prev, step.id]));
      }
    });
    const categoryName = currentCategory.name;
    setCompletedCategories(prev => new Set([...prev, categoryName]));
  };

  useEffect(() => {
    if (isPlaying && currentStep) {
      const timer = setTimeout(() => {
        handleNextStep();
      }, currentStep.duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentStepIndex, currentCategoryIndex, currentStep, handleNextStep]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          handleNextStep();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousStep();
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
  }, [handleNextStep, handlePreviousStep, handlePlayPause, handleReset]);

  const handleNavigateToPage = () => {
    if (currentStep) {
      router.push(currentStep.pageUrl);
    }
  };

  const handleJumpToCategory = (categoryIndex: number) => {
    setCurrentCategoryIndex(categoryIndex);
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const handleJumpToStep = (stepIndex: number) => {
    setCurrentStepIndex(stepIndex);
    setIsPlaying(false);
  };

  const getEstimatedTimeRemaining = () => {
    let totalSeconds = 0;
    for (let i = currentCategoryIndex; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const steps = getStepsForCategory(cat.name);
      if (i === currentCategoryIndex) {
        const remainingSteps = steps.slice(currentStepIndex);
        totalSeconds += remainingSteps.reduce((sum, step) => sum + step.duration, 0);
      } else {
        totalSeconds += steps.reduce((sum, step) => sum + step.duration, 0);
      }
    }
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    if (completedCategories.size === CATEGORIES.length && CATEGORIES.length > 0) {
      setShowCompletion(true);
      setIsPlaying(false);
    }
  }, [completedCategories.size]);

  const handleStartGuidedTour = () => {
    setShowWelcome(false);
    setIsPlaying(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("demo-welcome-dismissed", "true");
    }
  };

  const handleStartExplore = () => {
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

  if (!currentStep || !currentCategory) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>No demo content available. Please check configuration.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalEstimatedTime = Math.floor(
    CATEGORIES.reduce((sum, cat) => {
      const steps = getStepsForCategory(cat.name);
      return sum + steps.reduce((s, step) => s + step.duration, 0);
    }, 0) / 60
  );

  const nextCategory = currentCategoryIndex < CATEGORIES.length - 1 
    ? CATEGORIES[currentCategoryIndex + 1] 
    : null;
  const nextStep = currentStepIndex < categorySteps.length - 1 
    ? categorySteps[currentStepIndex + 1] 
    : null;

  const categoryProgressValue = getCategoryProgress(currentCategory.name);
  const completedInCategory = categorySteps.filter(s => completedSteps.has(s.id)).length;

  return (
    <>
      {/* Category Completion Celebration */}
      <Dialog open={showCategoryComplete} onOpenChange={setShowCategoryComplete}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full animate-pulse">
                <Trophy className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Category Complete! 🎉</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              You've completed <strong>{justCompletedCategory}</strong>!
              <br />
              Great progress! Moving to the next category...
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Final Completion Celebration */}
      <Dialog open={showCompletion} onOpenChange={setShowCompletion}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-primary/20 to-purple-100 dark:from-primary/30 dark:to-purple-900/30 rounded-full">
                <Star className="h-12 w-12 text-primary fill-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Congratulations! 🎊</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              You've completed all <strong>15 categories</strong>!
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
        <DialogContent className="max-w-3xl" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-primary/20 to-purple-100 dark:from-primary/30 dark:to-purple-900/30 rounded-xl">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Welcome to Holdwall POS Demo
              </DialogTitle>
            </div>
            <DialogDescription className="text-base pt-2">
              Experience the complete platform with <strong className="text-foreground">15 comprehensive categories</strong>. 
              Navigate through categories and complete all steps in each category before moving to the next.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-2 border-primary/20 hover:border-primary transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br from-primary/5 to-transparent"
                    onClick={handleStartGuidedTour}>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Play className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Guided Tour</CardTitle>
                  </div>
                  <CardDescription>
                    Auto-play through all categories with automatic progression. Perfect for a complete overview.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>~{totalEstimatedTime} minutes total</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 dark:to-transparent"
                    onClick={handleStartExplore}>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-lg">Explore on Your Own</CardTitle>
                  </div>
                  <CardDescription>
                    Navigate at your own pace. Jump to any category. Perfect for focused learning.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    <span>Jump to any category</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Alert className="border-primary/20 bg-gradient-to-r from-primary/5 to-purple-50/50 dark:from-primary/10 dark:to-purple-950/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>Category-Based Navigation:</strong> Complete all steps in a category to unlock the next one. 
                You can always jump to any category or step using the sidebar.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleSkipWelcome} className="w-full sm:w-auto">
              Skip Introduction
            </Button>
            <Button onClick={handleStartExplore} className="w-full sm:w-auto bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
              Start Exploring
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Enhanced Header with Beautiful Stats */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-purple-50/30 dark:to-purple-950/10 shadow-xl">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-primary/20 to-purple-100 dark:from-primary/30 dark:to-purple-900/30 rounded-xl">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                      Interactive Platform Demo
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {DEMO_STEPS.length} comprehensive steps across {CATEGORIES.length} categories • Master the platform step by step
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg border border-primary/10 shadow-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">~{getEstimatedTimeRemaining()} remaining</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-sm">{completedCategoriesCount}/{CATEGORIES.length} categories</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-sm">{Math.round(overallProgress)}% complete</span>
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
                        className="gap-2 hover:bg-destructive/10 hover:border-destructive/20"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset all progress</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant={isPlaying ? "secondary" : "default"}
                  size="sm"
                  onClick={handlePlayPause}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Auto-Play
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Beautiful Category Progress Card */}
        <Card className="border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <ProgressRing progress={categoryProgressValue} size={80} strokeWidth={8} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {React.createElement(currentCategory.icon, { className: "w-8 h-8 text-primary" })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                        Category {currentCategoryIndex + 1} of {CATEGORIES.length}
                      </Badge>
                      {isCategoryComplete(currentCategory.name) && (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold">{currentCategory.name}</h3>
                    <p className="text-sm text-muted-foreground">{currentCategory.description}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    {Math.round(categoryProgressValue)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Category Progress</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Step {currentStepIndex + 1} of {categorySteps.length} in this category
                  </span>
                  <span className="font-semibold">
                    {completedInCategory}/{categorySteps.length} steps completed
                  </span>
                </div>
                <Progress 
                  value={categoryProgressValue} 
                  className="h-3 bg-muted/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Category Grid */}
        <Card className="border-2 border-primary/10 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BookOpen className="h-6 w-6 text-primary" />
                  Browse Categories
                </CardTitle>
                <CardDescription className="mt-2">
                  Click any category to jump to it. {CATEGORIES.length} categories covering the entire platform.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm">
                {completedCategoriesCount} completed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {CATEGORIES.map((category, index) => {
                const progress = getCategoryProgress(category.name);
                const isCurrent = index === currentCategoryIndex;
                const isComplete = isCategoryComplete(category.name);
                const completedCount = getStepsForCategory(category.name).filter(s => completedSteps.has(s.id)).length;
                const totalSteps = getStepsForCategory(category.name).length;
                
                return (
                  <button
                    key={category.name}
                    onClick={() => handleJumpToCategory(index)}
                    className={cn(
                      "group relative p-5 rounded-xl border-2 transition-all duration-300 text-left",
                      "hover:shadow-xl hover:scale-105 active:scale-95",
                      isCurrent
                        ? "border-primary bg-gradient-to-br from-primary/20 to-purple-100/50 dark:from-primary/30 dark:to-purple-900/30 shadow-lg scale-105"
                        : isComplete
                        ? "border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 hover:border-green-400"
                        : "border-border bg-card hover:border-primary/50 hover:bg-gradient-to-br hover:from-primary/5 hover:to-purple-50/30 dark:hover:to-purple-950/10"
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute -top-2 -right-2">
                        <div className="h-4 w-4 bg-primary rounded-full animate-ping" />
                        <div className="absolute inset-0 h-4 w-4 bg-primary rounded-full" />
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {React.createElement(category.icon, { className: "w-8 h-8 text-primary flex-shrink-0" })}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {category.name}
                          </h3>
                        </div>
                      </div>
                      {isComplete && (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">
                      {category.description}
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          {completedCount}/{totalSteps} steps
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ~{Math.floor(category.estimatedTime / 60)}m
                        </span>
                      </div>
                      <Progress 
                        value={progress} 
                        className={cn(
                          "h-2",
                          isComplete 
                            ? "bg-green-200 dark:bg-green-900" 
                            : isCurrent
                            ? "bg-primary/30"
                            : "bg-muted"
                        )}
                      />
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant={
                            category.importance === "essential" 
                              ? "default" 
                              : category.importance === "important"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {category.importance}
                        </Badge>
                        {progress > 0 && !isComplete && (
                          <span className="text-xs font-semibold text-primary">
                            {Math.round(progress)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Enhanced Step Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Next Category/Step Preview */}
            {nextCategory && !nextStep && (
              <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 shadow-sm">
                <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-sm">
                  <strong className="text-blue-900 dark:text-blue-100">Next Category:</strong>{" "}
                  <span className="font-medium">{nextCategory.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs flex items-center gap-1">
                    {React.createElement(nextCategory.icon, { className: "w-3 h-3" })}
                  </Badge>
                </AlertDescription>
              </Alert>
            )}
            {nextStep && (
              <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 shadow-sm">
                <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-sm">
                  <strong className="text-blue-900 dark:text-blue-100">Next Step:</strong>{" "}
                  <span className="font-medium">{nextStep.title}</span>
                </AlertDescription>
              </Alert>
            )}

            {/* Beautiful Current Step Card */}
            <Card className="border-2 border-primary/30 shadow-2xl transition-all duration-300 hover:shadow-3xl bg-gradient-to-br from-card via-card to-primary/5">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="p-3 bg-gradient-to-br from-primary/20 to-purple-100 dark:from-primary/30 dark:to-purple-900/30 rounded-xl">
                        {React.createElement(currentCategory.icon, { className: "w-8 h-8 text-primary" })}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-semibold px-3 py-1">
                          {currentCategory.name}
                        </Badge>
                        <Badge variant="secondary" className="font-semibold px-3 py-1">
                          Step {currentStepIndex + 1} of {categorySteps.length}
                        </Badge>
                        {completedSteps.has(currentStep.id) && (
                          <Badge className="bg-green-600 text-white px-3 py-1">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-3xl mb-3 font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                        {currentStep.title}
                      </CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        {currentStep.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enhanced Page Info */}
                <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 p-6 rounded-xl border border-border/50 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <ExternalLink className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">Target Page</p>
                      </div>
                      <p className="text-base font-medium text-foreground">{currentStep.page}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono bg-background/50 px-2 py-1 rounded inline-block">
                        {currentStep.pageUrl}
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleNavigateToPage}
                      className="gap-2 shadow-sm bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Navigate
                    </Button>
                  </div>
                </div>

                {/* Enhanced Actions Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold text-lg">Actions to Perform</h3>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 rounded-xl p-5 border border-blue-200/50 dark:border-blue-800/30 shadow-sm">
                    <ul className="space-y-3">
                      {currentStep.actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-3 group">
                          <div className="mt-0.5 flex-shrink-0">
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                              <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{idx + 1}</span>
                            </div>
                          </div>
                          <span className="text-sm leading-relaxed flex-1 pt-1 group-hover:text-foreground transition-colors">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Enhanced Expected Results Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900/30 dark:to-emerald-800/30 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-bold text-lg">Expected Results</h3>
                  </div>
                  <div className="bg-gradient-to-br from-green-50/80 to-emerald-100/50 dark:from-green-950/20 dark:to-emerald-900/10 rounded-xl p-5 border border-green-200/50 dark:border-green-800/30 shadow-sm">
                    <ul className="space-y-3">
                      {currentStep.expectedResults.map((result, idx) => (
                        <li key={idx} className="flex items-start gap-3 group">
                          <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="text-sm leading-relaxed flex-1 group-hover:text-foreground transition-colors">{result}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Enhanced Duration and Quick Actions */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-muted/60 to-muted/40 rounded-xl border border-border/50 shadow-sm">
                    <Clock className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">Estimated duration: </span>
                      <span className="text-sm font-bold text-primary">{currentStep.duration} seconds</span>
                      {isPlaying && (
                        <>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-sm font-semibold text-primary animate-pulse">
                            Auto-advancing in {currentStep.duration}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSkipCategory}
                            className="flex-1"
                          >
                            <SkipForward className="h-4 w-4 mr-2" />
                            Skip Category
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mark all steps in this category as complete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllComplete}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark All Complete
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mark all remaining steps in this category as complete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {currentCategory.importance === "essential" && (
                    <Alert className="border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 shadow-sm">
                      <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <AlertDescription className="text-sm">
                        <strong className="text-amber-900 dark:text-amber-100">Essential Category:</strong>{" "}
                        This category contains core features that are important to understand.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Enhanced Keyboard Shortcuts */}
                <div className="bg-gradient-to-r from-muted/40 to-muted/20 p-4 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="font-semibold">Keyboard shortcuts:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <kbd className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-mono shadow-sm">←</kbd>
                      <span>Previous</span>
                      <kbd className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-mono shadow-sm">→</kbd>
                      <span>Next</span>
                      <kbd className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-mono shadow-sm">Space</kbd>
                      <span>Play/Pause</span>
                      <kbd className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-mono shadow-sm">Ctrl+R</kbd>
                      <span>Reset</span>
                    </div>
                  </div>
                </div>

                {/* Enhanced Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handlePreviousStep}
                    disabled={currentCategoryIndex === 0 && currentStepIndex === 0}
                    className="gap-2"
                    size="lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCompleteStep(currentStep.id)}
                      className="gap-2"
                      size="lg"
                      disabled={completedSteps.has(currentStep.id)}
                    >
                      {completedSteps.has(currentStep.id) ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Completed
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Mark Complete
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      disabled={currentCategoryIndex === CATEGORIES.length - 1 && currentStepIndex === categorySteps.length - 1}
                      className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                      size="lg"
                    >
                      {nextStep ? "Next Step" : nextCategory ? "Next Category" : "Complete"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Category Steps List */}
            <Card className="border-2 border-primary/10 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Steps in Category
                </CardTitle>
                <CardDescription className="text-xs">
                  {categorySteps.length} steps • {completedInCategory} completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {categorySteps.map((step, index) => {
                    const isCurrent = index === currentStepIndex;
                    const isCompleted = completedSteps.has(step.id);
                    return (
                      <button
                        key={step.id}
                        onClick={() => handleJumpToStep(index)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all duration-200 group",
                          isCurrent
                            ? "bg-gradient-to-r from-primary to-purple-600 text-white border-primary shadow-lg scale-105"
                            : isCompleted
                            ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 hover:from-green-100 dark:hover:from-green-950/40 border-green-200 dark:border-green-800"
                            : "hover:bg-muted border-border hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <CheckCircle2 className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isCurrent ? "text-white" : "text-green-600 dark:text-green-400"
                            )} />
                          ) : (
                            <Circle className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isCurrent ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                            )} />
                          )}
                          <span className={cn(
                            "flex-1 text-sm font-medium truncate",
                            isCurrent && "text-white"
                          )}>
                            {index + 1}. {step.title}
                          </span>
                          {isCurrent && (
                            <ArrowRight className="h-3.5 w-3.5 text-white flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Categories List */}
            <Card className="border-2 border-primary/10 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  All Categories
                </CardTitle>
                <CardDescription className="text-xs">
                  {CATEGORIES.length} categories • {completedCategoriesCount} completed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {CATEGORIES.map((category, index) => {
                  const progress = getCategoryProgress(category.name);
                  const isCurrent = index === currentCategoryIndex;
                  const isComplete = isCategoryComplete(category.name);
                  const steps = getStepsForCategory(category.name);
                  const completedCount = steps.filter(s => completedSteps.has(s.id)).length;
                  
                  return (
                    <button
                      key={category.name}
                      onClick={() => handleJumpToCategory(index)}
                      className={cn(
                        "w-full p-3 rounded-lg border transition-all text-left group",
                        isCurrent 
                          ? "border-primary bg-gradient-to-r from-primary/20 to-purple-100/50 dark:from-primary/30 dark:to-purple-900/30 shadow-md scale-105" 
                          : isComplete
                          ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 hover:border-green-400"
                          : "border-border hover:bg-muted/50 hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {React.createElement(category.icon, { className: "w-5 h-5 text-primary flex-shrink-0" })}
                            <span className={cn(
                              "text-sm font-semibold truncate",
                              isCurrent && "text-primary"
                            )}>{category.name}</span>
                            {isComplete && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            )}
                            {isCurrent && !isComplete && (
                              <div className="h-2 w-2 bg-primary rounded-full animate-pulse flex-shrink-0" />
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold">
                            {completedCount}/{steps.length}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ~{Math.floor(category.estimatedTime / 60)}m
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={progress} 
                        className={cn(
                          "h-2",
                          isComplete ? "bg-green-200 dark:bg-green-900" : ""
                        )}
                      />
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
