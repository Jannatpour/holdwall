"use client";

import { useState, useEffect } from "react";
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
  Plus,
  Filter,
} from "@/components/demo-icons";
import { AuthGuard } from "@/components/auth-guard";
import Link from "next/link";

interface SecurityIncident {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  detectedAt: string;
  narrativeRiskScore: number | null;
  outbreakProbability: number | null;
  explanationId: string | null;
}

export default function SecurityIncidentsPage() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "high_risk">("all");

  useEffect(() => {
    loadIncidents();
  }, [filter]);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === "open") {
        params.set("status", "OPEN");
      }
      if (filter === "high_risk") {
        params.set("min_risk", "0.7");
      }

      const response = await fetch(`/api/security-incidents?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error("Error loading incidents:", error);
    } finally {
      setLoading(false);
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

  const getRiskLevel = (score: number | null) => {
    if (!score) return "Unknown";
    if (score >= 0.8) return "Critical";
    if (score >= 0.6) return "High";
    if (score >= 0.4) return "Medium";
    return "Low";
  };

  return (
    <AppShell>
      <AuthGuard requiredRole="VIEWER">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20">
                  <Shield className="size-6 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                  Security Incident Command Center
                </h1>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                Comprehensive security incident management with narrative risk assessment, outbreak probability analysis, and AI-governed explanation generation. Full integration with SIEM and SOAR systems.
              </p>
            </div>
            <Button asChild className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
              <Link href="/security-incidents/new">
                <Plus className="mr-2 size-4" />
                New Incident
              </Link>
            </Button>
          </div>

          <Tabs defaultValue="incidents" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="incidents" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <AlertTriangle className="mr-2 size-4" />
                Incidents
              </TabsTrigger>
              <TabsTrigger value="explanations" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="mr-2 size-4" />
                Explanations
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Network className="mr-2 size-4" />
                Webhook Integration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="incidents" className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <div className="flex gap-2">
                  <Button
                    variant={filter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === "open" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("open")}
                  >
                    Open
                  </Button>
                  <Button
                    variant={filter === "high_risk" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("high_risk")}
                  >
                    High Risk
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading incidents...</div>
              ) : incidents.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Shield className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No security incidents found</p>
                    <Button asChild>
                      <Link href="/security-incidents/new">Create First Incident</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {incidents.map((incident) => (
                    <Card key={incident.id} className="hover:border-primary transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{incident.title}</CardTitle>
                              <Badge variant={getSeverityColor(incident.severity)}>
                                {incident.severity}
                              </Badge>
                              <Badge variant={getStatusColor(incident.status)}>
                                {incident.status}
                              </Badge>
                            </div>
                            <CardDescription>
                              Type: {incident.type.replace(/_/g, " ")} • 
                              Detected: {new Date(incident.detectedAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              Narrative Risk
                            </p>
                            <div className="flex items-center gap-2">
                              {incident.narrativeRiskScore !== null ? (
                                <>
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        incident.narrativeRiskScore >= 0.7
                                          ? "bg-destructive"
                                          : incident.narrativeRiskScore >= 0.4
                                          ? "bg-yellow-500"
                                          : "bg-green-500"
                                      }`}
                                      style={{ width: `${incident.narrativeRiskScore * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium">
                                    {getRiskLevel(incident.narrativeRiskScore)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">Not assessed</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              Outbreak Probability
                            </p>
                            <div className="flex items-center gap-2">
                              {incident.outbreakProbability !== null ? (
                                <>
                                  <TrendingUp className="size-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {(incident.outbreakProbability * 100).toFixed(0)}%
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">Not calculated</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              Explanation
                            </p>
                            <div className="flex items-center gap-2">
                              {incident.explanationId ? (
                                <>
                                  <CheckCircle2 className="size-4 text-green-500" />
                                  <Link
                                    href={`/security-incidents/${incident.id}/explanation`}
                                    className="text-sm text-primary hover:underline"
                                  >
                                    View Explanation
                                  </Link>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                >
                                  <Link href={`/security-incidents/${incident.id}/explanation/generate`}>
                                    Generate
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/security-incidents/${incident.id}`}>View Details</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const response = await fetch(
                                `/api/security-incidents/${incident.id}/narrative-risk`,
                                { method: "POST" }
                              );
                              if (response.ok) {
                                loadIncidents();
                              }
                            }}
                          >
                            Assess Risk
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="explanations" className="space-y-4">
              <Card className="transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    <CardTitle className="font-semibold">Incident Explanations</CardTitle>
                  </div>
                  <CardDescription>
                    AI-governed explanations for security incidents with full governance: model selection, policy checks, and approval workflows
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    View and manage incident explanations. Each explanation is generated using 
                    AI models with full governance: model selection, policy checks, and approval workflows.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-4">
              <Card className="transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Network className="size-5 text-primary" />
                    <CardTitle className="font-semibold">Webhook Integration Center</CardTitle>
                  </div>
                  <CardDescription>
                    Connect security tools (SIEM, SOAR) to automatically ingest incidents with real-time narrative risk assessment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Webhook Endpoint</p>
                    <code className="block p-2 bg-muted rounded text-sm">
                      POST /api/security-incidents/webhook?tenant_id=YOUR_TENANT_ID
                    </code>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Supported Sources</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Splunk</li>
                      <li>CrowdStrike</li>
                      <li>Palo Alto Networks</li>
                      <li>Custom webhooks</li>
                    </ul>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/integrations">Configure Integrations</Link>
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
