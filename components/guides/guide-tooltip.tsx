/**
 * Guide Tooltip Component
 * Displays contextual tooltips for guide steps
 */

"use client";

import React, { useSyncExternalStore } from "react";
import { X, ChevronRight, ExternalLink } from "@/components/demo-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GuideStep } from "@/lib/guides/types";

interface GuideTooltipProps {
  step: GuideStep;
  isActive: boolean;
  onComplete: () => void;
  onDismiss: () => void;
  onNext?: () => void;
  showNext?: boolean;
}

export function GuideTooltip({
  step,
  isActive,
  onComplete,
  onDismiss,
  onNext,
  showNext = false,
}: GuideTooltipProps) {
  const isBrowser = typeof window !== "undefined";

  // Re-render on scroll/resize without setState in effects.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _viewportTick = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => undefined;
      window.addEventListener("resize", onStoreChange);
      window.addEventListener("scroll", onStoreChange, true);
      return () => {
        window.removeEventListener("resize", onStoreChange);
        window.removeEventListener("scroll", onStoreChange, true);
      };
    },
    () => `${window.innerWidth}:${window.innerHeight}:${window.scrollX}:${window.scrollY}`,
    () => "ssr"
  );

  if (!isActive || !isBrowser) {
    return null;
  }

  let highlightRect: { top: number; left: number; width: number; height: number } | null = null;
  let anchorTop = window.innerHeight / 2;
  let anchorLeft = window.innerWidth / 2;
  let transform = "translate(-50%, -50%)";

  if (step.targetSelector) {
    const element = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    highlightRect = {
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
    };

    switch (step.position) {
      case "top":
        anchorTop = rect.top - 12;
        anchorLeft = rect.left + rect.width / 2;
        transform = "translate(-50%, -100%)";
        break;
      case "bottom":
        anchorTop = rect.bottom + 12;
        anchorLeft = rect.left + rect.width / 2;
        transform = "translate(-50%, 0)";
        break;
      case "left":
        anchorTop = rect.top + rect.height / 2;
        anchorLeft = rect.left - 12;
        transform = "translate(-100%, -50%)";
        break;
      case "right":
        anchorTop = rect.top + rect.height / 2;
        anchorLeft = rect.right + 12;
        transform = "translate(0, -50%)";
        break;
      case "center":
      default:
        anchorTop = window.innerHeight / 2;
        anchorLeft = window.innerWidth / 2;
        transform = "translate(-50%, -50%)";
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onDismiss}
        aria-hidden="true"
      />
      
      {/* Highlight target element */}
      {highlightRect ? (
        <div
          className="fixed z-41 pointer-events-none rounded-md border-2 border-primary shadow-lg"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      ) : null}

      {/* Tooltip */}
      <Card
        className={cn(
          "fixed z-50 w-80 shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        style={{
          top: anchorTop,
          left: anchorLeft,
          transform,
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{step.title}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription className="text-sm leading-relaxed">
            {step.description}
          </CardDescription>
          {step.content && (
            <p className="text-sm text-muted-foreground">{step.content}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
            >
              Skip
            </Button>
            <div className="flex gap-2">
              {showNext && onNext && (
                <Button
                  size="sm"
                  onClick={onNext}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              {step.action && (
                <Button
                  size="sm"
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
                <Button
                  size="sm"
                  onClick={onComplete}
                >
                  Got it
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
