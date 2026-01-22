/**
 * Protocol Bridge
 * 
 * Integrates MCP, ACP, A2A, ANP, AG-UI, and AP2 protocols into a unified agent orchestration system.
 */

import { logger } from "@/lib/logging/logger";
import { MCPGateway } from "@/lib/mcp/gateway";
import { ACPClientImpl } from "@/lib/acp/client";
import { createLMOSTransport } from "@/lib/phoenix/transport";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { getANPProtocol } from "@/lib/anp/protocol";
import { getAGUIProtocol } from "@/lib/ag-ui/protocol";
import { getAP2Protocol } from "@/lib/payment/ap2";
import type { MCPToolCall, MCPToolResult } from "@/lib/mcp/types";
import type { ACPMessageType, ACPMessagePayload } from "@/lib/acp/types";

export type ProtocolType = "mcp" | "acp" | "a2a" | "anp" | "ag-ui" | "ap2";

export interface UnifiedAgentRequest {
  protocol: ProtocolType;
  action: string;
  payload: unknown;
  userId: string;
  tenantId: string;
  sessionId?: string;
  agentId?: string;
}

export interface UnifiedAgentResponse {
  success: boolean;
  result: unknown;
  protocol: ProtocolType;
  metadata?: {
    latency?: number;
    cost?: number;
    model?: string;
  };
}

/**
 * Protocol Bridge for unified agent orchestration
 */
export class ProtocolBridge {
  private mcpGateway: MCPGateway;
  private acpClient: ACPClientImpl;
  private a2aProtocol = getA2AProtocol();
  private anpProtocol = getANPProtocol();
  private aguiProtocol = getAGUIProtocol();
  private ap2Protocol = getAP2Protocol();

  constructor() {
    this.mcpGateway = new MCPGateway();
    // Use LMOS transport abstraction for ACP client
    const transportType = (process.env.ACP_TRANSPORT_TYPE as "http" | "sse" | "websocket" | "webrtc" | "mqtt" | "gateway") || "http";
    const acpTransport = createLMOSTransport(transportType, {
      url: process.env.ACP_BASE_URL || "http://localhost:3000",
      brokerUrl: process.env.MQTT_BROKER_URL,
      topic: process.env.MQTT_TOPIC || "holdwall/acp",
      protocol: process.env.GATEWAY_PROTOCOL as "http" | "websocket" | "custom" | undefined,
    });
    this.acpClient = new ACPClientImpl(acpTransport);
  }

