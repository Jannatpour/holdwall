/**
 * MCP Tool Safety Enforcement
 * 
 * Hardens MCP tool execution with allowlists, scoped credentials, risk tiers,
 * content-based policies, and execution timeouts.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { MCPToolCall } from "@/lib/mcp/types";

export type ToolRiskTier = "low" | "medium" | "high" | "critical";

export interface ToolAllowlist {
  tenantId: string;
  allowedTools: string[];
  blockedTools: string[];
  riskTierPolicy: {
    low: boolean; // Allow low-risk tools
    medium: boolean; // Allow medium-risk tools
    high: boolean; // Allow high-risk tools
    critical: boolean; // Allow critical-risk tools (usually false)
  };
}

export interface ScopedCredentials {
  toolName: string;
  allowedResources: string[]; // Resource identifiers tool can access
  allowedOperations: string[]; // Operations tool can perform
  maxScope: "read" | "write" | "delete" | "admin";
}

export interface ContentBasedPolicy {
  toolName: string;
  blockedPatterns: RegExp[]; // Patterns that block execution
  requiredPatterns?: RegExp[]; // Patterns that must be present
  maxInputLength?: number;
  maxOutputLength?: number;
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  riskTier?: ToolRiskTier;
  warnings?: string[];
}

/**
 * MCP Tool Safety Enforcer
 */
