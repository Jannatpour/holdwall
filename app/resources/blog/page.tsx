import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Blog",
  "Articles on evidence-first workflows, perception engineering, and publishing trust artifacts.",
  "/resources/blog"
);

const posts = [
  {
    title: "Why evidence beats vibes in the AI narrative",
    date: "2026-01-12",
    body: "A practical guide to making your answers citeable: provenance, versioning, and governance.",
  },
  {
    title: "Outbreak probability: forecasting narratives before they spike",
    date: "2026-01-03",
    body: "How drift signals, amplification, and sentiment combine into actionable risk scoring.",
  },
  {
    title: "From incident to trust artifact: shipping AAAL",
    date: "2025-12-18",
    body: "A repeatable workflow for converting operational truth into public, authoritative artifacts.",
  },
];

export default function ResourcesBlogPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Articles on evidence-first workflows, perception engineering, and publishing trust artifacts.
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
          {posts.map((p) => (
            <Card key={p.title}>
              <CardHeader>
                <CardTitle className="text-base">{p.title}</CardTitle>
                <div className="text-sm text-muted-foreground">{p.date}</div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                {p.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
