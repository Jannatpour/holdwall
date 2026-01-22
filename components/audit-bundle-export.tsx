"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, FileJson, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export type ResourceType = "incident" | "claim_cluster" | "artifact" | "approval" | "workflow";

interface AuditBundleExportProps {
  resourceType?: ResourceType;
  resourceId?: string;
  trigger?: React.ReactNode;
}

export function AuditBundleExport({
  resourceType: initialResourceType,
  resourceId: initialResourceId,
  trigger,
}: AuditBundleExportProps) {
  const [open, setOpen] = React.useState(false);
  const [resourceType, setResourceType] = React.useState<ResourceType | "">(initialResourceType || "");
  const [resourceId, setResourceId] = React.useState(initialResourceId || "");
  const [includePDF, setIncludePDF] = React.useState(true);
  const [includeJSON, setIncludeJSON] = React.useState(true);
  const [includeVersionIds, setIncludeVersionIds] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = async () => {
    if (!resourceType || !resourceId) {
      setError("Please select a resource type and enter a resource ID");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/audit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          include_pdf: includePDF,
          include_json: includeJSON,
          include_version_ids: includeVersionIds,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to export audit bundle");
      }

      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || "application/zip";
      
      // Determine file extension
      const extension = contentType.includes("pdf") ? "pdf" : "zip";
      const filename = `audit-bundle-${resourceType}-${resourceId}-${Date.now()}.${extension}`;

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Audit bundle exported successfully");
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export audit bundle";
      setError(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="mr-2 size-4" />
            Export Audit Bundle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Audit Bundle</DialogTitle>
          <DialogDescription>
            Export a comprehensive audit bundle with PDF executive summary, JSON evidence package, and immutable version IDs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="resource-type">Resource Type</Label>
            <Select
              value={resourceType}
              onValueChange={(value) => setResourceType(value as ResourceType)}
              disabled={!!initialResourceType}
            >
              <SelectTrigger id="resource-type">
                <SelectValue placeholder="Select resource type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incident">Incident</SelectItem>
                <SelectItem value="claim_cluster">Claim Cluster</SelectItem>
                <SelectItem value="artifact">Artifact</SelectItem>
                <SelectItem value="approval">Approval</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resource-id">Resource ID</Label>
            <input
              id="resource-id"
              type="text"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              placeholder="Enter resource ID"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!!initialResourceId}
            />
          </div>

          <div className="space-y-3">
            <Label>Export Options</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-pdf"
                  checked={includePDF}
                  onCheckedChange={(checked) => setIncludePDF(checked === true)}
                />
                <Label htmlFor="include-pdf" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="size-4" />
                  PDF Executive Summary
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-json"
                  checked={includeJSON}
                  onCheckedChange={(checked) => setIncludeJSON(checked === true)}
                />
                <Label htmlFor="include-json" className="flex items-center gap-2 cursor-pointer">
                  <FileJson className="size-4" />
                  JSON Evidence Package
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-version-ids"
                  checked={includeVersionIds}
                  onCheckedChange={(checked) => setIncludeVersionIds(checked === true)}
                />
                <Label htmlFor="include-version-ids" className="flex items-center gap-2 cursor-pointer">
                  <CheckCircle2 className="size-4" />
                  Immutable Version IDs
                </Label>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting || !resourceType || !resourceId}>
              {exporting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
