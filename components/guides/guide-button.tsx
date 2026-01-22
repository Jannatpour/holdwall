/**
 * Guide Button Component
 * Button to start/control guides
 */

"use client";

import React from "react";
import { HelpCircle, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGuide } from "./guide-provider";
import { getGuide } from "@/lib/guides/registry";
import type { GuideId } from "@/lib/guides/types";

interface GuideButtonProps {
  pageId: GuideId;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function GuideButton({ pageId, variant = "outline", size = "default" }: GuideButtonProps) {
  const { startGuide, stopGuide, isGuideActive, dismissGuide } = useGuide();
  const guide = getGuide(pageId);
  const isActive = isGuideActive(pageId);

  if (!guide) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          {isActive ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Stop Guide
            </>
          ) : (
            <>
              <HelpCircle className="mr-2 h-4 w-4" />
              Guide
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{guide.title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isActive ? (
          <>
            <DropdownMenuItem onClick={() => stopGuide()}>
              Stop Current Guide
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dismissGuide(pageId)}>
              Dismiss Guide
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => startGuide(pageId)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Start Guide
            </DropdownMenuItem>
            {guide.quickStart && guide.quickStart.length > 0 && (
              <DropdownMenuItem onClick={() => startGuide(pageId)}>
                Quick Start
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`/docs/guides/${pageId}`} target="_blank" rel="noopener noreferrer">
            View Full Documentation
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
