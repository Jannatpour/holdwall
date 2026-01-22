"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calendar,
  DollarSign,
  Shield,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

interface MonthlyReport {
  period: {
    start: string;
    end: string;
    days: number;
  };
  executiveSummary: {
    overallRiskScore: number;
    riskTrend: "improving" | "stable" | "worsening";
    keyAchievements: string[];
    criticalIssues: string[];
  };
  outbreaksPrevented: {
    count: number;
    estimatedImpact: string;
    topPreventedNarratives: Array<{
      category: string;
      probability: number;
      preventedAt: string;
    }>;
  };
  timeToResolution: {
    averageDays: number;
    improvement: number;
    breakdown: Array<{
      category: string;
      averageDays: number;
      count: number;
    }>;
  };
  aiAnswerImpact: {
    citationCaptureRate: number;
    improvement: number;
    authoritativeArtifacts: number;
    aiSummaryShifts: number;
  };
  supportCostReduction: {
    ticketDeflection: number;
    estimatedSavings: string;
    supportVolumeChange: number;
  };
  legalExposure: {
    regulatoryInquiries: number;
    legalApprovalsProcessed: number;
    auditReadinessScore: number;
  };
  narrativeCategories: Array<{
    category: string;
    clusterCount: number;
    averageDecisiveness: number;
    trend: "up" | "down" | "stable";
  }>;
  recommendations: string[];
}

export function FinancialServicesMonthlyReportViewer() {
  const [startDate, setStartDate] = React.useState(
    format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = React.useState(false);
  const [report, setReport] = React.useState<MonthlyReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      const response = await fetch(`/api/financial-services/monthly-report?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate monthly report");
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Monthly Impact & Risk Report
          </CardTitle>
          <CardDescription>
            Generate executive-ready reports showing outbreaks prevented, time-to-resolution
            improvements, and cost reduction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report-start-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-end-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                End Date
              </Label>
              <Input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Monthly Report
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {report && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Executive Summary</TabsTrigger>
            <TabsTrigger value="outbreaks">Outbreaks Prevented</TabsTrigger>
            <TabsTrigger value="resolution">Time to Resolution</TabsTrigger>
            <TabsTrigger value="ai-impact">AI Answer Impact</TabsTrigger>
            <TabsTrigger value="cost">Support Cost Reduction</TabsTrigger>
            <TabsTrigger value="legal">Legal Exposure</TabsTrigger>
            <TabsTrigger value="categories">Narrative Categories</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
                <CardDescription>
                  Period: {format(new Date(report.period.start), "PP")} -{" "}
                  {format(new Date(report.period.end), "PP")} ({report.period.days} days)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Overall Risk Score</div>
                    <div className="text-3xl font-bold">{report.executiveSummary.overallRiskScore}</div>
                    <Progress
                      value={report.executiveSummary.overallRiskScore}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Risk Trend</div>
                    <Badge
                      variant={
                        report.executiveSummary.riskTrend === "improving"
                          ? "default"
                          : report.executiveSummary.riskTrend === "worsening"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-lg px-3 py-1"
                    >
                      {report.executiveSummary.riskTrend.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Key Achievements
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    {report.executiveSummary.keyAchievements.map((achievement, idx) => (
                      <li key={idx}>{achievement}</li>
                    ))}
                  </ul>
                </div>
                {report.executiveSummary.criticalIssues.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Critical Issues
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      {report.executiveSummary.criticalIssues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outbreaks">
            <Card>
              <CardHeader>
                <CardTitle>Outbreaks Prevented</CardTitle>
                <CardDescription>{report.outbreaksPrevented.estimatedImpact}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600">
                    {report.outbreaksPrevented.count}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Potential narrative outbreaks prevented
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Top Prevented Narratives</h4>
                  <div className="space-y-2">
                    {report.outbreaksPrevented.topPreventedNarratives.map((narrative, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{narrative.category}</div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(narrative.preventedAt), "PPp")}
                              </div>
                            </div>
                            <Badge variant="outline">
                              {(narrative.probability * 100).toFixed(0)}% probability
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolution">
            <Card>
              <CardHeader>
                <CardTitle>Time to Resolution</CardTitle>
                <CardDescription>
                  Average: {report.timeToResolution.averageDays.toFixed(1)} days ({" "}
                  {report.timeToResolution.improvement > 0 ? "+" : ""}
                  {report.timeToResolution.improvement}% improvement)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.timeToResolution.breakdown.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{item.category}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.averageDays.toFixed(1)} days ({item.count} cases)
                        </span>
                      </div>
                      <Progress value={(item.averageDays / 10) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-impact">
            <Card>
              <CardHeader>
                <CardTitle>AI Answer Impact</CardTitle>
                <CardDescription>
                  Citation capture rate: {report.aiAnswerImpact.citationCaptureRate.toFixed(1)}% (
                  {report.aiAnswerImpact.improvement > 0 ? "+" : ""}
                  {report.aiAnswerImpact.improvement}% improvement)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Citation Capture Rate</div>
                    <div className="text-2xl font-bold">
                      {report.aiAnswerImpact.citationCaptureRate.toFixed(1)}%
                    </div>
                    <Progress
                      value={report.aiAnswerImpact.citationCaptureRate}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Authoritative Artifacts</div>
                    <div className="text-2xl font-bold">
                      {report.aiAnswerImpact.authoritativeArtifacts}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost">
            <Card>
              <CardHeader>
                <CardTitle>Support Cost Reduction</CardTitle>
                <CardDescription>
                  Estimated savings: {report.supportCostReduction.estimatedSavings}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Ticket Deflection</div>
                    <div className="text-2xl font-bold">
                      {report.supportCostReduction.ticketDeflection}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Estimated Savings</div>
                    <div className="text-2xl font-bold text-green-600">
                      {report.supportCostReduction.estimatedSavings}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Volume Change</div>
                    <div className="text-2xl font-bold">
                      {report.supportCostReduction.supportVolumeChange > 0 ? "+" : ""}
                      {report.supportCostReduction.supportVolumeChange}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="legal">
            <Card>
              <CardHeader>
                <CardTitle>Legal Exposure</CardTitle>
                <CardDescription>Regulatory compliance and audit readiness</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Regulatory Inquiries</div>
                    <div className="text-2xl font-bold">
                      {report.legalExposure.regulatoryInquiries}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Legal Approvals Processed</div>
                    <div className="text-2xl font-bold">
                      {report.legalExposure.legalApprovalsProcessed}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Audit Readiness Score</div>
                    <div className="text-2xl font-bold">
                      {report.legalExposure.auditReadinessScore}%
                    </div>
                    <Progress
                      value={report.legalExposure.auditReadinessScore}
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Narrative Categories</CardTitle>
                <CardDescription>Analysis by financial narrative category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.narrativeCategories.map((category, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{category.category}</div>
                            <div className="text-sm text-muted-foreground">
                              {category.clusterCount} clusters,{" "}
                              {(category.averageDecisiveness * 100).toFixed(0)}% avg decisiveness
                            </div>
                          </div>
                          <Badge
                            variant={
                              category.trend === "up"
                                ? "destructive"
                                : category.trend === "down"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {category.trend === "up" ? (
                              <TrendingUp className="mr-1 h-3 w-3" />
                            ) : category.trend === "down" ? (
                              <TrendingDown className="mr-1 h-3 w-3" />
                            ) : (
                              <BarChart3 className="mr-1 h-3 w-3" />
                            )}
                            {category.trend}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations">
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Actionable recommendations based on report analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.recommendations.map((recommendation, idx) => (
                    <Alert key={idx}>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>{recommendation}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
