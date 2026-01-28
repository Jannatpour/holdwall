/**
 * A2A Agent Discovery Component
 * 
 * Interactive agent discovery and connection UI for Agent-to-Agent Protocol
 */

"use client";

import { useState, useEffect } from "react";
import { useGraphQL } from "@/lib/graphql/client";
import { A2A_QUERIES, A2A_MUTATIONS } from "@/lib/graphql/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Search, Users, Link2, Unlink, Plus, CheckCircle, XCircle } from "@/components/demo-icons";

interface AgentProfile {
  agentId: string;
  name: string;
  version: string;
  description?: string;
  capabilities: string[];
  skills?: Array<{
    skill: string;
    proficiency: number;
    verified: boolean;
  }>;
  cost?: {
    baseCost: number;
    currency: string;
    pricingModel: string;
    tokenCost?: number;
  };
  reliability?: {
    uptime: number;
    successRate: number;
    averageLatency: number;
    lastVerified: string;
  };
  availability?: {
    status: string;
    maxConcurrentTasks: number;
    currentLoad: number;
  };
  metadata?: {
    author?: string;
    tags?: string[];
    documentation?: string;
    license?: string;
    supportContact?: string;
  };
}

interface Agent {
  id?: string;
  agentId?: string;
  name?: string;
  capabilities: string[];
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  metadata?: Record<string, unknown>;
  profile?: AgentProfile;
  registeredAt?: string;
  [key: string]: any; // Allow additional properties from GraphQL
}

interface AgentConnection {
  connectionId: string;
  fromAgentId: string;
  toAgentId: string;
  status: "CONNECTED" | "DISCONNECTED" | "PENDING";
  lastMessageAt?: string;
  messageCount: number;
}

