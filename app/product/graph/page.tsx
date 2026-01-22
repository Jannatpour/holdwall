import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Belief Graph",
  "Model narrative dynamics as a belief graph. Track reinforcement, neutralization, and decay so structurally weak claims stop driving decisions.",
  "/product/graph"
);

export default function ProductGraphPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Belief graph</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Model narrative dynamics as a belief graph. Track reinforcement, neutralization, and decay so
            structurally weak claims stop driving decisions.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/product">Back to product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/graph">Open graph in app</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nodes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Claims, narratives, proof points, and emotions can all be represented as nodes with trust and
              decisiveness scores.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edges</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Reinforcement and neutralization edges encode how one node affects another and how influence
              changes over time.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time decay</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Decay factors and actor-weighting prevent stale narratives from remaining structurally decisive.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

