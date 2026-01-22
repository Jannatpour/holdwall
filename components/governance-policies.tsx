"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Policy = {
  id: string;
  sourceType: string;
  allowedSources: string[];
  collectionMethod: string;
  retentionDays: number;
  autoDelete: boolean;
  complianceFlags: string[];
  updatedAt: string;
};

export function GovernancePolicies() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);

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

        const res = await fetch("/api/governance/policies", { credentials: "include" });
        if (res.status === 401) {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (!res.ok) throw new Error("Failed to load policies");
        const json = await res.json();
        if (!cancelled) setPolicies((json.policies || []) as Policy[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load policies");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

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
        <CardTitle>Policies</CardTitle>
        <CardDescription>Source compliance policies by source type</CardDescription>
      </CardHeader>
      <CardContent>
        {policies.length === 0 ? (
          <div className="text-sm text-muted-foreground">No policies configured</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source type</TableHead>
                <TableHead>Collection method</TableHead>
                <TableHead>Retention (days)</TableHead>
                <TableHead>Auto-delete</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.sourceType}</TableCell>
                  <TableCell>{p.collectionMethod}</TableCell>
                  <TableCell>{p.retentionDays}</TableCell>
                  <TableCell>
                    <Badge variant={p.autoDelete ? "default" : "secondary"}>
                      {p.autoDelete ? "on" : "off"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.complianceFlags || []).slice(0, 6).map((f) => (
                        <Badge key={f} variant="outline" className="text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

