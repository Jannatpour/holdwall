import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { FinancialServicesPlaybookContent } from "@/components/financial-services/playbook-content";
import { Building2, ArrowLeft, Download } from "lucide-react";

export const metadata: Metadata = genMeta(
  "Financial Services Playbook - Complete Operating Guide",
  "Complete Day 1 → Day 7 → Day 30 operating playbook for Banks, FinTech, Payments, and Insurance. Production-ready for enterprise sales, onboarding, compliance review, and executive briefings.",
  "/resources/playbooks/financial-services"
);

export default async function FinancialServicesPlaybookPage() {
  return (
    <SiteShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="size-8 text-primary" />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">POS for Financial Services</h1>
                <p className="text-muted-foreground mt-1">
                  Banks · FinTech · Payments · Insurance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Complete Operating Playbook</Badge>
              <Badge variant="outline">Enterprise-Ready</Badge>
            </div>
            <p className="text-muted-foreground max-w-3xl italic">
              This playbook is exhaustive, non-marketing, and written for direct use in enterprise
              sales, onboarding, compliance review, and executive briefings.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild variant="outline">
            <Link href="/resources/playbooks">
              <ArrowLeft className="mr-2 size-4" />
              Back to Playbooks
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/solutions/financial-services">
              View Solution Page
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api/playbooks/financial-services" target="_blank">
              <Download className="mr-2 size-4" />
              Download JSON
            </Link>
          </Button>
        </div>

        {/* Playbook Content */}
        <Card>
          <CardContent className="pt-6">
            <FinancialServicesPlaybookContent />
          </CardContent>
        </Card>
      </div>
    </SiteShell>
  );
}
