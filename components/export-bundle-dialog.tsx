/**
 * Export Bundle Dialog Component
 * 
 * Dialog for exporting audit bundles
 * Shows export progress and download options
 */

"use client";

import * as React from "react";
import { Download, FileArchive, Loader2 } from "@/components/demo-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ExportBundleDialogProps {
  trigger?: React.ReactNode;
  entityType?: string;
  entityId?: string;
  onExport?: () => Promise<string>; // Returns job ID
}

export function ExportBundleDialog({
  trigger,
  entityType,
  entityId,
  onExport,
}: ExportBundleDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setProgress(0);

    try {
      if (onExport) {
        const id = await onExport();
        setJobId(id);
        
        // Poll for export status
        const pollInterval = setInterval(async () => {
          try {
            const response = await fetch(`/api/exports/${id}/status`);
            if (response.ok) {
              const data = await response.json();
              setProgress(data.progress || 0);

              if (data.status === "completed") {
                clearInterval(pollInterval);
                setExporting(false);
                setDownloadUrl(data.download_url);
              } else if (data.status === "failed") {
                clearInterval(pollInterval);
                setExporting(false);
                setError(data.error || "Export failed");
              }
            }
          } catch (err) {
            clearInterval(pollInterval);
            setExporting(false);
            setError("Failed to check export status");
          }
        }, 1000);
      } else {
        // Default export via API
        const response = await fetch("/api/exports/audit-bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setJobId(data.job_id);
          // Poll for status...
        } else {
          setError("Failed to start export");
        }
      }
    } catch (err) {
      setExporting(false);
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Audit Bundle</DialogTitle>
          <DialogDescription>
            Export audit trail and evidence for {entityType || "selected items"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {exporting ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Exporting...</span>
              </div>
              <Progress value={progress} />
            </div>
          ) : downloadUrl ? (
            <Alert>
              <FileArchive className="h-4 w-4" />
              <AlertDescription>
                Export completed. Ready to download.
              </AlertDescription>
            </Alert>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="text-sm text-muted-foreground">
              This will create a downloadable bundle containing:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Audit trail events</li>
                <li>Related evidence</li>
                <li>Approval history</li>
                <li>Policy evaluations</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {downloadUrl ? (
            <Button onClick={() => window.open(downloadUrl, "_blank")}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          ) : (
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileArchive className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
