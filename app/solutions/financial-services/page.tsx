import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import {
  Building2,
  Shield,
  FileText,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Lock,
  BarChart3,
  Target,
  ArrowRight,
  Calendar,
  BookOpen,
} from "@/components/demo-icons";

export const metadata: Metadata = genMeta(
  "Financial Services - Banks, FinTech, Payments, Insurance",
  "POS for Financial Services: Turn narrative risk into a measurable, governable, auditable operational domain. Complete Day 1 → Day 7 → Day 30 operating playbook for financial institutions.",
  "/solutions/financial-services"
);

const narrativeCategories = [
  { name: "Scam / fraud accusations", impact: "High" },
  { name: "Account freezes / fund holds", impact: "High" },
  { name: "Hidden fees / unfair pricing", impact: "Medium" },
  { name: "Transaction failures", impact: "High" },
  { name: "Insurance claim denials", impact: "High" },
  { name: "Data privacy concerns", impact: "High" },
  { name: "Regulatory or legal allegations", impact: "Critical" },
  { name: "Platform outages / reliability", impact: "High" },
];

const day1Steps = [
  {
    step: 1,
    title: "Select Financial Risk Operating Mode",
    description: "Enable Narrative Risk Early Warning with financial-grade governance, legal approval gates, and higher evidence thresholds.",
  },
  {
    step: 2,
    title: "Connect Initial Data Sources",
    description: "Connect 3-5 sources: social channels, reviews, support tickets, incident logs, and policy documents.",
  },
  {
    step: 3,
    title: "Define Non-Starters & Escalation Rules",
    description: "Set hard rules: fraud/scam → Risk + Legal, regulator mentions → executive visibility, data breach → Security.",
  },
  {
    step: 4,
    title: "Receive First Perception Brief",
    description: "Get immediate visibility: top narrative clusters, severity scoring, velocity indicators, and outbreak probability.",
  },
];

const day7Steps = [
  {
    step: 5,
    title: "Select High-Risk Narrative Cluster",
    description: "Choose clusters like 'Bank froze my account' or 'Payment app scam' with full claim structure and evidence.",
  },
  {
    step: 6,
    title: "Generate Evidence-Backed Explanations",
    description: "POS produces public-facing explanations, internal risk briefs, and support playbooks from the same evidence spine.",
  },
  {
    step: 7,
    title: "Legal & Compliance Review",
    description: "In-system review with evidence sources, claim structure, exact language, and timestamped approvals.",
  },
  {
    step: 8,
    title: "Publish with Confidence",
    description: "Coordinate publication to trust pages, knowledge bases, and partner communications with AI-citable structure.",
  },
  {
    step: 9,
    title: "Measure Immediate Impact",
    description: "Track narrative velocity change, support ticket deflection, AI summary shifts, and escalation reduction.",
  },
];

const day30Steps = [
  {
    step: 10,
    title: "Monthly Impact & Risk Report",
    description: "Executive-ready reports showing outbreaks prevented, time-to-resolution, AI impact, and cost reduction.",
  },
  {
    step: 11,
    title: "Preemption Playbooks Go Live",
    description: "Predictive operations: detect signal drift, forecast complaints, pre-publish explanations before escalation.",
  },
  {
    step: 12,
    title: "Regulatory & Audit Readiness",
    description: "Export evidence bundles, approval trails, publication history, and impact metrics for regulatory exams.",
  },
];

const deliverables = [
  {
    title: "Daily / Weekly Perception Briefs",
    description: "Executive-ready summaries of narrative risk, velocity, and recommended actions.",
    icon: FileText,
  },
  {
    title: "Verified Evidence Vault",
    description: "Immutable evidence bundles with full provenance and audit-grade traceability.",
    icon: Lock,
  },
  {
    title: "Authoritative Public Explanations",
    description: "Evidence-backed explanations structured for both humans and AI systems.",
    icon: Shield,
  },
  {
    title: "Legal-Grade Audit Trails",
    description: "Complete approval history, versioning, and one-click export for regulatory review.",
    icon: FileText,
  },
  {
    title: "Forecasts of Emerging Risk",
    description: "Predictive analytics using Hawkes processes and belief graph modeling.",
    icon: TrendingUp,
  },
  {
    title: "Measured Impact on Trust and Cost",
    description: "ROI metrics: narrative risk reduction, support cost savings, legal exposure mitigation.",
    icon: BarChart3,
  },
];

