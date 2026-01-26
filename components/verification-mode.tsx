"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  Download,
  FileText,
  Shield,
  RefreshCw,
  Clock,
} from "lucide-react";
import { PROMISE_REGISTRY, getPromisesBySKU, getCompliancePromises, type PromiseContract } from "@/lib/verification/promise-registry";

interface VerificationResult {
  flow: string;
  step: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

interface FlowVerification {
  flowName: string;
  description: string;
  steps: VerificationResult[];
  overallStatus: "pass" | "fail" | "warning";
  totalDuration: number;
}

interface VerificationRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  results: FlowVerification[];
  summary?: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export function VerificationMode() {
  const [selectedSKU, setSelectedSKU] = useState<"A" | "B" | "C" | "D" | "compliance" | "all" | null>(null);
  const [selectedPromiseId, setSelectedPromiseId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<VerificationRun | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const runVerification = async (flow: string, promiseId?: string, sku?: string) => {
    setIsRunning(true);
    setLogs([]);
    addLog(`Starting verification: ${flow}${promiseId ? ` (promise: ${promiseId})` : ""}${sku ? ` (SKU: ${sku})` : ""}`);

    const runId = `run-${Date.now()}`;
    const run: VerificationRun = {
      id: runId,
      startedAt: new Date().toISOString(),
      status: "running",
      results: [],
    };
    setCurrentRun(run);

    try {
      const body: any = { flow };
      if (promiseId) body.promiseId = promiseId;
      if (sku) body.sku = sku;

      addLog("Calling verification API...");
      const response = await fetch("/api/verification/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      addLog(`Verification completed: ${data.summary.passed} passed, ${data.summary.failed} failed`);

      run.completedAt = new Date().toISOString();
      run.status = data.summary.failed > 0 ? "failed" : "completed";
      run.results = data.results || [];
      run.summary = data.summary;
      setCurrentRun({ ...run });
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      run.completedAt = new Date().toISOString();
      run.status = "failed";
      setCurrentRun({ ...run });
    } finally {
      setIsRunning(false);
    }
  };

  const exportReport = async (format: "json" | "pdf" = "json") => {
    if (!currentRun || currentRun.status !== "completed") {
      alert("No completed verification run to export");
      return;
    }

    if (format === "json") {
      const report = {
        run: currentRun,
        promises: selectedPromiseId ? [PROMISE_REGISTRY.find((p) => p.id === selectedPromiseId)] : undefined,
        generatedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verification-report-${currentRun.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // PDF export would require a server endpoint
      addLog("PDF export requires server-side generation - use JSON export for now");
    }
  };

  const skuPromises = {
    A: getPromisesBySKU("A"),
    B: getPromisesBySKU("B"),
    C: getPromisesBySKU("C"),
    D: getPromisesBySKU("D"),
    compliance: getCompliancePromises(),
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Verification Mode
              </CardTitle>
              <CardDescription>
                Run curated E2E scenarios to verify all SKU promises and compliance controls. Export audit-ready reports.
              </CardDescription>
            </div>
            {currentRun && currentRun.status === "completed" && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportReport("json")}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={selectedSKU || "all"} onValueChange={(v) => setSelectedSKU(v as any)}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="A">SKU A</TabsTrigger>
              <TabsTrigger value="B">SKU B</TabsTrigger>
              <TabsTrigger value="C">SKU C</TabsTrigger>
              <TabsTrigger value="D">SKU D</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  onClick={() => runVerification("all")}
                  disabled={isRunning}
                  className="h-auto py-4"
                  variant="outline"
                >
                  <Play className="mr-2 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-semibold">Verify All Flows</div>
                    <div className="text-xs text-muted-foreground">Signal, Claim, Artifact</div>
                  </div>
                </Button>
                <Button
                  onClick={() => runVerification("tenant-isolation")}
                  disabled={isRunning}
                  className="h-auto py-4"
                  variant="outline"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-semibold">Verify Tenant Isolation</div>
                    <div className="text-xs text-muted-foreground">Multi-tenant security</div>
                  </div>
                </Button>
              </div>
            </TabsContent>

            {(["A", "B", "C", "D", "compliance"] as const).map((sku) => (
              <TabsContent key={sku} value={sku} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {sku === "compliance" ? "Compliance Promises" : `SKU ${sku} Promises`}
                    </h3>
                    <Button
                      onClick={() => runVerification(sku === "compliance" ? "compliance" : `sku-${sku.toLowerCase()}`)}
                      disabled={isRunning}
                      size="sm"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Verify All
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {skuPromises[sku].map((promise) => (
                      <Card
                        key={promise.id}
                        className={`cursor-pointer transition-all ${
                          selectedPromiseId === promise.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedPromiseId(promise.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{promise.promise}</h4>
                                {promise.sku && <Badge variant="outline">SKU {promise.sku}</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{promise.capability.api || promise.capability.route}</p>
                              {promise.slo && (
                                <div className="text-xs text-muted-foreground">
                                  SLO: {promise.slo.latency_ms ? `${promise.slo.latency_ms}ms` : ""}{" "}
                                  {promise.slo.error_budget ? `| Error budget: ${(promise.slo.error_budget * 100).toFixed(1)}%` : ""}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                runVerification("promise", promise.id);
                              }}
                              disabled={isRunning}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Current Run Results */}
          {currentRun && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Verification Results</span>
                  <Badge variant={currentRun.status === "completed" ? "default" : currentRun.status === "failed" ? "destructive" : "secondary"}>
                    {currentRun.status}
                  </Badge>
                </CardTitle>
                {currentRun.summary && (
                  <CardDescription>
                    {currentRun.summary.passed} passed, {currentRun.summary.failed} failed, {currentRun.summary.warnings} warnings
                    {currentRun.completedAt && (
                      <span className="ml-2">
                        • Duration: {Math.round((new Date(currentRun.completedAt).getTime() - new Date(currentRun.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {currentRun.results.map((result, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        {result.overallStatus === "pass" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : result.overallStatus === "fail" ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        {result.flowName}
                      </h4>
                      <span className="text-xs text-muted-foreground">{result.totalDuration}ms</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{result.description}</p>
                    <div className="space-y-1">
                      {result.steps.map((step, stepIdx) => (
                        <div key={stepIdx} className="flex items-start gap-2 text-sm">
                          {step.status === "pass" ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : step.status === "fail" ? (
                            <XCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                          )}
                          <span className={step.status === "fail" ? "text-red-600" : step.status === "warning" ? "text-yellow-600" : ""}>
                            <strong>{step.step}:</strong> {step.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Verification Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-1">
                  {logs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
