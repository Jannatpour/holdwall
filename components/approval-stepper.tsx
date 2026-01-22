/**
 * Approval Stepper Component
 * 
 * Visual stepper showing approval workflow progress
 * Draft → Review → Approved → Published
 */

"use client";

import * as React from "react";
import { Check, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ApprovalStatus = "draft" | "in_review" | "approved" | "published" | "rejected";

interface ApprovalStepperProps {
  currentStatus: ApprovalStatus;
  className?: string;
}

const steps: Array<{ id: ApprovalStatus; label: string }> = [
  { id: "draft", label: "Draft" },
  { id: "in_review", label: "In Review" },
  { id: "approved", label: "Approved" },
  { id: "published", label: "Published" },
];

export function ApprovalStepper({ currentStatus, className }: ApprovalStepperProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStatus);
  const isRejected = currentStatus === "rejected";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex && !isRejected;
        const isRejectedAtThisStep = isRejected && index === currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-background text-primary",
                  isRejectedAtThisStep && "border-destructive bg-destructive text-destructive-foreground",
                  !isCompleted && !isCurrent && !isRejectedAtThisStep && "border-muted bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : isCurrent ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  (isCompleted || isCurrent) && "text-foreground",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-12",
                  isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
