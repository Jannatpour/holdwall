/**
 * OpenAPI/Swagger Documentation Generator
 * Auto-generate API documentation from route handlers
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      email: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
}

export const openAPISpec: OpenAPISpec = {
  openapi: "3.1.0",
  info: {
    title: "Holdwall POS API",
    version: "1.0.0",
    description:
      "Evidence-first, agentic perception engineering API. Build authoritative artifacts (AAAL), predict narrative risk (NPE), and route actions through human-gated autopilot.",
    contact: {
      name: "Holdwall Support",
      email: "api@holdwall.com",
      url: "https://holdwall.com/support",
    },
  },
  servers: [
    {
      url: "https://api.holdwall.com",
      description: "Production server",
    },
    {
      url: "https://staging-api.holdwall.com",
      description: "Staging server",
    },
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  paths: {
    "/api/claims": {
      get: {
        summary: "List claims",
        description: "Get a list of claims with optional filtering",
        tags: ["Claims"],
        parameters: [
          {
            name: "cluster_id",
            in: "query",
            schema: { type: "string" },
            description: "Filter by cluster ID",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
            description: "Maximum number of results",
          },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Claim" },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "500": { description: "Internal server error" },
        },
        security: [{ bearerAuth: [] }],
      },
      post: {
        summary: "Create claim",
        description: "Create a new claim",
        tags: ["Claims"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateClaimInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Claim created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Claim" },
              },
            },
          },
          "400": { description: "Bad request" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/evidence": {
      get: {
        summary: "List evidence",
        description: "Get a list of evidence items",
        tags: ["Evidence"],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Evidence" },
                },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/search": {
      get: {
        summary: "Global search",
        description: "Search across all entity types",
        tags: ["Search"],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 2, maxLength: 200 },
            description: "Search query",
          },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: { $ref: "#/components/schemas/SearchResult" },
                    },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/metrics": {
      get: {
        summary: "Get metrics",
        description: "Get Prometheus-compatible metrics",
        tags: ["Observability"],
        parameters: [
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["prometheus", "json"], default: "prometheus" },
          },
        ],
        responses: {
          "200": {
            description: "Metrics data",
            content: {
              "text/plain": {},
              "application/json": {},
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/feature-flags": {
      get: {
        summary: "Get feature flags",
        description: "Check if a feature is enabled or list all flags (admin only)",
        tags: ["System"],
        parameters: [
          {
            name: "flag",
            in: "query",
            schema: { type: "string" },
            description: "Feature flag name to check",
          },
        ],
        responses: {
          "200": {
            description: "Feature flag status or list of flags",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        flag: { type: "string" },
                        enabled: { type: "boolean" },
                      },
                    },
                    {
                      type: "object",
                      properties: {
                        flags: {
                          type: "array",
                          items: { $ref: "#/components/schemas/FeatureFlag" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
        security: [{ bearerAuth: [] }],
      },
      put: {
        summary: "Update feature flag",
        description: "Create or update a feature flag (admin only)",
        tags: ["System"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/FeatureFlag" },
            },
          },
        },
        responses: {
          "200": {
            description: "Feature flag updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    flag: { $ref: "#/components/schemas/FeatureFlag" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/system/load-balancer": {
      get: {
        summary: "Get load balancer status",
        description: "Get current load balancer status and instance information",
        tags: ["System"],
        responses: {
          "200": {
            description: "Load balancer status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalInstances: { type: "integer" },
                    healthyInstances: { type: "integer" },
                    averageLoad: { type: "number" },
                    instances: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ServiceInstance" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
      post: {
        summary: "Manage load balancer instances",
        description: "Register or unregister service instances (admin only)",
        tags: ["System"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["register", "unregister"] },
                  instance: { $ref: "#/components/schemas/ServiceInstance" },
                },
                required: ["action"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Action completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/system/threat-detection": {
      get: {
        summary: "Get threat detection statistics",
        description: "Get threat detection statistics and blocked sources (admin only)",
        tags: ["System"],
        responses: {
          "200": {
            description: "Threat detection statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalThreats: { type: "integer" },
                    threatsByType: { type: "object" },
                    threatsBySeverity: { type: "object" },
                    blockedSources: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
        security: [{ bearerAuth: [] }],
      },
      post: {
        summary: "Manage threat detection",
        description: "Block or unblock IP addresses (admin only)",
        tags: ["System"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["block", "unblock"] },
                  ip: { type: "string" },
                },
                required: ["action", "ip"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Action completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/a2a/register": {
      post: {
        summary: "Register A2A agent",
        description: "Register an agent in the A2A network for discovery and communication",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["agentId", "name", "version", "capabilities", "endpoint"],
                properties: {
                  agentId: { type: "string" },
                  name: { type: "string" },
                  version: { type: "string" },
                  capabilities: { type: "array", items: { type: "string" } },
                  endpoint: { type: "string" },
                  publicKey: { type: "string" },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Agent registered successfully" },
          "400": { description: "Invalid request" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/a2a/discover": {
      post: {
        summary: "Discover A2A agents",
        description: "Discover agents by capabilities with OASF filtering",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["requesterAgentId"],
                properties: {
                  requesterAgentId: { type: "string" },
                  requiredCapabilities: { type: "array", items: { type: "string" } },
                  filters: { type: "object" },
                  maxResults: { type: "integer" },
                  sortBy: { type: "string", enum: ["cost", "reliability", "latency", "uptime"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Agent discovery results" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/a2a/hire": {
      post: {
        summary: "Hire agent (OASF)",
        description: "Hire best agent for task based on OASF profile (capability, cost, reliability)",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["taskType", "requiredCapabilities"],
                properties: {
                  taskType: { type: "string" },
                  requiredCapabilities: { type: "array", items: { type: "string" } },
                  budget: { type: "number" },
                  maxLatency: { type: "number" },
                  requiredSkills: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Agent hired successfully" },
          "404": { description: "No suitable agent found" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/a2a/card/{agentId}": {
      get: {
        summary: "Get agent card",
        description: "Get agent card/profile information for hosting and display",
        tags: ["Agent Protocols"],
        parameters: [
          {
            name: "agentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Agent card" },
          "404": { description: "Agent not found" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/anp/networks": {
      post: {
        summary: "Create or manage ANP network",
        description: "Create network, discover networks, join/leave, route messages, select agents, check health",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["create", "discover", "join", "leave", "route_message", "select_agent", "health", "agent_health"] },
                  networkId: { type: "string" },
                  name: { type: "string" },
                  topology: { type: "string", enum: ["mesh", "star", "hierarchical", "ring"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Network operation successful" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
      get: {
        summary: "Discover ANP networks",
        description: "Discover available agent networks",
        tags: ["Agent Protocols"],
        responses: {
          "200": { description: "Network list" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/ap2/mandates": {
      post: {
        summary: "Create or approve AP2 mandate",
        description: "Create payment mandate or approve existing mandate with signature",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["create", "approve"] },
                  fromAgentId: { type: "string" },
                  toAgentId: { type: "string" },
                  type: { type: "string", enum: ["intent", "cart", "payment"] },
                  amount: { type: "number" },
                  currency: { type: "string", minLength: 3, maxLength: 3 },
                  mandateId: { type: "string" },
                  signature: { type: "string" },
                  publicKey: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Mandate operation successful" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
      get: {
        summary: "Get or list AP2 mandates",
        description: "Get mandate details by ID or list mandates with filters",
        tags: ["Agent Protocols"],
        parameters: [
          {
            name: "mandateId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Get single mandate by ID",
          },
          {
            name: "fromAgentId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter by from agent ID",
          },
          {
            name: "toAgentId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter by to agent ID",
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["pending", "approved", "rejected", "expired", "revoked", "completed"] },
            description: "Filter by mandate status",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
            description: "Maximum number of mandates to return",
          },
        ],
        responses: {
          "200": {
            description: "Mandate details (if mandateId provided) or list of mandates (if filters provided)",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        mandate: { $ref: "#/components/schemas/PaymentMandate" },
                      },
                    },
                    {
                      type: "object",
                      properties: {
                        mandates: {
                          type: "array",
                          items: { $ref: "#/components/schemas/PaymentMandate" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "404": { description: "Mandate not found" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/ap2/payments": {
      post: {
        summary: "Execute AP2 payment or revoke mandate",
        description: "Execute payment from approved mandate or revoke mandate",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["execute", "revoke"] },
                  mandateId: { type: "string" },
                  fromAgentId: { type: "string" },
                  toAgentId: { type: "string" },
                  signature: { type: "string" },
                  publicKey: { type: "string" },
                  adapterName: { type: "string" },
                  agentId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Payment operation successful" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/ap2/wallet": {
      get: {
        summary: "Get AP2 wallet balance and ledger",
        description: "Get wallet balance and transaction ledger for agent",
        tags: ["Agent Protocols"],
        parameters: [
          {
            name: "agentId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "currency",
            in: "query",
            schema: { type: "string", minLength: 3, maxLength: 3 },
          },
        ],
        responses: {
          "200": { description: "Wallet information" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
      post: {
        summary: "Set AP2 wallet limit",
        description: "Set spending limit for agent wallet",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["agentId", "limitType", "limitAmount", "currency"],
                properties: {
                  agentId: { type: "string" },
                  limitType: { type: "string", enum: ["daily", "weekly", "monthly", "transaction", "lifetime"] },
                  limitAmount: { type: "number" },
                  currency: { type: "string", minLength: 3, maxLength: 3 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Limit set successfully" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/ap2/audit": {
      get: {
        summary: "Get AP2 audit logs",
        description: "Retrieve payment audit logs with filtering",
        tags: ["Agent Protocols"],
        parameters: [
          {
            name: "mandateId",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "transactionId",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "agentId",
            in: "query",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Audit logs" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/security/identity": {
      post: {
        summary: "Register identity, verify, generate keys, sign/verify",
        description: "Protocol security identity management operations",
        tags: ["Security"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action"],
                properties: {
                  action: { type: "string", enum: ["register", "verify", "generate_keypair", "sign", "verify_signature"] },
                  agentId: { type: "string" },
                  publicKey: { type: "string" },
                  certificate: { type: "string" },
                  oidcToken: { type: "string" },
                  message: { type: "string" },
                  signature: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Operation successful" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
      get: {
        summary: "Get security context",
        description: "Get security context for agent",
        tags: ["Security"],
        parameters: [
          {
            name: "agentId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Security context" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/security/permissions": {
      post: {
        summary: "Check protocol permission",
        description: "Check if agent has permission for protocol action",
        tags: ["Security"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["agentId", "protocol", "action"],
                properties: {
                  agentId: { type: "string" },
                  protocol: { type: "string", enum: ["a2a", "anp", "ag-ui", "ap2", "acp", "mcp"] },
                  action: { type: "string" },
                  resource: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Permission check result" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/agents/unified": {
      post: {
        summary: "Unified protocol API",
        description: "Single endpoint for all agent protocols (MCP, ACP, A2A, ANP, AG-UI, AP2)",
        tags: ["Agent Protocols"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["protocol", "action", "payload"],
                properties: {
                  protocol: { type: "string", enum: ["mcp", "acp", "a2a", "anp", "ag-ui", "ap2"] },
                  action: { type: "string" },
                  payload: { type: "object" },
                  sessionId: { type: "string" },
                  agentId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Protocol operation result" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
      get: {
        summary: "Get protocol capabilities",
        description: "Get available actions for each protocol",
        tags: ["Agent Protocols"],
        responses: {
          "200": { description: "Protocol capabilities" },
          "401": { description: "Unauthorized" },
        },
        security: [{ bearerAuth: [] }],
      },
    },
  },
  components: {
    schemas: {
      Claim: {
        type: "object",
        properties: {
          id: { type: "string" },
          canonicalText: { type: "string" },
          variants: { type: "array", items: { type: "string" } },
          decisiveness: { type: "number", minimum: 0, maximum: 1 },
          clusterId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "canonicalText", "decisiveness"],
      },
      CreateClaimInput: {
        type: "object",
        properties: {
          canonicalText: { type: "string" },
          variants: { type: "array", items: { type: "string" } },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["canonicalText"],
      },
      Evidence: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["SIGNAL", "DOCUMENT", "ARTIFACT", "METRIC", "EXTERNAL"] },
          sourceType: { type: "string" },
          sourceId: { type: "string" },
          contentRaw: { type: "string", nullable: true },
          contentNormalized: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "type", "sourceType", "sourceId"],
      },
      SearchResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: ["claim", "evidence", "artifact", "audit", "signal", "task", "influencer", "trust_asset"],
          },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          url: { type: "string" },
        },
        required: ["id", "type", "title", "url"],
      },
      PaymentMandate: {
        type: "object",
        properties: {
          mandateId: { type: "string" },
          fromAgentId: { type: "string" },
          toAgentId: { type: "string" },
          type: { type: "string", enum: ["intent", "cart", "payment"] },
          amount: { type: "integer", description: "Amount in smallest currency unit (cents)" },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          description: { type: "string", nullable: true },
          metadata: { type: "object", additionalProperties: true, nullable: true },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          status: {
            type: "string",
            enum: ["pending", "approved", "rejected", "expired", "revoked", "completed"],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["mandateId", "fromAgentId", "toAgentId", "type", "amount", "currency", "status", "createdAt", "updatedAt"],
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
          code: { type: "string" },
        },
        required: ["error"],
      },
      FeatureFlag: {
        type: "object",
        properties: {
          name: { type: "string" },
          enabled: { type: "boolean" },
          description: { type: "string" },
          rollout_percentage: { type: "number", minimum: 0, maximum: 100 },
          target_users: { type: "array", items: { type: "string" } },
          target_tenants: { type: "array", items: { type: "string" } },
          target_roles: { type: "array", items: { type: "string" } },
        },
        required: ["name", "enabled"],
      },
      ServiceInstance: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          region: { type: "string" },
          zone: { type: "string" },
          health: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
          load: { type: "number", minimum: 0, maximum: 1 },
          capacity: { type: "integer" },
          activeRequests: { type: "integer" },
          responseTime: { type: "number" },
          errorRate: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["id", "url", "health"],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from NextAuth",
      },
    },
  },
};

/**
 * Generate OpenAPI spec as JSON
 */
export function generateOpenAPISpec(): string {
  return JSON.stringify(openAPISpec, null, 2);
}
