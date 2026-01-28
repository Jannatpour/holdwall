/**
 * Forecasts Data Component
 * Display drift, outbreak probability, and what-if simulations with AI-powered insights
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/loading-states";
import { ExplainScoreDrawer, type ScoreType } from "@/components/explain-score-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Info,
  Package,
} from "@/components/demo-icons";

interface Forecast {
  id: string;
  type: "DRIFT" | "OUTBREAK" | "ANOMALY";
  value: number;
  confidenceLevel: number;
  horizonDays: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface DriftAnalysis {
  currentSentiment: number;
  predictedSentiment: number;
  driftMagnitude: number;
  confidence: number;
  trend: "increasing" | "decreasing" | "stable";
}

export function ForecastsData() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [driftAnalysis, setDriftAnalysis] = useState<DriftAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);
  const [narrativeForecasts, setNarrativeForecasts] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<Record<string, Record<string, number>>>({});
  const [accuracyMetrics, setAccuracyMetrics] = useState<any>(null);
  const [contentPacks, setContentPacks] = useState<any[]>([]);
  const cancelledRef = useRef(false);

  async function loadForecasts() {
    setLoading(true);
    setError(null);
    try {
      const [
        forecastsRes,
        driftRes,
        narrativeRes,
        heatmapRes,
        accuracyRes,
        packsRes,
      ] = await Promise.all([
        fetch("/api/forecasts"),
        fetch("/api/forecasts?type=drift"),
        fetch("/api/forecasts?type=narrative"),
        fetch("/api/forecasts/heatmap"),
        fetch("/api/forecasts/accuracy"),
        fetch("/api/forecasts/content-packs"),
      ]);

      if (!forecastsRes.ok) {
        throw new Error("Failed to load forecasts");
      }

      const forecastsData = await forecastsRes.json();
      if (!cancelledRef.current) {
        setForecasts(forecastsData.forecasts || forecastsData || []);
      }

      if (driftRes.ok && !cancelledRef.current) {
        const driftData = await driftRes.json();
        setDriftAnalysis(driftData.analysis || null);
      }

      if (narrativeRes.ok && !cancelledRef.current) {
        const narrativeData = await narrativeRes.json();
        setNarrativeForecasts(narrativeData.forecasts || []);
      }

      if (heatmapRes.ok && !cancelledRef.current) {
        const heatmapData = await heatmapRes.json();
        setHeatmapData(heatmapData.heatmap || {});
      }

      if (accuracyRes.ok && !cancelledRef.current) {
        const accuracyData = await accuracyRes.json();
        setAccuracyMetrics(accuracyData);
      }

      if (packsRes.ok && !cancelledRef.current) {
        const packsData = await packsRes.json();
        setContentPacks(packsData.packs || []);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load forecasts");
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadForecasts();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  function scoreTypeForForecast(forecast: Forecast): ScoreType {
    switch (forecast.type) {
      case "OUTBREAK":
        return "outbreak_probability";
      case "DRIFT":
      case "ANOMALY":
      default:
        return "narrative_risk";
    }
  }

  if (loading) {
    return <LoadingState count={3} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={loadForecasts} />;
  }

  const outbreakForecasts = forecasts.filter((f) => f.type === "OUTBREAK");
  const driftForecasts = forecasts.filter((f) => f.type === "DRIFT");
  const latestOutbreak = outbreakForecasts[0];
  const latestDrift = driftForecasts[0];

  return (
    <div className="space-y-6">
      {/* Outbreak Probability */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Outbreak Probability</CardTitle>
              <CardDescription>
                7-day forecast with confidence intervals
              </CardDescription>
            </div>
            <Button onClick={loadForecasts} variant="outline" size="sm">
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestOutbreak ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold">
                    {(latestOutbreak.value * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Confidence: {(latestOutbreak.confidenceLevel * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-right">
                  {latestOutbreak.value > 0.6 ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" />
                      High Risk
                    </Badge>
                  ) : latestOutbreak.value > 0.3 ? (
                    <Badge variant="outline" className="gap-1 text-amber-600">
                      <AlertTriangle className="size-3" />
                      Moderate Risk
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-green-600">
                      Low Risk
                    </Badge>
                  )}
                </div>
              </div>
              <Progress value={latestOutbreak.value * 100} className="h-3" />
              <div className="flex items-center gap-2">
                <ExplainScoreDrawer
                  entityType="forecast"
                  entityId={latestOutbreak.id}
                  scoreType={scoreTypeForForecast(latestOutbreak)}
                />
                <div className="text-xs text-muted-foreground">
                  Forecast generated {new Date(latestOutbreak.createdAt).toLocaleDateString()}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <BarChart3 className="mx-auto size-12 mb-4" />
              <p>No outbreak forecasts available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sentiment Drift */}
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Drift Analysis</CardTitle>
          <CardDescription>
            Anomaly detection and drift forecasting
          </CardDescription>
        </CardHeader>
        <CardContent>
          {driftAnalysis ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2" data-guide="drift-metrics">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground mb-1">Current Sentiment</div>
                  <div className="text-2xl font-bold">
                    {(driftAnalysis.currentSentiment * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground mb-1">Predicted Sentiment</div>
                  <div className="text-2xl font-bold">
                    {(driftAnalysis.predictedSentiment * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {driftAnalysis.trend === "increasing" ? (
                  <TrendingUp className="size-5 text-green-600" />
                ) : driftAnalysis.trend === "decreasing" ? (
                  <TrendingDown className="size-5 text-red-600" />
                ) : (
                  <BarChart3 className="size-5 text-muted-foreground" />
                )}
                <div>
                  <div className="font-medium">
                    Drift: {(driftAnalysis.driftMagnitude * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground" data-guide="confidence-indicator">
                    Confidence: {(driftAnalysis.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              <Progress value={Math.abs(driftAnalysis.driftMagnitude) * 100} className="h-2" data-guide="drift-chart" />
            </div>
          ) : latestDrift ? (
            <div className="space-y-4">
              <div className="text-2xl font-bold">
                {(latestDrift.value * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">
                Drift magnitude with {(latestDrift.confidenceLevel * 100).toFixed(0)}% confidence
              </div>
              <Progress value={Math.abs(latestDrift.value) * 100} className="h-2" />
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <TrendingUp className="mx-auto size-12 mb-4" />
              <p>No drift analysis available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Forecasts */}
      <Card data-guide="forecast-list">
        <CardHeader>
          <CardTitle data-guide="forecast-types">Recent Forecasts</CardTitle>
          <CardDescription>
            All forecast types and their predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forecasts.length > 0 ? (
            <div className="space-y-3">
              {forecasts.slice(0, 10).map((forecast) => (
                <div
                  key={forecast.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => setSelectedForecast(forecast)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{forecast.type}</Badge>
                      <span className="font-medium">
                        {(forecast.value * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {forecast.horizonDays}-day horizon • {new Date(forecast.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {(forecast.confidenceLevel * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <BarChart3 className="mx-auto size-12 mb-4" />
              <p>No forecasts available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Narrative Forecasts */}
      <Card>
        <CardHeader>
          <CardTitle>Narrative Forecasts</CardTitle>
          <CardDescription>
            Predicted narrative emergence by surface and region
          </CardDescription>
        </CardHeader>
        <CardContent>
          {narrativeForecasts.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Narrative</TableHead>
                    <TableHead>Surface</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Probability</TableHead>
                    <TableHead>Horizon</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {narrativeForecasts.map((forecast: any) => (
                    <TableRow key={forecast.id}>
                      <TableCell className="font-medium max-w-md">
                        {forecast.narrative || forecast.description || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{forecast.surface || "all"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{forecast.region || "global"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={forecast.probability * 100} className="w-20" />
                          <span className="text-sm font-medium">
                            {Math.round(forecast.probability * 100)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{forecast.horizon_days || 7} days</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((forecast.confidence || 0.7) * 100)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="No narrative forecasts"
              description="Narrative forecasts will appear as patterns are detected"
            />
          )}
        </CardContent>
      </Card>

      {/* Heatmap by Surface/Region */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Heatmap</CardTitle>
          <CardDescription>
            Outbreak probability by surface and region
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(heatmapData).length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Surface</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Outbreak Probability</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(heatmapData).flatMap(([surface, regions]) =>
                    Object.entries(regions as Record<string, number>).map(([region, probability]) => (
                      <TableRow key={`${surface}-${region}`}>
                        <TableCell className="font-medium">{surface}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{region}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={probability * 100} className="w-24" />
                            <span className="text-sm font-medium">
                              {Math.round(probability * 100)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              probability > 0.7
                                ? "destructive"
                                : probability > 0.4
                                ? "default"
                                : "outline"
                            }
                          >
                            {probability > 0.7 ? "High" : probability > 0.4 ? "Medium" : "Low"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="No heatmap data"
              description="Heatmap data will appear as forecasts are generated"
            />
          )}
        </CardContent>
      </Card>

      {/* Preemptive Content Pack Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Preemptive Content Packs</CardTitle>
          <CardDescription>
            AI-generated content packs for predicted narratives
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contentPacks.length > 0 ? (
            <div className="space-y-3">
              {contentPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="size-4 text-primary" />
                      <span className="font-medium">{pack.name || "Content Pack"}</span>
                      <Badge variant="outline">{pack.narrative_type || "general"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {pack.description || "Preemptive content for predicted narrative"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Artifacts: {pack.artifacts_count || 0}</span>
                      <span>•</span>
                      <span>Target: {pack.target_surface || "all"}</span>
                      <span>•</span>
                      <span>Probability: {Math.round((pack.trigger_probability || 0) * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/studio?pack=${pack.id}`}>
                        <Package className="mr-2 size-4" />
                        Generate
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState
                title="No content packs"
                description="Content packs will be generated for high-probability narratives"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    const response = await fetch("/api/forecasts/content-packs", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ generate: true }),
                    });
                    if (response.ok) {
                      loadForecasts();
                    }
                  } catch (err) {
                    console.error("Failed to generate content pack:", err);
                  }
                }}
              >
                <Package className="mr-2 size-4" />
                Generate Content Pack
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accuracy Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Accuracy Metrics</CardTitle>
          <CardDescription>
            Historical accuracy of forecast predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accuracyMetrics ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground mb-1">Overall Accuracy</div>
                  <div className="text-2xl font-bold">
                    {Math.round((accuracyMetrics.overall_accuracy || 0) * 100)}%
                  </div>
                  <Progress
                    value={(accuracyMetrics.overall_accuracy || 0) * 100}
                    className="mt-2"
                  />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground mb-1">Outbreak Prediction</div>
                  <div className="text-2xl font-bold">
                    {Math.round((accuracyMetrics.outbreak_accuracy || 0) * 100)}%
                  </div>
                  <Progress
                    value={(accuracyMetrics.outbreak_accuracy || 0) * 100}
                    className="mt-2"
                  />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground mb-1">Drift Prediction</div>
                  <div className="text-2xl font-bold">
                    {Math.round((accuracyMetrics.drift_accuracy || 0) * 100)}%
                  </div>
                  <Progress
                    value={(accuracyMetrics.drift_accuracy || 0) * 100}
                    className="mt-2"
                  />
                </div>
              </div>
              {accuracyMetrics.recent_forecasts && accuracyMetrics.recent_forecasts.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Recent Forecast Performance</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Forecast</TableHead>
                        <TableHead>Predicted</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Accuracy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accuracyMetrics.recent_forecasts.slice(0, 5).map((fc: any) => (
                        <TableRow key={fc.id}>
                          <TableCell className="font-medium">{fc.type}</TableCell>
                          <TableCell>{Math.round((fc.predicted || 0) * 100)}%</TableCell>
                          <TableCell>{Math.round((fc.actual || 0) * 100)}%</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {Math.abs((fc.predicted || 0) - (fc.actual || 0)) < 0.1 ? (
                                <CheckCircle2 className="size-4 text-green-600" />
                              ) : (
                                <AlertTriangle className="size-4 text-orange-600" />
                              )}
                              <span className="text-sm">
                                {Math.round(
                                  (1 - Math.abs((fc.predicted || 0) - (fc.actual || 0))) * 100
                                )}
                                %
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No accuracy data"
              description="Accuracy metrics will appear as forecasts are validated against actual outcomes"
            />
          )}
        </CardContent>
      </Card>

      {selectedForecast && (
        <ExplainScoreDrawer
          entityType="forecast"
          entityId={selectedForecast.id}
          scoreType={scoreTypeForForecast(selectedForecast)}
          trigger={
            <Button variant="outline" className="w-full">
              <Info className="mr-2 size-4" />
              Explain Forecast
            </Button>
          }
        />
      )}
    </div>
  );
}
