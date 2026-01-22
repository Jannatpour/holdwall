import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Pipeline",
  "A production ingestion and indexing pipeline that preserves provenance. Signals become normalized evidence, then structured claims, clusters, and indexable artifacts.",
  "/product/pipeline"
);

export default function ProductPipelinePage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            A production ingestion and indexing pipeline that preserves provenance. Signals become
            normalized evidence, then structured claims, clusters, and indexable artifacts.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/product">Back to product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/overview">See it live</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ingestion</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Multi-source collectors produce immutable evidence records with collection method,
              retention policy, and compliance flags.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Normalization</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Text/content is normalized and annotated so claims can be extracted consistently and
              traced back to raw sources.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indexing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Claims, evidence, and artifacts are indexed for fast global search and for retrieval
              in RAG/KAG workflows.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

