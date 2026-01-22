import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Case Studies",
  "Examples of how evidence-first perception engineering changes outcomes. These case studies describe repeatable workflows rather than one-off heroics.",
  "/resources/cases"
);

const cases = [
  {
    title: "Reliability narrative containment",
    body: "Signals were clustered into a single reliability storyline, an AAAL incident artifact was published, and approvals routed before public release.",
  },
  {
    title: "Procurement acceleration",
    body: "A recurring questionnaire was answered via a reusable trust bundle: audit export + signed artifact + evidence references.",
  },
  {
    title: "Support perception alignment",
    body: "Support incidents were linked to evidence and communicated through governed playbooks so public claims matched operational reality.",
  },
];

export default function ResourcesCasesPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Case studies</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Examples of how evidence-first perception engineering changes outcomes. These case studies describe
            repeatable workflows rather than one-off heroics.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/resources">Back to resources</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/solutions">Explore solutions</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {cases.map((c) => (
            <Card key={c.title}>
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
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
