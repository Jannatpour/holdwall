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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Loader2, AlertCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PADLPublishDialogProps {
  artifactId: string;
  artifactTitle: string;
  trigger?: React.ReactNode;
  onPublished?: (publicUrl: string) => void;
}

export function PADLPublishDialog({
  artifactId,
  artifactTitle,
  trigger,
  onPublished,
}: PADLPublishDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [publicUrl, setPublicUrl] = React.useState("");
  const [robotsDirective, setRobotsDirective] = React.useState("index, follow");
  const [integrityHash, setIntegrityHash] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open && !publicUrl) {
      // Generate default URL
      const defaultUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com"}/padl/${artifactId}`;
      setPublicUrl(defaultUrl);
    }
  }, [open, artifactId, publicUrl]);

  const handleGenerateHash = async () => {
    try {
      const response = await fetch(`/api/aaal?id=${artifactId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch artifact");
      }
      const artifact = await response.json();
      
      // Generate integrity hash from content
      const encoder = new TextEncoder();
      const data = encoder.encode(artifact.content || "");
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      setIntegrityHash(hash);
      toast.success("Integrity hash generated");
    } catch (err) {
      toast.error("Failed to generate integrity hash");
    }
  };

  const handlePublish = async () => {
    if (!publicUrl.trim()) {
      setError("Public URL is required");
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const response = await fetch("/api/aaal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact_id: artifactId,
          public_url: publicUrl.trim(),
          robots_directive: robotsDirective,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to publish to PADL");
      }

      const data = await response.json();
      const finalUrl = data.public_url || publicUrl;
      
      setPublishedUrl(finalUrl);
      toast.success("Artifact published to PADL successfully");
      onPublished?.(finalUrl);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        setOpen(false);
        setPublishedUrl(null);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish to PADL";
      setError(message);
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!publishedUrl) return;
    
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default">
            <ExternalLink className="mr-2 size-4" />
            Publish to PADL
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Publish to PADL</DialogTitle>
          <DialogDescription>
            Publish this artifact to the Public Artifact Delivery Layer with signed integrity verification and version pinning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="artifact-title">Artifact Title</Label>
            <Input
              id="artifact-title"
              value={artifactTitle}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="public-url">Public URL</Label>
            <Input
              id="public-url"
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              placeholder="https://trust.example.com/artifacts/..."
              disabled={publishing}
            />
            <p className="text-xs text-muted-foreground">
              The public URL where this artifact will be accessible. Can be your own domain or the default PADL domain.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="robots-directive">Robots Directive</Label>
            <Select
              value={robotsDirective}
              onValueChange={setRobotsDirective}
              disabled={publishing}
            >
              <SelectTrigger id="robots-directive">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="index, follow">Index, Follow (default)</SelectItem>
                <SelectItem value="index, nofollow">Index, NoFollow</SelectItem>
                <SelectItem value="noindex, follow">NoIndex, Follow</SelectItem>
                <SelectItem value="noindex, nofollow">NoIndex, NoFollow</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls how search engines and AI crawlers index this artifact.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="integrity-hash">Integrity Hash</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateHash}
                disabled={publishing || !!integrityHash}
              >
                {integrityHash ? (
                  <>
                    <CheckCircle2 className="mr-2 size-4" />
                    Generated
                  </>
                ) : (
                  "Generate Hash"
                )}
              </Button>
            </div>
            {integrityHash ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
                <code className="flex-1 text-xs font-mono break-all">{integrityHash}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(integrityHash);
                    toast.success("Hash copied");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Generate a cryptographic hash to verify artifact integrity. This will be generated automatically on publish.
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {publishedUrl && (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Artifact published successfully!</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUrl}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 size-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 size-4" />
                        Copy URL
                      </>
                    )}
                  </Button>
                </div>
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-sm text-primary hover:underline"
                >
                  {publishedUrl}
                  <ExternalLink className="ml-1 inline size-3" />
                </a>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>
              <strong>Before publishing:</strong> Ensure the artifact is approved and all evidence references are valid. 
              Published artifacts are publicly accessible and indexed by search engines and AI systems.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={publishing || !publicUrl.trim()}>
            {publishing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 size-4" />
                Publish to PADL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
