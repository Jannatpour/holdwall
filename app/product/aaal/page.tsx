import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "AAAL Studio",
  "Authoritative artifacts (AAAL) are built to be cited. Holdwall links each section to evidence, enforces policy checks, and routes approvals before publishing to PADL.",
  "/product/aaal"
);

export default function ProductAAALPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">AAAL studio</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Authoritative artifacts (AAAL) are built to be cited. Holdwall links each section to evidence,
            enforces policy checks, and routes approvals before publishing to PADL.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/product">Back to product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studio">Open AAAL studio</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence-backed sections</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Every claim can be tied to evidence IDs and immutable provenance, enabling verifiable responses.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policy checks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Before publication, artifacts can run policy checks and produce auditable results for governance.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">PADL publishing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Publish signed, versioned artifacts to a public delivery layer for trust pages and AI citation.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

