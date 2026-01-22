/**
 * Empty State Component
 * 
 * Standard empty state with action-first CTA
 * Used throughout the app
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardHeader className="text-center">
        {icon && <div className="mx-auto mb-4">{icon}</div>}
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {action && (
        <CardContent className="text-center">
          <Button onClick={action.onClick}>{action.label}</Button>
        </CardContent>
      )}
    </Card>
  );
}
