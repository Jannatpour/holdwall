"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  FileText,
  BarChart3,
  Users,
  Lock,
  ExternalLink,
  Building2,
  Target,
  Zap,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { FinancialServicesPerceptionBrief } from "@/components/financial-services/perception-brief";
import { FinancialServicesWorkflow } from "@/components/financial-services/workflow";
import { FinancialServicesNarrativeClusters } from "@/components/financial-services/narrative-clusters";
import { FinancialServicesPlaybookViewer } from "@/components/financial-services/playbook-viewer";
import { FinancialServicesExplanationsGenerator } from "@/components/financial-services/explanations-generator";
import { FinancialServicesAuditExport } from "@/components/financial-services/audit-export";
import { FinancialServicesPreemptionManager } from "@/components/financial-services/preemption-manager";
import { FinancialServicesMonthlyReportViewer } from "@/components/financial-services/monthly-report-viewer";
import { FinancialServicesConfigManager } from "@/components/financial-services/config-manager";

interface FinancialServicesOverview {
  outbreakProbability: number;
  activeClusters: number;
  pendingLegalApprovals: number;
  publishedArtifacts: number;
  governanceLevel: string;
  legalApprovalRequired: boolean;
  day1Completed: boolean;
  day7Completed: boolean;
  day30Completed: boolean;
}

export function FinancialServicesDashboardClient() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = React.useState(tabParam || "overview");
  const [overview, setOverview] = React.useState<FinancialServicesOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchOverview = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/financial-services/perception-brief");
        if (!response.ok) {
          throw new Error("Failed to fetch Financial Services overview");
        }
        const data = await response.json();
        if (!cancelled) {
          setOverview({
            outbreakProbability: data.outbreakProbability || 0,
            activeClusters: data.topClusters?.length || 0,
            pendingLegalApprovals: data.pendingLegalApprovals || 0,
            publishedArtifacts: data.artifacts?.length || 0,
            governanceLevel: data.governanceLevel || "financial",
            legalApprovalRequired: data.legalApprovalRequired || true,
            day1Completed: false, // Would come from config
            day7Completed: false,
            day30Completed: false,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 300000); // Refresh every 5 minutes

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground overflow-x-auto w-full">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="workflow">Workflow</TabsTrigger>
        <TabsTrigger value="narratives">Clusters</TabsTrigger>
        <TabsTrigger value="brief">Brief</TabsTrigger>
        <TabsTrigger value="explanations">Explanations</TabsTrigger>
        <TabsTrigger value="preemption">Preemption</TabsTrigger>
        <TabsTrigger value="monthly-report">Monthly Report</TabsTrigger>
        <TabsTrigger value="audit-export">Audit Export</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
        <TabsTrigger value="playbook">Playbook</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outbreak Probability</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overview?.outbreakProbability ?? 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current narrative risk
                  </p>
                  {overview && overview.outbreakProbability >= 60 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        High outbreak probability detected
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Clusters</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overview?.activeClusters ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Narrative clusters tracked
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overview?.pendingLegalApprovals ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Awaiting legal review
                  </p>
                  {overview && overview.pendingLegalApprovals > 0 && (
                    <Button variant="link" size="sm" className="mt-2 p-0 h-auto" asChild>
                      <Link href="/approvals">
                        Review now <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Published Artifacts</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overview?.publishedArtifacts ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Evidence-backed explanations
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Governance Status */}
        {overview && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Financial Services Operating Mode</CardTitle>
                  <CardDescription>
                    Governance and compliance settings
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  <Shield className="mr-2 h-4 w-4" />
                  {overview.governanceLevel.toUpperCase()} Governance
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Legal Approval Required</span>
                  <Badge variant={overview.legalApprovalRequired ? "default" : "secondary"}>
                    {overview.legalApprovalRequired ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Financial-Grade Governance Active</AlertTitle>
                  <AlertDescription>
                    Financial-grade governance is enabled with legal approval gates, higher evidence
                    thresholds, and conservative publishing defaults. All narrative responses require
                    legal review before publication.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for Financial Services operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setActiveTab("workflow")}>
                <Clock className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">View Workflow Progress</div>
                  <div className="text-xs text-muted-foreground">Day 1 → 7 → 30</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setActiveTab("brief")}>
                <FileText className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Generate Perception Brief</div>
                  <div className="text-xs text-muted-foreground">Executive summary</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/claims">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Review Claim Clusters</div>
                    <div className="text-xs text-muted-foreground">Narrative analysis</div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/approvals">
                  <Lock className="mr-2 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Legal Approvals</div>
                    <div className="text-xs text-muted-foreground">Review pending</div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/studio">
                  <FileText className="mr-2 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Create AAAL Artifact</div>
                    <div className="text-xs text-muted-foreground">Evidence-backed response</div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setActiveTab("audit-export")}>
                <Shield className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Export Audit Bundle</div>
                  <div className="text-xs text-muted-foreground">Regulatory compliance</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setActiveTab("explanations")}>
                <FileText className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Generate Explanations</div>
                  <div className="text-xs text-muted-foreground">Evidence-backed responses</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setActiveTab("preemption")}>
                <Zap className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Preemption Playbooks</div>
                  <div className="text-xs text-muted-foreground">Predictive management</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setActiveTab("monthly-report")}>
                <BarChart3 className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Monthly Report</div>
                  <div className="text-xs text-muted-foreground">Executive impact report</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setActiveTab("config")}>
                <Settings className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Configuration</div>
                  <div className="text-xs text-muted-foreground">Governance settings</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="workflow">
        <FinancialServicesWorkflow />
      </TabsContent>

      <TabsContent value="narratives">
        <FinancialServicesNarrativeClusters />
      </TabsContent>

      <TabsContent value="brief">
        <FinancialServicesPerceptionBrief />
      </TabsContent>

      <TabsContent value="explanations">
        <FinancialServicesExplanationsGenerator />
      </TabsContent>

      <TabsContent value="preemption">
        <FinancialServicesPreemptionManager />
      </TabsContent>

      <TabsContent value="monthly-report">
        <FinancialServicesMonthlyReportViewer />
      </TabsContent>

      <TabsContent value="audit-export">
        <FinancialServicesAuditExport />
      </TabsContent>

      <TabsContent value="config">
        <FinancialServicesConfigManager />
      </TabsContent>

      <TabsContent value="playbook">
        <FinancialServicesPlaybookViewer />
      </TabsContent>
    </Tabs>
  );
}
