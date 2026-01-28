import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { Shield, CheckCircle2, XCircle, AlertTriangle, Eye, Heart, Scale } from "@/components/demo-icons";

export const metadata: Metadata = genMeta(
  "Ethics & Governance",
  "Our approach to responsible AI, ethical automation, and transparent governance. No manipulation, no deception—only evidence and transparency.",
  "/ethics"
);

export default function EthicsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4" variant="outline">
            Responsible AI
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Ethics & governance
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Our approach to responsible AI, ethical automation, and transparent governance. 
            POS doesn&apos;t hide criticism—it becomes the most trusted interpreter of it, for both humans and machines.
            No manipulation, no deception—only evidence and transparency.
          </p>
        </div>
      </section>

      {/* Core Principles */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Core principles
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Evidence-First",
                description: "Every action backed by immutable evidence from public sources. No claims without proof.",
                icon: CheckCircle2,
              },
              {
                title: "Transparency",
                description: "Full disclosure of automated actions, clear attribution, and open audit trails.",
                icon: Eye,
              },
              {
                title: "No Manipulation",
                description: "We do not engage in fake reviews, impersonation, or deceptive practices.",
                icon: XCircle,
              },
              {
                title: "Human Oversight",
                description: "Critical actions require human approval. Automation is gated by policy checks.",
                icon: Shield,
              },
              {
                title: "Ethical Scraping",
                description: "Respect robots.txt, rate limits, and terms of service. Only public data.",
                icon: Heart,
              },
              {
                title: "Fair Representation",
                description: "We help organizations present accurate information, not suppress legitimate criticism.",
                icon: Scale,
              },
            ].map((principle) => (
              <Card key={principle.title}>
                <CardHeader>
                  <principle.icon className="mb-2 size-8 text-primary" />
                  <CardTitle>{principle.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{principle.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What We Don't Do */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What we don&apos;t do
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Clear boundaries on unethical practices we will never engage in
            </p>
          </div>
          <div className="mt-16 space-y-4">
            {[
              "Fake reviews or testimonials",
              "Impersonation of individuals or organizations",
              "Content takedown requests or censorship",
              "Deceptive manipulation of search results",
              "Astroturfing or sockpuppet accounts",
              "False attribution or citation fraud",
            ].map((item) => (
              <Card key={item} className="border-destructive/20">
                <CardContent className="flex items-center gap-4 p-6">
                  <XCircle className="size-6 text-destructive" />
                  <p className="font-medium">{item}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Governance Model */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Governance model
            </h2>
          </div>
          <div className="mt-16 space-y-8">
            {[
              {
                title: "Policy Gates",
                description: "Automated actions must pass policy checks before execution. High-risk actions always require approval.",
              },
              {
                title: "Approval Workflows",
                description: "Multi-level approval routing with role-based permissions and escalation paths.",
              },
              {
                title: "Audit Trails",
                description: "Complete traceability of all actions with immutable logs and one-click export.",
              },
              {
                title: "Human-in-the-Loop",
                description: "Critical decisions always involve human judgment. AI assists, humans decide.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Questions about our ethics?
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            We&apos;re committed to transparency. Contact us with any questions about our practices.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/auth/signin">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
