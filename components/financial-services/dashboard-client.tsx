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
  RefreshCw,
  Activity,
  Sparkles,
  ArrowRight,
} from "@/components/demo-icons";
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
    <div className="space-y-6">
      {/* Strategic Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Financial Services Command Center
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Transform narrative risk into measurable, governable operational advantage
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              setError(null);
            }}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="inline-flex h-11 items-center justify-start rounded-lg bg-muted/50 p-1.5 text-muted-foreground overflow-x-auto w-full border">
        <TabsTrigger 
          value="overview" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Command Center
        </TabsTrigger>
        <TabsTrigger 
          value="workflow" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Workflow
        </TabsTrigger>
        <TabsTrigger 
          value="narratives" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Narratives
        </TabsTrigger>
        <TabsTrigger 
          value="brief" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Executive Brief
        </TabsTrigger>
        <TabsTrigger 
          value="explanations" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Explanations
        </TabsTrigger>
        <TabsTrigger 
          value="preemption" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Preemption
        </TabsTrigger>
        <TabsTrigger 
          value="monthly-report" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Impact Report
        </TabsTrigger>
        <TabsTrigger 
          value="audit-export" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Audit Export
        </TabsTrigger>
        <TabsTrigger 
          value="config" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Configuration
        </TabsTrigger>
        <TabsTrigger 
          value="playbook" 
          className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-4 py-2"
        >
          Playbook
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* Key Metrics with Enhanced Design */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="h-36 rounded-lg" />
            </>
          ) : (
            <>
              <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outbreak Probability</CardTitle>
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {overview?.outbreakProbability ?? 0}%
                  </div>
                  <Progress 
                    value={overview?.outbreakProbability ?? 0} 
                    className="h-2 mb-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Current narrative risk
                  </p>
                  {overview && overview.outbreakProbability >= 60 && (
                    <Alert variant="destructive" className="mt-3 border-destructive/50">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        High outbreak probability detected - Immediate action recommended
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Clusters</CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {overview?.activeClusters ?? 0}
                  </div>
                  <Progress 
                    value={Math.min((overview?.activeClusters ?? 0) * 10, 100)} 
                    className="h-2 mb-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Narrative clusters tracked
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2 h-auto p-0 text-xs" asChild>
                    <Link href="/claims">
                      View all <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <Lock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {overview?.pendingLegalApprovals ?? 0}
                  </div>
                  {overview && overview.pendingLegalApprovals > 0 && (
                    <Progress 
                      value={Math.min(overview.pendingLegalApprovals * 20, 100)} 
                      className="h-2 mb-2"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Awaiting legal review
                  </p>
                  {overview && overview.pendingLegalApprovals > 0 && (
                    <Button variant="default" size="sm" className="mt-2 w-full" asChild>
                      <Link href="/governance">
                        Review Now <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Published Artifacts</CardTitle>
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {overview?.publishedArtifacts ?? 0}
                  </div>
                  <Progress 
                    value={Math.min((overview?.publishedArtifacts ?? 0) * 5, 100)} 
                    className="h-2 mb-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Evidence-backed explanations
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2 h-auto p-0 text-xs" asChild>
                    <Link href="/studio">
                      Create new <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Strategic Governance Status */}
        {overview && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Shield className="h-5 w-5 text-primary" />
                    Financial-Grade Governance Framework
                  </CardTitle>
                  <CardDescription className="text-base">
                    Enterprise risk management with regulatory compliance and legal oversight
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm px-3 py-1.5">
                  <Shield className="mr-2 h-4 w-4" />
                  {overview.governanceLevel.toUpperCase()} Mode
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">Legal Approval Gates</span>
                    <span className="text-xs text-muted-foreground block">
                      Required for all narrative responses
                    </span>
                  </div>
                  <Badge variant={overview.legalApprovalRequired ? "default" : "secondary"} className="ml-4">
                    {overview.legalApprovalRequired ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">Evidence Threshold</span>
                    <span className="text-xs text-muted-foreground block">
                      Higher standards for financial services
                    </span>
                  </div>
                  <Badge variant="outline" className="ml-4">70% Minimum</Badge>
                </div>
              </div>
              <Alert className="border-primary/20 bg-primary/5">
                <Shield className="h-5 w-5 text-primary" />
                <AlertTitle className="text-base">Regulatory Compliance Active</AlertTitle>
                <AlertDescription className="text-sm leading-6">
                  Your organization operates under financial-grade governance with mandatory legal approval gates, 
                  elevated evidence thresholds, and conservative publishing defaults. Every narrative response 
                  undergoes legal review before publication, ensuring regulatory compliance and risk mitigation.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Strategic Quick Actions */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Zap className="h-5 w-5 text-primary" />
                  Strategic Operations Hub
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Accelerate your narrative governance workflow with one-click access to critical operations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                onClick={() => setActiveTab("workflow")}
              >
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors mr-3">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Workflow Progression</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Track Day 1 → 7 → 30 milestones</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                onClick={() => setActiveTab("brief")}
              >
                <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors mr-3">
                  <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Executive Perception Brief</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Daily strategic intelligence</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                asChild
              >
                <Link href="/claims">
                  <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors mr-3">
                    <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-base">Narrative Intelligence</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Analyze claim clusters</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                asChild
              >
                <Link href="/governance">
                  <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors mr-3">
                    <Lock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-base">Legal Review Queue</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {overview?.pendingLegalApprovals ?? 0} pending approvals
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                asChild
              >
                <Link href="/studio">
                  <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors mr-3">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-base">Create Authoritative Response</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Evidence-backed artifacts</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                onClick={() => setActiveTab("audit-export")}
              >
                <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors mr-3">
                  <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Regulatory Audit Export</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Compliance-ready bundles</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                onClick={() => setActiveTab("explanations")}
              >
                <div className="p-2 bg-teal-500/10 rounded-lg group-hover:bg-teal-500/20 transition-colors mr-3">
                  <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Generate Explanations</div>
                  <div className="text-xs text-muted-foreground mt-0.5">AI-powered responses</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                onClick={() => setActiveTab("preemption")}
              >
                <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors mr-3">
                  <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Predictive Preemption</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Stop outbreaks before they start</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                onClick={() => setActiveTab("monthly-report")}
              >
                <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors mr-3">
                  <BarChart3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Executive Impact Report</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Monthly ROI analysis</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-[1.02] group" 
                onClick={() => setActiveTab("config")}
              >
                <div className="p-2 bg-gray-500/10 rounded-lg group-hover:bg-gray-500/20 transition-colors mr-3">
                  <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Governance Configuration</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Customize operating mode</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
    </div>
  );
}
