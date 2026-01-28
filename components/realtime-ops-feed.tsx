"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Zap, CheckCircle2, AlertTriangle, Clock } from "@/components/demo-icons";
import { formatDistanceToNow } from "date-fns";

interface OpsEvent {
  id: string;
  type: string;
  occurred_at: string;
  actor_id?: string;
  correlation_id?: string;
  data?: Record<string, unknown>;
}

interface RealtimeOpsFeedProps {
  maxEvents?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function RealtimeOpsFeed({
  maxEvents = 20,
  autoRefresh = true,
  refreshInterval = 5000,
}: RealtimeOpsFeedProps) {
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Initial fetch
    async function fetchEvents() {
      try {
        const response = await fetch(`/api/events/recent?limit=${maxEvents}`);
        if (!response.ok) {
          throw new Error("Failed to fetch events");
        }
        const data = await response.json();
        if (!cancelled) {
          setEvents(data.events || []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load events");
          setLoading(false);
        }
      }
    }

    fetchEvents();

    // SSE connection for real-time updates using fetch (supports auth headers)
    if (typeof window !== "undefined" && autoRefresh) {
      const sseUrl = `/api/events/stream`;

      async function connectSSE() {
        if (cancelled) return;
        
        // Clean up previous connection if exists
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        try {
          abortControllerRef.current = new AbortController();
          
          const response = await fetch(sseUrl, {
            headers: {
              Accept: "text/event-stream",
            },
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            if (response.status === 401) {
              setError("Authentication required");
              setIsConnected(false);
              return;
            }
            throw new Error(`SSE connection failed: ${response.statusText}`);
          }

          if (!response.body) {
            throw new Error("Response body is not readable");
          }

          setIsConnected(true);
          setError(null);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!cancelled) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (cancelled) break;
              
              if (line.startsWith("event: ")) {
                const eventType = line.slice(7).trim();
                // Handle event type if needed
                continue;
              }

              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Handle heartbeat messages
                  if (data.type === "heartbeat") {
                    continue;
                  }
                  
                  // Handle connection messages
                  if (data.type === "connected") {
                    setIsConnected(true);
                    continue;
                  }
                  
                  // Handle actual events
                  if (data.id || data.type || data.occurred_at) {
                    const newEvent = data as OpsEvent;
                    setEvents((prev) => {
                      const updated = [newEvent, ...prev];
                      return updated.slice(0, maxEvents);
                    });
                  }
                } catch (err) {
                  console.error("Failed to parse SSE message:", err);
                }
              }
            }
          }
        } catch (err) {
          if (cancelled) return;
          
          if (err instanceof Error && err.name === "AbortError") {
            // Intentional abort, don't reconnect
            return;
          }
          
          console.error("SSE connection error:", err);
          setIsConnected(false);
          
          // Reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!cancelled) {
              connectSSE();
            }
          }, 3000);
        }
      }

      connectSSE();
    }

    // Fallback polling if SSE fails
    if (autoRefresh && !isConnected) {
      const interval = setInterval(() => {
        if (!cancelled) {
          fetchEvents();
        }
      }, refreshInterval);

      return () => {
        cancelled = true;
        clearInterval(interval);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [maxEvents, autoRefresh, refreshInterval, isConnected]);

  function getEventIcon(type: string) {
    if (type.includes("approval") || type.includes("approved")) {
      return <CheckCircle2 className="size-4 text-green-600" />;
    }
    if (type.includes("error") || type.includes("failed")) {
      return <AlertTriangle className="size-4 text-destructive" />;
    }
    if (type.includes("publish") || type.includes("created")) {
      return <Zap className="size-4 text-primary" />;
    }
    return <Activity className="size-4 text-muted-foreground" />;
  }

  function getEventTypeLabel(type: string): string {
    return type
      .split(".")
      .pop()
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()) || type;
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Recent Activity</span>
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full ${isConnected ? "bg-green-500" : "bg-muted"}`}
            title={isConnected ? "Connected" : "Disconnected"}
          />
          <span>{isConnected ? "Live" : "Polling"}</span>
        </div>
      </div>
      <ScrollArea className="h-[400px]">
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No recent events
          </div>
        ) : (
          <div className="space-y-2 pr-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <div className="mt-0.5">{getEventIcon(event.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {getEventTypeLabel(event.type)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {event.type.split(".")[0]}
                    </Badge>
                  </div>
                  {event.data && Object.keys(event.data).length > 0 && (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {JSON.stringify(event.data).substring(0, 100)}
                      {JSON.stringify(event.data).length > 100 && "..."}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>
                      {formatDistanceToNow(new Date(event.occurred_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
