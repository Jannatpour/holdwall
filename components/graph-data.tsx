/**
 * Graph Data Component
 * 
 * Loads and displays belief graph data with GraphCanvas
 */

"use client";

import { useEffect, useState } from "react";
import { GraphCanvas, type GraphNode, type GraphEdge } from "@/components/graph-canvas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/loading-states";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GraphDataProps {
  range?: string;
  timestamp?: string;
  nodeId?: string;
}

export function GraphData({ range = "30d", timestamp, nodeId }: GraphDataProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (range) params.append("range", range);
        if (timestamp) params.append("timestamp", timestamp);

        const response = await fetch(`/api/graph/snapshot?${params}`);
        if (!response.ok) {
          throw new Error("Failed to load graph");
        }

        const data = await response.json();
        if (!cancelled) {
          // Transform API response to graph format
          const graphNodes: GraphNode[] = (data.nodes || []).map((node: any, idx: number) => ({
            id: node.id,
            type: node.type?.toLowerCase() || "claim",
            content: node.content || "",
            trust_score: node.trustScore || 0,
            decisiveness: node.decisiveness || 0,
            x: Math.cos((idx / (data.nodes?.length || 1)) * 2 * Math.PI) * 200,
            y: Math.sin((idx / (data.nodes?.length || 1)) * 2 * Math.PI) * 200,
          }));

          const graphEdges: GraphEdge[] = (data.edges || []).map((edge: any) => ({
            id: edge.id,
            from: edge.fromNodeId,
            to: edge.toNodeId,
            type: edge.type?.toLowerCase() || "reinforcement",
            weight: edge.weight || 0.5,
          }));

          setNodes(graphNodes);
          setEdges(graphEdges);
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

    loadGraph();
    return () => {
      cancelled = true;
    };
  }, [range, timestamp]);

  if (loading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        title="Graph not built yet"
        description="Compute the belief graph to visualize relationships"
        action={{
          label: "Compute Graph",
          onClick: async () => {
            try {
              await fetch("/api/graph/recompute", { method: "POST" });
              window.location.reload();
            } catch (err) {
              // Use structured logger if available, fallback to console for error reporting
              if (typeof window !== "undefined") {
                import("@/lib/logging/logger").then(({ logger }) => {
                  logger.error("Failed to compute graph", {
                    error: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                  });
                }).catch(() => {
                  console.error("Failed to compute graph:", err);
                });
              } else {
                console.error("Failed to compute graph:", err);
              }
            }
          },
        }}
      />
    );
  }

  return (
    <>
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        onNodeClick={(nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          setSelectedNode(node || null);
        }}
      />

      {selectedNode && (
        <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Node Details</SheetTitle>
              <SheetDescription>Belief graph node information</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-120px)] mt-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Type</div>
                  <div className="text-sm text-muted-foreground capitalize">{selectedNode.type}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Content</div>
                  <div className="text-sm">{selectedNode.content}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Trust Score</div>
                  <div className="text-sm">{selectedNode.trust_score.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Decisiveness</div>
                  <div className="text-sm">{(selectedNode.decisiveness * 100).toFixed(1)}%</div>
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