export class MCPSafetyEnforcer {
  private allowlists: Map<string, ToolAllowlist> = new Map();
  private scopedCredentials: Map<string, ScopedCredentials> = new Map();
  private contentPolicies: Map<string, ContentBasedPolicy> = new Map();
  private toolRiskTiers: Map<string, ToolRiskTier> = new Map();
  private executionTimeouts: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultRiskTiers();
    this.initializeDefaultPolicies();
  }

  /**
   * Check if tool execution is allowed
   */
  async checkToolExecution(
    toolCall: MCPToolCall,
    tenantId: string,
    userId: string
  ): Promise<SafetyCheckResult> {
    const toolName = toolCall.tool_name;
    const warnings: string[] = [];

    // 1. Check allowlist
    const allowlistCheck = this.checkAllowlist(toolName, tenantId);
    if (!allowlistCheck.allowed) {
      return allowlistCheck;
    }

    // 2. Check risk tier
    const riskTier = this.getToolRiskTier(toolName);
    const riskTierCheck = this.checkRiskTier(riskTier, tenantId);
    if (!riskTierCheck.allowed) {
      return riskTierCheck;
    }
    warnings.push(...(riskTierCheck.warnings || []));

    // 3. Check scoped credentials
    const credentialsCheck = this.checkScopedCredentials(toolCall, tenantId);
    if (!credentialsCheck.allowed) {
      return credentialsCheck;
    }
    warnings.push(...(credentialsCheck.warnings || []));

    // 4. Check content-based policies
    const contentCheck = this.checkContentPolicy(toolCall);
    if (!contentCheck.allowed) {
      return contentCheck;
    }
    warnings.push(...(contentCheck.warnings || []));

    // 5. Check execution timeout
    const timeout = this.getExecutionTimeout(toolName);
    if (timeout > 0) {
      warnings.push(`Tool has execution timeout: ${timeout}ms`);
    }

    // Record metrics
    metrics.increment("mcp_safety_checks_total", {
      tool: toolName,
      tenant_id: tenantId,
      risk_tier: riskTier,
      allowed: "true",
    });

    logger.info("MCP tool safety check passed", {
      tool: toolName,
      tenantId,
      userId,
      riskTier,
    });

    return {
      allowed: true,
      riskTier,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check allowlist
   */
  private checkAllowlist(toolName: string, tenantId: string): SafetyCheckResult {
    const allowlist = this.allowlists.get(tenantId);
    if (!allowlist) {
      // No allowlist = allow by default (can be changed to deny by default)
      return { allowed: true };
    }

    // Check blocked tools
    if (allowlist.blockedTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is blocked for tenant ${tenantId}`,
      };
    }

    // Check allowed tools (if allowlist is restrictive)
    if (allowlist.allowedTools.length > 0 && !allowlist.allowedTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is not in allowlist for tenant ${tenantId}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check risk tier policy
   */
  private checkRiskTier(
    riskTier: ToolRiskTier,
    tenantId: string
  ): SafetyCheckResult {
    const allowlist = this.allowlists.get(tenantId);
    if (!allowlist) {
      // Default policy: allow low/medium, block high/critical
      if (riskTier === "high" || riskTier === "critical") {
        return {
          allowed: false,
          reason: `Tool risk tier ${riskTier} is blocked by default policy`,
          riskTier,
        };
      }
      return { allowed: true, riskTier };
    }

    const policy = allowlist.riskTierPolicy;
    const allowed = policy[riskTier];

    if (!allowed) {
      return {
        allowed: false,
        reason: `Tool risk tier ${riskTier} is not allowed for tenant ${tenantId}`,
        riskTier,
      };
    }

    const warnings: string[] = [];
    if (riskTier === "high") {
      warnings.push("High-risk tool execution");
    }
    if (riskTier === "critical") {
      warnings.push("CRITICAL: Critical-risk tool execution");
    }

    return {
      allowed: true,
      riskTier,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check scoped credentials
   */
  private checkScopedCredentials(
    toolCall: MCPToolCall,
    tenantId: string
  ): SafetyCheckResult {
    const scopedCreds = this.scopedCredentials.get(toolCall.tool_name);
    if (!scopedCreds) {
      return { allowed: true }; // No scoping = allow
    }

    // Check if tool is accessing allowed resources
    if (toolCall.parameters?.resource) {
      const resource = toolCall.parameters.resource as string;
      if (
        scopedCreds.allowedResources.length > 0 &&
        !scopedCreds.allowedResources.includes(resource)
      ) {
        return {
          allowed: false,
          reason: `Tool ${toolCall.tool_name} is not allowed to access resource ${resource}`,
        };
      }
    }

    // Check if tool is performing allowed operations
    if (toolCall.parameters?.operation) {
      const operation = toolCall.parameters.operation as string;
      if (
        scopedCreds.allowedOperations.length > 0 &&
        !scopedCreds.allowedOperations.includes(operation)
      ) {
        return {
          allowed: false,
          reason: `Tool ${toolCall.tool_name} is not allowed to perform operation ${operation}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check content-based policies
   */
  private checkContentPolicy(toolCall: MCPToolCall): SafetyCheckResult {
    const policy = this.contentPolicies.get(toolCall.tool_name);
    if (!policy) {
      return { allowed: true };
    }

    const input = JSON.stringify(toolCall.parameters || {});

    // Check max input length
    if (policy.maxInputLength && input.length > policy.maxInputLength) {
      return {
        allowed: false,
        reason: `Tool input exceeds maximum length: ${input.length} > ${policy.maxInputLength}`,
      };
    }

    // Check blocked patterns
    for (const pattern of policy.blockedPatterns) {
      if (pattern.test(input)) {
        return {
          allowed: false,
          reason: `Tool input matches blocked pattern: ${pattern}`,
        };
      }
    }

    // Check required patterns
    if (policy.requiredPatterns && policy.requiredPatterns.length > 0) {
      const hasRequired = policy.requiredPatterns.some((pattern) =>
        pattern.test(input)
      );
      if (!hasRequired) {
        return {
          allowed: false,
          reason: `Tool input does not match required patterns`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get tool risk tier
   */
  getToolRiskTier(toolName: string): ToolRiskTier {
    return this.toolRiskTiers.get(toolName) || "medium";
  }

  /**
   * Set tool risk tier
   */
  setToolRiskTier(toolName: string, riskTier: ToolRiskTier): void {
    this.toolRiskTiers.set(toolName, riskTier);
    logger.info("Tool risk tier updated", { tool: toolName, riskTier });
  }

  /**
   * Get execution timeout for tool
   */
  getExecutionTimeout(toolName: string): number {
    return this.executionTimeouts.get(toolName) || 30000; // Default 30s
  }

  /**
   * Set execution timeout for tool
   */
  setExecutionTimeout(toolName: string, timeoutMs: number): void {
    this.executionTimeouts.set(toolName, timeoutMs);
    logger.info("Tool execution timeout updated", {
      tool: toolName,
      timeout: timeoutMs,
    });
  }

  /**
   * Set allowlist for tenant
   */
  setAllowlist(tenantId: string, allowlist: ToolAllowlist): void {
    this.allowlists.set(tenantId, allowlist);
    logger.info("Tool allowlist updated", { tenantId });
  }

  /**
   * Set scoped credentials for tool
   */
  setScopedCredentials(toolName: string, credentials: ScopedCredentials): void {
    this.scopedCredentials.set(toolName, credentials);
    logger.info("Scoped credentials updated", { tool: toolName });
  }

  /**
   * Set content policy for tool
   */
  setContentPolicy(toolName: string, policy: ContentBasedPolicy): void {
    this.contentPolicies.set(toolName, policy);
    logger.info("Content policy updated", { tool: toolName });
  }

  /**
   * Initialize default risk tiers
   */
  private initializeDefaultRiskTiers(): void {
    // Low-risk: Read-only, safe operations
    this.toolRiskTiers.set("read_file", "low");
    this.toolRiskTiers.set("search", "low");
    this.toolRiskTiers.set("get_metadata", "low");

    // Medium-risk: Write operations with validation
    this.toolRiskTiers.set("write_file", "medium");
    this.toolRiskTiers.set("update_record", "medium");
    this.toolRiskTiers.set("send_email", "medium");

    // High-risk: Destructive or sensitive operations
    this.toolRiskTiers.set("delete_file", "high");
    this.toolRiskTiers.set("execute_command", "high");
    this.toolRiskTiers.set("access_database", "high");

    // Critical-risk: System-level or dangerous operations
    this.toolRiskTiers.set("system_command", "critical");
    this.toolRiskTiers.set("network_request", "critical");
  }

  /**
   * Initialize default content policies
   */
  private initializeDefaultPolicies(): void {
    // Block SQL injection patterns
    this.contentPolicies.set("execute_command", {
      toolName: "execute_command",
      blockedPatterns: [
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
        /UPDATE\s+.*\s+SET/i,
        /INSERT\s+INTO/i,
        /;\s*--/i, // SQL comment injection
      ],
      maxInputLength: 1000,
    });

    // Block path traversal
    this.contentPolicies.set("read_file", {
      toolName: "read_file",
      blockedPatterns: [/\.\./, /\/etc\/passwd/, /\/proc\//],
    });
  }
}

// Singleton instance
let safetyEnforcerInstance: MCPSafetyEnforcer | null = null;

export function getMCPSafetyEnforcer(): MCPSafetyEnforcer {
  if (!safetyEnforcerInstance) {
    safetyEnforcerInstance = new MCPSafetyEnforcer();
  }
  return safetyEnforcerInstance;
}
