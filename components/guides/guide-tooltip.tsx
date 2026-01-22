/**
 * Guide Tooltip Component
 * Displays contextual tooltips for guide steps
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, ChevronRight, ExternalLink } from "lucide-react";
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
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !step.targetSelector) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      try {
        const element = document.querySelector(step.targetSelector!) as HTMLElement;
        if (!element) {
          setPosition(null);
          return;
        }

        targetRef.current = element;
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltipRef.current?.getBoundingClientRect();
        const tooltipHeight = tooltipRect?.height || 200;
        const tooltipWidth = tooltipRect?.width || 300;

        let top = 0;
        let left = 0;

        switch (step.position) {
          case "top":
            top = rect.top - tooltipHeight - 12;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "bottom":
            top = rect.bottom + 12;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "left":
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.left - tooltipWidth - 12;
            break;
          case "right":
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.right + 12;
            break;
          case "center":
            top = window.innerHeight / 2 - tooltipHeight / 2;
            left = window.innerWidth / 2 - tooltipWidth / 2;
            break;
          default:
            top = rect.bottom + 12;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
        }

        // Keep within viewport
        top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));
        left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

        setPosition({ top, left });
      } catch (error) {
        console.error("Failed to position tooltip:", error);
        setPosition(null);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isActive, step.targetSelector, step.position]);

  if (!isActive || !position) {
    return null;
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
      {targetRef.current && (
        <div
          className="fixed z-41 pointer-events-none rounded-md border-2 border-primary shadow-lg"
          style={{
            top: targetRef.current.getBoundingClientRect().top + window.scrollY - 4,
            left: targetRef.current.getBoundingClientRect().left + window.scrollX - 4,
            width: targetRef.current.getBoundingClientRect().width + 8,
            height: targetRef.current.getBoundingClientRect().height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <Card
        ref={tooltipRef}
        className={cn(
          "fixed z-50 w-80 shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
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
