import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Claims & Clustering",
  "Holdwall extracts claims from evidence, tracks variant phrasings, and clusters narratives so teams can work the highest-deciding storylines first.",
  "/product/claims"
);

export default function ProductClaimsPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Claims & clustering</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Holdwall extracts claims from evidence, tracks variant phrasings, and clusters narratives so
            teams can work the highest-deciding storylines first.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/product">Back to product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/claims">Open claims in app</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extraction</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Extracts canonical claims from evidence and records the evidence references for each claim.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variants</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Tracks alternate phrasings so teams can recognize the same narrative across channels.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clustering</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Groups related claims into clusters and prioritizes by decisiveness, not just volume.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

