/**
 * Guide Modal Component
 * Displays modal dialogs for guide steps
 */

"use client";

import React from "react";
import { X, ChevronRight, ExternalLink } from "@/components/demo-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GuideStep } from "@/lib/guides/types";

interface GuideModalProps {
  step: GuideStep;
  isOpen: boolean;
  onComplete: () => void;
  onDismiss: () => void;
  onNext?: () => void;
  showNext?: boolean;
}

export function GuideModal({
  step,
  isOpen,
  onComplete,
  onDismiss,
  onNext,
  showNext = false,
}: GuideModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {step.description}
          </DialogDescription>
        </DialogHeader>
        {step.content && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.content}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onDismiss}
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {showNext && onNext && (
              <Button onClick={onNext}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step.action && (
              <Button
                onClick={() => {
                  if (step.action?.onClick) {
                    step.action.onClick();
                  }
                  if (step.action?.href) {
                    window.location.href = step.action.href;
                  }
                  onComplete();
                }}
              >
                {step.action.label}
                {step.action.href && <ExternalLink className="ml-1 h-4 w-4" />}
              </Button>
            )}
            {!step.action && !showNext && (
              <Button onClick={onComplete}>
                Got it
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
