/**
 * ANP Networks Component
 * 
 * Interactive network management UI for Agent Network Protocol
 */

"use client";

import { useState, useEffect } from "react";
import { useGraphQL } from "@/lib/graphql/client";
import { ANP_QUERIES, ANP_MUTATIONS } from "@/lib/graphql/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Network, Plus, Activity, Users, CheckCircle, XCircle } from "lucide-react";

interface AgentNetwork {
  networkId: string;
  name: string;
  description?: string;
  topology: "MESH" | "STAR" | "HIERARCHICAL" | "RING";
  agents: Array<{
    agentId: string;
    capabilities: string[];
    status: string;
  }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface NetworkHealth {
  networkId: string;
  overallStatus: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  agentHealth: Array<{
    agentId: string;
    status: "ONLINE" | "OFFLINE" | "DEGRADED";
    lastHeartbeat: string;
    latency?: number;
    errorRate?: number;
  }>;
  networkMetrics: {
    totalAgents: number;
    activeAgents: number;
    averageLatency?: number;
    messageThroughput?: number;
  };
}

export function ANPNetworks({ agentId }: { agentId: string }) {
  const { query, mutate, isAuthenticated } = useGraphQL();
  const [networks, setNetworks] = useState<AgentNetwork[]>([]);
  const [healthData, setHealthData] = useState<Record<string, NetworkHealth>>({});
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);

  // Form state
  const [networkName, setNetworkName] = useState("");
  const [networkDescription, setNetworkDescription] = useState("");
  const [topology, setTopology] = useState<"MESH" | "STAR" | "HIERARCHICAL" | "RING">("MESH");

  useEffect(() => {
    if (isAuthenticated) {
      loadNetworks();
    }
  }, [isAuthenticated]);

  const loadNetworks = async () => {
    setLoading(true);
    try {
      const result = await query<{ networks: { edges: Array<{ node: AgentNetwork }> } }>({
        query: ANP_QUERIES.GET_NETWORKS,
        variables: {
          filters: {},
          pagination: { limit: 50 },
        },
      });

      if (result?.networks?.edges) {
        setNetworks(result.networks.edges.map((e) => e.node));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load networks");
    } finally {
      setLoading(false);
    }
  };

  const loadNetworkHealth = async (networkId: string) => {
    try {
      const result = await query<{ networkHealth: NetworkHealth }>({
        query: ANP_QUERIES.GET_NETWORK_HEALTH,
        variables: { networkId },
      });

      if (result?.networkHealth) {
        setHealthData((prev) => ({ ...prev, [networkId]: result.networkHealth }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load network health");
    }
  };

  const handleCreateNetwork = async () => {
    if (!networkName.trim()) {
      toast.error("Please enter a network name");
      return;
    }

    try {
      const result = await mutate<{ createNetwork: AgentNetwork }>({
        query: ANP_MUTATIONS.CREATE_NETWORK,
        variables: {
          input: {
            name: networkName,
            description: networkDescription || undefined,
            topology,
            metadata: {},
          },
        },
      });

      if (result?.createNetwork) {
        toast.success("Network created successfully");
        setCreateDialogOpen(false);
        setNetworkName("");
        setNetworkDescription("");
        await loadNetworks();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create network");
    }
  };

  const handleJoinNetwork = async (networkId: string) => {
    try {
      await mutate({
        query: ANP_MUTATIONS.JOIN_NETWORK,
        variables: { networkId, agentId },
      });

      toast.success("Joined network successfully");
      await loadNetworks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join network");
    }
  };

  const handleLeaveNetwork = async (networkId: string) => {
    try {
      await mutate({
        query: ANP_MUTATIONS.LEAVE_NETWORK,
        variables: { networkId, agentId },
      });

      toast.success("Left network successfully");
      await loadNetworks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave network");
    }
  };

  const getStatusBadge = (status: NetworkHealth["overallStatus"]) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      HEALTHY: "default",
      DEGRADED: "secondary",
      UNHEALTHY: "destructive",
    };

    const icons = {
      HEALTHY: CheckCircle,
      DEGRADED: Activity,
      UNHEALTHY: XCircle,
    };

    const Icon = icons[status] || Activity;

    return (
      <Badge variant={variants[status] || "secondary"}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Agent Networks
              </CardTitle>
              <CardDescription>Manage agent networks and monitor health</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Network
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Agent Network</DialogTitle>
                  <DialogDescription>
                    Create a new network for agent collaboration
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Network Name</Label>
                    <Input
                      value={networkName}
                      onChange={(e) => setNetworkName(e.target.value)}
                      placeholder="My Network"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={networkDescription}
                      onChange={(e) => setNetworkDescription(e.target.value)}
                      placeholder="Network description..."
                    />
                  </div>
                  <div>
                    <Label>Topology</Label>
                    <Select value={topology} onValueChange={(v) => setTopology(v as typeof topology)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MESH">Mesh</SelectItem>
                        <SelectItem value="STAR">Star</SelectItem>
                        <SelectItem value="HIERARCHICAL">Hierarchical</SelectItem>
                        <SelectItem value="RING">Ring</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateNetwork} className="w-full">
                    Create Network
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {networks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Network</TableHead>
                  <TableHead>Topology</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {networks.map((network) => {
                  const health = healthData[network.networkId];
                  const isMember = network.agents.some((a) => a.agentId === agentId);

                  return (
                    <TableRow key={network.networkId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{network.name}</div>
                          {network.description && (
                            <div className="text-sm text-muted-foreground">{network.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{network.topology}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {network.agents.length}
                        </div>
                      </TableCell>
                      <TableCell>
                        {health ? (
                          getStatusBadge(health.overallStatus)
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedNetworkId(network.networkId);
                              loadNetworkHealth(network.networkId);
                              setHealthDialogOpen(true);
                            }}
                          >
                            Check Health
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(network.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!isMember ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleJoinNetwork(network.networkId)}
                            >
                              Join
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleLeaveNetwork(network.networkId)}
                            >
                              Leave
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedNetworkId(network.networkId);
                              loadNetworkHealth(network.networkId);
                              setHealthDialogOpen(true);
                            }}
                          >
                            <Activity className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No networks yet. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Dialog */}
      <Dialog open={healthDialogOpen} onOpenChange={setHealthDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Network Health</DialogTitle>
            <DialogDescription>
              Real-time health monitoring for agent network
            </DialogDescription>
          </DialogHeader>
          {selectedNetworkId && healthData[selectedNetworkId] && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Overall Status</div>
                  <div className="mt-1">{getStatusBadge(healthData[selectedNetworkId].overallStatus)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Active Agents</div>
                  <div className="text-lg font-semibold">
                    {healthData[selectedNetworkId].networkMetrics.activeAgents} / {healthData[selectedNetworkId].networkMetrics.totalAgents}
                  </div>
                </div>
              </div>

              {healthData[selectedNetworkId].networkMetrics.averageLatency && (
                <div>
                  <div className="text-sm text-muted-foreground">Average Latency</div>
                  <div className="text-lg font-semibold">
                    {healthData[selectedNetworkId].networkMetrics.averageLatency}ms
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-2">Agent Health</div>
                <div className="space-y-2">
                  {healthData[selectedNetworkId].agentHealth.map((agent) => (
                    <div key={agent.agentId} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium text-sm">{agent.agentId}</div>
                        <div className="text-xs text-muted-foreground">
                          Last heartbeat: {new Date(agent.lastHeartbeat).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant={agent.status === "ONLINE" ? "default" : "secondary"}>
                        {agent.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