export function A2ADiscovery({ agentId }: { agentId: string }) {
  const { query, mutate, isAuthenticated } = useGraphQL();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<AgentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Form state
  const [agentName, setAgentName] = useState("");
  const [capabilities, setCapabilities] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
      loadConnections();
    }
  }, [isAuthenticated]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const result = await query<{ agents: { edges: Array<{ node: Agent }> } }>({
        query: A2A_QUERIES.DISCOVER_AGENTS,
        variables: {
          filters: searchQuery ? { search: searchQuery } : {},
          pagination: { limit: 50 },
        },
      });

      if (result?.agents?.edges) {
        setAgents(result.agents.edges.map((e) => e.node as Agent));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  const loadConnections = async () => {
    try {
      const result = await query<{ agentConnections: AgentConnection[] }>({
        query: A2A_QUERIES.GET_AGENT_CONNECTIONS,
        variables: { agentId },
      });

      if (result?.agentConnections) {
        setConnections(result.agentConnections);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load connections");
    }
  };

  const handleRegisterAgent = async () => {
    if (!agentName.trim()) {
      toast.error("Please enter an agent name");
      return;
    }

    try {
      const result = await mutate<{ registerAgent: Agent }>({
        query: A2A_MUTATIONS.REGISTER_AGENT,
        variables: {
          input: {
            agentId,
            name: agentName,
            capabilities: capabilities.split(",").map((c) => c.trim()).filter(Boolean),
            metadata: {},
          },
        },
      });

      if (result?.registerAgent) {
        toast.success("Agent registered successfully");
        setRegisterDialogOpen(false);
        setAgentName("");
        setCapabilities("");
        await loadAgents();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to register agent");
    }
  };

  const handleConnect = async (toAgentId: string) => {
    try {
      const result = await mutate<{ connectAgents: AgentConnection }>({
        query: A2A_MUTATIONS.CONNECT_AGENTS,
        variables: {
          fromAgentId: agentId,
          toAgentId,
        },
      });

      if (result?.connectAgents) {
        toast.success("Connected to agent successfully");
        setConnectDialogOpen(false);
        setSelectedAgentId(null);
        await loadConnections();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect to agent");
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await mutate({
        query: A2A_MUTATIONS.DISCONNECT_AGENTS,
        variables: { connectionId },
      });

      toast.success("Disconnected from agent successfully");
      await loadConnections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect from agent");
    }
  };

  const getStatusBadge = (status: Agent["status"]) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      ONLINE: "default",
      OFFLINE: "secondary",
      DEGRADED: "destructive",
    };

    const icons = {
      ONLINE: CheckCircle,
      OFFLINE: XCircle,
      DEGRADED: XCircle,
    };

    const Icon = icons[status] || XCircle;

    return (
      <Badge variant={variants[status] || "secondary"}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const filteredAgents = agents.filter((agent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const agentId = agent.id || agent.agentId || "";
    return (
      agentId.toLowerCase().includes(query) ||
      agent.name?.toLowerCase().includes(query) ||
      agent.capabilities.some((c) => c.toLowerCase().includes(query)) ||
      agent.profile?.skills?.some((s) => s.skill.toLowerCase().includes(query))
    );
  });

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
      {/* Agent Discovery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Agent Discovery
              </CardTitle>
              <CardDescription>Discover and connect to other agents</CardDescription>
            </div>
            <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Register Agent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register Agent</DialogTitle>
                  <DialogDescription>
                    Register this agent in the discovery network
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Agent Name</Label>
                    <Input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="My Agent"
                    />
                  </div>
                  <div>
                    <Label>Capabilities (comma-separated)</Label>
                    <Textarea
                      value={capabilities}
                      onChange={(e) => setCapabilities(e.target.value)}
                      placeholder="search, analyze, generate"
                    />
                  </div>
                  <Button onClick={handleRegisterAgent} className="w-full">
                    Register
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents by ID, name, or capabilities..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadAgents();
                }}
                className="pl-10"
              />
            </div>
          </div>

          {filteredAgents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => {
                  const agentId = agent.id || agent.agentId || "";
                  const isConnected = connections.some(
                    (c) => c.toAgentId === agentId && c.status === "CONNECTED"
                  );

                  return (
                    <TableRow key={agentId}>
                      <TableCell className="font-mono text-sm">{agentId}</TableCell>
                      <TableCell>{agent.name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.slice(0, 3).map((cap) => (
                            <Badge key={cap} variant="outline" className="text-xs">
                              {cap}
                            </Badge>
                          ))}
                          {agent.capabilities.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{agent.capabilities.length - 3}
                            </Badge>
                          )}
                        </div>
                        {agent.profile && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {agent.profile.cost && (
                              <span>
                                ${agent.profile.cost.baseCost.toFixed(4)}/{agent.profile.cost.pricingModel.replace("_", "-")}
                              </span>
                            )}
                            {agent.profile.reliability && (
                              <span className="ml-2">
                                {Math.round(agent.profile.reliability.uptime * 100)}% uptime
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(agent.status)}</TableCell>
                      <TableCell>
                        {!isConnected && agentId !== agentId ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAgentId(agentId);
                              setConnectDialogOpen(true);
                            }}
                          >
                            <Link2 className="h-4 w-4 mr-2" />
                            Connect
                          </Button>
                        ) : isConnected ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Connected
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No agents found. Register an agent to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle>Active Connections</CardTitle>
          <CardDescription>Manage your agent connections</CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Last Message</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <TableRow key={connection.connectionId}>
                    <TableCell className="font-mono text-sm">{connection.toAgentId}</TableCell>
                    <TableCell>
                      <Badge variant={connection.status === "CONNECTED" ? "default" : "secondary"}>
                        {connection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{connection.messageCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {connection.lastMessageAt
                        ? new Date(connection.lastMessageAt).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {connection.status === "CONNECTED" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDisconnect(connection.connectionId)}
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No active connections
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to connect to this agent?
            </DialogDescription>
          </DialogHeader>
          {selectedAgentId && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">Agent ID: {selectedAgentId}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleConnect(selectedAgentId)}
                  className="flex-1"
                >
                  Connect
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConnectDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
