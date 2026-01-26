/**
 * Health Check API
 * Comprehensive health checks for all system components including protocols
 */

import { NextResponse } from "next/server";

export async function GET() {
  // IMPORTANT: Keep this endpoint resilient.
  // Avoid top-level imports of heavy subsystems so a single failed import (missing env, optional deps, etc.)
  // doesn't turn health checks into Vercel/Next HTML 500 pages.
  let health: any;
  try {
    const { checkHealth } = await import("@/lib/monitoring/health");
    health = await checkHealth();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
        message,
      },
      { status: 503 }
    );
  }
  
  // Protocol checks are optional because importing protocols can trigger heavy initialization.
  // Enable explicitly via HEALTH_INCLUDE_PROTOCOLS=true.
  if (process.env.HEALTH_INCLUDE_PROTOCOLS !== "true") {
    return NextResponse.json(health, { status: health.status === "healthy" ? 200 : 503 });
  }

  try {
    const { getA2AProtocol } = await import("@/lib/a2a/protocol");
    const { getANPProtocol } = await import("@/lib/anp/protocol");
    const { getAP2Protocol } = await import("@/lib/payment/ap2");
    const { getProtocolSecurity } = await import("@/lib/security/protocol-security");
    const { getAGUIProtocol } = await import("@/lib/ag-ui/protocol");

    const a2aProtocol = getA2AProtocol();
    const anpProtocol = getANPProtocol();
    const ap2Protocol = getAP2Protocol();
    const protocolSecurity = getProtocolSecurity();
    const aguiProtocol = getAGUIProtocol();

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
