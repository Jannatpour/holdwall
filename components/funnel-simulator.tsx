/**
 * Funnel Simulator Component
 * 
 * Simulates what buyer sees at each funnel stage
 * Shows AI answer preview and artifact placements
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, FileText, CheckCircle2 } from "lucide-react";

export interface FunnelStage {
  id: string;
  name: string;
  artifacts: Array<{
    id: string;
    title: string;
    type: string;
  }>;
}

export interface FunnelSimulation {
  persona: string;
  stages: FunnelStage[];
  ai_answer_preview: string;
}

interface FunnelSimulatorProps {
  persona?: string;
}

export function FunnelSimulator({ persona: initialPersona }: FunnelSimulatorProps) {
  const [persona, setPersona] = React.useState(initialPersona || "buyer");
  const [simulation, setSimulation] = React.useState<FunnelSimulation | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    loadSimulation();
  }, [persona]);

  const loadSimulation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/simulate/buyer-view?persona=${persona}`);
      if (response.ok) {
        const data = await response.json();
        setSimulation(data.simulation);
      }
    } catch (error) {
      console.error("Failed to load simulation:", error);
    } finally {
      setLoading(false);
    }
  };

  const stages = [
    { id: "awareness", name: "Awareness" },
    { id: "research", name: "Research" },
    { id: "comparison", name: "Comparison" },
    { id: "decision", name: "Decision" },
    { id: "post-purchase", name: "Post-purchase" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Funnel Simulator</CardTitle>
            <CardDescription>See what {persona} sees at each stage</CardDescription>
          </div>
          <Select value={persona} onValueChange={setPersona}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">Buyer</SelectItem>
              <SelectItem value="pr">PR</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="simulator">
          <TabsList>
            <TabsTrigger value="placement">Placement Plan</TabsTrigger>
            <TabsTrigger value="simulator">Simulator</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="placement" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Artifacts</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage) => {
                  const stageData = simulation?.stages.find(s => s.name === stage.name);
                  return (
                    <TableRow key={stage.id}>
                      <TableCell className="font-medium">{stage.name}</TableCell>
                      <TableCell>
                        {stageData?.artifacts.length ? (
                          <div className="flex flex-wrap gap-1">
                            {stageData.artifacts.map(a => (
                              <Badge key={a.id} variant="outline">{a.title}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {stageData?.artifacts.map(a => a.type).join(", ") || "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="simulator" className="space-y-4">
            {simulation?.ai_answer_preview && (
              <Card>
                <CardHeader>
                  <CardTitle>AI Answer Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {simulation.ai_answer_preview}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="grid gap-4">
              {stages.map((stage) => {
                const stageData = simulation?.stages.find(s => s.name === stage.name);
                return (
                  <Card key={stage.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{stage.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stageData?.artifacts.length ? (
                        <div className="space-y-2">
                          {stageData.artifacts.map(artifact => (
                            <div key={artifact.id} className="flex items-center gap-2 p-2 border rounded">
                              <FileText className="h-4 w-4" />
                              <span className="text-sm">{artifact.title}</span>
                              <Badge variant="outline" className="ml-auto">{artifact.type}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No artifacts assigned</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="metrics">
            <div className="text-sm text-muted-foreground">Funnel metrics and analytics</div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
