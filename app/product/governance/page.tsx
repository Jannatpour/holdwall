import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Governance & Audits",
  "Holdwall ships governance as a first-class capability: approvals, role gates, audit logs, and exportable bundles for procurement, incident reviews, and regulatory compliance.",
  "/product/governance"
);

export default function ProductGovernancePage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Governance & audits</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Holdwall ships governance as a first-class capability: approvals, role gates, audit logs, and exportable
            bundles for procurement, incident reviews, and regulatory compliance.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/product">Back to product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/governance">Open governance in app</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Route actions through approvers with clear decisions, reasons, and timestamps—no hidden automation.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit trails</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Activity is logged as events with correlation IDs for lineage tracing and incident reconstruction.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exportable bundles</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Generate PDF summaries and JSON evidence packages so audits and procurement can be answered quickly.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

