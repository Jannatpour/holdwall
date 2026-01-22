import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "AAAL Templates",
  "Use structured AAAL templates to publish authoritative answers that AI systems can cite. Templates focus on evidence links, explicit scope, and versioned integrity.",
  "/resources/templates"
);

export default function ResourcesTemplatesPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">AAAL templates</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Use structured AAAL templates to publish authoritative answers that AI systems can cite. Templates
            focus on evidence links, explicit scope, and versioned integrity.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/resources">Back to resources</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studio">Open AAAL studio</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incident explanation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              A structured incident narrative: what happened, impact, mitigations, and verifiable evidence.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security posture</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              A trust artifact that maps controls to evidence and clarifies scope, assumptions, and updates.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product claims</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              A canonical answer artifact for recurring product narratives with evidence-backed proof points.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

