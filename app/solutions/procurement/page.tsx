import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Evidence-Backed Intake & Case Triage (SKU C)",
  "Turn inbound allegations into verifiable, provable case files. Evidence vault → claim extraction → verification → structured intake packet → CRM handoff.",
  "/solutions/procurement"
);

export default function SolutionsProcurementPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline">SKU C</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Evidence-Backed Intake & Case Triage</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-7 font-medium text-primary">
            Turn inbound allegations into verifiable, provable case files.
          </p>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Core loop: Evidence vault → claim extraction → verification → structured intake packet → CRM handoff.
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            <strong>Primary Buyer:</strong> Legal / Claims Management
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/solutions">Back to solutions</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/governance">Open governance</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Answer packs</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Export a consistent set of artifacts and evidence references for recurring questionnaires.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lineage</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Every decision is attributable via correlation IDs and audit logs so reviewers can verify context.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Ensure only approved answers are published or shared externally, with explicit decisions and reasons.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

