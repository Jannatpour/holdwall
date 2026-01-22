/**
 * Degraded Mode Banner Component
 * 
 * Shows when system is in degraded mode
 * Displays Kafka lag, source outages, etc.
 */

"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface DegradedModeInfo {
  reason: "kafka_lag" | "source_outage" | "service_degraded" | "cache_unavailable";
  message: string;
  severity: "warning" | "error";
  canRetry?: boolean;
  onRetry?: () => void;
}

interface DegradedModeBannerProps {
  info: DegradedModeInfo;
  className?: string;
}

export function DegradedModeBanner({ info, className }: DegradedModeBannerProps) {
  const getReasonLabel = (reason: DegradedModeInfo["reason"]): string => {
    switch (reason) {
      case "kafka_lag":
        return "Event Stream Lag";
      case "source_outage":
        return "Source Outage";
      case "service_degraded":
        return "Service Degraded";
      case "cache_unavailable":
        return "Cache Unavailable";
      default:
        return "System Degraded";
    }
  };

  return (
    <Alert
      variant={info.severity === "error" ? "destructive" : "default"}
      className={className}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{getReasonLabel(info.reason)}</AlertTitle>
      <AlertDescription>
        <div className="flex items-center justify-between">
          <span>{info.message}</span>
          {info.canRetry && info.onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={info.onRetry}
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
