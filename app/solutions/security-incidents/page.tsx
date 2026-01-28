import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { Shield, AlertTriangle, FileText, CheckCircle2, Sparkles, Lock, Network } from "@/components/demo-icons";

export const metadata: Metadata = genMeta(
  "Security Incident Narrative Management (SKU D)",
  "When security incidents happen, govern how AI systems understand and communicate about them. AI-governed narrative responses to security incidents with automatic risk assessment and citation tracking.",
  "/solutions/security-incidents"
);

export default function SolutionsSecurityIncidentsPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline">SKU D</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Security Incident Narrative Management</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-7 font-medium text-primary">
            When security incidents happen, govern how AI systems understand and communicate about them
          </p>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Core loop: Security Incident Detected → Narrative Risk Assessment → 
            AI-Governed Evidence-Backed Explanation → Multi-Stakeholder Approval → 
            Publish to Trust Center → Monitor AI Citation Impact
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            <strong>Primary Buyer:</strong> CISO / Head of Security (with Comms/Legal/AI Governance as co-buyers)
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/solutions">Back to solutions</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/security">Security overview</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/governance">AI Governance</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Shield className="mb-2 size-8 text-primary" />
              <CardTitle className="text-base">Security Tool Integration</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Webhook integrations with SIEM, SOAR, and security monitoring tools. 
              Automatic incident ingestion with real-time narrative risk scoring.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <AlertTriangle className="mb-2 size-8 text-primary" />
              <CardTitle className="text-base">Narrative Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Automatically assess narrative risk and outbreak probability when security 
              incidents occur. Forecast how incidents will be perceived and spread.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Sparkles className="mb-2 size-8 text-primary" />
              <CardTitle className="text-base">AI-Governed Explanations</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Generate evidence-backed incident explanations with AI governance. 
              Ensure AI systems cite your authoritative voice, not speculation.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <FileText className="mb-2 size-8 text-primary" />
              <CardTitle className="text-base">Multi-Stakeholder Approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Route incident explanations through Legal, Comms, and Executive approvals 
              with complete audit trails and policy compliance.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CheckCircle2 className="mb-2 size-8 text-primary" />
              <CardTitle className="text-base">AI Citation Tracking</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Track when AI systems (ChatGPT, Claude, Perplexity) cite your authoritative 
              incident explanations. Measure narrative impact and trust lift.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Lock className="mb-2 size-8 text-primary" />
              <CardTitle className="text-base">Regulatory Compliance</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              GDPR breach notification narratives, regulatory reporting templates, 
              and complete audit bundles for compliance reviews.
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">How It Works</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Incident Detection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Security incidents are automatically ingested from your security tools 
                  (SIEM, SOAR, monitoring systems) via webhooks or manual entry.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Real-time webhook integration</li>
                  <li>Support for Splunk, CrowdStrike, Palo Alto, and custom tools</li>
                  <li>Automatic incident classification and severity assessment</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Narrative Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Holdwall automatically assesses narrative risk using advanced forecasting 
                  models to predict how the incident will be perceived and spread.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Narrative risk score (0-1)</li>
                  <li>Outbreak probability forecasting</li>
                  <li>Urgency level determination</li>
                  <li>Recommended action prioritization</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. AI-Governed Explanation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Generate evidence-backed incident explanations using AI models with 
                  full governance: model selection, policy checks, and approval workflows.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>AI model registry and approval</li>
                  <li>Evidence-backed content generation</li>
                  <li>Structured JSON-LD for AI citation</li>
                  <li>Policy compliance checking</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">4. Approval & Publishing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Route explanations through multi-stage approvals (Legal, Comms, Executive) 
                  with human-gated autopilot modes and complete audit trails.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Multi-stage approval workflows</li>
                  <li>Human-gated autopilot controls</li>
                  <li>Publish to trust center and PADL</li>
                  <li>Complete audit trail export</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">5. AI Citation Monitoring</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Monitor when AI systems cite your authoritative explanations and measure 
                  the impact on narrative perception and trust.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>AI answer snapshot monitoring</li>
                  <li>Citation rate tracking</li>
                  <li>Narrative impact measurement</li>
                  <li>Trust lift analytics</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">6. Continuous Improvement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Learn from each incident to improve narrative risk assessment, explanation 
                  quality, and AI citation rates over time.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Model performance tracking</li>
                  <li>Explanation quality metrics</li>
                  <li>Citation rate optimization</li>
                  <li>Playbook refinement</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Key Features</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Security Tool Webhooks",
                description: "Integrate with Splunk, CrowdStrike, Palo Alto, and custom security tools",
                icon: Network,
              },
              {
                title: "Automated Risk Assessment",
                description: "Real-time narrative risk scoring and outbreak probability forecasting",
                icon: AlertTriangle,
              },
              {
                title: "AI Model Governance",
                description: "Model registry, approval workflows, and policy enforcement for AI-generated content",
                icon: Sparkles,
              },
              {
                title: "Evidence-Backed Explanations",
                description: "Generate explanations backed by immutable evidence with full provenance",
                icon: FileText,
              },
              {
                title: "Multi-Stage Approvals",
                description: "Route through Legal, Comms, and Executive with complete audit trails",
                icon: CheckCircle2,
              },
              {
                title: "AI Citation Tracking",
                description: "Monitor when ChatGPT, Claude, and Perplexity cite your explanations",
                icon: Shield,
              },
            ].map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 size-6 text-primary" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/50 p-6">
          <h3 className="text-lg font-semibold mb-2">Strategic Value</h3>
          <p className="text-sm text-muted-foreground">
            Transform security incidents from narrative crises into trust-building opportunities. 
            When a security incident occurs, Holdwall ensures AI systems cite your authoritative 
            explanation—not speculation, not competitors, not misinformation. This is the only 
            platform that combines security incident management with AI governance for narrative systems.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
