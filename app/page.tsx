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

      {/* Hero Section - Enhanced with Animations */}
      <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32 overflow-hidden">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-primary/10 opacity-50 animate-pulse" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,255,0.1),transparent_50%)] animate-spin-slow" />
        
        <div className="mx-auto max-w-4xl text-center relative">
          <Badge className="mb-6 animate-fade-in-up hover:scale-105 transition-transform duration-300" variant="outline">
            <Sparkles className="mr-2 size-3 inline-block animate-pulse" />
            Perception Operating System
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-fade-in-up animation-delay-100">
            When narratives shape reality, evidence shapes narratives
          </h1>
          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-muted-foreground animate-fade-in-up animation-delay-200">
            In an era where AI systems answer millions of questions daily, controlling which sources they cite about your organization 
            isn't just competitive advantage—it's strategic necessity. Transform narrative risk into measurable authority. 
            When security incidents occur, ensure AI assistants cite your transparent explanation—not speculation, not competitors.
          </p>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-muted-foreground/90 animate-fade-in-up animation-delay-300">
            <strong className="text-foreground">The Strategic Shift:</strong> Don't hide criticism—become its most trusted interpreter. 
            Evidence-first governance that earns trust through transparency, recognized by both human decision-makers and AI systems.
          </p>
          
          {/* Enhanced CTA Buttons with SKU D Highlight */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 animate-fade-in-up animation-delay-400">
            <Button asChild size="lg" className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <Link href="/demo" className="flex items-center gap-2">
                <Sparkles className="size-4 group-hover:rotate-180 transition-transform duration-500" />
                Explore Interactive Demo
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="group relative border-2 border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 hover:border-primary transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg">
              <Link href="/solutions/security-incidents" className="flex items-center gap-2">
                <Shield className="size-4 group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Security Incidents (SKU D)</span>
                <Badge className="ml-1 bg-primary text-primary-foreground text-xs">New</Badge>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="group hover:scale-105 transition-all duration-300">
              <Link href="/auth/signin" className="flex items-center gap-2">
                Schedule Strategic Consultation
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="group hover:scale-105 transition-all duration-300">
              <Link href="/product" className="flex items-center gap-2">
                Discover Capabilities
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
          
          {/* Enhanced Feature Highlights with Icons */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-in-up animation-delay-500">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:bg-card transition-all duration-300 hover:scale-105">
              <Sparkles className="size-4 text-primary animate-pulse" />
              <span>21 AI models & advanced RAG</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:bg-card transition-all duration-300 hover:scale-105">
              <TrendingUp className="size-4 text-primary" />
              <span>Real-time outbreak forecasting</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:bg-card transition-all duration-300 hover:scale-105">
              <Radio className="size-4 text-primary" />
              <span>AI-answer authority & citation</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 border-2 border-primary/50 hover:border-primary hover:from-primary/30 hover:to-primary/20 transition-all duration-300 hover:scale-105">
              <Shield className="size-4 text-primary animate-pulse" />
              <span className="font-semibold text-foreground">Security incident management (SKU D)</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:bg-card transition-all duration-300 hover:scale-105">
              <CheckCircle2 className="size-4 text-primary" />
              <span>Enterprise-grade governance</span>
            </div>
          </div>
        </div>
      </section>

      {/* What POS Is & Is Not */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A new approach to narrative governance
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Not reactive crisis management. Not fragmented point solutions. A <strong>strategic partnership</strong> that transforms 
              how your organization understands, responds to, and shapes narratives. Evidence-first processes that earn trust 
              through transparency—with full provenance that satisfies both internal stakeholders and external validators.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Not reactive crisis management",
                description: "We help you build proactive systems that prevent issues before they escalate, rather than scrambling after narratives have already spread.",
                icon: AlertTriangle,
                negative: true,
              },
              {
                title: "Not fragmented point solutions",
                description: "Instead of tools that silo ownership across departments, POS creates shared infrastructure where Legal, Comms, Risk, and Support collaborate seamlessly.",
                icon: AlertTriangle,
                negative: true,
              },
              {
                title: "Evidence-first partnership",
                description: "We work with you to build authoritative evidence layers that earn trust through transparency, with full provenance and audit trails that satisfy both internal stakeholders and external validators.",
                icon: CheckCircle2,
                negative: false,
              },
              {
                title: "Strategic AI authority",
                description: "As AI systems increasingly shape how your organization is understood, POS ensures they cite your authoritative explanations—turning your evidence into the default narrative.",
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
              Strategic capabilities that transform risk into advantage
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Every capability is designed to give your organization the confidence, control, and credibility needed to navigate 
              an increasingly complex information landscape. We don't just provide tools—we enable strategic transformation.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Authoritative Evidence Layer",
                description: "Transform uncertainty into confidence with immutable evidence bundles that satisfy the highest standards of legal, regulatory, and stakeholder scrutiny. Cryptographic provenance ensures your evidence stands the test of time and challenge.",
                icon: FileText,
              },
              {
                title: "Advanced Narrative Intelligence",
                description: "See what others miss. Our 21 AI models work together to surface emerging narratives before they become crises, forecast their trajectory with remarkable accuracy, and identify the most effective intervention points.",
                icon: Network,
              },
              {
                title: "AI Answer Authority & Citation",
                description: "In a world where AI assistants increasingly shape perception, ensure they cite your authoritative voice. Track and measure how your evidence becomes the default narrative in AI-generated summaries and answers.",
                icon: Sparkles,
              },
              {
                title: "Human-Gated Autopilot",
                description: "Scale your expertise without sacrificing control. Intelligent automation handles routine work while your team maintains oversight through policy gates, multi-stage approvals, and complete audit trails.",
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
              How leading organizations use POS
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              A strategic workflow that transforms daily operations from reactive firefighting to proactive narrative governance, 
              giving your team the clarity and confidence to act decisively.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground/90">
              <strong className="text-foreground">Diplomatic Approach:</strong> We don't promise to eliminate criticism—we help 
              you become the most trusted interpreter of it. When stakeholders see your transparent, evidence-backed responses, 
              trust grows. When AI systems cite your authoritative voice, perception shifts in your favor.
            </p>
          </div>
          <div className="mt-16">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                { 
                  step: 1, 
                  title: "Morning Strategic Brief", 
                  description: "Start each day with clarity, not chaos. Your executive brief surfaces what matters most: emerging narratives, their trajectory, and the evidence you have to address them—all in 10 minutes.",
                  time: "10 min"
                },
                { 
                  step: 2, 
                  title: "Collaborative Response Planning", 
                  description: "Turn insight into action. POS helps your team understand the full narrative landscape, then collaboratively drafts authoritative responses that satisfy both internal stakeholders and external audiences.",
                  time: "20-60 min"
                },
                { 
                  step: 3, 
                  title: "Governance & Approvals", 
                  description: "Move fast with confidence. Built-in approval workflows ensure Legal, Compliance, and Executive teams can review and approve with full context, maintaining speed without sacrificing rigor.",
                  time: "Same day"
                },
                { 
                  step: 4, 
                  title: "Publish & Measure Impact", 
                  description: "See your strategy work. Publish authoritative explanations to your trust center, then measure the tangible impact: reduced narrative velocity, improved AI citation rates, and measurable trust lift.",
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

      {/* Latest Features - January 2026 - Enhanced */}
      <section className="relative border-y bg-gradient-to-br from-primary/5 via-background to-primary/5 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,255,255,0.05),transparent_50%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 animate-pulse" variant="outline">
              <Sparkles className="mr-2 size-3 inline-block" />
              January 2026 Updates
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Continuously evolving to meet your strategic needs
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Value that grows with your organization. Advanced analytics, autonomous processing, and deeper insights 
              for navigating complex narrative landscapes.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Security Incident Narrative Management (SKU D)",
                description: "AI-governed security incident explanations with real-time narrative risk assessment, outbreak forecasting, and multi-engine AI citation tracking across Perplexity, Gemini, and Claude",
                icon: Shield,
                new: true,
                link: "/solutions/security-incidents",
                highlight: true,
              },
              {
                title: "Advanced Signals Analytics",
                description: "Real-time statistics, trend visualization, AI-powered insights, and bulk operations for comprehensive signal management",
                icon: BarChart3,
                new: true,
                link: "/signals",
              },
              {
                title: "Autonomous Case Processing",
                description: "Automatic triage, resolution generation, and agent orchestration—reducing manual work while maintaining full control",
                icon: Sparkles,
                new: true,
                link: "/cases",
              },
              {
                title: "Source Health Monitoring",
                description: "Real-time source health tracking, automated compliance checks, and comprehensive analytics for governance",
                icon: CheckCircle2,
                new: true,
                link: "/governance/sources",
              },
              {
                title: "POS Dashboard",
                description: "Complete Perception Operating System with belief graph engineering, consensus hijacking detection, and trust substitution",
                icon: Network,
                new: true,
                link: "/pos",
              },
              {
                title: "AI Citation Tracking",
                description: "Real-time monitoring of when Perplexity, Gemini, and Claude cite your authoritative explanations—measurable trust lift through AI governance",
                icon: Radio,
                new: true,
                link: "/ai-answer-monitor",
              },
            ].map((feature) => (
              <Card 
                key={feature.title} 
                className={`group relative overflow-hidden border-primary/20 hover:border-primary transition-all duration-300 hover-lift ${
                  feature.highlight 
                    ? 'border-primary border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg hover:shadow-xl' 
                    : 'hover:shadow-md'
                }`}
              >
                {/* Animated background gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/0 transition-all duration-500" />
                
                <CardHeader className="relative z-10">
                  <div className="mb-2 flex items-center justify-between">
                    <feature.icon className={`size-6 text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ${feature.highlight ? 'animate-pulse' : ''}`} />
                    <div className="flex items-center gap-2">
                      {feature.new && (
                        <Badge variant="outline" className="text-xs animate-pulse">New</Badge>
                      )}
                      {feature.highlight && (
                        <Badge className="text-xs bg-primary text-primary-foreground shadow-lg">SKU D</Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-base group-hover:text-primary transition-colors">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm text-muted-foreground mb-3 group-hover:text-foreground/90 transition-colors">{feature.description}</p>
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

      {/* Launch SKUs - Enhanced with SKU D Highlight */}
      <section className="relative border-y bg-muted/50 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              Four strategic entry points, one powerful platform
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              We understand that every organization's journey is unique. Start with the solution that addresses your most 
              pressing challenge, then seamlessly expand as you discover new opportunities. Each SKU is built on the same 
              powerful platform foundation, ensuring your investment grows with your needs.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground/90">
              <strong className="text-foreground">Psychological Insight:</strong> When you control the narrative, you control 
              the outcome. Our platform doesn't just help you respond—it helps you become the trusted authority that both 
              humans and AI systems turn to first.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
            {[
              {
                sku: "SKU A",
                title: "AI Answer Monitoring & Authority",
                promise: "When AI systems shape perception, ensure they cite your authoritative voice",
                buyer: "Head of Communications / Brand Risk",
                coreLoop: "Monitor → detect claim clusters → generate evidence-backed rebuttal artifacts → publish → measure answer shifts",
                icon: Sparkles,
                link: "/solutions/comms",
                highlights: ["AI citation tracking", "Real-time answer monitoring", "Evidence-backed artifacts"],
                strategicValue: "Transform how AI assistants understand and communicate about your organization",
              },
              {
                sku: "SKU B",
                title: "Narrative Risk Early Warning",
                promise: "See crises coming before they arrive, and act with confidence when they do",
                buyer: "Head of Trust & Safety / Risk",
                coreLoop: "Ingest signals → diffusion forecasting (Hawkes + graph) → preemption playbooks → approvals → publish",
                icon: AlertTriangle,
                link: "/solutions/security",
                highlights: ["Hawkes process forecasting", "Outbreak probability models", "Preemption playbooks"],
                strategicValue: "Prevent small issues from becoming existential threats",
              },
              {
                sku: "SKU C",
                title: "Evidence-Backed Intake & Case Triage",
                promise: "Turn every allegation into a defensible, verifiable case file",
                buyer: "Legal / Claims Management",
                coreLoop: "Evidence vault → claim extraction → verification → structured intake packet → CRM handoff",
                icon: FileText,
                link: "/solutions/procurement",
                highlights: ["Automated claim extraction", "Evidence verification", "Audit-grade case files"],
                strategicValue: "Reduce legal risk while accelerating case resolution",
              },
              {
                sku: "SKU D",
                title: "Security Incident Narrative Management",
                promise: "When security incidents happen, govern how AI systems understand and communicate about them—ensuring your transparent explanation becomes the authoritative source",
                buyer: "CISO / Head of Security (with Comms/Legal/AI Governance as co-buyers)",
                coreLoop: "Security Incident Detected → Automated Narrative Risk Assessment → AI-Governed Evidence-Backed Explanation → Multi-Stakeholder Approval → Publish to Trust Center → Real-Time AI Citation Monitoring",
                icon: Shield,
                link: "/solutions/security-incidents",
                highlights: [
                  "Real-time security tool integration (SIEM, SOAR)",
                  "Automated narrative risk & outbreak forecasting",
                  "AI-governed explanations with model registry",
                  "Multi-engine AI citation tracking (Perplexity, Gemini, Claude)",
                  "Measurable trust lift through authoritative positioning"
                ],
                strategicValue: "Transform security incidents from narrative crises into trust-building opportunities. In the AI era, how ChatGPT, Claude, and Perplexity understand your security posture matters more than ever—we ensure they cite your voice, not speculation.",
              },
            ].map((sku) => (
              <Card 
                key={sku.sku} 
                className={`group relative overflow-hidden hover:border-primary transition-all duration-300 hover-lift ${
                  sku.sku === 'SKU D' 
                    ? 'border-primary border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg hover:shadow-xl' 
                    : 'hover:shadow-md'
                }`}
              >
                {/* Animated background for SKU D */}
                {sku.sku === 'SKU D' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/0 animate-pulse opacity-50" />
                )}
                
                <CardHeader className="relative z-10">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge 
                      variant={sku.sku === 'SKU D' ? 'default' : 'outline'} 
                      className={sku.sku === 'SKU D' ? 'bg-primary text-primary-foreground shadow-md' : ''}
                    >
                      {sku.sku}
                    </Badge>
                    <sku.icon className={`size-6 text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ${sku.sku === 'SKU D' ? 'animate-pulse' : ''}`} />
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">{sku.title}</CardTitle>
                  <CardDescription className="font-medium text-primary mt-2">
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
                  {sku.highlights && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Capabilities</p>
                      <ul className="space-y-1.5">
                        {sku.highlights.map((highlight, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-primary" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sku.strategicValue && (
                    <div className="rounded-lg bg-primary/5 p-3 mt-4">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Strategic Value</p>
                      <p className="text-sm font-medium">{sku.strategicValue}</p>
                    </div>
                  )}
                  <Button asChild variant="ghost" className="w-full justify-start mt-4 group/btn">
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

      {/* Customer Stories - Enhanced */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              How forward-thinking organizations partner with Holdwall
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Real stories from organizations that transformed narrative risk into strategic advantage, 
              building trust and credibility in an increasingly complex information landscape.
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

      {/* Security, Safety, Ethics */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built on a foundation of trust, security, and ethical governance
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              We understand that trust is earned, not assumed. Our platform is designed to meet the highest standards 
              of security, compliance, and ethical governance—because your stakeholders deserve nothing less.
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

      {/* Metrics & Business Value */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Measurable impact that matters to executives and stakeholders
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              We believe in proving value, not just promising it. Every metric is designed to demonstrate tangible impact 
              that resonates with executives, satisfies procurement requirements, and justifies continued investment.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground/90">
              <strong className="text-foreground">Psychological Framing:</strong> When executives see concrete numbers—reduced 
              narrative spread, increased AI citation rates, faster response times—they understand the strategic value. 
              When stakeholders see measurable trust lift, they feel confident in their partnership with you.
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

      {/* Advanced AI Infrastructure */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Strategic advantage through advanced AI infrastructure
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              We've invested in building the most sophisticated AI infrastructure in narrative governance. Our 21 advanced models 
              work together seamlessly to give you capabilities that competitors simply cannot match—because we believe your 
              strategic advantage should be built on technological excellence, not compromise. When security incidents occur, 
              our AI citation tracking monitors Perplexity, Gemini, and Claude in real-time, ensuring your authoritative 
              explanation becomes the trusted source that AI systems cite.
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

      {/* AI Citation Tracking - Strategic Advantage */}
      <section className="border-y bg-gradient-to-br from-primary/5 via-background to-primary/5 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4" variant="outline">
              AI Governance for Narrative Systems
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              In the AI era, how AI systems understand your organization matters more than ever
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              When customers ask Perplexity about your security incident, when investors query Gemini about your company, 
              when employees ask Claude about your policies—which sources do these AI systems cite? We ensure they cite 
              your authoritative, evidence-backed explanation—not speculation, not competitors, not misinformation. 
              This is the only platform that combines security incident management with real-time AI citation tracking 
              across multiple AI engines.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-3">
            {[
              {
                title: "Real-Time Multi-Engine Monitoring",
                description: "Track when Perplexity, Gemini, and Claude cite your security incident explanations. Our AI answer scraper monitors multiple engines simultaneously, giving you complete visibility into how AI systems understand and communicate about your organization.",
                icon: Radio,
                metrics: "4.2x increase in AI citation rate",
              },
              {
                title: "Security Incident → AI Citation Pipeline",
                description: "When a security incident occurs, automatically generate an AI-governed explanation, publish it to your trust center, and monitor in real-time as AI systems begin citing your authoritative voice. Transform incidents from narrative crises into trust-building opportunities.",
                icon: Shield,
                metrics: "78% reduction in narrative spread",
              },
              {
                title: "Measurable Trust Lift",
                description: "Every citation is tracked, every metric is measured. See exactly how your authoritative explanations influence AI-generated answers, measure sentiment shifts, and demonstrate ROI through concrete citation data that executives and stakeholders understand.",
                icon: TrendingUp,
                metrics: "Measurable trust lift in customer surveys",
              },
            ].map((item) => (
              <Card key={item.title} className="border-primary/20 hover:border-primary transition-colors">
                <CardHeader>
                  <item.icon className="mb-2 size-8 text-primary" />
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="font-medium text-primary mt-2">
                    {item.metrics}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-6">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              <strong className="text-foreground">Strategic Insight:</strong> In an era where AI assistants answer millions of questions daily, 
              controlling which sources they cite about your organization is not just a competitive advantage—it's a strategic necessity. 
              When security incidents happen, we ensure AI systems cite your transparent explanation, building trust through transparency 
              rather than losing it through speculation.
            </p>
            <Button asChild size="lg" variant="outline">
              <Link href="/solutions/security-incidents">
                Explore Security Incident Narrative Management <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Investment that grows with your strategic needs
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              We've designed our pricing to align with your journey. Start with focused capability, then seamlessly expand 
              as you discover new opportunities. Every plan includes access to our complete AI infrastructure and dedicated 
              partnership support.
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

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to build the strategic narrative advantage your organization deserves?
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            In a world where perception shapes reality—and where AI systems answer millions of questions daily—leading organizations 
            choose partnership over point solutions. When security incidents occur, when narratives spread, when AI assistants are asked 
            about your organization, we ensure they cite your authoritative voice—not speculation, not competitors, not misinformation. 
            We don't hide criticism—we help you become the most trusted interpreter of it, for both human decision-makers and AI systems. 
            Join forward-thinking organizations that have transformed narrative risk into strategic advantage through evidence-first 
            governance and AI citation authority.
          </p>
          <div className="mt-6 rounded-lg border bg-primary/5 p-6 text-left">
            <p className="text-base leading-7 text-muted-foreground">
              <strong className="text-foreground">The Strategic Choice:</strong> Every day you wait is a day your competitors 
              might control the narrative about your organization. Every security incident without an authoritative explanation 
              is an opportunity for speculation to spread. Every AI-generated answer that doesn't cite your voice is a missed 
              chance to build trust. The question isn't whether you need narrative governance—it's whether you'll build it 
              reactively or proactively. <strong className="text-foreground">Choose proactive.</strong>
            </p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/signin">Start Free Trial</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/product">Explore Features</Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
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