  /**
   * Route request to appropriate protocol
   */
  async route(request: UnifiedAgentRequest): Promise<UnifiedAgentResponse> {
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (request.protocol) {
        case "mcp":
          result = await this.handleMCP(request);
          break;
        case "acp":
          result = await this.handleACP(request);
          break;
        case "a2a":
          result = await this.handleA2A(request);
          break;
        case "anp":
          result = await this.handleANP(request);
          break;
        case "ag-ui":
          result = await this.handleAGUI(request);
          break;
        case "ap2":
          result = await this.handleAP2(request);
          break;
        default:
          throw new Error(`Unknown protocol: ${request.protocol}`);
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        result,
        protocol: request.protocol,
        metadata: {
          latency,
        },
      };
    } catch (error) {
      logger.error("Protocol bridge routing failed", {
        error: error instanceof Error ? error.message : String(error),
        protocol: request.protocol,
        action: request.action,
      });

      return {
        success: false,
        result: { error: error instanceof Error ? error.message : String(error) },
        protocol: request.protocol,
        metadata: {
          latency: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Handle MCP protocol requests
   */
  private async handleMCP(request: UnifiedAgentRequest): Promise<unknown> {
    if (request.action === "execute_tool") {
      const toolCall = request.payload as MCPToolCall;
      const gatewayResponse = await this.mcpGateway.process({
        toolCall,
        userId: request.userId,
        tenantId: request.tenantId,
      });
      return gatewayResponse.result;
    }

    throw new Error(`Unknown MCP action: ${request.action}`);
  }

  /**
   * Handle ACP protocol requests
   */
  private async handleACP(request: UnifiedAgentRequest): Promise<unknown> {
    if (request.action === "send_message") {
      const { type, payload } = request.payload as {
        type: ACPMessageType;
        payload: ACPMessagePayload;
      };
      const messageId = await this.acpClient.send(type, payload);
      return { messageId };
    }

    throw new Error(`Unknown ACP action: ${request.action}`);
  }

  /**
   * Handle A2A protocol requests
   */
  private async handleA2A(request: UnifiedAgentRequest): Promise<unknown> {
    switch (request.action) {
      case "register":
        await this.a2aProtocol.registerAgent(request.payload as any);
        return { success: true };
      case "discover":
        return await this.a2aProtocol.discoverAgents(request.payload as any);
      case "connect":
        const { agentId, peerAgentId } = request.payload as {
          agentId: string;
          peerAgentId: string;
        };
        return await this.a2aProtocol.connectAgents(agentId, peerAgentId);
      case "send_message":
        await this.a2aProtocol.sendMessage(request.payload as any);
        return { success: true };
      case "receive_messages":
        if (!request.agentId) {
          throw new Error("agentId required for receive_messages");
        }
        return await this.a2aProtocol.receiveMessages(request.agentId);
      case "register_with_profile":
        await this.a2aProtocol.registerAgentWithProfile(
          request.payload as any,
          (request.payload as any).endpoint,
          (request.payload as any).publicKey
        );
        return { success: true };
      case "hire_agent":
        const hiredAgent = await this.a2aProtocol.hireAgent(request.payload as any);
        return { agent: hiredAgent };
      default:
        throw new Error(`Unknown A2A action: ${request.action}`);
    }
  }

  /**
   * Handle ANP protocol requests with network manager integration
   */
  private async handleANP(request: UnifiedAgentRequest): Promise<unknown> {
    switch (request.action) {
      case "create_network":
        await this.anpProtocol.createNetwork(request.payload as any);
        return { success: true };
      case "discover_networks":
        return await this.anpProtocol.discoverNetworks(request.payload as any);
      case "join_network":
        return await this.anpProtocol.joinNetwork(request.payload as any);
      case "leave_network":
        const { agentId, networkId } = request.payload as {
          agentId: string;
          networkId: string;
        };
        await this.anpProtocol.leaveNetwork(agentId, networkId);
        return { success: true };
      case "send_network_message":
        await this.anpProtocol.sendNetworkMessage(request.payload as any);
        return { success: true };
      case "route_message":
        const routeParams = request.payload as {
          networkId: string;
          fromAgentId: string;
          toAgentId: string;
          options?: {
            preferLowLatency?: boolean;
            preferHighReliability?: boolean;
            maxHops?: number;
          };
        };
        return await this.anpProtocol.routeMessage(
          routeParams.networkId,
          routeParams.fromAgentId,
          routeParams.toAgentId,
          routeParams.options
        );
      case "select_agent":
        const selectParams = request.payload as {
          networkId: string;
          criteria: {
            requiredCapabilities?: string[];
            preferLowLatency?: boolean;
            preferHighReliability?: boolean;
            excludeAgentIds?: string[];
          };
        };
        const selectedAgent = await this.anpProtocol.selectAgent(
          selectParams.networkId,
          selectParams.criteria
        );
        return { agentId: selectedAgent };
      case "get_network_health":
        const healthParams = request.payload as { networkId: string };
        return await this.anpProtocol.getNetworkHealth(healthParams.networkId);
      case "check_agent_health":
        const agentHealthParams = request.payload as { agentId: string };
        return await this.anpProtocol.checkAgentHealth(agentHealthParams.agentId);
      default:
        throw new Error(`Unknown ANP action: ${request.action}`);
    }
  }

  /**
   * Handle AP2 protocol requests
   */
  private async handleAP2(request: UnifiedAgentRequest): Promise<unknown> {
    switch (request.action) {
      case "create_mandate":
        return await this.ap2Protocol.createMandate(request.payload as any);
      case "approve_mandate":
        return await this.ap2Protocol.approveMandate(request.payload as any);
      case "execute_payment":
        return await this.ap2Protocol.executePayment(request.payload as any);
      case "revoke_mandate":
        const revokeParams = request.payload as { mandateId: string; agentId: string };
        await this.ap2Protocol.revokeMandate(revokeParams.mandateId, revokeParams.agentId);
        return { success: true };
      case "get_mandate":
        const getParams = request.payload as { mandateId: string };
        const mandate = await this.ap2Protocol.getMandate(getParams.mandateId);
        return mandate;
      case "get_wallet_balance":
        const balanceParams = request.payload as { walletId: string; currency?: string };
        const balance = await this.ap2Protocol.getWalletBalance(balanceParams.walletId, balanceParams.currency || "USD");
        return { balance, walletId: balanceParams.walletId, currency: balanceParams.currency || "USD" };
      case "get_wallet_ledger":
        const ledgerParams = request.payload as { walletId: string; currency?: string };
        return await this.ap2Protocol.getWalletLedger(ledgerParams.walletId, ledgerParams.currency);
      case "set_wallet_limit":
        const limitParams = request.payload as {
          agentId: string;
          limitType: "daily" | "weekly" | "monthly" | "transaction" | "lifetime";
          limitAmount: number;
          currency: string;
        };
        await this.ap2Protocol.setWalletLimit(
          limitParams.agentId,
          limitParams.limitType,
          limitParams.limitAmount,
          limitParams.currency
        );
        return { success: true };
      case "get_audit_logs":
        const auditParams = request.payload as {
          mandateId?: string;
          transactionId?: string;
          agentId?: string;
          action?: string;
          startTime?: Date;
          endTime?: Date;
        };
        return await this.ap2Protocol.getAuditLogs(auditParams);
      case "execute_payment_with_adapter":
        const executeParams = request.payload as {
          mandateId: string;
          fromAgentId: string;
          toAgentId: string;
          signature: string;
          publicKey: string;
          adapterName?: string;
        };
        return await this.ap2Protocol.executePaymentWithAdapter(
          {
            mandateId: executeParams.mandateId,
            fromAgentId: executeParams.fromAgentId,
            toAgentId: executeParams.toAgentId,
            signature: executeParams.signature,
            publicKey: executeParams.publicKey,
          },
          executeParams.adapterName
        );
      default:
        throw new Error(`Unknown AP2 action: ${request.action}`);
    }
  }

  /**
   * Handle AG-UI protocol requests
   */
  private async handleAGUI(request: UnifiedAgentRequest): Promise<unknown> {
    switch (request.action) {
      case "start_session":
        if (!request.agentId) {
          throw new Error("agentId required for start_session");
        }
        return await this.aguiProtocol.startSession(request.userId, request.agentId);
      case "process_input":
        return await this.aguiProtocol.processInput(request.payload as any);
      case "get_session":
        if (!request.sessionId) {
          throw new Error("sessionId required for get_session");
        }
        const session = this.aguiProtocol.getSession(request.sessionId);
        if (!session) {
          throw new Error("Session not found");
        }
        return session;
      case "end_session":
        if (!request.sessionId) {
          throw new Error("sessionId required for end_session");
        }
        await this.aguiProtocol.endSession(request.sessionId);
        return { success: true };
      default:
        throw new Error(`Unknown AG-UI action: ${request.action}`);
    }
  }

  /**
   * Get protocol capabilities
   */
  getProtocolCapabilities(): Record<ProtocolType, string[]> {
    return {
      mcp: ["execute_tool", "list_tools", "get_tool_schema"],
      acp: ["send_message", "receive_message", "subscribe"],
      a2a: [
        "register",
        "register_with_profile",
        "discover",
        "hire_agent",
        "connect",
        "send_message",
        "receive_messages",
        "disconnect",
      ],
      anp: [
        "create_network",
        "discover_networks",
        "join_network",
        "leave_network",
        "send_network_message",
        "route_message",
        "select_agent",
        "get_network_health",
        "check_agent_health",
      ],
      "ag-ui": [
        "start_session",
        "process_input",
        "get_session",
        "end_session",
      ],
      ap2: [
        "create_mandate",
        "approve_mandate",
        "execute_payment",
        "execute_payment_with_adapter",
        "revoke_mandate",
        "get_mandate",
        "get_wallet_balance",
        "get_wallet_ledger",
        "set_wallet_limit",
        "get_audit_logs",
      ],
    };
  }
}

// Singleton instance
let protocolBridgeInstance: ProtocolBridge | null = null;

export function getProtocolBridge(): ProtocolBridge {
  if (!protocolBridgeInstance) {
    protocolBridgeInstance = new ProtocolBridge();
  }
  return protocolBridgeInstance;
}
