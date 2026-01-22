import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "AI Answer Monitoring & Authority (SKU A)",
  "Become the most cited source about your own criticism. Monitor → detect claim clusters → generate evidence-backed rebuttal artifacts → publish → measure answer shifts.",
  "/solutions/comms"
);

export default function SolutionsCommsPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline">SKU A</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">AI Answer Monitoring & Authority</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-7 font-medium text-primary">
            Become the most cited source about your own criticism.
          </p>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Core loop: Monitor → detect claim clusters → generate evidence-backed rebuttal artifacts → publish → measure answer shifts.
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            <strong>Primary Buyer:</strong> Head of Communications / Brand Risk
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/solutions">Back to solutions</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/overview">Open command center</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily executive brief</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              A stable daily summary of top claim clusters, outbreak probability, and recommended actions.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence-backed answers</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Draft AAAL artifacts that cite evidence IDs so answers remain defensible and consistent.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Governed autopilot</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Route work through approvals and audit logs, so comms velocity does not compromise trust.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

