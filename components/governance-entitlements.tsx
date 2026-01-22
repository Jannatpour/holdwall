"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Entitlement = {
  id: string;
  metric: string;
  soft_limit: number;
  hard_limit: number;
  enforcement: string;
  current_usage: number;
  counter: null | {
    value: number;
    period: string;
    last_reset: string;
    next_reset: string;
  };
};

export function GovernanceEntitlements() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (status === "unauthenticated") {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (status === "loading") {
          return;
        }

        const res = await fetch("/api/governance/entitlements", { credentials: "include" });
        if (res.status === 401) {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (!res.ok) throw new Error("Failed to load entitlements");
        const json = await res.json();
        if (!cancelled) setEntitlements((json.entitlements || []) as Entitlement[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load entitlements");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const rows = useMemo(() => {
    return entitlements.map((e) => {
      const limit = e.hard_limit || e.soft_limit || 0;
      const usage = e.counter ? e.counter.value : e.current_usage;
      const pct = limit > 0 ? Math.round((usage / limit) * 100) : 0;
      return { ...e, usage, pct: Math.min(100, Math.max(0, pct)) };
    });
  }, [entitlements]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metering & entitlements</CardTitle>
        <CardDescription>Usage counters and limits by metric</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No entitlements configured</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{row.metric}</div>
                  <div className="text-xs text-muted-foreground">
                    Enforcement: <span className="font-mono">{row.enforcement}</span>
                    {row.counter ? (
                      <>
                        {" "}
                        • Period: <span className="font-mono">{row.counter.period}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {row.usage.toLocaleString()} / {row.hard_limit.toLocaleString()}
                  </div>
                  <Badge variant={row.pct >= 100 ? "destructive" : "outline"} className="text-xs">
                    {row.pct}%
                  </Badge>
                </div>
              </div>
              <Progress value={row.pct} />
              {row.counter ? (
                <div className="text-xs text-muted-foreground">
                  Resets at {new Date(row.counter.next_reset).toLocaleString()}
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

