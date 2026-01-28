/**
 * Agents Management Component
 * 
 * Interactive UI for managing all agent protocols
 */

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AP2Wallet } from "./ap2-wallet";
import { AP2Mandates } from "./ap2-mandates";
import { ANPNetworks } from "./anp-networks";
import { A2ADiscovery } from "./a2a-discovery";
import { AGUIConversation } from "./ag-ui-conversation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, FileText, Network, Users, MessageSquare, Shield } from "@/components/demo-icons";

export function AgentsManagement() {
  const { data: session } = useSession() || { data: null };
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [agentIdInput, setAgentIdInput] = useState<string>("");

  // Derive agent ID from session or use input
  const agentId = selectedAgentId || (session?.user as any)?.id || agentIdInput || "default-agent";
  const userId = (session?.user as any)?.id || "default-user";

  const handleSetAgentId = () => {
    if (agentIdInput.trim()) {
      setSelectedAgentId(agentIdInput.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
          <CardDescription>Select or configure the agent ID for protocol operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Agent ID</Label>
              <Input
                value={agentIdInput}
                onChange={(e) => setAgentIdInput(e.target.value)}
                placeholder={agentId || "Enter agent ID..."}
              />
            </div>
            <Button onClick={handleSetAgentId}>Set Agent ID</Button>
          </div>
          <div className="mt-4">
            <Badge variant="outline">Current Agent: {agentId}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Protocol Tabs */}
      <Tabs defaultValue="a2a" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="a2a" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            A2A
          </TabsTrigger>
          <TabsTrigger value="anp" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            ANP
          </TabsTrigger>
          <TabsTrigger value="ag-ui" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            AG-UI
          </TabsTrigger>
          <TabsTrigger value="ap2-wallet" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            AP2 Wallet
          </TabsTrigger>
          <TabsTrigger value="ap2-mandates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            AP2 Mandates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="a2a" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent-to-Agent Protocol (A2A)</CardTitle>
              <CardDescription>
                Discover and connect to other agents with AGORA-style optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <A2ADiscovery agentId={agentId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Network Protocol (ANP)</CardTitle>
              <CardDescription>
                Manage agent networks with health monitoring and intelligent routing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ANPNetworks agentId={agentId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ag-ui" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent-User Interaction Protocol (AG-UI)</CardTitle>
              <CardDescription>
                Real-time conversational interface with streaming support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AGUIConversation agentId={agentId} userId={userId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ap2-wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Payment Protocol - Wallet (AP2)</CardTitle>
              <CardDescription>
                Manage agent wallet balances, limits, and transaction history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AP2Wallet walletId={`wallet_${agentId}`} agentId={agentId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ap2-mandates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Payment Protocol - Mandates (AP2)</CardTitle>
              <CardDescription>
                Create and manage payment mandates for agent-to-agent transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AP2Mandates agentId={agentId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Protocol Security
          </CardTitle>
          <CardDescription>
            All protocol operations are secured with identity verification, RBAC/ABAC, and cryptographic signing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium mb-2">Security Features</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Identity verification for all agents</li>
                <li>• Role-based and attribute-based access control</li>
                <li>• Cryptographic message signing</li>
                <li>• Key management (KMS/HSM integration)</li>
                <li>• mTLS and OIDC support</li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Protocol Coverage</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• A2A: Agent identity and connection security</li>
                <li>• ANP: Network creation and membership verification</li>
                <li>• AG-UI: Session initiation and permission checks</li>
                <li>• AP2: Payment mandate and transaction security</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
