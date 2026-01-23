"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Shield,
  Users,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface ExplanationResult {
  id: string;
  clusterId: string;
  publicExplanation: {
    title: string;
    summary: string;
    explanation: string;
    metrics: {
      issueCount: number;
      resolutionRate: number;
      averageResolutionTime: string;
    };
    policyReferences: string[];
    timeBoundUpdates: string[];
  };
  internalRiskBrief: {
    rootCause: string;
    exposureAssessment: {
      customerImpact: number;
      regulatoryRisk: "low" | "medium" | "high";
      financialExposure: string;
    };
    regulatoryImplications: string[];
    recommendedActions: string[];
  };
  supportPlaybooks: Array<{
    responseMacros: Array<{
      trigger: string;
      response: string;
    }>;
    deEscalationLanguage: string[];
    escalationCriteria: string[];
  }>;
  evidenceBundle: {
    evidenceIds: string[];
    claimIds: string[];
    approvalTrail: Array<{
      approver: string;
      decision: string;
      timestamp: Date;
    }>;
  };
  createdAt: string;
}

export function FinancialServicesExplanationsGenerator() {
  const [clusterId, setClusterId] = React.useState("");
  const [createArtifact, setCreateArtifact] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ExplanationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [availableClusters, setAvailableClusters] = React.useState<
    Array<{ id: string; primaryClaim: string; size: number }>
  >([]);

  React.useEffect(() => {
    const fetchClusters = async () => {
      try {
        const response = await fetch("/api/financial-services/perception-brief");
        if (response.ok) {
          const data = await response.json();
          setAvailableClusters(
            data.topClusters?.map((c: any) => ({
              id: c.id,
              primaryClaim: c.primaryClaim,
              size: c.size,
            })) || []
          );
        }
      } catch (err) {
        // Silently fail - clusters are optional
      }
    };
    fetchClusters();
  }, []);

  const handleGenerate = async () => {
    if (!clusterId.trim()) {
      setError("Please select or enter a cluster ID");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/financial-services/explanations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clusterId,
          createArtifact,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate explanation");
      }

      const data = await response.json();
      setResult(data.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            AI-Powered Explanation Generator
          </CardTitle>
          <CardDescription className="text-base">
            Transform narrative clusters into comprehensive evidence-backed explanations: public-facing responses, 
            internal risk briefs, support playbooks, and regulatory-ready audit bundles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cluster-select">Select Narrative Cluster</Label>
            {availableClusters.length > 0 ? (
              <Select value={clusterId} onValueChange={setClusterId}>
                <SelectTrigger id="cluster-select">
                  <SelectValue placeholder="Select a cluster..." />
                </SelectTrigger>
                <SelectContent>
                  {availableClusters.map((cluster) => (
                    <SelectItem key={cluster.id} value={cluster.id}>
                      {cluster.primaryClaim.substring(0, 80)}... ({cluster.size} claims)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="cluster-id"
                placeholder="Enter cluster ID"
                value={clusterId}
                onChange={(e) => setClusterId(e.target.value)}
              />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="create-artifact"
              checked={createArtifact}
              onChange={(e) => setCreateArtifact(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="create-artifact" className="text-sm">
              Automatically create AAAL artifact and route to legal approval
            </Label>
          </div>

          <Button onClick={handleGenerate} disabled={loading || !clusterId.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Explanation
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

      {result && (
        <Tabs defaultValue="public" className="space-y-4">
          <TabsList>
            <TabsTrigger value="public">Public Explanation</TabsTrigger>
            <TabsTrigger value="internal">Internal Risk Brief</TabsTrigger>
            <TabsTrigger value="support">Support Playbooks</TabsTrigger>
            <TabsTrigger value="evidence">Evidence Bundle</TabsTrigger>
          </TabsList>

          <TabsContent value="public">
            <Card>
              <CardHeader>
                <CardTitle>{result.publicExplanation.title}</CardTitle>
                <CardDescription>Public-facing explanation for customers and regulators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground">
                    {result.publicExplanation.summary}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Full Explanation</h4>
                  <Textarea
                    readOnly
                    value={result.publicExplanation.explanation}
                    className="min-h-[200px]"
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Issue Count</div>
                    <div className="text-2xl font-bold">
                      {result.publicExplanation.metrics.issueCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Resolution Rate</div>
                    <div className="text-2xl font-bold">
                      {(result.publicExplanation.metrics.resolutionRate * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Resolution Time</div>
                    <div className="text-2xl font-bold">
                      {result.publicExplanation.metrics.averageResolutionTime}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Policy References</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.publicExplanation.policyReferences.map((ref, idx) => (
                      <Badge key={idx} variant="outline">
                        {ref}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Time-Bound Updates</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    {result.publicExplanation.timeBoundUpdates.map((update, idx) => (
                      <li key={idx}>{update}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="internal">
            <Card>
              <CardHeader>
                <CardTitle>Internal Risk Brief</CardTitle>
                <CardDescription>Executive-ready risk assessment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Root Cause</h4>
                  <p className="text-sm text-muted-foreground">{result.internalRiskBrief.rootCause}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Exposure Assessment</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Customer Impact</div>
                      <div className="text-xl font-bold">
                        {result.internalRiskBrief.exposureAssessment.customerImpact}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Regulatory Risk</div>
                      <Badge
                        variant={
                          result.internalRiskBrief.exposureAssessment.regulatoryRisk === "high"
                            ? "destructive"
                            : result.internalRiskBrief.exposureAssessment.regulatoryRisk === "medium"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {result.internalRiskBrief.exposureAssessment.regulatoryRisk.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Financial Exposure</div>
                      <div className="text-xl font-bold">
                        {result.internalRiskBrief.exposureAssessment.financialExposure}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Regulatory Implications</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    {result.internalRiskBrief.regulatoryImplications.map((impl, idx) => (
                      <li key={idx}>{impl}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Recommended Actions</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    {result.internalRiskBrief.recommendedActions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support">
            <Card>
              <CardHeader>
                <CardTitle>Support Playbooks</CardTitle>
                <CardDescription>Response macros and escalation criteria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.supportPlaybooks.map((playbook, idx) => (
                  <div key={idx} className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Response Macros
                      </h4>
                      <div className="space-y-2">
                        {playbook.responseMacros.map((macro, mIdx) => (
                          <Card key={mIdx}>
                            <CardContent className="pt-4">
                              <div className="text-sm font-medium mb-1">Trigger: {macro.trigger}</div>
                              <div className="text-sm text-muted-foreground">{macro.response}</div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">De-Escalation Language</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                        {playbook.deEscalationLanguage.map((lang, lIdx) => (
                          <li key={lIdx}>{lang}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Escalation Criteria</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                        {playbook.escalationCriteria.map((criteria, cIdx) => (
                          <li key={cIdx}>{criteria}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Bundle</CardTitle>
                <CardDescription>Complete evidence and approval trail</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Evidence Items</div>
                    <div className="text-2xl font-bold">{result.evidenceBundle.evidenceIds.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Claims</div>
                    <div className="text-2xl font-bold">{result.evidenceBundle.claimIds.length}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Approval Trail
                  </h4>
                  {result.evidenceBundle.approvalTrail.length > 0 ? (
                    <div className="space-y-2">
                      {result.evidenceBundle.approvalTrail.map((approval, idx) => (
                        <Card key={idx}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{approval.approver}</div>
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(approval.timestamp), "PPp")}
                                </div>
                              </div>
                              <Badge
                                variant={approval.decision === "APPROVED" ? "default" : "secondary"}
                              >
                                {approval.decision}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No approvals yet</p>
                  )}
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/evidence?cluster=${result.clusterId}`}>
                    View Full Evidence <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
