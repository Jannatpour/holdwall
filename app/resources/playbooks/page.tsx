import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Playbooks",
  "Holdwall playbooks are executable workflows that can draft, route, and publish responses—always with auditability and explicit approvals when required.",
  "/resources/playbooks"
);

export default function ResourcesPlaybooksPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Playbooks</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Holdwall playbooks are executable workflows that can draft, route, and publish responses—always
            with auditability and explicit approvals when required.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/resources">Back to resources</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/playbooks">Open playbooks in app</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Operating Playbooks</h2>
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              <Card className="hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg">Financial Services</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Complete Day 1 → Day 7 → Day 30 operating playbook for Banks, FinTech, Payments, and Insurance.
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Production-ready playbook for enterprise sales, onboarding, compliance review, and executive briefings.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/solutions/financial-services">View Solution</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/resources/playbooks/financial-services">
                        View Full Playbook
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Playbook Types</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommend only</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-6">
                  Generate recommended actions and drafts without executing side effects.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Auto-draft</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-6">
                  Draft artifacts and responses automatically, then route for human review.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Auto-route / auto-publish</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-6">
                  Route approvals automatically and publish when policy gates are satisfied.
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

