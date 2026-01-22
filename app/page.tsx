import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { SchemaGenerator } from "@/lib/seo/schema-generator";

// Generate metadata - simplified to prevent build/runtime errors
export const metadata: Metadata = {
  title: "Home | Holdwall POS",
  description: "Perception Operating System: Turn narrative risk into a measurable, forecastable domain. Make negative narratives structurally non-decisive through evidence, provenance, and AI-answer authority.",
  openGraph: {
    title: "Home | Holdwall POS",
    description: "Perception Operating System: Turn narrative risk into a measurable, forecastable domain.",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com",
    siteName: "Holdwall POS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Home | Holdwall POS",
    description: "Perception Operating System: Turn narrative risk into a measurable, forecastable domain.",
  },
};
import {
  Shield,
  Network,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle2,
  ArrowRight,
  Users,
  Building2,
  Globe,
  Lock,
  BarChart3,
  Sparkles,
  Radio,
  AlertTriangle,
} from "lucide-react";

export default function Home() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com";
    const schemaGenerator = new SchemaGenerator();
    const organizationSchema = schemaGenerator.generateOrganization({
    name: "Holdwall",
    description:
      "Perception Operating System: An evidence-first, AI-native system that makes claims about an organization auditable, forecastable, and governable—for both humans and AI decision systems.",
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    contactPoint: {
      email: "contact@holdwall.com",
    },
    sameAs: [
      "https://twitter.com/holdwall",
      "https://linkedin.com/company/holdwall",
    ],
  });

  const productSchema = schemaGenerator.generateProduct({
    name: "Holdwall POS",
    description: "Perception Operating System: Evidence-first narrative governance for the AI era",
    url: `${baseUrl}/product`,
    brand: "Holdwall",
    category: "Software",
  });

  const softwareSchema = schemaGenerator.generateSoftwareApplication({
    name: "Holdwall POS",
    description: "Perception Operating System for evidence-first, agentic perception engineering",
    url: baseUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
  });

  const breadcrumbSchema = schemaGenerator.generateBreadcrumbs([
    { name: "Home", url: baseUrl },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      <div className="min-h-screen bg-background">
        <SiteHeader />

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4" variant="outline">
            Perception Operating System
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Turn narrative risk into a measurable, forecastable domain
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            POS makes negative narratives <strong>structurally non-decisive</strong> by building an Authoritative Evidence Layer and an AI-Answer Authority Layer. 
            No takedowns. No manipulation. Only evidence, provenance, and governance.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/signin">Request a Demo</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/product">See the Platform</Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>Evidence-first architecture</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>Audit-grade provenance</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>AI-answer authority</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>Human-gated autopilot</span>
            </div>
          </div>
        </div>
      </section>

      {/* What POS Is & Is Not */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What POS is (and what it&apos;s not)
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              POS is a <strong>perception governance system</strong>: it turns narrative risk into a measurable, forecastable domain and routes responses through evidence, policy, and approvals.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Not SEO tooling",
                description: "POS can improve search outcomes, but it is not keyword-first.",
                icon: AlertTriangle,
                negative: true,
              },
              {
                title: "Not PR software",
                description: "POS supports comms, but it is not a campaign manager.",
                icon: AlertTriangle,
                negative: true,
              },
              {
                title: "Evidence-first governance",
                description: "POS builds authoritative evidence layers with full provenance and audit trails.",
                icon: CheckCircle2,
                negative: false,
              },
              {
                title: "AI-answer authority",
                description: "POS produces AI-citable artifacts so AI systems quote your authoritative explanation.",
                icon: Sparkles,
                negative: false,
              },
            ].map((item) => (
              <Card key={item.title} className={item.negative ? "border-destructive/20" : ""}>
                <CardHeader>
                  <item.icon className={`mb-2 size-8 ${item.negative ? "text-destructive" : "text-primary"}`} />
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

      {/* What POS Delivers */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What POS delivers
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Outcomes, not just features. Four core capabilities that make negative narratives structurally non-decisive.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Authoritative Evidence Layer",
                description: "Immutable, provable evidence bundles with provenance, policy, and audit-grade traceability.",
                icon: FileText,
              },
              {
                title: "Narrative Intelligence",
                description: "Claim clustering, belief graphs, and outbreak forecasting using diffusion-native models.",
                icon: Network,
              },
              {
                title: "AI Answer Authority",
                description: "Artifacts formatted to become cited sources in AI answers (AEO-native).",
                icon: Sparkles,
              },
              {
                title: "Human-Gated Autopilot",
                description: "Playbooks that can draft/route/publish with explicit governance gates and approvals.",
                icon: Shield,
              },
            ].map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 size-8 text-primary" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How Customers Use POS */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How customers use POS
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              The daily operating loop: from perception briefs to measurable impact
            </p>
          </div>
          <div className="mt-16">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                { 
                  step: 1, 
                  title: "Morning Perception Brief", 
                  description: "10 minutes: See top emerging claim clusters, outbreak probability, and available evidence.",
                  time: "10 min"
                },
                { 
                  step: 2, 
                  title: "Generate Response Plan", 
                  description: "20-60 minutes: Click a cluster → POS shows claim graph and drafts public explanation, internal brief, and support macros.",
                  time: "20-60 min"
                },
                { 
                  step: 3, 
                  title: "Governance & Approvals", 
                  description: "Same day: Comms drafts → Legal approves → Exec approves (if needed). Full audit trail.",
                  time: "Same day"
                },
                { 
                  step: 4, 
                  title: "Publish & Measure", 
                  description: "1-14 days: Publish to trust center/knowledge base. Measure outbreak probability drop, narrative velocity, and AI answer shifts.",
                  time: "1-14 days"
                },
              ].map((item) => (
                <Card key={item.step}>
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {item.step}
                      </div>
                      <Badge variant="outline" className="text-xs">{item.time}</Badge>
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Launch SKUs */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Three launch SKUs
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Start with one wedge product. Each SKU uses the same POS platform backbone.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-3">
            {[
              {
                sku: "SKU A",
                title: "AI Answer Monitoring & Authority",
                promise: "Become the most cited source about your own criticism",
                buyer: "Head of Communications / Brand Risk",
                coreLoop: "Monitor → detect claim clusters → generate evidence-backed rebuttal artifacts → publish → measure answer shifts",
                icon: Sparkles,
                link: "/solutions/comms",
              },
              {
                sku: "SKU B",
                title: "Narrative Risk Early Warning",
                promise: "Detect and defuse narrative outbreaks before virality",
                buyer: "Head of Trust & Safety / Risk",
                coreLoop: "Ingest signals → diffusion forecasting (Hawkes + graph) → preemption playbooks → approvals → publish",
                icon: AlertTriangle,
                link: "/solutions/security",
              },
              {
                sku: "SKU C",
                title: "Evidence-Backed Intake & Case Triage",
                promise: "Turn inbound allegations into verifiable, provable case files",
                buyer: "Legal / Claims Management",
                coreLoop: "Evidence vault → claim extraction → verification → structured intake packet → CRM handoff",
                icon: FileText,
                link: "/solutions/procurement",
              },
            ].map((sku) => (
              <Card key={sku.sku} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline">{sku.sku}</Badge>
                    <sku.icon className="size-6 text-primary" />
                  </div>
                  <CardTitle>{sku.title}</CardTitle>
                  <CardDescription className="font-medium text-primary">
                    {sku.promise}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Buyer</p>
                    <p className="mt-1 text-sm">{sku.buyer}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Core Loop</p>
                    <p className="mt-1 text-sm text-muted-foreground">{sku.coreLoop}</p>
                  </div>
                  <Button asChild variant="ghost" className="w-full justify-start mt-4">
                    <Link href={sku.link}>
                      Learn More <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Stories */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How organizations use POS
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Three concrete customer stories
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-3">
            {[
              {
                industry: "Financial Services",
                challenge: "Scam narratives on social/Reddit",
                useCase: "Early warning + authoritative explanation + trust substitution",
                dailyActions: [
                  "Monitor 'scam/fraud' clusters",
                  "Forecast whether it will spike",
                  "Publish evidence-backed explainer + metrics",
                  "Route to legal approvals"
                ],
                outcome: "Narratives become less decisive; executives see measurable reduction in spread",
                icon: Building2,
              },
              {
                industry: "SaaS Company",
                challenge: "Complaints about outages and reliability",
                useCase: "Incident narrative control + transparency",
                dailyActions: [
                  "POS detects outage chatter across channels",
                  "Auto-generates incident timeline + explanation",
                  "Publishes postmortem + SLA updates",
                  "Measures churn-risk signals and support deflection"
                ],
                outcome: "Fewer escalations, faster comms, improved trust",
                icon: Network,
              },
              {
                industry: "Healthcare / Legal",
                challenge: "Sensitive allegations and claims intake",
                useCase: "Evidence vault + defensible case packets",
                dailyActions: [
                  "Capture inbound allegations",
                  "Extract claims and verify against evidence",
                  "Package complete 'audit bundle' for legal/case management"
                ],
                outcome: "Faster triage, fewer bad cases, higher defensibility",
                icon: Shield,
              },
            ].map((story) => (
              <Card key={story.industry} className="hover:border-primary transition-colors">
                <CardHeader>
                  <story.icon className="mb-2 size-8 text-primary" />
                  <CardTitle>{story.industry}</CardTitle>
                  <CardDescription className="font-medium">{story.challenge}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Use Case</p>
                    <p className="mt-1 text-sm">{story.useCase}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Actions</p>
                    <ul className="mt-2 space-y-1">
                      {story.dailyActions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1 size-1.5 rounded-full bg-primary" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outcome</p>
                    <p className="mt-1 text-sm font-medium">{story.outcome}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security, Safety, Ethics */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Security, safety, and ethics
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Trust infrastructure built for enterprise and regulated industries
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Governance & Approvals",
                description: "Human-gated workflows with role-based access controls and approval routing.",
                icon: Shield,
              },
              {
                title: "Evidence Provenance",
                description: "Immutable evidence vault with cryptographic hashes and full traceability.",
                icon: Lock,
              },
              {
                title: "Tenant Isolation",
                description: "Complete data isolation with encrypted storage and secure multi-tenancy.",
                icon: Network,
              },
              {
                title: "Audit Trails",
                description: "Comprehensive logging and one-click audit bundle export for compliance.",
                icon: FileText,
              },
              {
                title: "Safe Automation",
                description: "Policy gates ensure automated actions meet safety and compliance standards.",
                icon: CheckCircle2,
              },
              {
                title: "What We Don't Do",
                description: "No fake reviews, impersonation, manipulation, or deception. Only evidence and transparency.",
                icon: AlertTriangle,
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <item.icon className="mb-2 size-8 text-primary" />
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

      {/* Metrics & Business Value */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Metrics & business value
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Four tiers of measurable ROI: operational efficiency, risk reduction, authority lift, and counterfactual impact
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                tier: "Operational Efficiency",
                metrics: [
                  "Time-to-brief reduction",
                  "Time-to-approved artifact",
                  "Analyst hours saved via routing/cascades"
                ],
                icon: TrendingUp,
              },
              {
                tier: "Risk Reduction",
                metrics: [
                  "Outbreak probability delta",
                  "Cascade intensity delta (diffusion model)",
                  "Prevented narrative outbreaks"
                ],
                icon: Shield,
              },
              {
                tier: "Authority Lift",
                metrics: [
                  "AI citation capture rate",
                  "Authoritative artifact index coverage",
                  "Answer sentiment shift"
                ],
                icon: Sparkles,
              },
              {
                tier: "Counterfactual Impact",
                metrics: [
                  "With intervention vs without (simulated)",
                  "Executive-ready impact attribution",
                  "ROI proof for procurement"
                ],
                icon: BarChart3,
              },
            ].map((tier) => (
              <Card key={tier.tier}>
                <CardHeader>
                  <tier.icon className="mb-2 size-8 text-primary" />
                  <CardTitle className="text-lg">{tier.tier}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tier.metrics.map((metric, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1 size-1.5 rounded-full bg-primary" />
                        {metric}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Choose the plan that fits your needs
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {[
              {
                name: "Team",
                price: "$2,500",
                period: "/month",
                description: "For one comms/security pod managing a narrow surface area",
                features: [
                  "Signals ingestion + claims + clustering",
                  "Evidence vault + traceability",
                  "AAAL authoring + approvals",
                  "Forecasting + daily executive brief",
                ],
                cta: "Start with Team",
                popular: false,
              },
              {
                name: "Company",
                price: "$9,500",
                period: "/month",
                description: "For multiple teams with shared governance and publishing",
                features: [
                  "Everything in Team",
                  "Playbooks + autopilot modes",
                  "Audit bundle export",
                  "PADL publishing for trust pages",
                ],
                cta: "Choose Company",
                popular: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "",
                description: "For regulated orgs with strict controls, scale, and integrations",
                features: [
                  "SSO + role-based access",
                  "Advanced policy checks",
                  "Dedicated ingestion connectors",
                  "Security reviews + procurement support",
                ],
                cta: "Contact Sales",
                popular: false,
              },
            ].map((plan) => (
              <Card key={plan.name} className={plan.popular ? "border-primary" : ""}>
                <CardHeader>
                  {plan.popular && (
                    <Badge className="mb-2 w-fit">Most Popular</Badge>
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full" variant={plan.popular ? "default" : "outline"}>
                    <Link href="/auth/signin">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Try the Interactive Demo
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Experience the complete platform with our step-by-step interactive walkthrough. 
              See every feature from authentication to publishing—no account required.
            </p>
          </div>
          <div className="mt-12">
            <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-background">
              <CardHeader className="text-center">
                <Sparkles className="mx-auto mb-4 size-12 text-primary" />
                <CardTitle className="text-2xl">Complete Platform Demo</CardTitle>
                <CardDescription className="text-base">
                  52 comprehensive steps covering all 18 sections of Holdwall POS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    "Step-by-step guidance",
                    "Progress tracking",
                    "Auto-play mode",
                    "Real platform integration",
                    "Keyboard shortcuts",
                    "Complete coverage",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="size-5 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  <Button asChild size="lg">
                    <Link href="/demo">Start Interactive Demo</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/product">Learn More About Features</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Resources
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Learn more about perception engineering and narrative risk
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Interactive Demo",
                description: "Step-by-step walkthrough of all features",
                link: "/demo",
                icon: Sparkles,
                highlight: true,
              },
              {
                title: "Documentation",
                description: "Complete API reference and guides",
                link: "/resources/docs",
                icon: FileText,
              },
              {
                title: "Case Studies",
                description: "See how organizations use Holdwall",
                link: "/resources/cases",
                icon: BarChart3,
              },
              {
                title: "Security & Compliance",
                description: "Learn about our security practices",
                link: "/security",
                icon: Lock,
              },
              {
                title: "Ethics & Governance",
                description: "Our approach to responsible AI",
                link: "/ethics",
                icon: Shield,
              },
              {
                title: "Compliance",
                description: "Regulatory compliance information",
                link: "/compliance",
                icon: CheckCircle2,
              },
              {
                title: "Blog",
                description: "Latest insights and updates",
                link: "/resources/blog",
                icon: Globe,
              },
            ].map((resource) => (
              <Card 
                key={resource.title} 
                className={`hover:border-primary transition-colors ${resource.highlight ? "border-primary border-2" : ""}`}
              >
                <CardHeader>
                  <resource.icon className="mb-2 size-8 text-primary" />
                  <CardTitle>{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link href={resource.link}>
                      Learn More <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            POS doesn&apos;t hide criticism—it becomes the most trusted interpreter of it, for both humans and machines.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/signin">Request a Demo</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/product">See the Platform</Link>
            </Button>
          </div>
        </div>
      </section>

        <SiteFooter />
      </div>
    </>
  );
}
