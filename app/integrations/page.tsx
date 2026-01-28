"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Key, Trash2, CheckCircle2, XCircle, AlertTriangle, Settings, Play, RefreshCw } from "@/components/demo-icons";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/lib/logging/logger";

interface MCPTool {
  name: string;
  version: string;
  description: string;
  permissions: string[];
  lastRun?: string;
  rateLimit?: string;
  reliabilityScore?: number;
  totalExecutions?: number;
  successRate?: number;
  avgExecutionTimeMs?: number;
}

interface Connector {
  id: string;
  type: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR" | "SYNCING";
  enabled: boolean;
  lastSync?: string;
  lastError?: string;
  errorCount?: number;
  schedule?: string;
  lastRun?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    itemsProcessed: number;
    itemsCreated: number;
    itemsFailed: number;
    error?: string;
  };
}

interface APIKey {
  id: string;
  name: string;
  service: string;
  maskedKey: string;
  createdAt: string;
  lastUsed?: string;
  apiKey?: string; // Only on creation
}

export default function IntegrationsPage() {
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyService, setNewKeyService] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [connectorDialogOpen, setConnectorDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [newConnectorType, setNewConnectorType] = useState("");
  const [newConnectorName, setNewConnectorName] = useState("");
  const [newConnectorConfig, setNewConnectorConfig] = useState("");
  const [syncingConnector, setSyncingConnector] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [toolsRes, connectorsRes, keysRes] = await Promise.all([
        fetch("/api/integrations/mcp-tools"),
        fetch("/api/integrations/connectors"),
        fetch("/api/integrations/api-keys"),
      ]);

      if (toolsRes.ok) {
        const toolsData = await toolsRes.json();
        setMcpTools(toolsData.tools || []);
      }

      if (connectorsRes.ok) {
        const connectorsData = await connectorsRes.json();
        // Map API response to UI format
        setConnectors((connectorsData.connectors || []).map((c: any) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          status: c.status === "ACTIVE" ? "connected" : c.status === "ERROR" ? "error" : "disconnected",
          enabled: c.enabled,
          lastSync: c.lastSync,
          lastError: c.lastError,
          errorCount: c.errorCount,
          schedule: c.schedule,
          lastRun: c.lastRun,
        })));
      }

      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAPIKey() {
    if (!newKeyName || !newKeyService || !newKeyValue) {
      toast.error("Please provide name, service, and key value");
      return;
    }

    try {
      const response = await fetch("/api/integrations/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          service: newKeyService,
          key: newKeyValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to create API key" }));
        throw new Error(error.error || "Failed to create API key");
      }

      const data = await response.json();
      toast.success("API key created", {
        description: data.key?.apiKey ? `Key: ${data.key.apiKey.substring(0, 8)}...` : "Save this key - it won't be shown again",
      });
      setKeyDialogOpen(false);
      setNewKeyName("");
      setNewKeyService("");
      setNewKeyValue("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create API key");
    }
  }

  async function handleSyncConnector(connectorId: string) {
    setSyncingConnector(connectorId);
    try {
      const response = await fetch(`/api/integrations/${connectorId}/sync`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to sync connector");
      }

      toast.success("Connector sync started");
      // Reload after a delay to see updated status
      setTimeout(() => {
        loadData();
        setSyncingConnector(null);
      }, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync connector");
      setSyncingConnector(null);
    }
  }

  async function handleCreateConnector() {
    if (!newConnectorType || !newConnectorName) {
      toast.error("Please provide connector type and name");
      return;
    }

    let config: Record<string, unknown> = {};
    try {
      if (newConnectorConfig) {
        config = JSON.parse(newConnectorConfig);
      }
    } catch {
      toast.error("Invalid JSON configuration");
      return;
    }

    try {
      const response = await fetch("/api/integrations/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newConnectorType,
          name: newConnectorName,
          config,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to create connector" }));
        throw new Error(error.error || "Failed to create connector");
      }

      toast.success("Connector created");
      setConnectorDialogOpen(false);
      setNewConnectorType("");
      setNewConnectorName("");
      setNewConnectorConfig("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create connector");
    }
  }

  function openConnectorConfig(connector: Connector) {
    setSelectedConnector(connector);
    setConnectorDialogOpen(true);
  }

  async function handleDeleteAPIKey(keyId: string) {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const response = await fetch(`/api/integrations/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }

      toast.success("API key deleted");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete API key");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Integrations Registry</h1>
          <p className="text-muted-foreground">
            Manage MCP tools, connectors, and API keys
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="mcp-tools" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mcp-tools">MCP Tools</TabsTrigger>
            <TabsTrigger value="connectors">Connectors</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="agents">Agents (A2A)</TabsTrigger>
            <TabsTrigger value="networks">Networks (ANP)</TabsTrigger>
            <TabsTrigger value="payments">Payments (AP2)</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="mcp-tools" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>MCP Tool Registry</CardTitle>
                <CardDescription>
                  Model Context Protocol tools available for agent orchestration
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">Loading tools...</div>
                ) : mcpTools.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No MCP tools registered</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tool Name</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Reliability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mcpTools.map((tool) => (
                        <TableRow key={`${tool.name}-${tool.version}`}>
                          <TableCell className="font-medium">{tool.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{tool.version}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tool.description}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {tool.permissions.map((perm) => (
                                <Badge key={perm} variant="secondary" className="text-xs">
                                  {perm}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tool.lastRun ? new Date(tool.lastRun).toLocaleDateString() : "Never"}
                            {tool.totalExecutions !== undefined && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {tool.totalExecutions} executions
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {tool.reliabilityScore !== undefined ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {Math.round(tool.reliabilityScore * 100)}%
                                </span>
                                {tool.reliabilityScore >= 0.9 ? (
                                  <CheckCircle2 className="size-4 text-green-600" />
                                ) : tool.reliabilityScore >= 0.7 ? (
                                  <AlertTriangle className="size-4 text-orange-600" />
                                ) : (
                                  <XCircle className="size-4 text-destructive" />
                                )}
                                {tool.avgExecutionTimeMs !== undefined && (
                                  <div className="text-xs text-muted-foreground ml-2">
                                    {tool.avgExecutionTimeMs}ms avg
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connectors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Connectors</CardTitle>
                    <CardDescription>
                      External service connectors and their status
                    </CardDescription>
                  </div>
                  <Dialog open={connectorDialogOpen && !selectedConnector} onOpenChange={setConnectorDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 size-4" />
                        Add Connector
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create Connector</DialogTitle>
                        <DialogDescription>
                          Configure a new data source connector
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="connector-type">Connector Type</Label>
                          <Select value={newConnectorType} onValueChange={(value) => {
                            setNewConnectorType(value);
                            setNewConnectorConfig(""); // Reset config when type changes
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select connector type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rss">RSS/Atom Feed</SelectItem>
                              <SelectItem value="github">GitHub</SelectItem>
                              <SelectItem value="s3">S3/Object Storage</SelectItem>
                              <SelectItem value="webhook">Webhook/Custom API</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="connector-name">Name</Label>
                          <Input
                            id="connector-name"
                            value={newConnectorName}
                            onChange={(e) => setNewConnectorName(e.target.value)}
                            placeholder="e.g., Tech News RSS"
                          />
                        </div>
                        
                        {/* Type-specific configuration fields */}
                        {newConnectorType === "rss" && (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="space-y-2">
                              <Label htmlFor="rss-url">Feed URL *</Label>
                              <Input
                                id="rss-url"
                                placeholder="https://example.com/feed.xml"
                                onChange={(e) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.url = e.target.value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ url: e.target.value }, null, 2));
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rss-retention">Retention Policy</Label>
                              <Input
                                id="rss-retention"
                                placeholder="90 days"
                                defaultValue="90 days"
                                onChange={(e) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.retentionPolicy = e.target.value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ retentionPolicy: e.target.value }, null, 2));
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {newConnectorType === "github" && (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="space-y-2">
                              <Label htmlFor="github-owner">Repository Owner *</Label>
                              <Input
                                id="github-owner"
                                placeholder="octocat"
                                onChange={(e) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.owner = e.target.value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ owner: e.target.value }, null, 2));
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="github-repo">Repository Name *</Label>
                              <Input
                                id="github-repo"
                                placeholder="Hello-World"
                                onChange={(e) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.repo = e.target.value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ repo: e.target.value }, null, 2));
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="github-types">Content Types</Label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    onChange={(e) => {
                                      try {
                                        const config = JSON.parse(newConnectorConfig || "{}");
                                        config.types = config.types || [];
                                        if (e.target.checked) {
                                          if (!config.types.includes("issues")) config.types.push("issues");
                                        } else {
                                          config.types = config.types.filter((t: string) => t !== "issues");
                                        }
                                        setNewConnectorConfig(JSON.stringify(config, null, 2));
                                      } catch {
                                        setNewConnectorConfig(JSON.stringify({ types: e.target.checked ? ["issues"] : [] }, null, 2));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">Issues</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    onChange={(e) => {
                                      try {
                                        const config = JSON.parse(newConnectorConfig || "{}");
                                        config.types = config.types || [];
                                        if (e.target.checked) {
                                          if (!config.types.includes("pull_requests")) config.types.push("pull_requests");
                                        } else {
                                          config.types = config.types.filter((t: string) => t !== "pull_requests");
                                        }
                                        setNewConnectorConfig(JSON.stringify(config, null, 2));
                                      } catch {
                                        setNewConnectorConfig(JSON.stringify({ types: e.target.checked ? ["pull_requests"] : [] }, null, 2));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">Pull Requests</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {newConnectorType === "s3" && (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="space-y-2">
                              <Label htmlFor="s3-provider">Storage Provider *</Label>
                              <Select
                                onValueChange={(value) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.provider = value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ provider: value }, null, 2));
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="s3">AWS S3</SelectItem>
                                  <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                                  <SelectItem value="azure">Azure Blob Storage</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="s3-bucket">Bucket Name *</Label>
                              <Input
                                id="s3-bucket"
                                placeholder="my-bucket"
                                onChange={(e) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.bucket = e.target.value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ bucket: e.target.value }, null, 2));
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="s3-prefix">Path Prefix</Label>
                              <Input
                                id="s3-prefix"
                                placeholder="documents/"
                                onChange={(e) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.prefix = e.target.value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ prefix: e.target.value }, null, 2));
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {newConnectorType === "webhook" && (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="space-y-2">
                              <Label htmlFor="webhook-url">API Endpoint URL *</Label>
                              <Input
                                id="webhook-url"
                                placeholder="https://api.example.com/data"
                                onChange={(e) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.url = e.target.value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ url: e.target.value }, null, 2));
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="webhook-method">HTTP Method</Label>
                              <Select
                                defaultValue="GET"
                                onValueChange={(value) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.method = value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ method: value }, null, 2));
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GET">GET</SelectItem>
                                  <SelectItem value="POST">POST</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="webhook-format">Response Format</Label>
                              <Select
                                defaultValue="json"
                                onValueChange={(value) => {
                                  try {
                                    const config = JSON.parse(newConnectorConfig || "{}");
                                    config.format = value;
                                    setNewConnectorConfig(JSON.stringify(config, null, 2));
                                  } catch {
                                    setNewConnectorConfig(JSON.stringify({ format: value }, null, 2));
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="json">JSON</SelectItem>
                                  <SelectItem value="xml">XML</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {/* Fallback to JSON editor for advanced configuration */}
                        {newConnectorType && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="connector-config">Advanced Configuration (JSON)</Label>
                              <span className="text-xs text-muted-foreground">Optional</span>
                            </div>
                            <Textarea
                              id="connector-config"
                              value={newConnectorConfig}
                              onChange={(e) => setNewConnectorConfig(e.target.value)}
                              placeholder='{"additional": "config"}'
                              rows={4}
                              className="font-mono text-sm"
                            />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setConnectorDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateConnector}>
                          <Plus className="mr-2 size-4" />
                          Create Connector
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">Loading connectors...</div>
                ) : connectors.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No connectors configured</div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {connectors.map((connector) => (
                      <Card key={connector.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{connector.name}</CardTitle>
                            <Badge
                              variant={
                                connector.status === "ACTIVE"
                                  ? "default"
                                  : connector.status === "ERROR"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {connector.status === "ACTIVE" ? "Active" : 
                               connector.status === "ERROR" ? "Error" :
                               connector.status === "SYNCING" ? "Syncing" :
                               connector.status === "INACTIVE" ? "Inactive" :
                               connector.status}
                            </Badge>
                          </div>
                          <CardDescription>{connector.type}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {connector.lastSync && (
                            <div className="text-sm text-muted-foreground mb-2">
                              Last sync: {new Date(connector.lastSync).toLocaleString()}
                            </div>
                          )}
                          {connector.lastRun && (
                            <div className="text-sm text-muted-foreground mb-2">
                              Last run: {connector.lastRun.itemsProcessed} processed, {connector.lastRun.itemsCreated} created
                            </div>
                          )}
                          {connector.lastError && (
                            <div className="text-sm text-destructive mb-2">
                              Error: {connector.lastError.substring(0, 50)}...
                            </div>
                          )}
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => openConnectorConfig(connector)}
                            >
                              <Settings className="mr-2 size-4" />
                              Configure
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSyncConnector(connector.id)}
                              disabled={syncingConnector === connector.id || !connector.enabled}
                            >
                              {syncingConnector === connector.id ? (
                                <RefreshCw className="size-4 animate-spin" />
                              ) : (
                                <Play className="size-4" />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Manage API keys for external service integrations
                    </CardDescription>
                  </div>
                  <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 size-4" />
                        Add API Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create API Key</DialogTitle>
                        <DialogDescription>
                          Add a new API key for external service integration
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="key-name">Key Name</Label>
                          <Input
                            id="key-name"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="e.g., OpenAI Production Key"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="key-service">Service</Label>
                          <Input
                            id="key-service"
                            value={newKeyService}
                            onChange={(e) => setNewKeyService(e.target.value)}
                            placeholder="e.g., openai, anthropic, google"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="key-value">API Key Value</Label>
                          <Input
                            id="key-value"
                            type="password"
                            value={newKeyValue}
                            onChange={(e) => setNewKeyValue(e.target.value)}
                            placeholder="Enter the API key"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateAPIKey}>
                          <Key className="mr-2 size-4" />
                          Create Key
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">Loading API keys...</div>
                ) : apiKeys.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No API keys configured</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Key</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">{key.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{key.service}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {key.maskedKey}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(key.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : "Never"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAPIKey(key.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <AgentsManagementTab />
          </TabsContent>

          <TabsContent value="networks" className="space-y-4">
            <NetworksManagementTab />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <PaymentsManagementTab />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <SecurityManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// Agents (A2A) Management Component
function AgentsManagementTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    agentId: "",
    name: "",
    version: "",
    capabilities: [] as string[],
    endpoint: "",
    publicKey: "",
  });

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      const res = await fetch("/api/a2a/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterAgentId: "system",
          maxResults: 100,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      logger.error("Failed to load agents", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterAgent() {
    try {
      const res = await fetch("/api/a2a/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgent),
      });
      if (res.ok) {
        toast.success("Agent registered successfully");
        setRegisterDialogOpen(false);
        setNewAgent({ agentId: "", name: "", version: "", capabilities: [], endpoint: "", publicKey: "" });
        loadAgents();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to register agent");
      }
    } catch (error) {
      toast.error("Failed to register agent");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>A2A Agent Registry</CardTitle>
            <CardDescription>
              Register and discover agents for direct agent-to-agent communication
            </CardDescription>
          </div>
          <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                Register Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Register New Agent</DialogTitle>
                <DialogDescription>
                  Register an agent in the A2A network for discovery and communication
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Agent ID</Label>
                  <Input
                    value={newAgent.agentId}
                    onChange={(e) => setNewAgent({ ...newAgent, agentId: e.target.value })}
                    placeholder="agent-001"
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="Agent Name"
                  />
                </div>
                <div>
                  <Label>Version</Label>
                  <Input
                    value={newAgent.version}
                    onChange={(e) => setNewAgent({ ...newAgent, version: e.target.value })}
                    placeholder="1.0.0"
                  />
                </div>
                <div>
                  <Label>Endpoint</Label>
                  <Input
                    value={newAgent.endpoint}
                    onChange={(e) => setNewAgent({ ...newAgent, endpoint: e.target.value })}
                    placeholder="https://agent.example.com"
                  />
                </div>
                <div>
                  <Label>Public Key</Label>
                  <Textarea
                    value={newAgent.publicKey}
                    onChange={(e) => setNewAgent({ ...newAgent, publicKey: e.target.value })}
                    placeholder="-----BEGIN PUBLIC KEY-----..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRegisterAgent}>Register</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No agents registered</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Endpoint</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.agentId}>
                  <TableCell className="font-medium">{agent.agentId}</TableCell>
                  <TableCell>{agent.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{agent.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(agent.capabilities || []).slice(0, 3).map((cap: string) => (
                        <Badge key={cap} variant="secondary" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                      {(agent.capabilities || []).length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(agent.capabilities || []).length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{agent.endpoint}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Networks (ANP) Management Component
function NetworksManagementTab() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newNetwork, setNewNetwork] = useState({
    networkId: "",
    name: "",
    description: "",
    topology: "mesh" as "mesh" | "star" | "hierarchical" | "ring",
    agents: [] as string[],
  });

  useEffect(() => {
    loadNetworks();
  }, []);

  async function loadNetworks() {
    setLoading(true);
    try {
      const res = await fetch("/api/anp/networks");
      if (res.ok) {
        const data = await res.json();
        setNetworks(data.networks || []);
      }
    } catch (error) {
      logger.error("Failed to load networks", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNetwork() {
    try {
      const res = await fetch("/api/anp/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNetwork),
      });
      if (res.ok) {
        toast.success("Network created successfully");
        setCreateDialogOpen(false);
        setNewNetwork({ networkId: "", name: "", description: "", topology: "mesh", agents: [] });
        loadNetworks();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create network");
      }
    } catch (error) {
      toast.error("Failed to create network");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>ANP Networks</CardTitle>
            <CardDescription>
              Manage agent networks with health monitoring and intelligent routing
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                Create Network
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Agent Network</DialogTitle>
                <DialogDescription>
                  Create a new agent network for coordinated multi-agent operations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Network ID</Label>
                  <Input
                    value={newNetwork.networkId}
                    onChange={(e) => setNewNetwork({ ...newNetwork, networkId: e.target.value })}
                    placeholder="network-001"
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={newNetwork.name}
                    onChange={(e) => setNewNetwork({ ...newNetwork, name: e.target.value })}
                    placeholder="Network Name"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newNetwork.description}
                    onChange={(e) => setNewNetwork({ ...newNetwork, description: e.target.value })}
                    placeholder="Network description"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Topology</Label>
                  <Select
                    value={newNetwork.topology}
                    onValueChange={(value: any) => setNewNetwork({ ...newNetwork, topology: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mesh">Mesh</SelectItem>
                      <SelectItem value="star">Star</SelectItem>
                      <SelectItem value="hierarchical">Hierarchical</SelectItem>
                      <SelectItem value="ring">Ring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateNetwork}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading networks...</div>
        ) : networks.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No networks created</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Network ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Topology</TableHead>
                <TableHead>Agents</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {networks.map((network) => (
                <TableRow key={network.networkId}>
                  <TableCell className="font-medium">{network.networkId}</TableCell>
                  <TableCell>{network.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{network.topology}</Badge>
                  </TableCell>
                  <TableCell>{(network.agents || []).length} agents</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const res = await fetch(
                          `/api/anp/networks?action=health&networkId=${network.networkId}`
                        );
                        if (res.ok) {
                          const health = await res.json();
                          toast.success(
                            `Network health: ${health.overallHealth} (${health.healthyAgents}/${health.agentCount} healthy)`
                          );
                        }
                      }}
                    >
                      <Settings className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Payments (AP2) Management Component
function PaymentsManagementTab() {
  const [mandates, setMandates] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"mandates" | "wallets" | "audit">("mandates");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load mandates and wallets
      // In a real implementation, these would be separate API calls
      setMandates([]);
      setWallets([]);
    } catch (error) {
      logger.error("Failed to load payment data", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AP2 Payment Protocol</CardTitle>
        <CardDescription>
          Manage payment mandates, wallets, and audit logs for autonomous agent transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="mandates">Mandates</TabsTrigger>
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>
          <TabsContent value="mandates" className="space-y-4">
            <div className="text-center text-muted-foreground py-8">
              Payment mandates management - Use API endpoints for full functionality
            </div>
          </TabsContent>
          <TabsContent value="wallets" className="space-y-4">
            <div className="text-center text-muted-foreground py-8">
              Wallet management - Use API endpoints for full functionality
            </div>
          </TabsContent>
          <TabsContent value="audit" className="space-y-4">
            <div className="text-center text-muted-foreground py-8">
              Audit logs - Use API endpoints for full functionality
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Security Management Component
function SecurityManagementTab() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [newIdentity, setNewIdentity] = useState({
    agentId: "",
    publicKey: "",
    certificate: "",
    oidcToken: "",
  });

  useEffect(() => {
    loadIdentities();
  }, []);

  async function loadIdentities() {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from the security API
      setIdentities([]);
    } catch (error) {
      logger.error("Failed to load identities", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterIdentity() {
    try {
      const res = await fetch("/api/security/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          ...newIdentity,
        }),
      });
      if (res.ok) {
        toast.success("Identity registered successfully");
        setRegisterDialogOpen(false);
        setNewIdentity({ agentId: "", publicKey: "", certificate: "", oidcToken: "" });
        loadIdentities();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to register identity");
      }
    } catch (error) {
      toast.error("Failed to register identity");
    }
  }

  async function handleGenerateKeyPair(agentId: string) {
    try {
      const res = await fetch("/api/security/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_keypair",
          agentId,
          algorithm: "RSA",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Key pair generated successfully");
        setNewIdentity({ ...newIdentity, publicKey: data.publicKey });
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to generate key pair");
      }
    } catch (error) {
      toast.error("Failed to generate key pair");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Protocol Security</CardTitle>
            <CardDescription>
              Manage agent identities, key pairs, and security credentials
            </CardDescription>
          </div>
          <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Key className="size-4 mr-2" />
                Register Identity
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Register Agent Identity</DialogTitle>
                <DialogDescription>
                  Register an agent identity with security credentials for protocol access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Agent ID</Label>
                  <Input
                    value={newIdentity.agentId}
                    onChange={(e) => setNewIdentity({ ...newIdentity, agentId: e.target.value })}
                    placeholder="agent-001"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Public Key</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateKeyPair(newIdentity.agentId)}
                      disabled={!newIdentity.agentId}
                    >
                      <Key className="size-3 mr-1" />
                      Generate
                    </Button>
                  </div>
                  <Textarea
                    value={newIdentity.publicKey}
                    onChange={(e) => setNewIdentity({ ...newIdentity, publicKey: e.target.value })}
                    placeholder="-----BEGIN PUBLIC KEY-----..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label>mTLS Certificate (Optional)</Label>
                  <Textarea
                    value={newIdentity.certificate}
                    onChange={(e) => setNewIdentity({ ...newIdentity, certificate: e.target.value })}
                    placeholder="-----BEGIN CERTIFICATE-----..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>OIDC Token (Optional)</Label>
                  <Input
                    value={newIdentity.oidcToken}
                    onChange={(e) => setNewIdentity({ ...newIdentity, oidcToken: e.target.value })}
                    placeholder="OIDC token for identity verification"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRegisterIdentity}>Register</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading identities...</div>
        ) : identities.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No identities registered. Register an identity to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent ID</TableHead>
                <TableHead>Identity Verified</TableHead>
                <TableHead>mTLS Verified</TableHead>
                <TableHead>OIDC Verified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {identities.map((identity) => (
                <TableRow key={identity.agentId}>
                  <TableCell className="font-medium">{identity.agentId}</TableCell>
                  <TableCell>
                    {identity.identityVerified ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    {identity.mTLSVerified ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    {identity.oidcVerified ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Settings className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