export default function FinancialServicesSolutionPage() {
  return (
    <SiteShell>
      <div className="space-y-16">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-base px-3 py-1">
              Financial Services
            </Badge>
            <Badge variant="outline">SKU B</Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            POS for Financial Services
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Banks · FinTech · Payments · Insurance
          </p>
          <p className="text-lg text-muted-foreground max-w-3xl leading-7">
            Turn narrative risk into a <strong>measurable, governable, auditable operational domain</strong>. 
            POS gives financial institutions a governed, auditable way to see narrative risk early, 
            explain issues transparently, and prove that trust was protected—before regulators or AI systems decide for us.
          </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/demo">Try Interactive Demo</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/signin">Request a Demo</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/resources/playbooks">View Complete Playbook</Link>
              </Button>
            </div>
        </div>

        {/* Why Financial Institutions Buy POS */}
        <section className="space-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Why Financial Institutions Buy POS</h2>
            <p className="text-muted-foreground mt-2 max-w-3xl">
              Financial institutions operate in an environment where <strong>trust is fragile, narratives spread faster than facts, 
              and AI systems increasingly influence decisions</strong>.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>The Problem</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                    <span>Traditional tools react too late</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                    <span>Ownership fragmented across PR, Legal, Risk, Support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                    <span>Cannot prove impact or control AI-generated summaries</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>The Solution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  <strong className="text-foreground">POS exists to solve one core financial problem:</strong>
                </p>
                <blockquote className="border-l-4 border-primary pl-4 italic text-sm text-muted-foreground">
                  How your institution is perceived directly affects deposits, churn, regulatory scrutiny, 
                  fraud exposure, and long-term brand equity.
                </blockquote>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Who Uses POS */}
        <section className="space-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Who Uses POS Inside a Financial Institution</h2>
            <p className="text-muted-foreground mt-2">
              POS is not owned by one department—it is <strong>shared infrastructure</strong> with clear role boundaries.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <Users className="mb-2 size-8 text-primary" />
                <CardTitle>Primary Economic Owner</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Head of Brand Risk / Reputation / Trust</li>
                  <li>• Chief Risk Officer (CRO)</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="mb-2 size-8 text-primary" />
                <CardTitle>Mandatory Co-Owners</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Legal & Compliance</li>
                  <li>• Fraud & Risk Operations</li>
                  <li>• Customer Support / CX</li>
                  <li>• Security</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Building2 className="mb-2 size-8 text-primary" />
                <CardTitle>Executive Consumers</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• CEO / COO</li>
                  <li>• Board Risk Committee</li>
                  <li>• Regulatory Liaison Teams</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Narrative Categories */}
        <section className="space-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Core Narrative Categories</h2>
            <p className="text-muted-foreground mt-2">
              POS manages high-impact narrative categories that directly affect financial stability.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {narrativeCategories.map((category) => (
              <Card key={category.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{category.name}</CardTitle>
                    <Badge
                      variant={category.impact === "Critical" ? "destructive" : category.impact === "High" ? "default" : "outline"}
                      className="text-xs"
                    >
                      {category.impact}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">Why These Matter</h4>
              <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span>Influence customer churn</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span>Trigger regulatory scrutiny</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span>Affect AI-generated answers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span>Drive support volume and legal cost</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Day 1 → Day 7 → Day 30 Workflow */}
        <section className="space-y-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Day 1 → Day 7 → Day 30 Operating Model</h2>
            <p className="text-muted-foreground mt-2">
              This is exactly how a financial institution uses POS in real life.
            </p>
          </div>

          {/* Day 1 */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-base px-3 py-1">
                DAY 1
              </Badge>
              <h3 className="text-2xl font-semibold">Visibility, Control, and Safety</h3>
            </div>
            <p className="text-muted-foreground">
              Create immediate situational awareness and eliminate blind spots.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {day1Steps.map((step) => (
                <Card key={step.step}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {step.step}
                      </div>
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Day 1 Business Outcome</h4>
                    <p className="text-sm text-muted-foreground">
                      The institution knows what is forming. No guessing, no social media panic. Executives have immediate visibility.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day 7 */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-base px-3 py-1">
                DAY 7
              </Badge>
              <h3 className="text-2xl font-semibold">Authority, Control, and De-Escalation</h3>
            </div>
            <p className="text-muted-foreground">
              Replace speculation and emotion with verified, authoritative explanations.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {day7Steps.map((step) => (
                <Card key={step.step}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {step.step}
                      </div>
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Day 7 Business Outcome</h4>
                    <p className="text-sm text-muted-foreground">
                      The institution owns the explanation. Legal risk is controlled. Support volume stabilizes. Narratives stop accelerating.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day 30 */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-base px-3 py-1">
                DAY 30
              </Badge>
              <h3 className="text-2xl font-semibold">Governance, Proof, and Institutionalization</h3>
            </div>
            <p className="text-muted-foreground">
              Make narrative control part of financial risk governance, not a one-off response.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {day30Steps.map((step) => (
                <Card key={step.step}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {step.step}
                      </div>
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Day 30 Business Outcome</h4>
                    <p className="text-sm text-muted-foreground">
                      Narrative risk becomes measurable and manageable. Executives trust the system. Regulators see proactive governance. 
                      The institution stops reacting and starts leading.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Deliverables */}
        <section className="space-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">What Financial Institutions Receive</h2>
            <p className="text-muted-foreground mt-2">
              By Day 30, the institution has these operational assets.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {deliverables.map((deliverable) => (
              <Card key={deliverable.title}>
                <CardHeader>
                  <deliverable.icon className="mb-2 size-8 text-primary" />
                  <CardTitle className="text-base">{deliverable.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{deliverable.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Long-Term Value */}
        <section className="space-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Why Financial Institutions Keep POS Long-Term</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>POS Becomes Part Of</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    <span>Risk governance</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    <span>Regulatory posture</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    <span>Executive decision-making</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    <span>AI-era brand protection</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>POS Replaces</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-4 text-muted-foreground" />
                    <span>Fragmented monitoring tools</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-4 text-muted-foreground" />
                    <span>Manual war rooms</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-4 text-muted-foreground" />
                    <span>Reactive PR cycles</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-4 text-muted-foreground" />
                    <span>Unprovable reputation management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Executive Summary */}
        <section className="border-t pt-12">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-2xl">One-Sentence Explanation (For Financial Executives)</CardTitle>
            </CardHeader>
            <CardContent>
              <blockquote className="text-lg italic text-muted-foreground border-l-4 border-primary pl-6">
                "POS gives us a governed, auditable way to see narrative risk early, explain issues transparently, 
                and prove that trust was protected—before regulators or AI systems decide for us."
              </blockquote>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="border-t pt-12">
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">Ready to Get Started?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              This playbook is production-ready and can be used directly in enterprise sales, onboarding, 
              compliance review, and executive briefings.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-center">
                <Button asChild size="lg">
                  <Link href="/demo">Try Interactive Demo</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/signin">Request a Demo</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/resources/playbooks/financial-services">View Complete Playbook</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/solutions">Back to Solutions</Link>
                </Button>
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
