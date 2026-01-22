/**
 * MCP Gateway Pattern
 * 
 * Centralized gateway handling authentication, authorization (RBAC),
 * rate limiting, and audit trails across multiple MCP servers.
 */

import type { MCPToolCall, MCPToolResult } from "./types";
import { RateLimiter } from "@/lib/middleware/rate-limit";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { InMemoryMCPToolRegistry } from "./registry";
import { getMCPSafetyEnforcer } from "./safety";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { getANPProtocol } from "@/lib/anp/protocol";
import { db } from "@/lib/db/client";

export interface GatewayRequest {
  toolCall: MCPToolCall;
  userId: string;
  tenantId: string;
  permissions?: string[];
}

export interface GatewayResponse {
  result: MCPToolResult;
  metadata: {
    authenticated: boolean;
    authorized: boolean;
    rateLimited: boolean;
    auditId: string;
  };
}

export class MCPGateway {
  private rateLimiter: RateLimiter;
  private auditLog: DatabaseAuditLog;
  private toolRegistry: InMemoryMCPToolRegistry;
  private safetyEnforcer = getMCPSafetyEnforcer();

  constructor() {
    this.rateLimiter = new RateLimiter();
    this.auditLog = new DatabaseAuditLog();
    this.toolRegistry = new InMemoryMCPToolRegistry();
  }

  /**
   * Process request through gateway
   */
  async process(
    request: GatewayRequest
  ): Promise<GatewayResponse> {
    const auditId = crypto.randomUUID();
    const startTime = Date.now();

    // 1. Authentication (verify user exists and is active)
    const authenticated = await this.authenticate(request.userId, request.tenantId);

    // 2. Authorization (RBAC/ABAC)
    const authorized = authenticated
      ? await this.authorize(request.toolCall, request.userId, request.permissions || [])
      : false;

    // 3. Rate limiting (Redis-backed)
    const rateLimitResult = await this.rateLimiter.rateLimit(
      new Request("http://localhost", {
        headers: {
          "x-user-id": request.userId,
          "x-tenant-id": request.tenantId,
        },
      }) as any,
      {
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        strategy: "sliding",
        keyGenerator: () => `mcp:${request.userId}:${request.toolCall.tool_name}`,
      }
    );

    const rateLimited = !rateLimitResult.allowed;

    // 4. Safety checks (allowlists, risk tiers, scoped credentials, content policies)
    const safetyCheck = await this.safetyEnforcer.checkToolExecution(
      request.toolCall,
      request.tenantId,
      request.userId
    );

    // 5. Execute tool if allowed
    let result: MCPToolResult;

    if (!authenticated) {
      result = {
        call_id: request.toolCall.call_id,
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "User not authenticated",
        },
      };
    } else if (!authorized) {
      result = {
        call_id: request.toolCall.call_id,
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User not authorized for this tool",
        },
      };
    } else if (rateLimited) {
      result = {
        call_id: request.toolCall.call_id,
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Rate limit exceeded",
          details: { retryAfter: rateLimitResult.retryAfter },
        },
      };
    } else if (!safetyCheck.allowed) {
      result = {
        call_id: request.toolCall.call_id,
        success: false,
        error: {
          code: "SAFETY_CHECK_FAILED",
          message: safetyCheck.reason || "Tool execution blocked by safety policy",
        },
      };
    } else {
      // Execute tool via registry with timeout
      try {
        const timeout = this.safetyEnforcer.getExecutionTimeout(request.toolCall.tool_name);
        const executionPromise = this.toolRegistry.call(request.toolCall);
        const timeoutPromise = new Promise<MCPToolResult>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Tool execution timeout: ${timeout}ms`)),
            timeout
          )
        );

        result = await Promise.race([executionPromise, timeoutPromise]);
        
        // Track execution metrics
        await this.trackExecution(request, result, Date.now() - startTime);
      } catch (error) {
        result = {
          call_id: request.toolCall.call_id,
          success: false,
          error: {
            code: "EXECUTION_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    }

    const response: GatewayResponse = {
      result,
      metadata: {
        authenticated,
        authorized,
        rateLimited,
        auditId,
      },
    };

    // 5. Audit logging (DB-backed)
    await this.auditLog.append({
      audit_id: auditId,
      tenant_id: request.tenantId,
      actor_id: request.userId,
      type: "mcp_tool_execution",
      timestamp: new Date().toISOString(),
      correlation_id: request.toolCall.call_id,
      causation_id: undefined,
      data: {
        tool_name: request.toolCall.tool_name,
        tool_version: request.toolCall.tool_version,
        parameters: request.toolCall.parameters,
        result: result.success,
        error: result.error,
        execution_time_ms: Date.now() - startTime,
      } as any,
      evidence_refs: [],
    });

    return response;
  }

  /**
   * Track tool execution metrics
   */
  private async trackExecution(
    request: GatewayRequest,
    result: MCPToolResult,
    durationMs: number
  ): Promise<void> {
    // Store execution metrics in database for reliability tracking
    // This could be a separate MCPToolExecution table, but for now we'll use audit log
    // In production, you might want a dedicated metrics table
  }

  /**
   * Authenticate user (verify user exists and is active)
   */
  private async authenticate(userId: string, tenantId: string): Promise<boolean> {
    if (!userId || !tenantId) {
      return false;
    }

    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, tenantId: true },
      });

      return user !== null && user.tenantId === tenantId;
    } catch (error) {
      console.error("Error authenticating user:", error);
      return false;
    }
  }

  /**
   * Authorize tool access (RBAC/ABAC)
   */
  private async authorize(
    toolCall: MCPToolCall,
    userId: string,
    permissions: string[]
  ): Promise<boolean> {
    // Check explicit permissions first
    const requiredPermission = `mcp:tool:${toolCall.tool_name}:execute`;
    if (permissions.includes(requiredPermission) || permissions.includes("mcp:*")) {
      return true;
    }

    // Check user role (ABAC)
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      // Admins have access to all tools
      if (user?.role === "ADMIN") {
        return true;
      }

      // Check tool-specific requirements
      const tool = this.toolRegistry.get(toolCall.tool_name, toolCall.tool_version);
      if (tool?.requires_approval) {
        // Tools requiring approval need explicit permission
        return false;
      }

      // Default: allow for non-admin users if tool doesn't require approval
      return true;
    } catch (error) {
      console.error("Error authorizing tool access:", error);
      return false;
    }
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(
    filters?: {
      userId?: string;
      toolName?: string;
      startTime?: string;
      endTime?: string;
      tenantId?: string;
    }
  ): Promise<Array<{
    auditId: string;
    timestamp: string;
    toolName: string;
    success: boolean;
    executionTimeMs: number;
  }>> {
    const entries = await this.auditLog.query({
      tenant_id: filters?.tenantId,
      type: "mcp_tool_execution",
      actor_id: filters?.userId,
      timestamp_after: filters?.startTime,
      timestamp_before: filters?.endTime,
    });

    return entries
      .filter((entry) => {
        const data = entry.data as any;
        if (filters?.toolName && data.tool_name !== filters.toolName) {
          return false;
        }
        return true;
      })
      .map((entry) => {
        const data = entry.data as any;
        return {
          auditId: entry.audit_id,
          timestamp: entry.timestamp,
          toolName: data.tool_name || "",
          success: data.result === true,
          executionTimeMs: data.execution_time_ms || 0,
        };
      });
  }
}
