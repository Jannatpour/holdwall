"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "@/components/demo-icons";
import { PLAYBOOK_TEMPLATES, type PlaybookTemplate } from "@/lib/playbooks/templates";

interface CreatePlaybookDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function CreatePlaybookDialog({ open, onOpenChange, children }: CreatePlaybookDialogProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState<PlaybookTemplate | null>(null);
  const [autopilotMode, setAutopilotMode] = React.useState<"RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH">("RECOMMEND_ONLY");
  const [loading, setLoading] = React.useState(false);
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  React.useEffect(() => {
    if (selectedTemplate) {
      setAutopilotMode(selectedTemplate.recommendedAutopilotMode);
      if (!name) {
        setName(selectedTemplate.name);
      }
      if (!description) {
        setDescription(selectedTemplate.description);
      }
    }
  }, [selectedTemplate]);

  React.useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setName("");
      setDescription("");
      setSelectedTemplate(null);
      setAutopilotMode("RECOMMEND_ONLY");
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Playbook name is required");
      return;
    }

    setLoading(true);
    try {
      const template = selectedTemplate?.template || {
        type: "default",
        steps: [],
      };

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

      const playbook = await response.json();
      toast.success("Playbook created successfully");
      setIsOpen(false);
      
      // Refresh the page to show new playbook
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create playbook");
    } finally {
      setLoading(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Playbook</DialogTitle>
          <DialogDescription>
            Create a new playbook to automate workflows and responses
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="template" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Choose Template</TabsTrigger>
            <TabsTrigger value="configure">Configure</TabsTrigger>
          </TabsList>
          
          <TabsContent value="template" className="space-y-4 py-4">
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
          </TabsContent>

          <TabsContent value="configure" className="space-y-4 py-4">
            <div className="space-y-4">
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
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Playbook"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
