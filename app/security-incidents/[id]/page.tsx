"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Sparkles,
  Lock,
  Network,
  ArrowLeft,
  Play,
  Download,
} from "@/components/demo-icons";
import { AuthGuard } from "@/components/auth-guard";
import Link from "next/link";

interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  detectedAt: string;
  resolvedAt: string | null;
  source: string | null;
  narrativeRiskScore: number | null;
  outbreakProbability: number | null;
  explanationId: string | null;
  explanation?: {
    id: string;
    title: string;
    summary: string;
    isPublished: boolean;
    publishedAt: string | null;
  };
}

export default function SecurityIncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id as string;

  const [incident, setIncident] = useState<SecurityIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  const loadIncident = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/security-incidents/${incidentId}`);
      if (response.ok) {
        const data = await response.json();
        setIncident(data.incident);
      }
    } catch (error) {
      // Error handled by loading state
    } finally {
      setLoading(false);
    }
  };

  const handleAssessRisk = async () => {
    try {
      const response = await fetch(
        `/api/security-incidents/${incidentId}/narrative-risk`,
        { method: "POST" }
      );
      if (response.ok) {
        loadIncident();
      }
    } catch (error) {
      // Error handled by UI state
    }
  };

  const handleGenerateExplanation = async () => {
    try {
      setGenerating(true);
      const response = await fetch(
        `/api/security-incidents/${incidentId}/explanation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            includeRootCause: true,
            includeResolution: true,
            includePrevention: true,
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        router.push(`/security-incidents/${incidentId}/explanation?draft=${encodeURIComponent(JSON.stringify(data.draft))}`);
      }
    } catch (error) {
      // Error handled by generating state
    } finally {
      setGenerating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "destructive";
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "default";
      case "LOW":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "destructive";
      case "INVESTIGATING":
        return "default";
      case "CONTAINED":
        return "secondary";
      case "RESOLVED":
        return "default";
      case "CLOSED":
        return "outline";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <AppShell>
        <AuthGuard requiredRole="VIEWER">
          <div className="text-center py-12">Loading incident...</div>
        </AuthGuard>
      </AppShell>
    );
  }

  if (!incident) {
    return (
      <AppShell>
        <AuthGuard requiredRole="VIEWER">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Incident not found</p>
            <Button asChild>
              <Link href="/security-incidents">Back to Incidents</Link>
            </Button>
          </div>
        </AuthGuard>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AuthGuard requiredRole="VIEWER">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/security-incidents">
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{incident.title}</h1>
                <p className="text-muted-foreground">
                  Detected: {new Date(incident.detectedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getSeverityColor(incident.severity)}>
                {incident.severity}
              </Badge>
              <Badge variant={getStatusColor(incident.status)}>
                {incident.status}
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="narrative-risk">Narrative Risk</TabsTrigger>
              <TabsTrigger value="explanation">Explanation</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Incident Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Type
                      </p>
                      <p className="text-sm">{incident.type.replace(/_/g, " ")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Severity
                      </p>
                      <Badge variant={getSeverityColor(incident.severity)}>
                        {incident.severity}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Status
                      </p>
                      <Badge variant={getStatusColor(incident.status)}>
                        {incident.status}
                      </Badge>
                    </div>
                    {incident.source && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Source
                        </p>
                        <p className="text-sm">{incident.source}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {incident.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="narrative-risk" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Narrative Risk Assessment</CardTitle>
                  <CardDescription>
                    Assessed narrative risk and outbreak probability for this security incident
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {incident.narrativeRiskScore !== null ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">Narrative Risk Score</p>
                          <span className="text-sm font-bold">
                            {(incident.narrativeRiskScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              incident.narrativeRiskScore >= 0.7
                                ? "bg-destructive"
                                : incident.narrativeRiskScore >= 0.4
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${incident.narrativeRiskScore * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">Outbreak Probability</p>
                          <span className="text-sm font-bold">
                            {incident.outbreakProbability
                              ? `${(incident.outbreakProbability * 100).toFixed(0)}%`
                              : "Not calculated"}
                          </span>
                        </div>
                        {incident.outbreakProbability !== null && (
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${incident.outbreakProbability * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Narrative risk has not been assessed yet
                      </p>
                      <Button onClick={handleAssessRisk}>
                        <TrendingUp className="mr-2 size-4" />
                        Assess Narrative Risk
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="explanation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Incident Explanation</CardTitle>
                  <CardDescription>
                    AI-governed explanation for this security incident
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {incident.explanation ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">{incident.explanation.title}</p>
                        <p className="text-sm text-muted-foreground">{incident.explanation.summary}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {incident.explanation.isPublished ? (
                          <>
                            <CheckCircle2 className="size-4 text-green-500" />
                            <span className="text-sm text-muted-foreground">Published</span>
                            {incident.explanation.publishedAt && (
                              <span className="text-xs text-muted-foreground">
                                on {new Date(incident.explanation.publishedAt).toLocaleDateString()}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <Clock className="size-4 text-yellow-500" />
                            <span className="text-sm text-muted-foreground">Draft - Pending Approval</span>
                          </>
                        )}
                      </div>
                      <Button asChild variant="outline">
                        <Link href={`/security-incidents/${incidentId}/explanation`}>
                          View Full Explanation
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="mx-auto mb-4 size-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No explanation has been generated yet
                      </p>
                      <Button onClick={handleGenerateExplanation} disabled={generating}>
                        <Sparkles className="mr-2 size-4" />
                        {generating ? "Generating..." : "Generate AI-Governed Explanation"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evidence & Audit Trail</CardTitle>
                  <CardDescription>
                    Evidence bundles and complete audit trail for this incident
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Evidence bundles and audit trails are available for this incident. 
                    Export complete audit bundles for compliance reviews.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href={`/governance?incident_id=${incidentId}`}>
                      <Download className="mr-2 size-4" />
                      Export Audit Bundle
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AuthGuard>
    </AppShell>
  );
}
