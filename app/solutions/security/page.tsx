import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Narrative Risk Early Warning (SKU B)",
  "Detect and defuse narrative outbreaks before virality. Ingest signals → diffusion forecasting (Hawkes + graph) → preemption playbooks → approvals → publish.",
  "/solutions/security"
);

export default function SolutionsSecurityPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline">SKU B</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Narrative Risk Early Warning</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-7 font-medium text-primary">
            Detect and defuse narrative outbreaks before virality.
          </p>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Core loop: Ingest signals → diffusion forecasting (Hawkes + graph) → preemption playbooks → approvals → publish.
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            <strong>Primary Buyer:</strong> Head of Trust & Safety / Risk
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/solutions">Back to solutions</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/security">Security overview</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security Incident Integration</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Connect with security tools (SIEM, SOAR) via webhooks. Automatically assess narrative risk 
              when security incidents occur and generate AI-governed explanations.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Narrative Risk Forecasting</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Advanced forecasting models predict narrative outbreak probability for security incidents. 
              Hawkes process and graph-based diffusion models identify high-risk scenarios.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preemption Playbooks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Automated playbooks for security incident narratives. Pre-built templates for data breaches, 
              ransomware, DDoS, and other common security incidents.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit bundle exports</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Generate PDF executive summaries and JSON evidence bundles that map to immutable event lineage.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role gates</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Enforce approvals and permissions so high-impact publishing is human-gated and reviewable.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trust asset library</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Consolidate trust artifacts, policies, and evidence so procurement and customers can self-serve.
            </CardContent>
          </Card>
        </div>
        <div className="rounded-lg border bg-primary/5 p-4">
          <h3 className="font-semibold mb-2">Enhanced with Security Incident Capabilities</h3>
          <p className="text-sm text-muted-foreground">
            SKU B now includes security incident narrative management. When security incidents occur, 
            automatically assess narrative risk, generate evidence-backed explanations, and ensure AI 
            systems cite your authoritative voice. See <Link href="/solutions/security-incidents" className="text-primary underline">SKU D</Link> for 
            dedicated security incident narrative management.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}

