import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Support & Operations",
  "Close the gap between what happened and what people believe happened. Holdwall surfaces high-signal clusters, ties them to evidence, and routes playbooks so teams can respond quickly and consistently.",
  "/solutions/support"
);

export default function SolutionsSupportPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Support & ops</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Close the gap between what happened and what people believe happened. Holdwall surfaces high-signal
            clusters, ties them to evidence, and routes playbooks so teams can respond quickly and consistently.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/solutions">Back to solutions</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/signals">Open signals</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Triage</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Convert streaming signals into clustered narratives so operations teams can focus on what matters.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Playbooks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Execute response workflows with autopilot modes and explicit approval steps when required.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">After-action proof</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Export a complete evidence bundle so incidents can be explained to customers and procurement.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

