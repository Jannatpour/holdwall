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
  description: "When narratives shape reality, evidence shapes narratives. Partner with Holdwall to transform narrative risk into strategic advantage through evidence-first governance, advanced AI, and authoritative positioning.",
  openGraph: {
    title: "Home | Holdwall POS",
    description: "Transform narrative risk into strategic advantage. Evidence-first perception governance powered by 21 advanced AI models.",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com",
    siteName: "Holdwall POS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Home | Holdwall POS",
    description: "Transform narrative risk into strategic advantage. Evidence-first perception governance powered by 21 advanced AI models.",
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
      "Perception Operating System: A strategic partnership platform that transforms narrative risk into competitive advantage through evidence-first governance, advanced AI infrastructure, and authoritative positioning for both human decision-makers and AI systems.",
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
    description: "Perception Operating System: Strategic narrative governance that transforms risk into advantage through evidence, advanced AI, and partnership",
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

      {/* Hero Section - Innovative Creative Design */}
      <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24 overflow-hidden">
        {/* Dynamic Animated Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,255,255,0.15),transparent_50%)] animate-spin-slow" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(0,255,255,0.1),transparent_50%)] animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '25s' }} />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="mx-auto max-w-5xl text-center relative">
          {/* Badge with shimmer effect */}
          <Badge className="mb-8 animate-fade-in-up glass-effect hover:scale-105 transition-transform duration-300" variant="outline">
            <Sparkles className="mr-2 size-3 inline-block animate-pulse" />
            Perception Operating System
          </Badge>
          
          {/* Main headline with gradient animation */}
          <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl gradient-text animate-fade-in-up animation-delay-100">
            When narratives shape reality,<br />evidence shapes narratives
          </h1>
          
          {/* Concise, strategic subheading */}
          <p className="mx-auto mt-8 max-w-2xl text-xl leading-8 text-muted-foreground animate-fade-in-up animation-delay-200 font-medium">
            Control which sources AI systems cite about your organization. Transform security incidents into trust-building opportunities.
          </p>
          
          {/* Primary CTAs - SKU D First */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
            {/* SKU D - PRIMARY - MOST PROMINENT */}
            <Button asChild size="lg" className="group relative overflow-hidden bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary hover:via-primary hover:to-primary shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-105 border-2 border-primary/30 w-full sm:w-auto min-w-[280px] animate-glow">
              <Link href="/solutions/security-incidents" className="flex items-center justify-center gap-2.5 text-primary-foreground font-bold text-base px-6 py-3">
                <Shield className="size-5 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300" />
                <span>Security Incidents (SKU D)</span>
                <Badge className="bg-primary-foreground text-primary text-xs font-bold px-2 py-0.5 shadow-lg animate-bounce">NEW</Badge>
                <ArrowRight className="size-4 group-hover:translate-x-2 transition-transform" />
              </Link>
            </Button>
            
            <Button asChild size="lg" variant="outline" className="group glass-effect hover:bg-primary/5 w-full sm:w-auto transition-all duration-300 hover:scale-105">
              <Link href="/demo" className="flex items-center justify-center gap-2">
                <Sparkles className="size-4 group-hover:rotate-180 transition-transform duration-500" />
                Try Interactive Demo
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
          
          {/* Streamlined feature highlights */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm animate-fade-in-up animation-delay-400">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-effect border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
              <Sparkles className="size-3.5 text-primary" />
              <span>21 AI models</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-effect border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
              <Shield className="size-3.5 text-primary animate-pulse" />
              <span className="font-semibold">SKU D: Security Incidents</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-effect border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
              <Radio className="size-3.5 text-primary" />
              <span>AI citation tracking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Strategic Approach - Streamlined */}
      <section className="border-y bg-gradient-to-b from-muted/30 to-background py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Strategic partnership, not point solutions
            </h2>
            <p className="mt-6 text-lg leading-7 text-muted-foreground">
              Evidence-first governance that earns trust through transparency. Transform how your organization understands, responds to, and shapes narratives.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Proactive, not reactive",
                description: "Prevent issues before they escalate",
                icon: Shield,
              },
              {
                title: "Unified, not fragmented",
                description: "Shared infrastructure across teams",
                icon: Network,
              },
              {
                title: "Evidence-first",
                description: "Full provenance and audit trails",
                icon: FileText,
              },
              {
                title: "AI authority",
                description: "Ensure AI systems cite your voice",
                icon: Sparkles,
              },
            ].map((item, idx) => (
              <Card key={item.title} className="group hover-lift border-primary/10 hover:border-primary/30 transition-all duration-300 animate-scale-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                <CardHeader className="pb-3">
                  <item.icon className="mb-3 size-7 text-primary group-hover:scale-110 transition-transform" />
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Core Capabilities - Streamlined */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Transform risk into advantage
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Strategic capabilities that give your organization confidence, control, and credibility.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Evidence Layer",
                description: "Immutable evidence bundles with cryptographic provenance",
                icon: FileText,
              },
              {
                title: "Narrative Intelligence",
                description: "21 AI models surface emerging narratives before they become crises",
                icon: Network,
              },
              {
                title: "AI Citation",
                description: "Ensure AI systems cite your authoritative voice",
                icon: Sparkles,
              },
              {
                title: "Human-Gated Automation",
                description: "Scale expertise without sacrificing control",
                icon: Shield,
              },
            ].map((feature, idx) => (
              <Card key={feature.title} className="group hover-lift border-primary/10 hover:border-primary/30 transition-all duration-300 animate-slide-in-right" style={{ animationDelay: `${idx * 0.1}s` }}>
                <CardHeader className="pb-3">
                  <feature.icon className="mb-3 size-7 text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow - Streamlined */}
      <section className="border-y bg-gradient-to-b from-background to-muted/20 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              From reactive to proactive
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Transform daily operations with clarity and confidence. Become the most trusted interpreter of your narrative.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { 
                step: 1, 
                title: "Strategic Brief", 
                description: "Start each day with clarity—emerging narratives and evidence in 10 minutes",
                time: "10 min"
              },
              { 
                step: 2, 
                title: "Response Planning", 
                description: "Collaboratively draft authoritative responses that satisfy all stakeholders",
                time: "20-60 min"
              },
              { 
                step: 3, 
                title: "Governance", 
                description: "Built-in approval workflows maintain speed without sacrificing rigor",
                time: "Same day"
              },
              { 
                step: 4, 
                title: "Measure Impact", 
                description: "Track reduced narrative velocity, improved AI citations, and trust lift",
                time: "1-14 days"
              },
            ].map((item, idx) => (
              <Card key={item.step} className="group hover-lift border-primary/10 hover:border-primary/30 transition-all duration-300 animate-scale-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                <CardHeader className="pb-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary group-hover:scale-110 transition-transform">
                      {item.step}
                    </div>
                    <Badge variant="outline" className="text-xs">{item.time}</Badge>
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Features - SKU D Prominent */}
      <section className="relative border-y bg-gradient-to-br from-primary/5 via-background to-primary/5 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,255,255,0.05),transparent_50%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 animate-pulse glass-effect" variant="outline">
              <Sparkles className="mr-2 size-3 inline-block" />
              January 2026
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Continuously evolving
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Advanced analytics, autonomous processing, and deeper insights for navigating complex narrative landscapes.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Security Incidents (SKU D)",
                description: "AI-governed explanations with real-time risk assessment and multi-engine citation tracking",
                icon: Shield,
                new: true,
                link: "/solutions/security-incidents",
                highlight: true,
              },
              {
                title: "Signals Analytics",
                description: "Real-time statistics, trend visualization, and AI-powered insights",
                icon: BarChart3,
                new: true,
                link: "/signals",
              },
              {
                title: "Autonomous Processing",
                description: "Automatic triage and resolution generation with full control",
                icon: Sparkles,
                new: true,
                link: "/cases",
              },
              {
                title: "Source Health",
                description: "Real-time tracking and automated compliance checks",
                icon: CheckCircle2,
                new: true,
                link: "/governance/sources",
              },
              {
                title: "POS Dashboard",
                description: "Complete Perception Operating System capabilities",
                icon: Network,
                new: true,
                link: "/pos",
              },
              {
                title: "AI Citation Tracking",
                description: "Real-time monitoring across Perplexity, Gemini, and Claude",
                icon: Radio,
                new: true,
                link: "/ai-answer-monitor",
              },
            ].map((feature, idx) => (
              <Card 
                key={feature.title} 
                className={`group relative overflow-hidden hover-lift transition-all duration-300 animate-slide-in-right ${
                  feature.highlight 
                    ? 'border-primary border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg hover:shadow-xl animate-glow' 
                    : 'border-primary/10 hover:border-primary/30'
                }`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/0 transition-all duration-500" />
                
                <CardHeader className="relative z-10 pb-3">
                  <div className="mb-2 flex items-center justify-between">
                    <feature.icon className={`size-6 text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform ${feature.highlight ? 'animate-pulse' : ''}`} />
                    <div className="flex items-center gap-2">
                      {feature.new && (
                        <Badge variant="outline" className="text-xs">New</Badge>
                      )}
                      {feature.highlight && (
                        <Badge className="text-xs bg-primary text-primary-foreground shadow-lg animate-bounce">SKU D</Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-base group-hover:text-primary transition-colors">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm text-muted-foreground mb-3">{feature.description}</p>
                  {feature.link && (
                    <Button variant="ghost" size="sm" asChild className="w-full justify-start group/btn">
                      <Link href={feature.link} className="flex items-center">
                        Learn More 
                        <ArrowRight className="ml-2 size-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Launch SKUs - SKU D Prominent */}
      <section className="relative border-y bg-gradient-to-b from-muted/50 via-primary/5 to-muted/50 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-effect border border-primary/50 animate-pulse">
              <Shield className="size-4 text-primary" />
              <span className="text-xs font-bold text-primary">FEATURING SKU D: Security Incident Narrative Management</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Four strategic entry points, one platform
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Start with the solution that addresses your most pressing challenge, then seamlessly expand. When you control the narrative, you control the outcome.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
            {[
              {
                sku: "SKU A",
                title: "AI Answer Authority",
                promise: "Ensure AI systems cite your authoritative voice",
                buyer: "Head of Communications",
                icon: Sparkles,
                link: "/solutions/comms",
                highlights: ["AI citation tracking", "Real-time monitoring", "Evidence-backed artifacts"],
              },
              {
                sku: "SKU B",
                title: "Narrative Risk Early Warning",
                promise: "See crises coming before they arrive",
                buyer: "Head of Trust & Safety",
                icon: AlertTriangle,
                link: "/solutions/security",
                highlights: ["Hawkes forecasting", "Outbreak models", "Preemption playbooks"],
              },
              {
                sku: "SKU C",
                title: "Evidence-Backed Intake",
                promise: "Turn allegations into defensible case files",
                buyer: "Legal / Claims",
                icon: FileText,
                link: "/solutions/procurement",
                highlights: ["Automated extraction", "Evidence verification", "Audit-grade files"],
              },
              {
                sku: "SKU D",
                title: "Security Incident Management",
                promise: "Govern how AI systems understand security incidents",
                buyer: "CISO / Head of Security",
                icon: Shield,
                link: "/solutions/security-incidents",
                highlights: [
                  "SIEM/SOAR integration",
                  "Automated risk assessment",
                  "Multi-engine AI citation tracking",
                  "Measurable trust lift"
                ],
              },
            ].map((sku, idx) => (
              <Card 
                key={sku.sku} 
                className={`group relative overflow-hidden hover-lift transition-all duration-300 animate-scale-in ${
                  sku.sku === 'SKU D' 
                    ? 'border-primary border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg hover:shadow-xl animate-glow' 
                    : 'border-primary/10 hover:border-primary/30'
                }`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                {sku.sku === 'SKU D' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/0 animate-pulse opacity-50" />
                )}
                
                <CardHeader className="relative z-10 pb-3">
                  <div className="mb-3 flex items-center justify-between">
                    <Badge 
                      variant={sku.sku === 'SKU D' ? 'default' : 'outline'} 
                      className={sku.sku === 'SKU D' ? 'bg-primary text-primary-foreground shadow-md animate-bounce' : ''}
                    >
                      {sku.sku}
                    </Badge>
                    <sku.icon className={`size-6 text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform ${sku.sku === 'SKU D' ? 'animate-pulse' : ''}`} />
                  </div>
                  <CardTitle className="text-base group-hover:text-primary transition-colors">{sku.title}</CardTitle>
                  <CardDescription className="font-medium text-primary mt-2 text-sm">
                    {sku.promise}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Buyer</p>
                    <p className="mt-1 text-sm">{sku.buyer}</p>
                  </div>
                  {sku.highlights && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Capabilities</p>
                      <ul className="space-y-1.5">
                        {sku.highlights.slice(0, 3).map((highlight, hIdx) => (
                          <li key={hIdx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-primary" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start mt-4 group/btn">
                    <Link href={sku.link} className="flex items-center">
                      Learn More 
                      <ArrowRight className="ml-2 size-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Stories - Streamlined */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              How organizations partner with Holdwall
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Real stories from organizations that transformed narrative risk into strategic advantage.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-2">
            {[
              {
                industry: "Financial Services",
                challenge: "Scam narratives threatening customer trust and regulatory relationships",
                useCase: "Strategic early warning system with authoritative evidence-based responses",
                dailyActions: [
                  "Proactively monitor emerging 'scam/fraud' narrative clusters",
                  "Forecast outbreak probability with advanced modeling",
                  "Collaboratively develop evidence-backed explanations",
                  "Route through legal and compliance with full context"
                ],
                outcome: "67% reduction in narrative spread, 45% faster response time, measurable trust lift in AI citations. Executives now have confidence in their narrative posture.",
                icon: Building2,
              },
              {
                industry: "SaaS Company",
                challenge: "Incident-related narratives eroding customer confidence and retention",
                useCase: "Transparent incident communication that builds trust through evidence",
                dailyActions: [
                  "Detect and understand incident narratives across all channels",
                  "Collaboratively develop transparent timelines and explanations",
                  "Publish authoritative postmortems with measurable commitments",
                  "Track narrative impact on customer sentiment and retention"
                ],
                outcome: "80% reduction in support escalations, 3x faster incident response, 92% customer satisfaction. Customers now trust the company's transparency.",
                icon: Network,
              },
              {
                industry: "Healthcare / Legal",
                challenge: "Complex allegations requiring defensible, verifiable case management",
                useCase: "Evidence-first case intake that reduces risk while accelerating resolution",
                dailyActions: [
                  "Systematically capture and structure inbound allegations",
                  "Verify claims against authoritative evidence sources",
                  "Package complete audit bundles that satisfy legal and regulatory requirements"
                ],
                outcome: "60% faster case triage, 40% reduction in false claims, 100% audit-grade defensibility. Legal teams have confidence in their case posture.",
                icon: Shield,
              },
              {
                industry: "Enterprise Technology",
                challenge: "Security incidents creating narrative crises that erode customer trust and investor confidence",
                useCase: "AI-governed security incident narrative management with real-time citation tracking",
                dailyActions: [
                  "Automatically ingest security incidents from SIEM/SOAR tools",
                  "Assess narrative risk and forecast outbreak probability in real-time",
                  "Generate evidence-backed explanations through AI governance workflows",
                  "Route through Legal, Comms, and Executive with complete context",
                  "Monitor when Perplexity, Gemini, and Claude cite your authoritative explanation"
                ],
                outcome: "78% reduction in narrative spread after incidents, 4.2x increase in AI citation rate for incident explanations, measurable trust lift in customer surveys. When security incidents occur, AI systems now cite your transparent explanation—not speculation.",
                icon: Lock,
              },
            ].map((story) => (
              <Card key={story.industry} className="group relative overflow-hidden hover:border-primary transition-all duration-300 hover-lift hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/0 transition-all duration-500" />
                <CardHeader className="relative z-10">
                  <story.icon className="mb-2 size-8 text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300" />
                  <CardTitle className="group-hover:text-primary transition-colors">{story.industry}</CardTitle>
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

      {/* Security, Safety, Ethics - Streamlined */}
      <section className="border-y bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Built on trust and security
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Enterprise-grade security, compliance, and ethical governance that meets the highest standards.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Governance & Approvals",
                description: "Empower your teams with intelligent workflows that maintain control while enabling speed. Role-based access ensures the right people see the right information at the right time.",
                icon: Shield,
              },
              {
                title: "Evidence Provenance",
                description: "Build unshakeable confidence with immutable evidence vaults. Cryptographic hashes and complete traceability ensure your evidence stands up to the most rigorous scrutiny.",
                icon: Lock,
              },
              {
                title: "Tenant Isolation",
                description: "Your data remains yours, always. Complete isolation with encrypted storage and secure multi-tenancy architecture ensures your information is protected at every layer.",
                icon: Network,
              },
              {
                title: "Audit Trails",
                description: "Demonstrate compliance with confidence. Comprehensive logging and one-click audit bundle export make regulatory reviews straightforward and defensible.",
                icon: FileText,
              },
              {
                title: "Safe Automation",
                description: "Scale your capabilities without compromising safety. Policy gates ensure every automated action meets your organization's standards for safety, compliance, and ethical governance.",
                icon: CheckCircle2,
              },
              {
                title: "Our Ethical Commitment",
                description: "We believe trust is built through transparency, not manipulation. We never engage in fake reviews, impersonation, or deception. Only evidence, only truth, only trust.",
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

      {/* Metrics & Business Value - Streamlined */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Measurable impact
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Concrete metrics that demonstrate tangible impact to executives and stakeholders.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                tier: "Operational Efficiency",
                metrics: [
                  "70% reduction in time-to-brief (10 min vs 35 min)",
                  "60% faster time-to-approved artifact",
                  "50+ analyst hours saved per month via AI routing"
                ],
                icon: TrendingUp,
              },
              {
                tier: "Risk Reduction",
                metrics: [
                  "85% accuracy in outbreak probability forecasting",
                  "67% reduction in narrative cascade intensity",
                  "Prevent 3-5 major outbreaks per quarter"
                ],
                icon: Shield,
              },
              {
                tier: "Authority Lift",
                metrics: [
                  "3-5x increase in AI citation capture rate",
                  "90%+ authoritative artifact index coverage",
                  "Measurable answer sentiment shift (negative → neutral/positive)",
                  "4.2x AI citation rate for security incident explanations",
                  "Real-time monitoring across Perplexity, Gemini, Claude"
                ],
                icon: Sparkles,
              },
              {
                tier: "Counterfactual Impact",
                metrics: [
                  "Simulated impact: 40-60% reduction in narrative spread",
                  "Executive-ready ROI dashboards",
                  "Procurement-ready impact attribution reports"
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

      {/* AI Infrastructure - Streamlined */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Advanced AI infrastructure
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              21 advanced models working together to give you capabilities competitors cannot match.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                category: "Graph Neural Networks",
                count: "7 Models",
                models: ["CODEN", "TIP-GNN", "RGP", "TGNF", "NGM", "ReaL-TG", "Explainable Forecast"],
                icon: Network,
              },
              {
                category: "Advanced RAG/KAG",
                count: "14 Models",
                models: ["GraphRAG", "KERAG", "CoRAG", "Agentic RAG", "Multimodal RAG", "CAG", "Knowledge Fusion"],
                icon: Sparkles,
              },
              {
                category: "AI Evaluation",
                count: "8 Frameworks",
                models: ["DeepTRACE", "CiteGuard", "GPTZero", "Galileo Guard", "Judge Framework", "Groundedness"],
                icon: CheckCircle2,
              },
              {
                category: "Semantic Search",
                count: "6 Embeddings",
                models: ["Voyage AI", "Gemini", "OpenAI", "NVIDIA NV-Embed", "Qwen3", "BGE-M3"],
                icon: BarChart3,
              },
            ].map((item) => (
              <Card key={item.category}>
                <CardHeader>
                  <item.icon className="mb-2 size-8 text-primary" />
                  <CardTitle className="text-lg">{item.category}</CardTitle>
                  <CardDescription className="font-semibold text-primary">{item.count}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {item.models.slice(0, 4).map((model, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        • {model}
                      </li>
                    ))}
                    {item.models.length > 4 && (
                      <li className="text-xs text-muted-foreground italic">
                        +{item.models.length - 4} more
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Citation - Streamlined */}
      <section className="border-y bg-gradient-to-br from-primary/5 via-background to-primary/5 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 glass-effect" variant="outline">
              AI Governance
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Control how AI systems understand your organization
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              When Perplexity, Gemini, and Claude answer questions about your security incidents, ensure they cite your authoritative explanation—not speculation.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
            {[
              {
                title: "Multi-Engine Monitoring",
                description: "Track citations across Perplexity, Gemini, and Claude in real-time",
                icon: Radio,
                metrics: "4.2x citation rate increase",
              },
              {
                title: "Incident → Citation Pipeline",
                description: "Automatically generate explanations and monitor AI citations",
                icon: Shield,
                metrics: "78% reduction in narrative spread",
              },
              {
                title: "Measurable Trust Lift",
                description: "Track how authoritative explanations influence AI answers",
                icon: TrendingUp,
                metrics: "Measurable trust lift",
              },
            ].map((item, idx) => (
              <Card key={item.title} className="group hover-lift border-primary/10 hover:border-primary/30 transition-all duration-300 animate-slide-in-right" style={{ animationDelay: `${idx * 0.1}s` }}>
                <CardHeader className="pb-3">
                  <item.icon className="mb-3 size-7 text-primary group-hover:scale-110 transition-transform" />
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription className="font-medium text-primary mt-2 text-sm">
                    {item.metrics}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" variant="outline" className="glass-effect">
              <Link href="/solutions/security-incidents">
                Explore SKU D <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing - Streamlined */}
      <section className="border-y bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
              Investment that grows with you
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Start with focused capability, then seamlessly expand. Every plan includes our complete AI infrastructure.
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {[
              {
                name: "Team",
                price: "$2,500",
                period: "/month",
                annualPrice: "$25,000",
                annualSavings: "Save $5,000/year",
                description: "Ideal for organizations beginning their narrative governance journey, with focused needs and a clear path to expansion",
                features: [
                  "1 SKU (choose A, B, or C)",
                  "Signals ingestion + AI-powered claim clustering",
                  "Evidence vault with full provenance",
                  "AAAL authoring with basic approvals",
                  "Daily executive brief + forecasting",
                  "Access to 21 AI models",
                  "Basic playbooks",
                  "Email support",
                ],
                cta: "Start with Team",
                popular: false,
              },
              {
                name: "Company",
                price: "$9,500",
                period: "/month",
                annualPrice: "$95,000",
                annualSavings: "Save $19,000/year",
                description: "Designed for organizations ready to scale narrative governance across teams, with advanced automation and comprehensive governance",
                features: [
                  "All 4 SKUs (A, B, C, D)",
                  "Everything in Team",
                  "Advanced playbooks + autopilot modes",
                  "Multi-stage approval workflows",
                  "Audit bundle export (PDF/JSON)",
                  "PADL publishing for trust pages",
                  "Advanced forecasting + intervention simulation",
                  "MCP/ACP agent orchestration",
                  "Priority support + onboarding",
                ],
                cta: "Choose Company",
                popular: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "",
                annualPrice: "",
                annualSavings: "",
                description: "Tailored for organizations with complex regulatory requirements, enterprise-scale needs, and strategic partnership priorities",
                features: [
                  "Everything in Company",
                  "SSO + advanced RBAC/ABAC",
                  "Dedicated ingestion connectors",
                  "Custom AI model fine-tuning",
                  "Advanced policy engine",
                  "Dedicated infrastructure options",
                  "Security reviews + compliance support",
                  "Custom SLA + dedicated support",
                  "White-glove onboarding",
                ],
                cta: "Contact Sales",
                popular: false,
              },
            ].map((plan) => (
              <Card key={plan.name} className={`relative ${plan.popular ? "border-primary border-2 shadow-lg" : ""}`}>
                <CardHeader>
                  {plan.popular && (
                    <Badge className="mb-2 w-fit bg-primary">Most Popular</Badge>
                  )}
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    {plan.annualPrice && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">
                          <span className="line-through">{plan.annualPrice}/year</span>
                          <span className="ml-2 font-semibold text-primary">{plan.annualSavings}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <CardDescription className="mt-2 text-base">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full mt-6" size="lg" variant={plan.popular ? "default" : "outline"}>
                    <Link href={plan.name === "Enterprise" ? "/auth/signin" : "/auth/signin"}>{plan.cta}</Link>
                  </Button>
                  {plan.name !== "Enterprise" && (
                    <p className="text-center text-xs text-muted-foreground">
                      Start free trial • No credit card required
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section - Enhanced */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.05),transparent_50%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              Experience the platform that transforms narrative risk into strategic advantage
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              We believe in transparency and confidence-building. Our interactive demo lets you experience the complete platform 
              at your own pace, with step-by-step guidance that shows you exactly how leading organizations use Holdwall to 
              build their narrative governance capabilities. No account required—just exploration and understanding.
            </p>
          </div>
          <div className="mt-12">
            <Card className="group relative overflow-hidden border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="text-center relative z-10">
                <Sparkles className="mx-auto mb-4 size-12 text-primary animate-pulse group-hover:rotate-180 transition-transform duration-500" />
                <CardTitle className="text-2xl bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                  Complete Platform Demo
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  15 categorized steps covering authentication, onboarding, dashboards, signals, integrations, and evidence—from account creation to evidence exploration. 
                  Experience how leading organizations build their narrative governance capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 relative z-10">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    "Step-by-step guidance",
                    "Progress tracking",
                    "Auto-play mode",
                    "Real platform integration",
                    "Keyboard shortcuts",
                    "Complete coverage",
                  ].map((feature, idx) => (
                    <div key={feature} className="flex items-center gap-2 group/feature hover:scale-105 transition-transform duration-300">
                      <CheckCircle2 className="size-5 text-primary group-hover/feature:scale-110 transition-transform" />
                      <span className="text-sm group-hover/feature:text-foreground transition-colors">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  <Button asChild size="lg" className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                    <Link href="/demo" className="flex items-center gap-2">
                      <Sparkles className="size-4 group-hover:rotate-180 transition-transform duration-500" />
                      Start Interactive Demo
                      <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="group hover:scale-105 transition-all duration-300">
                    <Link href="/product" className="flex items-center gap-2">
                      Explore Strategic Capabilities
                      <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
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
              Resources to support your strategic journey
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Building narrative governance capabilities is a journey, not a destination. We've curated resources to help you 
              understand not just what Holdwall does, but how it transforms how your organization thinks about perception, 
              trust, and strategic communication.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Interactive Demo",
                description: "Experience the complete platform with our guided walkthrough—see how strategic narrative governance works in practice",
                link: "/demo",
                icon: Sparkles,
                highlight: true,
              },
              {
                title: "Documentation",
                description: "Comprehensive guides and API references to help your team build narrative governance capabilities",
                link: "/resources/docs",
                icon: FileText,
              },
              {
                title: "Case Studies",
                description: "Learn how forward-thinking organizations transformed narrative risk into strategic advantage",
                link: "/resources/cases",
                icon: BarChart3,
              },
              {
                title: "Security & Compliance",
                description: "Understand how we protect your data and meet the highest standards of security and compliance",
                link: "/security",
                icon: Lock,
              },
              {
                title: "Ethics & Governance",
                description: "Explore our commitment to ethical AI and responsible governance practices",
                link: "/ethics",
                icon: Shield,
              },
              {
                title: "Compliance",
                description: "Detailed information about regulatory compliance and audit capabilities",
                link: "/compliance",
                icon: CheckCircle2,
              },
              {
                title: "Blog",
                description: "Strategic insights on narrative governance, perception engineering, and building trust",
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

      {/* Final CTA - Streamlined */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl gradient-text">
            Ready to build strategic narrative advantage?
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Control how AI systems understand your organization. Transform security incidents into trust-building opportunities.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/solutions/security-incidents" className="flex items-center gap-2">
                <Shield className="size-4" />
                Explore SKU D
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto glass-effect">
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              <span>14-day trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

        <SiteFooter />
      </div>
    </>
  );
}
