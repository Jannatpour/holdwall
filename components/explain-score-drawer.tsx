"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Info, 
  TrendingUp, 
  TrendingDown, 
  Link as LinkIcon,
  FileText,
  Database,
  Shield,
  BarChart3
} from "lucide-react";
import Link from "next/link";

export type ScoreType = "trust" | "decisiveness" | "outbreak_probability" | "narrative_risk";
export type ScoreEntityType = "claim" | "forecast" | "belief_node" | "cluster" | "artifact";

export interface ScoreExplanation {
  score: number;
  confidence: number;
  contributingSignals: Array<{
    name: string;
    weight: number;
    impact: "positive" | "neutral" | "negative";
    description: string;
    evidenceRefs?: string[];
  }>;
  weightingLogic: {
    method: string;
    factors: Array<{
      factor: string;
      weight: number;
      rationale: string;
    }>;
  };
  evidenceLinks: Array<{
    id: string;
    type: string;
    title: string;
    url: string;
    relevance: number;
  }>;
}

interface ExplainScoreDrawerProps {
  entityType: ScoreEntityType;
  entityId: string;
  scoreType: ScoreType;
  trigger?: React.ReactNode;
}

export function ExplainScoreDrawer({ 
  entityType,
  entityId,
  scoreType,
  trigger 
}: ExplainScoreDrawerProps) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<ScoreExplanation | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchExplanation = React.useCallback(async () => {
    if (!open) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/scores/explain?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(
          entityId
        )}&scoreType=${encodeURIComponent(scoreType)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch score explanation");
      }
      const explanation = await response.json();
      setData(explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [open, entityId, entityType, scoreType]);

  React.useEffect(() => {
    fetchExplanation();
  }, [fetchExplanation]);

  const getSignalIcon = (signal: ScoreExplanation["contributingSignals"][number]) => {
    if (signal.evidenceRefs && signal.evidenceRefs.length > 0) {
      return <Database className="size-4" />;
    }
    if (signal.name.toLowerCase().includes("forecast") || signal.name.toLowerCase().includes("model")) {
      return <BarChart3 className="size-4" />;
    }
    if (signal.name.toLowerCase().includes("cluster") || signal.name.toLowerCase().includes("claim")) {
      return <Shield className="size-4" />;
    }
    return <FileText className="size-4" />;
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "positive":
        return "text-green-600";
      case "negative":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case "evidence":
        return <Database className="size-4" />;
      case "claim":
        return <Shield className="size-4" />;
      case "artifact":
        return <FileText className="size-4" />;
      default:
        return <LinkIcon className="size-4" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Info className="size-4" />
            <span className="ml-2">Explain Score</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Score Explanation</SheetTitle>
          <SheetDescription>
            Detailed breakdown of {scoreType.replace(/_/g, " ")} score calculation
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading explanation...</div>
          </div>
        )}

        {error && (
          <div className="py-12">
            <div className="text-destructive">Error: {error}</div>
          </div>
        )}

        {data && !loading && (
          <ScrollArea className="h-[calc(100vh-120px)] pr-4">
            <div className="space-y-6 py-4">
              {/* Score Overview */}
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Score</div>
                  <div className="text-3xl font-bold">{Math.round(data.score * 100)}%</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {scoreType.replace(/_/g, " ")}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Confidence</span>
                    <span>{Math.round(data.confidence * 100)}%</span>
                  </div>
                  <Progress value={data.confidence * 100} />
                </div>
              </div>

              <Separator />

              {/* Contributing Signals */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Contributing Signals</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {data.weightingLogic.method}
                  </p>
                </div>
                <div className="space-y-3">
                  {data.contributingSignals.map((signal, idx) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getSignalIcon(signal)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{signal.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-sm ${getImpactColor(signal.impact)}`}>
                                {signal.impact}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{signal.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Weight</span>
                          <span>{Math.round(signal.weight * 100)}%</span>
                        </div>
                        <Progress value={signal.weight * 100} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Weighting Logic */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Weighting Logic</h3>
                <div className="space-y-2">
                  {data.weightingLogic.factors.map((f) => (
                    <div key={f.factor} className="space-y-1 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{f.factor}</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(f.weight * 100)}%
                        </span>
                      </div>
                      <Progress value={f.weight * 100} className="h-1.5" />
                      <div className="text-xs text-muted-foreground">{f.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Evidence Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Related Evidence</h3>
                <div className="space-y-2">
                  {data.evidenceLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getEvidenceIcon(link.type)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{link.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {link.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(link.relevance * 100)}% relevant
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={link.url}>
                          <LinkIcon className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
