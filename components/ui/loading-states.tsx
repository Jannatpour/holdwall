/**
 * Reusable Loading, Error, and Empty States
 * Consistent UI patterns across the application
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Inbox } from "lucide-react";

interface LoadingStateProps {
  count?: number;
  className?: string;
}

export function LoadingState({ count = 3, className }: LoadingStateProps) {
  return (
    <div className={`space-y-4 ${className || ""}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  error: string | Error;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export function ErrorState({
  error,
  onRetry,
  title = "Something went wrong",
  description,
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="mr-2 size-4" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({
  title = "No items found",
  description = "Get started by creating your first item.",
  action,
  icon,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {icon || <Inbox className="size-12 text-muted-foreground mb-4" />}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
          {description}
        </p>
        {action && (
          <Button onClick={action.onClick} variant="outline">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
