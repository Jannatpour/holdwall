import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Documentation",
  "System overview and operational guidance for deploying Holdwall: data model, APIs, security controls, and production operations.",
  "/resources/docs"
);

export default function ResourcesDocsPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            System overview and operational guidance for deploying Holdwall: data model, APIs, security controls,
            and production operations.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/resources">Back to resources</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/product">Explore product</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Core concepts</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Evidence vault, claims, clusters, belief graph, forecasts, artifacts, approvals, and audit bundles.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API surface</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              App Router API routes for ingestion, retrieval, orchestration, governance, and exports.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operations</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Rate limiting, health checks, logging, and incident response patterns for production deployments.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}
