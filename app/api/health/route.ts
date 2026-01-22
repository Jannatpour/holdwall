/**
 * Health Check API
 * Comprehensive health checks for all system components including protocols
 */

import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/monitoring/health";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { getANPProtocol } from "@/lib/anp/protocol";
import { getAP2Protocol } from "@/lib/payment/ap2";
import { getProtocolSecurity } from "@/lib/security/protocol-security";
import { getAGUIProtocol } from "@/lib/ag-ui/protocol";

export async function GET() {
  const health = await checkHealth();
  
  // Add protocol-specific health checks
  try {
    const a2aProtocol = getA2AProtocol();
    const anpProtocol = getANPProtocol();
    const ap2Protocol = getAP2Protocol();
    const protocolSecurity = getProtocolSecurity();
    const aguiProtocol = getAGUIProtocol();

    // Check protocol health
    const protocolHealth = {
      a2a: {
        status: "healthy" as const,
        agents: a2aProtocol.getAgentCount(),
        connections: a2aProtocol.getConnectionCount(),
      },
      anp: {
        status: "healthy" as const,
        networks: anpProtocol.getNetworkCount(),
        totalAgents: anpProtocol.getTotalAgentCount(),
      },
      ap2: {
        status: "healthy" as const,
        mandates: ap2Protocol.getMandateCount(),
        adapters: ap2Protocol.getAdapterCount(),
      },
      security: {
        status: "healthy" as const,
        identities: protocolSecurity.getIdentityCount(),
      },
      "ag-ui": {
        status: "healthy" as const,
        sessions: aguiProtocol.getSessionCount(),
      },
    };

    return NextResponse.json(
      {
        ...health,
        protocols: protocolHealth,
      },
      { status: health.status === "healthy" ? 200 : 503 }
    );
  } catch (error) {
    // If protocol health checks fail, still return base health
    return NextResponse.json(
      {
        ...health,
        protocols: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      },
      { status: health.status === "healthy" ? 200 : 503 }
    );
  }
}
