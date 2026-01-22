/**
 * Severity Badge Component
 * 
 * Displays severity levels with consistent styling
 * Used throughout the app for claims, signals, alerts
 */

"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Severity = "low" | "medium" | "high" | "critical" | "info";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
  showIcon?: boolean;
}

export function SeverityBadge({ severity, className, showIcon = false }: SeverityBadgeProps) {
  const variants: Record<Severity, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    critical: { variant: "destructive", label: "Critical" },
    high: { variant: "destructive", label: "High" },
    medium: { variant: "secondary", label: "Medium" },
    low: { variant: "outline", label: "Low" },
    info: { variant: "default", label: "Info" },
  };

  const config = variants[severity] || variants.info;

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
