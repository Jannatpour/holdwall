/**
 * Playbook Editor Component
 * Full-featured editor for creating and editing playbooks
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save, Trash2 } from "lucide-react";
import { PLAYBOOK_TEMPLATES, type PlaybookTemplate, getTemplateById } from "@/lib/playbooks/templates";
import { LoadingState, ErrorState } from "@/components/ui/loading-states";

interface Playbook {
  id: string;
  name: string;
  description?: string;
  template: Record<string, unknown>;
  autopilotMode: "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH";
  createdAt: string;
  updatedAt: string;
}

interface PlaybookEditorProps {
  playbookId?: string;
  onClose?: () => void;
}

export function PlaybookEditor({ playbookId, onClose }: PlaybookEditorProps) {
  const router = useRouter();
  const [playbook, setPlaybook] = React.useState<Playbook | null>(null);
  const [loading, setLoading] = React.useState(!!playbookId);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState<PlaybookTemplate | null>(null);
  const [autopilotMode, setAutopilotMode] = React.useState<"RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH">("RECOMMEND_ONLY");
  const [templateJson, setTemplateJson] = React.useState("");

  // Load playbook if editing
  React.useEffect(() => {
    if (!playbookId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPlaybook() {
      try {
        const response = await fetch(`/api/playbooks?id=${playbookId}`);
        if (!response.ok) {
          throw new Error("Failed to load playbook");
        }
        const data = await response.json();
        if (!cancelled) {
          setPlaybook(data);
          setName(data.name);
          setDescription(data.description || "");
          setAutopilotMode(data.autopilotMode);
          
          // Try to match template
          const templateType = (data.template as any)?.type || "default";
          const matchedTemplate = PLAYBOOK_TEMPLATES.find(t => t.type === templateType);
          if (matchedTemplate) {
            setSelectedTemplate(matchedTemplate);
          }
          
          setTemplateJson(JSON.stringify(data.template, null, 2));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load playbook");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPlaybook();
    return () => {
      cancelled = true;
    };
  }, [playbookId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Playbook name is required");
      return;
    }

    setSaving(true);
    try {
      let template: Record<string, unknown>;
      try {
        if (templateJson.trim()) {
          template = JSON.parse(templateJson);
        } else {
          template = selectedTemplate?.template || {
            type: "default",
            steps: [],
          };
        }
      } catch (e) {
        toast.error("Invalid JSON in template");
        setSaving(false);
        return;
      }

      if (playbookId) {
        // Update existing playbook
        const response = await fetch(`/api/playbooks?id=${playbookId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            template,
            autopilot_mode: autopilotMode,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update playbook");
        }

        toast.success("Playbook updated successfully");
      } else {
        // Create new playbook
        const response = await fetch("/api/playbooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            template,
            autopilot_mode: autopilotMode,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create playbook");
        }

        const newPlaybook = await response.json();
        toast.success("Playbook created successfully");
        
        // Redirect to edit mode for the new playbook
        router.push(`/playbooks?id=${newPlaybook.id}`);
        return;
      }

      // Refresh playbook data
      if (playbookId) {
        const response = await fetch(`/api/playbooks?id=${playbookId}`);
        if (response.ok) {
          const data = await response.json();
          setPlaybook(data);
        }
      }

      if (onClose) {
        onClose();
      } else {
        router.push("/playbooks");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save playbook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!playbookId) return;
    
    if (!confirm("Are you sure you want to delete this playbook? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/playbooks?id=${playbookId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete playbook");
      }

      toast.success("Playbook deleted successfully");
      router.push("/playbooks");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete playbook");
    } finally {
      setDeleting(false);
    }
  };

  const templatesByCategory = React.useMemo(() => {
    const categories: Record<string, PlaybookTemplate[]> = {};
    PLAYBOOK_TEMPLATES.forEach((template) => {
      if (!categories[template.category]) {
        categories[template.category] = [];
      }
      categories[template.category].push(template);
    });
    return categories;
  }, []);

  React.useEffect(() => {
    if (selectedTemplate && !playbookId) {
      setAutopilotMode(selectedTemplate.recommendedAutopilotMode);
      if (!name) {
        setName(selectedTemplate.name);
      }
      if (!description) {
        setDescription(selectedTemplate.description);
      }
      setTemplateJson(JSON.stringify(selectedTemplate.template, null, 2));
    }
  }, [selectedTemplate, playbookId, name, description]);

  if (loading) {
    return <LoadingState count={3} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => router.push("/playbooks")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Playbooks
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {playbookId ? "Edit Playbook" : "Create Playbook"}
            </h1>
            <p className="text-muted-foreground">
              {playbookId ? "Update playbook configuration and template" : "Create a new playbook workflow"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {playbookId && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {playbookId ? "Save Changes" : "Create Playbook"}
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          {!playbookId && <TabsTrigger value="template">Template</TabsTrigger>}
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Configure playbook name, description, and autopilot mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playbook-name">Name *</Label>
                <Input
                  id="playbook-name"
                  placeholder="e.g., High-Risk Narrative Response"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playbook-description">Description</Label>
                <Textarea
                  id="playbook-description"
                  placeholder="Describe what this playbook does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autopilot-mode">Autopilot Mode</Label>
                <Select value={autopilotMode} onValueChange={(value: any) => setAutopilotMode(value)}>
                  <SelectTrigger id="autopilot-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECOMMEND_ONLY">Recommend Only</SelectItem>
                    <SelectItem value="AUTO_DRAFT">Auto Draft</SelectItem>
                    <SelectItem value="AUTO_ROUTE">Auto Route</SelectItem>
                    <SelectItem value="AUTO_PUBLISH">Auto Publish</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {autopilotMode === "RECOMMEND_ONLY" && "Only suggests actions, requires manual approval"}
                  {autopilotMode === "AUTO_DRAFT" && "Automatically drafts responses, requires approval"}
                  {autopilotMode === "AUTO_ROUTE" && "Automatically routes to approvers"}
                  {autopilotMode === "AUTO_PUBLISH" && "Automatically publishes after approval"}
                </p>
              </div>
              {selectedTemplate && (
                <div className="space-y-2">
                  <Label>Selected Template</Label>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{selectedTemplate.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {selectedTemplate.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {!playbookId && (
          <TabsContent value="template" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Choose Template</CardTitle>
                <CardDescription>Select a template to start with or create a custom playbook</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(templatesByCategory).map(([category, templates]) => (
                    <div key={category} className="space-y-2">
                      <Label className="text-sm font-semibold capitalize">{category}</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {templates.map((template) => (
                          <Card
                            key={template.id}
                            className={`cursor-pointer transition-colors ${
                              selectedTemplate?.id === template.id
                                ? "border-primary bg-primary/5"
                                : "hover:bg-accent"
                            }`}
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">{template.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {template.description}
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Configuration</CardTitle>
              <CardDescription>Edit the playbook template JSON directly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="template-json">Template JSON</Label>
                <Textarea
                  id="template-json"
                  value={templateJson}
                  onChange={(e) => setTemplateJson(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  placeholder='{"type": "default", "steps": []}'
                />
                <p className="text-xs text-muted-foreground">
                  Edit the template JSON directly. Invalid JSON will prevent saving.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
