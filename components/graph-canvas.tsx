/**
 * Graph Canvas Component
 * 
 * Interactive graph visualization for belief graph explorer
 * Uses React Flow or D3 for rendering
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZoomIn, ZoomOut, RefreshCw, Download } from "lucide-react";

export interface GraphNode {
  id: string;
  type: "claim" | "emotion" | "proof_point" | "narrative";
  content: string;
  trust_score: number;
  decisiveness: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: "reinforcement" | "neutralization" | "decay";
  weight: number;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

export function GraphCanvas({ nodes, edges, onNodeClick, onEdgeClick }: GraphCanvasProps) {
  const [zoom, setZoom] = React.useState(1);
  const [showWeights, setShowWeights] = React.useState(true);
  const [showActors, setShowActors] = React.useState(false);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Simple canvas-based graph rendering
  // In production, would use React Flow, D3, or Cytoscape
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    for (const edge of edges) {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      
      if (!fromNode || !toNode) continue;

      const x1 = (fromNode.x || 0) * zoom + canvas.width / 2;
      const y1 = (fromNode.y || 0) * zoom + canvas.height / 2;
      const x2 = (toNode.x || 0) * zoom + canvas.width / 2;
      const y2 = (toNode.y || 0) * zoom + canvas.height / 2;

      ctx.strokeStyle = edge.type === "reinforcement" ? "#22c55e" : edge.type === "neutralization" ? "#ef4444" : "#6b7280";
      ctx.lineWidth = edge.weight * 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (showWeights) {
        ctx.fillStyle = "#000";
        ctx.font = "12px sans-serif";
        ctx.fillText(edge.weight.toFixed(2), (x1 + x2) / 2, (y1 + y2) / 2);
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const x = (node.x || 0) * zoom + canvas.width / 2;
      const y = (node.y || 0) * zoom + canvas.height / 2;

      ctx.fillStyle = node.trust_score > 0 ? "#22c55e" : "#ef4444";
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.id.substring(0, 3), x, y + 4);
    }
  }, [nodes, edges, zoom, showWeights]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Belief Graph</CardTitle>
            <CardDescription>Interactive graph explorer</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="explore">
          <TabsList>
            <TabsTrigger value="explore">Explore</TabsTrigger>
            <TabsTrigger value="paths">Paths</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>
          <TabsContent value="explore" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="show-weights" checked={showWeights} onCheckedChange={setShowWeights} />
                <Label htmlFor="show-weights">Show Weights</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="show-actors" checked={showActors} onCheckedChange={setShowActors} />
                <Label htmlFor="show-actors">Show Actors</Label>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="border rounded cursor-pointer"
              onClick={(e) => {
                // Simple click detection (in production, would use proper hit testing)
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  // Find closest node
                  const clickedNode = nodes.find(n => {
                    const nx = (n.x || 0) * zoom + 400;
                    const ny = (n.y || 0) * zoom + 300;
                    return Math.abs(nx - x) < 20 && Math.abs(ny - y) < 20;
                  });
                  if (clickedNode) {
                    setSelectedNode(clickedNode.id);
                    onNodeClick?.(clickedNode.id);
                  }
                }
              }}
            />
            {selectedNode && (
              <Card>
                <CardHeader>
                  <CardTitle>Node Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const node = nodes.find(n => n.id === selectedNode);
                    return node ? (
                      <div className="space-y-2">
                        <div><strong>Type:</strong> {node.type}</div>
                        <div><strong>Trust Score:</strong> {node.trust_score.toFixed(2)}</div>
                        <div><strong>Decisiveness:</strong> {(node.decisiveness * 100).toFixed(1)}%</div>
                        <div><strong>Content:</strong> {node.content.substring(0, 200)}</div>
                      </div>
                    ) : null;
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="paths">
            <div className="text-sm text-muted-foreground">Path analysis view</div>
          </TabsContent>
          <TabsContent value="compare">
            <div className="text-sm text-muted-foreground">Graph comparison view</div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
