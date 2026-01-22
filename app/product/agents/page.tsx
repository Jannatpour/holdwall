import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { AgentsManagement } from "@/components/agents/agents-management";

export const metadata: Metadata = genMeta(
  "Agents",
  "Holdwall integrates specialized agents for extraction, retrieval, forecasting, and publishing. MCP provides tool interoperability; ACP provides structured agent communication.",
  "/product/agents"
);

export const dynamic = 'force-dynamic';

export default function ProductAgentsPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Agents</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Holdwall integrates specialized agents for extraction, retrieval, forecasting, and publishing.
            MCP provides tool interoperability; ACP provides structured agent communication.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/product">Back to product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/playbooks">Open playbooks</Link>
            </Button>
          </div>
        </div>

        {/* Interactive Agent Management */}
        <AgentsManagement />

        {/* Protocol Overview Cards */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Protocol Overview</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tool interoperability (MCP)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Register and execute tools in a consistent contract so agents can collaborate across services.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent communication (ACP)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Provide structured task context and controlled message passing between agents and humans.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent-to-Agent (A2A)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Direct agent discovery, connection, and communication with AGORA-style optimization for efficient collaboration.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent Networks (ANP)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Network management with health monitoring, intelligent routing, and agent selection for scalable multi-agent systems.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent-User Interaction (AG-UI)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Standardized conversational interfaces with real-time streaming, intent detection, and multimodal interaction support.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent Payments (AP2)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Autonomous financial transactions between agents with mandates, signatures, wallet management, and compliance controls.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Protocol Security</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                End-to-end security with identity verification, RBAC/ABAC, cryptographic signing, mTLS, and OIDC integration.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Protocol Bridge</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Unified orchestration across all protocols with a single API endpoint for seamless multi-protocol operations.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evaluation gates</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                Apply groundedness and policy checks before drafts become routed actions or published artifacts.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

