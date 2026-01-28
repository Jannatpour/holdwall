import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Product",
  "Perception Operating System: Turn narrative risk into a measurable, forecastable domain. Evidence-first architecture with authoritative evidence layer, narrative intelligence, AI-answer authority, and human-gated autopilot.",
  "/product"
);
import {
  Radio,
  Network,
  TrendingUp,
  FileText,
  Settings,
  Zap,
  CheckCircle2,
} from "@/components/demo-icons";

const productAreas = [
  {
    title: "Pipeline",
    description:
      "Ingestion → normalization → enrichment → indexing, with provenance and compliance checks.",
    href: "/product/pipeline",
    icon: Radio,
  },
  {
    title: "Claims & clustering",
    description:
      "Extract claims from evidence, cluster narratives, and track variants with traceability.",
    href: "/product/claims",
    icon: FileText,
  },
  {
    title: "Belief graph",
    description:
      "Model reinforcement/neutralization/decay paths so weak narratives lose decisiveness over time.",
    href: "/product/graph",
    icon: Network,
  },
  {
    title: "Forecasting",
    description:
      "Drift and outbreak probability forecasts gated by evaluation so actions are defensible.",
    href: "/product/forecasting",
    icon: TrendingUp,
  },
  {
    title: "AAAL studio",
    description:
      "Author evidence-backed artifacts designed to be cited by AI systems, with approvals and policy checks.",
    href: "/product/aaal",
    icon: FileText,
  },
  {
    title: "Governance & audits",
    description:
      "Approvals, audit logs, and exportable audit bundles (PDF/JSON) for procurement and regulators.",
    href: "/product/governance",
    icon: Settings,
  },
  {
    title: "Agents",
    description:
      "Specialized agents orchestrated through MCP/ACP with tool interoperability and evaluation gates.",
    href: "/product/agents",
    icon: Zap,
  },
];

export default function ProductPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Perception Operating System</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            POS is a <strong>perception governance system</strong>: it turns narrative risk into a measurable, forecastable domain 
            and routes responses through evidence, policy, and approvals. POS makes negative narratives 
            <strong> structurally non-decisive</strong> by building an Authoritative Evidence Layer and an AI-Answer Authority Layer.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/demo">Try Interactive Demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/overview">Open command center</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/solutions">View solutions</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productAreas.map((area) => (
            <Card key={area.href} className="flex flex-col">
              <CardHeader>
                <area.icon className="mb-2 size-8 text-primary" />
                <CardTitle className="text-base">{area.title}</CardTitle>
                <CardDescription>{area.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant="outline" size="sm">
                  <Link href={area.href}>Learn more</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* What POS Delivers */}
        <section className="mt-16 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What POS delivers</h2>
            <p className="text-muted-foreground mt-2">
              Four core capabilities that make negative narratives structurally non-decisive
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <FileText className="mb-2 size-8 text-primary" />
                <CardTitle>Authoritative Evidence Layer</CardTitle>
                <CardDescription>
                  Immutable, provable evidence bundles with provenance, policy, and audit-grade traceability
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Merkleized evidence bundles
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Full provenance tracking
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    C2PA content credentials support
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Network className="mb-2 size-8 text-primary" />
                <CardTitle>Narrative Intelligence</CardTitle>
                <CardDescription>
                  Claim clustering, belief graphs, and outbreak forecasting using diffusion-native models
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Hawkes process forecasting
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Belief graph engineering
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Intervention simulation
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Zap className="mb-2 size-8 text-primary" />
                <CardTitle>AI Answer Authority</CardTitle>
                <CardDescription>
                  Artifacts formatted to become cited sources in AI answers (AEO-native)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Structured JSON-LD artifacts
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    AI citation tracking
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    PADL publishing
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Settings className="mb-2 size-8 text-primary" />
                <CardTitle>Human-Gated Autopilot</CardTitle>
                <CardDescription>
                  Playbooks that can draft/route/publish with explicit governance gates and approvals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Policy-gated automation
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Multi-level approvals
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Complete audit trails
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* AI Systems & Advanced Features */}
        <section className="mt-16 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">AI Systems & Advanced Features</h2>
            <p className="text-muted-foreground mt-2">
              2026-native AI capabilities: self-correcting RAG, learned routing, and cost-optimal cascades
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <Zap className="mb-2 size-8 text-primary" />
                <CardTitle>Corrective RAG (CRAG)</CardTitle>
                <CardDescription>
                  Self-correcting retrieval with critique → correct → re-retrieve loops
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Multi-stage retrieval policy
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Hybrid search (BM25 + embeddings)
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Quality critique and re-retrieval
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Network className="mb-2 size-8 text-primary" />
                <CardTitle>Learned Routing & Cascades</CardTitle>
                <CardDescription>
                  RouteLLM and FrugalGPT-style cost/quality optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Preference-based model routing
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    Cost-optimal cascades
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    DSPy pipeline optimization
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>MCP/ACP Protocol Support</CardTitle>
              <CardDescription>
                Model Context Protocol and Agent Communication Protocol for tool interoperability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">MCP Tools</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Evidence retrieval</li>
                    <li>• Claim analysis</li>
                    <li>• Forecast generation</li>
                    <li>• Artifact creation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">ACP Agents</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Specialized agent orchestration</li>
                    <li>• Evaluation gates</li>
                    <li>• Cost controls</li>
                    <li>• Tool chaining</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </SiteShell>
  );
}
