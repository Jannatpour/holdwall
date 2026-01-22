"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  Plus,
  X,
} from "lucide-react";

interface EscalationRule {
  id: string;
  name: string;
  condition: string;
  severity: "high" | "medium" | "low";
  routeTo: string[];
  enabled: boolean;
}

interface FinancialServicesConfig {
  enabled: boolean;
  governanceLevel: "standard" | "financial" | "regulated";
  legalApprovalRequired: boolean;
  evidenceThreshold: number;
  conservativePublishing: boolean;
  regulatoryTracking: boolean;
  escalationRules: EscalationRule[];
}

export function FinancialServicesConfigManager() {
  const [config, setConfig] = React.useState<FinancialServicesConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/financial-services/config");
      if (!response.ok) {
        throw new Error("Failed to fetch configuration");
      }
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/financial-services/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save configuration");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddEscalationRule = () => {
    if (!config) return;

    const newRule: EscalationRule = {
      id: `rule-${Date.now()}`,
      name: "New Escalation Rule",
      condition: "",
      severity: "medium",
      routeTo: [],
      enabled: true,
    };

    setConfig({
      ...config,
      escalationRules: [...config.escalationRules, newRule],
    });
  };

  const handleRemoveEscalationRule = (id: string) => {
    if (!config) return;

    setConfig({
      ...config,
      escalationRules: config.escalationRules.filter((r) => r.id !== id),
    });
  };

  const handleUpdateEscalationRule = (id: string, updates: Partial<EscalationRule>) => {
    if (!config) return;

    setConfig({
      ...config,
      escalationRules: config.escalationRules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Services Configuration</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error || "Failed to load configuration"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Financial Services Configuration
              </CardTitle>
              <CardDescription>
                Manage governance settings, approval gates, and escalation rules
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Governance Level */}
          <div className="space-y-2">
            <Label htmlFor="governance-level">Governance Level</Label>
            <Select
              value={config.governanceLevel}
              onValueChange={(value: "standard" | "financial" | "regulated") =>
                setConfig({ ...config, governanceLevel: value })
              }
            >
              <SelectTrigger id="governance-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="regulated">Regulated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Legal Approval Required */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="legal-approval">Legal Approval Required</Label>
              <div className="text-sm text-muted-foreground">
                All narrative responses require legal review before publishing
              </div>
            </div>
            <Switch
              id="legal-approval"
              checked={config.legalApprovalRequired}
              onCheckedChange={(checked) =>
                setConfig({ ...config, legalApprovalRequired: checked })
              }
            />
          </div>

          {/* Evidence Threshold */}
          <div className="space-y-2">
            <Label htmlFor="evidence-threshold">
              Evidence Threshold ({(config.evidenceThreshold * 100).toFixed(0)}%)
            </Label>
            <Input
              id="evidence-threshold"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.evidenceThreshold}
              onChange={(e) =>
                setConfig({ ...config, evidenceThreshold: parseFloat(e.target.value) })
              }
            />
            <div className="text-sm text-muted-foreground">
              Minimum evidence quality required for financial services narratives
            </div>
          </div>

          {/* Conservative Publishing */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="conservative-publishing">Conservative Publishing</Label>
              <div className="text-sm text-muted-foreground">
                Use conservative defaults for all published content
              </div>
            </div>
            <Switch
              id="conservative-publishing"
              checked={config.conservativePublishing}
              onCheckedChange={(checked) =>
                setConfig({ ...config, conservativePublishing: checked })
              }
            />
          </div>

          {/* Regulatory Tracking */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="regulatory-tracking">Regulatory Tracking</Label>
              <div className="text-sm text-muted-foreground">
                Enable complete audit trails for regulatory compliance
              </div>
            </div>
            <Switch
              id="regulatory-tracking"
              checked={config.regulatoryTracking}
              onCheckedChange={(checked) =>
                setConfig({ ...config, regulatoryTracking: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Escalation Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Escalation Rules</CardTitle>
              <CardDescription>
                Define automatic escalation rules for narrative categories
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddEscalationRule}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.escalationRules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) =>
                        handleUpdateEscalationRule(rule.id, { enabled: checked })
                      }
                    />
                    <Label className="font-medium">{rule.name}</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEscalationRule(rule.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Textarea
                      value={rule.condition}
                      onChange={(e) =>
                        handleUpdateEscalationRule(rule.id, { condition: e.target.value })
                      }
                      placeholder="e.g., claim includes 'fraud' + rising velocity"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select
                      value={rule.severity}
                      onValueChange={(value: "high" | "medium" | "low") =>
                        handleUpdateEscalationRule(rule.id, { severity: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Route To</Label>
                  <Input
                    value={rule.routeTo.join(", ")}
                    onChange={(e) =>
                      handleUpdateEscalationRule(rule.id, {
                        routeTo: e.target.value.split(",").map((s) => s.trim()),
                      })
                    }
                    placeholder="Risk, Legal, Security"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900 dark:text-green-100">
            Configuration Saved
          </AlertTitle>
          <AlertDescription className="text-green-800 dark:text-green-200">
            Financial Services configuration has been updated successfully.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
