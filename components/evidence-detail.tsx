"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ExternalLink, FileText, Shield } from "@/components/demo-icons";

type EvidenceRecord = {
  id: string;
  tenant_id: string;
  type: string;
  source: {
    type: string;
    id: string;
    url: string | null;
    collected_at: string;
    collected_by: string;
    method: string;
  };
  content: {
    raw: string | null;
    normalized: string | null;
    metadata: Record<string, unknown> | null;
  };
  created_at: string;
  updated_at: string;
  links?: {
    claims: Array<{ id: string; canonicalText: string }>;
    artifacts: Array<{ id: string; title: string; status: string }>;
    events: Array<{ id: string; type: string; correlationId: string; occurredAt: string }>;
  };
};

export function EvidenceDetail({ evidenceId }: { evidenceId: string }) {
  const [data, setData] = useState<EvidenceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/evidence?id=${encodeURIComponent(evidenceId)}&include=links`);
        if (!res.ok) throw new Error("Failed to fetch evidence");
        const json = (await res.json()) as EvidenceRecord;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch evidence");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [evidenceId]);

  const content = useMemo(() => {
    if (!data) return "";
    return (data.content.normalized || data.content.raw || "").toString();
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive">Error: {error || "Not found"}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base">Evidence {data.id}</CardTitle>
              <CardDescription className="mt-2">
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{data.type}</Badge>
                  <Badge variant="secondary">{data.source.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Collected {new Date(data.created_at).toLocaleString()}
                  </span>
                </span>
              </CardDescription>
            </div>
            {data.source.url ? (
              <Button asChild variant="outline" size="sm">
                <Link href={data.source.url} target="_blank" rel="noreferrer">
                  Source <ExternalLink className="ml-2 size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-sm whitespace-pre-wrap break-words">
              {content || "No content"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Source ID: <span className="font-mono">{data.source.id}</span> • Method:{" "}
            <span className="font-mono">{data.source.method}</span> • Collected by{" "}
            <span className="font-mono">{data.source.collected_by}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked claims</CardTitle>
            <CardDescription>Claims supported by this evidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.links?.claims?.length ? (
              data.links.claims.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="min-w-0 text-sm truncate">{c.canonicalText}</div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/claims/${c.id}`}>
                      <Shield className="mr-2 size-4" />
                      Open
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No linked claims</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked artifacts</CardTitle>
            <CardDescription>AAAL artifacts referencing this evidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.links?.artifacts?.length ? (
              data.links.artifacts.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.status}</div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/studio?artifact=${a.id}`}>
                      <FileText className="mr-2 size-4" />
                      Open
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No linked artifacts</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit & events</CardTitle>
            <CardDescription>Immutable event lineage references</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.links?.events?.length ? (
              data.links.events.slice(0, 10).map((e) => (
                <div key={e.id} className="rounded-md border p-2">
                  <div className="text-sm font-medium">{e.type}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.occurredAt).toLocaleString()} • correlation{" "}
                    <span className="font-mono">{e.correlationId}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No linked events</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

