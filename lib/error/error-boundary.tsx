/**
 * Error Boundary
 * Production-ready error boundary with recovery and reporting
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "@/components/demo-icons";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Log error using structured logger if available
    if (typeof window !== "undefined") {
      // Import logger dynamically to avoid SSR issues
      import("@/lib/logging/logger").then(({ logger }) => {
        logger.error("ErrorBoundary caught an error", {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          errorName: error.name,
        });
      }).catch(() => {
        // Fallback to console if logger import fails
        console.error("ErrorBoundary caught an error:", error, errorInfo);
      });
    } else {
      // Server-side fallback
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Check if it's a ChunkLoadError
    const isChunkLoadError = 
      error.name === "ChunkLoadError" ||
      error.message.includes("Failed to load chunk") ||
      error.message.includes("Loading chunk") ||
      error.message.includes("turbopack");

    if (isChunkLoadError && typeof window !== "undefined") {
      const warningMessage =
        "ChunkLoadError detected. This usually means:\n" +
        "1. The service worker is caching stale chunks\n" +
        "2. The .next directory needs to be cleared\n" +
        "3. Browser cache needs to be cleared\n\n" +
        "Try: Unregister service worker, clear cache, and reload.";

      // Log using structured logger if available
      import("@/lib/logging/logger").then(({ logger }) => {
        logger.warn("ChunkLoadError detected", {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        });
      }).catch(() => {
        console.warn(warningMessage);
      });
    }

    // Report to error tracking service
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-6 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                An unexpected error occurred. Error ID: {this.state.errorId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                (() => {
                  const isChunkLoadError = 
                    this.state.error?.name === "ChunkLoadError" ||
                    this.state.error?.message.includes("Failed to load chunk") ||
                    this.state.error?.message.includes("Loading chunk") ||
                    this.state.error?.message.includes("turbopack");

                  if (isChunkLoadError) {
                    return (
                      <div className="rounded-lg border bg-muted p-4 space-y-3">
                        <div className="font-semibold text-sm">Chunk Load Error</div>
                        <p className="text-sm text-muted-foreground">
                          This error usually occurs when cached JavaScript chunks become stale.
                        </p>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">To fix this:</p>
                          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                            <li>Open DevTools (F12) → Application → Service Workers</li>
                            <li>Click "Unregister" to remove the service worker</li>
                            <li>Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)</li>
                            <li>Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)</li>
                          </ol>
                        </div>
                        {process.env.NODE_ENV === "development" && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-muted-foreground">
                              Technical details
                            </summary>
                            <pre className="mt-2 text-xs overflow-auto">
                              {this.state.error.toString()}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  }

                  return process.env.NODE_ENV === "development" ? (
                    <div className="rounded-lg border bg-muted p-4">
                      <div className="font-mono text-sm text-destructive">
                        {this.state.error.toString()}
                      </div>
                      {this.state.errorInfo && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-muted-foreground">
                            Stack trace
                          </summary>
                          <pre className="mt-2 text-xs overflow-auto">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </details>
                      )}
                    </div>
                  ) : null;
                })()
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="mr-2 size-4" />
                  Try Again
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">
                    <Home className="mr-2 size-4" />
                    Go Home
                  </Link>
                </Button>
              </div>

              {this.state.errorId && (
                <p className="text-xs text-muted-foreground">
                  Please report this error ID if the problem persists: {this.state.errorId}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
