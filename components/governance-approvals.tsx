"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Approval = {
  id: string;
  resourceType: string;
  resourceId: string;
  action: string;
  requesterId: string;
  decision: string | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  artifactId: string | null;
};

export function GovernanceApprovals({ focusApprovalId }: { focusApprovalId?: string | null }) {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});


  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Don't call protected APIs until auth state is known.
        if (status === "unauthenticated") {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (status === "loading") {
          return;
        }

        const res = await fetch("/api/approvals?status=pending", { credentials: "include" });
        if (res.status === 401) {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (!res.ok) throw new Error("Failed to load approvals");
        const json = (await res.json()) as Approval[];
        if (!cancelled) {
          setApprovals(json);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load approvals");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const ordered = useMemo(() => {
    if (!focusApprovalId) return approvals;
    return [...approvals].sort((a, b) => (a.id === focusApprovalId ? -1 : b.id === focusApprovalId ? 1 : 0));
  }, [approvals, focusApprovalId]);

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    setProcessing((p) => ({ ...p, [approvalId]: true }));
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          approval_id: approvalId,
          decision,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit decision");
      }
      toast.success(decision === "approved" ? "Approved" : "Rejected");
      // Refresh approvals list
      const refreshRes = await fetch("/api/approvals?status=pending", { credentials: "include" });
      if (refreshRes.status === 401) {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (refreshRes.ok) {
        const refreshJson = (await refreshRes.json()) as Approval[];
        setApprovals(refreshJson);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit decision");
    } finally {
      setProcessing((p) => ({ ...p, [approvalId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
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

  if (ordered.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending approvals</CardTitle>
          <CardDescription>No items require approval right now</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {ordered.map((a) => {
        const reviewHref =
          a.resourceType === "AAAL_ARTIFACT" || a.artifactId
            ? `/studio?artifact=${a.resourceId}`
            : a.resourceType === "CLAIM_CLUSTER"
              ? `/claims?cluster=${a.resourceId}`
              : "/governance";

        return (
          <div
            key={a.id}
            className={[
              "flex items-center justify-between rounded-lg border p-4",
              a.id === focusApprovalId ? "border-primary" : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">
                  {a.resourceType} • {a.action}
                </div>
                <Badge variant="outline" className="text-xs">
                  PENDING
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Resource: <span className="font-mono">{a.resourceId}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Created: {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={reviewHref}>Review</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => decide(a.id, "rejected")}
                disabled={processing[a.id]}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => decide(a.id, "approved")}
                disabled={processing[a.id]}
              >
                Approve
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

