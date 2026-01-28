/**
 * Evidence Link Component
 * 
 * Hover preview + click to drawer for evidence
 * Provides traceability-first interaction
 */

"use client";

import * as React from "react";
import { ExternalLink, FileText } from "@/components/demo-icons";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export interface Evidence {
  id: string;
  content?: {
    raw?: string;
    normalized?: string;
  };
  sourceType?: string;
  sourceUrl?: string;
  collectedAt?: string;
}

interface EvidenceLinkProps {
  evidenceId: string;
  evidence?: Evidence;
  className?: string;
}

export function EvidenceLink({ evidenceId, evidence, className }: EvidenceLinkProps) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [evidenceData, setEvidenceData] = React.useState<Evidence | null>(evidence || null);

  const loadEvidence = async () => {
    if (evidenceData) {
      setSheetOpen(true);
      return;
    }

    try {
      const response = await fetch(`/api/evidence/${evidenceId}`);
      if (response.ok) {
        const data = await response.json();
        setEvidenceData(data);
        setSheetOpen(true);
      }
    } catch (error) {
      console.error("Failed to load evidence:", error);
    }
  };

  const previewText = evidenceData?.content?.normalized || evidenceData?.content?.raw || "";
  const preview = previewText.length > 200
    ? previewText.substring(0, 200) + "..."
    : previewText;

  return (
    <>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button
            variant="link"
            className={className}
            onClick={loadEvidence}
          >
            <FileText className="h-4 w-4 mr-1" />
            Evidence {evidenceId.substring(0, 8)}
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="space-y-2">
            <div className="font-semibold">Evidence Preview</div>
            <p className="text-sm text-muted-foreground">{preview || "Loading..."}</p>
            {evidenceData?.sourceType && (
              <Badge variant="outline" className="text-xs">
                {evidenceData.sourceType}
              </Badge>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Evidence Details</SheetTitle>
            <SheetDescription>
              Evidence ID: {evidenceId}
            </SheetDescription>
          </SheetHeader>
          {evidenceData && (
            <div className="mt-6 space-y-4">
              {evidenceData.sourceType && (
                <div>
                  <div className="text-sm font-medium">Source Type</div>
                  <Badge>{evidenceData.sourceType}</Badge>
                </div>
              )}
              {evidenceData.sourceUrl && (
                <div>
                  <div className="text-sm font-medium">Source URL</div>
                  <a
                    href={evidenceData.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {evidenceData.sourceUrl}
                  </a>
                </div>
              )}
              {evidenceData.collectedAt && (
                <div>
                  <div className="text-sm font-medium">Collected At</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(evidenceData.collectedAt).toLocaleString()}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium mb-2">Content</div>
                <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                  {evidenceData.content?.normalized || evidenceData.content?.raw || "No content"}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
