/**
 * Case Detail Component
 * 
 * Displays full case information, evidence, resolution plan, and actions.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState, ErrorState } from "@/components/ui/loading-states";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Play, 
  Sparkles,
  ArrowLeft,
  Download,
} from "@/components/demo-icons";
import Link from "next/link";
import { toast } from "sonner";
import { ResolutionPlanDisplay } from "@/components/resolution-plan-display";

interface CaseDetailProps {
  caseId: string;
}

export function CaseDetail({ caseId }: CaseDetailProps) {
  const router = useRouter();
  const [case_, setCase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [playbookLoading, setPlaybookLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCase() {
      try {
        setLoading(true);
        const response = await fetch(`/api/cases/${caseId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch case: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setCase(data);
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
    }

    fetchCase();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const handleTriage = async () => {
    setTriageLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/triage`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to run triage");
      }
      const result = await response.json();
      toast.success("Triage completed successfully");
      // Refresh case data
      const caseResponse = await fetch(`/api/cases/${caseId}`);
      if (caseResponse.ok) {
        const caseData = await caseResponse.json();
        setCase(caseData);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run triage");
    } finally {
      setTriageLoading(false);
    }
  };

  const handleExecutePlaybook = async () => {
    setPlaybookLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/execute-playbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error("Failed to execute playbook");
      }
      const result = await response.json();
      toast.success("Playbook execution started");
      // Refresh case data
      const caseResponse = await fetch(`/api/cases/${caseId}`);
      if (caseResponse.ok) {
        const caseData = await caseResponse.json();
        setCase(caseData);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute playbook");
    } finally {
      setPlaybookLoading(false);
    }
  };

  if (loading) {
    return <LoadingState count={3} />;
  }

  if (error || !case_) {
    return <ErrorState error={error || "Case not found"} title="Failed to load case" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/cases">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cases
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{case_.caseNumber}</h1>
            <p className="text-muted-foreground">{case_.type.replace("_", " ")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTriage}
            disabled={triageLoading}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {triageLoading ? "Triaging..." : "Run Triage"}
          </Button>
          <Button
            onClick={handleExecutePlaybook}
            disabled={playbookLoading}
          >
            <Play className="h-4 w-4 mr-2" />
            {playbookLoading ? "Executing..." : "Execute Playbook"}
          </Button>
        </div>
      </div>

      {/* Case Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{case_.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-orange-500">{case_.severity}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Priority</CardTitle>
          </CardHeader>
          <CardContent>
            {case_.priority ? (
              <Badge variant="outline">{case_.priority}</Badge>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="resolution">Resolution</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{case_.description}</p>
            </CardContent>
          </Card>

          {case_.impact && (
            <Card>
              <CardHeader>
                <CardTitle>Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{case_.impact}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium">Submitted By: </span>
                <span>{case_.submittedBy}</span>
              </div>
              {case_.submittedByEmail && (
                <div>
                  <span className="text-sm font-medium">Email: </span>
                  <span>{case_.submittedByEmail}</span>
                </div>
              )}
              {case_.submittedByName && (
                <div>
                  <span className="text-sm font-medium">Name: </span>
                  <span>{case_.submittedByName}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              <CardDescription>Files and documents linked to this case</CardDescription>
            </CardHeader>
            <CardContent>
              {case_.evidence && Array.isArray(case_.evidence) && case_.evidence.length > 0 ? (
                <div className="space-y-2">
                  {case_.evidence.map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">
                          Evidence {ev.evidenceId ? ev.evidenceId.substring(0, 8) : ev.id?.substring(0, 8) || "Unknown"}
                        </span>
                        <Badge variant="outline">{ev.evidenceType || "UPLOAD"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No evidence attached</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolution" className="space-y-4">
          {case_.resolution ? (
            <ResolutionPlanDisplay 
              resolution={case_.resolution as any} 
              showInternal={true}
              variant="both"
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  No resolution plan generated yet. Execute a playbook to generate one.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Case Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(case_.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {case_.updatedAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(case_.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
