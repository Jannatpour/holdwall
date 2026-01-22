import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Resources",
  "Practical frameworks and artifacts for teams using Holdwall POS. Documentation, case studies, playbooks, AAAL templates, and changelog.",
  "/resources"
);

const resources = [
  {
    title: "Playbooks",
    description: "Operational response playbooks you can run and audit.",
    href: "/resources/playbooks",
  },
  {
    title: "AAAL templates",
    description: "Structured templates for authoritative answers with evidence links.",
    href: "/resources/templates",
  },
  {
    title: "Documentation",
    description: "System overview, API reference, and operational guidance.",
    href: "/resources/docs",
  },
  {
    title: "Changelog",
    description: "Notable product and platform changes.",
    href: "/resources/changelog",
  },
  {
    title: "Case studies",
    description: "How teams use Holdwall to manage narrative risk.",
    href: "/resources/cases",
  },
  {
    title: "Blog",
    description: "Articles on trust, perception engineering, and AI citation.",
    href: "/resources/blog",
  },
];

export default function ResourcesPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Resources</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Practical frameworks and artifacts for teams using Holdwall POS. Use these resources to stand up
            evidence-first workflows, publish authoritative answers, and measure narrative risk impact.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/product">Explore platform</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/solutions">View solutions</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Interactive Demo",
              description: "Step-by-step walkthrough of all platform features",
              href: "/demo",
              highlight: true,
            },
            ...resources,
          ].map((r) => (
            <Card key={r.href} className={`flex flex-col ${(r as any).highlight ? "border-primary border-2" : ""}`}>
              <CardHeader>
                <CardTitle className="text-base">{r.title}</CardTitle>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant={(r as any).highlight ? "default" : "outline"} size="sm">
                  <Link href={r.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}

