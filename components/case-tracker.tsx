/**
 * Case Tracker Component
 * 
 * Customer-facing case tracking interface with email verification.
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FileText,
  Mail,
  Send,
  Download,
  ExternalLink,
} from "@/components/demo-icons";
import { toast } from "sonner";
import Link from "next/link";
import { ResolutionPlanDisplay } from "@/components/resolution-plan-display";

interface TimelineEvent {
  timestamp: string;
  event: string;
  description: string;
  type: string;
  actor: string;
}

function CaseTimeline({ caseId }: { caseId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        setLoading(true);
        const response = await fetch(`/api/cases/${caseId}/timeline`);
        if (!response.ok) {
          throw new Error("Failed to fetch timeline");
        }
        const data = await response.json();
        setEvents(data.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, [caseId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No timeline events available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, idx) => (
        <Card key={idx}>
          <CardContent className="pt-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {idx < events.length - 1 && (
                  <div className="w-px h-full min-h-[60px] bg-border mt-2" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{event.event}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
                {event.actor && event.actor !== "system" && (
                  <div className="mt-1 text-xs text-muted-foreground">By: {event.actor}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CaseData {
  id: string;
  caseNumber: string;
  type: string;
  status: string;
  severity: string;
  description: string;
  impact?: string;
  createdAt: string;
  updatedAt: string;
  resolution?: {
    customerPlan: any;
    internalPlan?: any;
    safetySteps?: any;
    timeline?: any;
    status: string;
    resolutionArtifactId?: string | null;
  };
  evidence?: Array<{
    evidenceId: string;
    evidenceType: string;
    evidence?: {
      metadata?: any;
    };
  }>;
}

export function CaseTracker({ initialCaseNumber = "" }: { initialCaseNumber?: string }) {
  const [caseNumber, setCaseNumber] = useState(initialCaseNumber);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"lookup" | "verify" | "view">("lookup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [verified, setVerified] = useState(false);

  // If case number is provided, auto-fill and try to load
  useEffect(() => {
    if (initialCaseNumber) {
      setCaseNumber(initialCaseNumber);
    }
  }, [initialCaseNumber]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/cases/track?caseNumber=${encodeURIComponent(caseNumber)}&email=${encodeURIComponent(email)}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to lookup case");
      }

      const data = await response.json();
      
      if (data.requiresVerification) {
        setStep("verify");
        toast.success("Verification code sent to your email");
      } else {
        setCaseData(data.case);
        setVerified(true);
        setStep("view");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lookup case");
      toast.error(err instanceof Error ? err.message : "Failed to lookup case");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/cases/track/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber,
          email,
          code: verificationCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid verification code");
      }

      const data = await response.json();
      setCaseData(data.case);
      setVerified(true);
      setStep("view");
      toast.success("Case verified successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid verification code");
      toast.error(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SUBMITTED: "secondary",
      TRIAGED: "default",
      IN_PROGRESS: "default",
      RESOLVED: "default",
      CLOSED: "outline",
    };

    const colors: Record<string, string> = {
      SUBMITTED: "bg-gray-500",
      TRIAGED: "bg-blue-500",
      IN_PROGRESS: "bg-yellow-500",
      RESOLVED: "bg-green-500",
      CLOSED: "bg-gray-400",
    };

    return (
      <Badge className={colors[status] || "bg-gray-500"}>
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DISPUTE: "Payment Dispute",
      FRAUD_ATO: "Fraud / Account Takeover",
      OUTAGE_DELAY: "Transaction Delay / Outage",
      COMPLAINT: "Complaint / Other",
    };
    return labels[type] || type;
  };

  if (step === "verify") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification code to {email}. Please enter it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("lookup")}
              >
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "view" && caseData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Case {caseData.caseNumber}</CardTitle>
                <CardDescription className="mt-1">
                  {getTypeLabel(caseData.type)} • Created {new Date(caseData.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
              {getStatusBadge(caseData.status)}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="resolution">Resolution Plan</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Description</Label>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {caseData.description}
                  </p>
                </div>

                {caseData.impact && (
                  <div>
                    <Label className="text-sm font-semibold">Impact</Label>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {caseData.impact}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <p className="mt-1 font-medium">{caseData.status.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Severity</Label>
                    <p className="mt-1 font-medium">{caseData.severity}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Updated</Label>
                    <p className="mt-1 font-medium">
                      {new Date(caseData.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <p className="mt-1 font-medium">
                      {new Date(caseData.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="resolution" className="space-y-4">
                {caseData.resolution ? (
                  <>
                    <ResolutionPlanDisplay 
                      resolution={caseData.resolution as any} 
                      showInternal={false}
                      variant="customer"
                    />
                    {caseData.resolution.resolutionArtifactId && (
                      <div>
                        <Button asChild variant="outline">
                          <Link href={`/artifacts/${caseData.resolution.resolutionArtifactId}`} target="_blank">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Resolution Artifact
                          </Link>
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Resolution plan is being prepared. Check back soon.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="evidence" className="space-y-4">
                {caseData.evidence && caseData.evidence.length > 0 ? (
                  <div className="space-y-2">
                    {caseData.evidence.map((ev, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="text-sm">
                                {ev.evidenceType} Evidence
                              </span>
                            </div>
                            <Badge variant="outline">{ev.evidenceType}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No evidence files attached to this case.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                <CaseTimeline caseId={caseData.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="outline" onClick={() => {
            setStep("lookup");
            setCaseData(null);
            setVerified(false);
          }}>
            Track Another Case
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lookup Your Case</CardTitle>
        <CardDescription>
          Enter your case number and email address to track your case status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLookup} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="caseNumber">
              Case Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="caseNumber"
              type="text"
              placeholder="CASE-20260122-A1B2C3"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Looking up case...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Track Case
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
