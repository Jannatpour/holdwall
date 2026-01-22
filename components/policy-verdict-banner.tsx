/**
 * Policy Verdict Banner Component
 * 
 * Displays policy evaluation results
 * Shows pass/fail status with reasons
 */

"use client";

import * as React from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export interface PolicyVerdict {
  passed: boolean;
  policy_name: string;
  reasons?: string[];
  warnings?: string[];
}

interface PolicyVerdictBannerProps {
  verdict: PolicyVerdict;
  className?: string;
}

export function PolicyVerdictBanner({ verdict, className }: PolicyVerdictBannerProps) {
  if (verdict.passed) {
    return (
      <Alert className={className}>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Policy Check Passed</AlertTitle>
        <AlertDescription>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="default">{verdict.policy_name}</Badge>
          </div>
          {verdict.reasons && verdict.reasons.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-sm">
              {verdict.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className={className}>
      <XCircle className="h-4 w-4" />
      <AlertTitle>Policy Check Failed</AlertTitle>
      <AlertDescription>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="destructive">{verdict.policy_name}</Badge>
        </div>
        {verdict.reasons && verdict.reasons.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-sm">
            {verdict.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        )}
        {verdict.warnings && verdict.warnings.length > 0 && (
          <div className="mt-2">
            <div className="text-sm font-medium">Warnings:</div>
            <ul className="list-disc list-inside text-sm">
              {verdict.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
