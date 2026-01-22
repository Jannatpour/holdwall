import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Solutions",
  "Three launch SKUs: AI Answer Monitoring & Authority (SKU A), Narrative Risk Early Warning (SKU B), and Evidence-Backed Intake & Case Triage (SKU C). Each SKU uses the same POS platform backbone.",
  "/solutions"
);
import {
  Building2,
  Users,
  FileText,
  Globe,
  MessageSquare,
  Shield,
  ShoppingCart,
  HeadphonesIcon,
} from "lucide-react";

const solutions = [
  {
    sku: "SKU A",
    title: "AI Answer Monitoring & Authority",
    promise: "Become the most cited source about your own criticism",
    buyer: "Head of Communications / Brand Risk",
    description: "Monitor → detect claim clusters → generate evidence-backed rebuttal artifacts → publish → measure answer shifts.",
    href: "/solutions/comms",
    icon: MessageSquare,
  },
  {
    sku: "SKU B",
    title: "Narrative Risk Early Warning",
    promise: "Detect and defuse narrative outbreaks before virality",
    buyer: "Head of Trust & Safety / Risk",
    description: "Ingest signals → diffusion forecasting (Hawkes + graph) → preemption playbooks → approvals → publish.",
    href: "/solutions/security",
    icon: Shield,
  },
  {
    sku: "SKU C",
    title: "Evidence-Backed Intake & Case Triage",
    promise: "Turn inbound allegations into verifiable, provable case files",
    buyer: "Legal / Claims Management",
    description: "Evidence vault → claim extraction → verification → structured intake packet → CRM handoff.",
    href: "/solutions/procurement",
    icon: ShoppingCart,
  },
  {
    title: "Support & Ops",
    description: "Connect incident reality to public perception and route high-signal actions.",
    href: "/solutions/support",
    icon: HeadphonesIcon,
  },
];

const industrySolutions = [
  {
    title: "Financial Services",
    description: "Banks, FinTech, Payments, Insurance. Turn narrative risk into a measurable, governable, auditable operational domain with Day 1 → Day 7 → Day 30 operating playbook.",
    icon: Building2,
    href: "/solutions/financial-services",
    useCases: [
      "Scam/fraud narrative management",
      "Regulatory compliance & audit readiness",
      "Financial-grade governance",
      "Legal approval workflows",
    ],
  },
  {
    title: "Enterprise Risk Management",
    description: "Monitor narrative threats across all channels, predict outbreaks, and maintain authoritative response artifacts.",
    icon: Shield,
    useCases: [
      "Multi-channel threat monitoring",
      "Predictive risk analytics",
      "Audit-ready documentation",
      "Regulatory compliance",
    ],
  },
  {
    title: "Public Relations & Communications",
    description: "Track sentiment drift, identify emerging narratives, and publish evidence-backed responses at scale.",
    icon: Users,
    useCases: [
      "Real-time sentiment tracking",
      "Narrative clustering",
      "Rapid response workflows",
      "Crisis management",
    ],
  },
  {
    title: "Compliance & Legal",
    description: "Maintain immutable evidence trails, export audit bundles, and demonstrate due diligence.",
    icon: FileText,
    useCases: [
      "Immutable evidence vault",
      "One-click audit export",
      "Regulatory compliance",
      "Legal documentation",
    ],
  },
  {
    title: "AI System Integration",
    description: "Provide authoritative sources for AI systems through PADL, reducing hallucination and improving trust.",
    icon: Globe,
    useCases: [
      "PADL publishing",
      "Structured artifacts",
      "AI citation tracking",
      "Trust asset management",
    ],
  },
];

export default function SolutionsPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Three Launch SKUs</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Start with one wedge product. Each SKU has opinionated onboarding, pre-built workflows, 
            limited surface area, and clear ROI metrics—all using the same POS platform backbone.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/product">Explore platform</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/signin">Request a Demo</Link>
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Launch SKUs</h2>
          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
            {solutions.filter(s => s.sku).map((s) => (
              <Card key={s.href} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{s.sku}</Badge>
                    <s.icon className="size-6 text-primary" />
                  </div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription className="font-medium text-primary">
                    {s.promise}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Buyer</p>
                    <p className="mt-1 text-sm">{s.buyer}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Core Loop</p>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full mt-4">
                    <Link href={s.href}>View solution</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {solutions.filter(s => !s.sku).map((s) => (
              <Card key={s.href} className="flex flex-col">
                <CardHeader>
                  <s.icon className="mb-2 size-8 text-primary" />
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline" size="sm">
                    <Link href={s.href}>View solution</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Customer Stories</h2>
          <p className="text-muted-foreground mb-6">
            How organizations use POS to manage narrative risk and build trust
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            {industrySolutions.map((solution) => (
              <Card key={solution.title} className={solution.href ? "hover:border-primary transition-colors" : ""}>
                <CardHeader>
                  <solution.icon className="mb-2 size-8 text-primary" />
                  <CardTitle>{solution.title}</CardTitle>
                  <CardDescription>{solution.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <h4 className="font-semibold mb-3">Key Use Cases</h4>
                  <ul className="space-y-2">
                    {solution.useCases.map((useCase) => (
                      <li key={useCase} className="text-sm text-muted-foreground">
                        • {useCase}
                      </li>
                    ))}
                  </ul>
                  {solution.href && (
                    <Button asChild variant="outline" size="sm" className="w-full mt-4">
                      <Link href={solution.href}>View Solution</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
