"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command as CommandIcon, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");
  const [inputMode, setInputMode] = React.useState<
    "playbook" | "cluster" | "approval" | "export_audit" | null
  >(null);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const commands: Command[] = React.useMemo(() => [
    {
      id: "overview",
      label: "Go to Overview",
      description: "View dashboard and key metrics",
      action: () => router.push("/overview"),
      keywords: ["overview", "dashboard", "home", "metrics"],
    },
    {
      id: "signals",
      label: "View Signals",
      description: "Browse all ingested signals",
      action: () => router.push("/signals"),
      keywords: ["signals", "ingestion", "monitor"],
    },
    {
      id: "claims",
      label: "View Claims",
      description: "Browse all extracted claims",
      action: () => router.push("/claims"),
      keywords: ["claims", "extraction", "clusters"],
    },
    {
      id: "graph",
      label: "Belief Graph",
      description: "Explore belief graph and paths",
      action: () => router.push("/graph"),
      keywords: ["graph", "belief", "paths", "nodes"],
    },
    {
      id: "forecasts",
      label: "View Forecasts",
      description: "Check drift and outbreak forecasts",
      action: () => router.push("/forecasts"),
      keywords: ["forecasts", "drift", "outbreak", "prediction"],
    },
    {
      id: "create-aaal",
      label: "Create AAAL Document",
      description: "Create a new AAAL artifact",
      action: async () => {
        try {
          const res = await fetch("/api/aaal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Untitled AAAL",
              content: "",
              evidence_refs: [],
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Failed to create AAAL artifact");
          }
          const json = await res.json();
          router.push(`/studio?artifact=${json.artifact_id}`);
          setOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to create AAAL artifact");
        }
      },
      keywords: ["create", "aaal", "document", "artifact", "new"],
    },
    {
      id: "studio",
      label: "AAAL Studio",
      description: "Open artifact authoring studio",
      action: () => router.push("/studio"),
      keywords: ["studio", "author", "edit", "artifact"],
    },
    {
      id: "trust",
      label: "Trust Assets",
      description: "Manage trust assets and gaps",
      action: () => router.push("/trust"),
      keywords: ["trust", "assets", "gaps", "library"],
    },
    {
      id: "funnel",
      label: "Funnel Map",
      description: "View decision funnel analysis",
      action: () => router.push("/funnel"),
      keywords: ["funnel", "decision", "map", "analysis"],
    },
    {
      id: "playbooks",
      label: "Playbooks",
      description: "View and manage playbooks",
      action: () => router.push("/playbooks"),
      keywords: ["playbooks", "workflows", "automation"],
    },
    {
      id: "run-playbook",
      label: "Run Playbook",
      description: "Execute a playbook workflow (enter ID)",
      action: () => {
        setInputMode("playbook");
        setInputValue("");
      },
      keywords: ["run", "playbook", "execute", "workflow"],
    },
    {
      id: "governance",
      label: "Governance",
      description: "Access governance and compliance",
      action: () => router.push("/governance"),
      keywords: ["governance", "compliance", "audit", "policies"],
    },
    {
      id: "export-audit",
      label: "Export Audit Bundle",
      description: "Export audit bundle (enter: RESOURCE_TYPE RESOURCE_ID)",
      action: () => {
        setInputMode("export_audit");
        setInputValue("");
      },
      keywords: ["export", "audit", "bundle", "pdf", "json"],
    },
    {
      id: "open-cluster",
      label: "Open Cluster by ID",
      description: "Navigate to a specific claim cluster (enter ID)",
      action: () => {
        setInputMode("cluster");
        setInputValue("");
      },
      keywords: ["cluster", "open", "claim", "cluster id"],
    },
    {
      id: "route-approval",
      label: "Route Approval",
      description: "Create an approval request (enter: RESOURCE_TYPE RESOURCE_ID ACTION)",
      action: () => {
        setInputMode("approval");
        setInputValue("");
      },
      keywords: ["route", "approval", "approve", "send"],
    },
    {
      id: "global-search",
      label: "Global Search",
      description: "Search across all content (Ctrl+F)",
      action: () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }));
      },
      keywords: ["search", "find", "global"],
    },
  ], [router]);

  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
    );
  }, [query, commands]);

  const handleInputSubmit = () => {
    if (!inputValue.trim()) return;

    if (inputMode === "playbook") {
      (async () => {
        try {
          const res = await fetch("/api/playbooks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playbook_id: inputValue.trim(),
              parameters: {},
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Failed to run playbook");
          }
          const json = await res.json();
          toast.success("Playbook execution started");
          router.push(`/playbooks?execution_id=${json.id}`);
          setOpen(false);
          setInputMode(null);
          setInputValue("");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to run playbook");
        }
      })();
    } else if (inputMode === "cluster") {
      router.push(`/claims?cluster=${inputValue}`);
      setOpen(false);
      setInputMode(null);
      setInputValue("");
    } else if (inputMode === "approval") {
      (async () => {
        try {
          const parts = inputValue.trim().split(/\s+/);
          if (parts.length < 3) {
            toast.error("Enter: RESOURCE_TYPE RESOURCE_ID ACTION");
            return;
          }
          const [resource_type, resource_id, ...actionParts] = parts;
          const action = actionParts.join(" ");
          const res = await fetch("/api/approvals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource_type,
              resource_id,
              action,
              approvers: [],
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Failed to route approval");
          }
          const json = await res.json();
          toast.success("Approval request created");
          router.push(`/governance?approval_id=${json.id}`);
          setOpen(false);
          setInputMode(null);
          setInputValue("");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to route approval");
        }
      })();
    } else if (inputMode === "export_audit") {
      (async () => {
        try {
          const parts = inputValue.trim().split(/\s+/);
          if (parts.length < 2) {
            toast.error("Enter: RESOURCE_TYPE RESOURCE_ID");
            return;
          }
          const [resource_type, resource_id] = parts;
          const res = await fetch(`/api/governance/audit-bundle?format=json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource_type,
              resource_id,
              time_range: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString(),
              },
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Failed to export audit bundle");
          }
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `audit-bundle-${resource_type}-${resource_id}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success("Audit bundle exported");
          setOpen(false);
          setInputMode(null);
          setInputValue("");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to export audit bundle");
        }
      })();
    }
  };

  const handleCommand = (cmd: Command) => {
    // Commands that require input mode
    if (
      cmd.id === "run-playbook" ||
      cmd.id === "open-cluster" ||
      cmd.id === "route-approval" ||
      cmd.id === "export-audit" ||
      cmd.id === "create-aaal"
    ) {
      cmd.action();
    } else {
      cmd.action();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Search and execute commands quickly
          </DialogDescription>
        </DialogHeader>
        <div className="px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                inputMode === "playbook" ? "Enter playbook ID..."
                : inputMode === "cluster" ? "Enter cluster ID..."
                : inputMode === "approval" ? "Enter: RESOURCE_TYPE RESOURCE_ID ACTION"
                : inputMode === "export_audit" ? "Enter: RESOURCE_TYPE RESOURCE_ID"
                : "Type a command or search..."
              }
              value={inputMode ? inputValue : query}
              onChange={(e) => {
                if (inputMode) {
                  setInputValue(e.target.value);
                } else {
                  setQuery(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (inputMode && e.key === "Enter") {
                  handleInputSubmit();
                } else if (inputMode && e.key === "Escape") {
                  setInputMode(null);
                  setInputValue("");
                  setQuery("");
                }
              }}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-[400px] px-4 pb-4">
          <div className="space-y-1">
            {inputMode ? (
              <div className="py-4 space-y-2">
                <div className="text-sm text-muted-foreground">
                  {inputMode === "playbook" && "Enter the playbook ID to run"}
                  {inputMode === "cluster" && "Enter the cluster ID to open"}
                  {inputMode === "approval" && "Enter the resource ID to route for approval"}
                </div>
                <Button onClick={handleInputSubmit} className="w-full" size="sm">
                  Submit
                </Button>
                <Button
                  onClick={() => {
                    setInputMode(null);
                    setInputValue("");
                    setQuery("");
                  }}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ) : filteredCommands.length > 0 ? (
              filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => handleCommand(cmd)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {cmd.icon || <CommandIcon className="size-4" />}
                  <div className="flex-1">
                    <div className="font-medium">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-xs text-muted-foreground">
                        {cmd.description}
                      </div>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No commands found
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
