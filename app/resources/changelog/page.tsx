import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Changelog",
  "Notable changes to Holdwall. For operational incidents, publish an AAAL artifact and reference it from your trust pages.",
  "/resources/changelog"
);

const changes = [
  {
    date: "2026-01-20",
    title: "Marketing site & navigation",
    body: "Public site pages added for product, solutions, trust, and resources.",
  },
  {
    date: "2026-01-15",
    title: "Audit bundle export",
    body: "PDF/JSON export route for procurement-ready audit bundles.",
  },
  {
    date: "2026-01-05",
    title: "Global search",
    body: "Search across claims, evidence, artifacts, and signals via a unified API endpoint.",
  },
];

export default function ResourcesChangelogPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Notable changes to Holdwall. For operational incidents, publish an AAAL artifact and reference it
            from your trust pages.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/resources">Back to resources</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/product">Explore product</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {changes.map((c) => (
            <Card key={`${c.date}-${c.title}`}>
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
                <div className="text-sm text-muted-foreground">{c.date}</div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                {c.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}

