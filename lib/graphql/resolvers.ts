/**
 * GraphQL Resolvers
 * 
 * Production-ready resolvers with:
 * - Data fetching from database
 * - Error handling
 * - Authorization
 * - Pagination
 * - Field-level resolvers
 */

import { db } from "@/lib/db/client";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { Reranker } from "@/lib/search/reranking";
import type { Evidence } from "@/lib/evidence/vault";
import { GraphQLDataLoader } from "./dataloader";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { getANPProtocol } from "@/lib/anp/protocol";
import { getAP2Protocol } from "@/lib/payment/ap2";

const evidenceVault = new DatabaseEvidenceVault();
const reranker = new Reranker();

// Create DataLoader instance per request (would be request-scoped in production)
function getDataLoader(context: any): GraphQLDataLoader {
  if (!context.dataLoader) {
    context.dataLoader = new GraphQLDataLoader();
  }
  return context.dataLoader;
}

/**
 * Map OASF AgentProfile to GraphQL AgentProfile type
 */
function mapProfileToGraphQL(profile: any): any {
  if (!profile) return null;

  return {
    agentId: profile.agentId,
    name: profile.name,
    version: profile.version,
    description: profile.description || null,
    capabilities: profile.capabilities || [],
    skills: (profile.skills || []).map((s: any) => ({
      skill: s.skill,
      proficiency: s.proficiency,
      verified: s.verified,
    })),
    cost: {
      baseCost: profile.cost?.baseCost || 0,
      currency: profile.cost?.currency || "USD",
      pricingModel: (profile.cost?.pricingModel || "per_request").toUpperCase().replace("-", "_"),
      tokenCost: profile.cost?.tokenCost || null,
    },
    reliability: profile.reliability
      ? {
          uptime: profile.reliability.uptime,
          successRate: profile.reliability.successRate,
          averageLatency: profile.reliability.averageLatency,
          lastVerified: profile.reliability.lastVerified instanceof Date
            ? profile.reliability.lastVerified
            : new Date(profile.reliability.lastVerified),
        }
      : null,
    availability: profile.availability
      ? {
          status: (profile.availability.status || "offline").toUpperCase(),
          maxConcurrentTasks: profile.availability.maxConcurrentTasks || 1,
          currentLoad: profile.availability.currentLoad || 0,
        }
      : null,
    metadata: profile.metadata || null,
  };
}

/**
 * Map AgentIdentity to GraphQL Agent type
 */
function mapAgentToGraphQL(agent: any, a2aProtocol: any): any {
  if (!agent) return null;

  const connections = a2aProtocol.getConnections(agent.agentId);
  const profile = agent.metadata?.profile as any;
  const anp = getANPProtocol();

  return {
    id: agent.agentId,
    name: agent.name,
    version: agent.version,
    capabilities: agent.capabilities,
    endpoint: agent.endpoint,
    publicKey: agent.publicKey || null,
    metadata: agent.metadata || null,
    profile: profile ? mapProfileToGraphQL(profile) : null,
    connections: connections.map((c: any) => ({
      connectionId: c.connectionId,
      agentId: c.agentId,
      peerAgentId: c.peerAgentId,
      status: c.status.toUpperCase(),
      establishedAt: c.establishedAt,
      lastHeartbeat: c.lastHeartbeat || null,
      capabilities: c.capabilities || [],
      metadata: c.metadata || null,
    })),
    health: anp.getAgentHealth(agent.agentId),
    createdAt: new Date(),
  };
}

export const resolvers = {
  Query: {
    // Evidence resolvers
    evidence: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const evidence = await evidenceVault.get(id);
      
      // Enforce tenant scoping
      if (evidence && evidence.tenant_id !== tenantId) {
        return null; // Don't reveal existence of other tenants' evidence
      }

      return evidence;
    },

    evidenceList: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId?: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      // Use tenantId from context, not client-provided
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      // Ignore client-provided tenantId for security
      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const results = await evidenceVault.query({
        tenant_id: tenantId, // Always use context tenantId
        ...filters,
      });

      const totalCount = results.length;
      const edges = results.slice(offset, offset + limit).map((evidence, index) => ({
        node: evidence,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    searchEvidence: async (
      _: any,
      {
        tenantId: clientTenantId,
        query,
        options,
      }: {
        tenantId?: string;
        query: string;
        options?: any;
      },
      context: any
    ) => {
      // Use tenantId from context, not client-provided
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }
      let results = await evidenceVault.search(query, tenantId, {
        limit: options?.limit || 100,
        min_relevance: options?.minRelevance || 0.3,
      });

      // Apply reranking if requested
      if (options?.useReranking) {
        const reranked = await reranker.rerank(
          query,
          results.map((ev) => ({
            id: ev.evidence_id,
            text: `${ev.content.raw || ""} ${ev.content.normalized || ""}`,
            metadata: ev.metadata || {},
          })),
          {
            model: (options?.rerankingModel as any) || "cross-encoder",
            topK: options?.limit || 10,
          }
        );
        // Map reranked results back to evidence
        const rerankedIds = new Set(reranked.map((r) => r.id));
        results = results.filter((ev) => rerankedIds.has(ev.evidence_id));
        // Sort by rerank order
        const orderMap = new Map(reranked.map((r, idx) => [r.id, idx]));
        results.sort((a, b) => (orderMap.get(a.evidence_id) || 0) - (orderMap.get(b.evidence_id) || 0));
      }

      const limit = options?.limit || 10;
      const edges = results.slice(0, limit).map((evidence, index) => ({
        node: evidence,
        cursor: Buffer.from(`${index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: results.length > limit,
          hasPreviousPage: false,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount: results.length,
      };
    },

    // Claim resolvers
    claim: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const claim = await db.claim.findUnique({
        where: { id },
        include: {
          evidenceRefs: {
            include: { evidence: true },
          },
          cluster: true,
        },
      });

      if (!claim) return null;

      // Enforce tenant scoping
      if (claim.tenantId !== tenantId) {
        return null; // Don't reveal existence of other tenants' claims
      }

      return {
        id: claim.id,
        tenantId: claim.tenantId,
        canonicalText: claim.canonicalText,
        variants: claim.variants,
        decisiveness: claim.decisiveness,
        clusterId: claim.clusterId,
        evidence: claim.evidenceRefs.map((ref) => ref.evidence),
        createdAt: claim.createdAt,
      };
    },

    claimList: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId?: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      // Use tenantId from context, not client-provided
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const where: any = { tenantId }; // Always use context tenantId
      if (filters?.clusterId) where.clusterId = filters.clusterId;
      if (filters?.minDecisiveness) where.decisiveness = { gte: filters.minDecisiveness };

      const [results, totalCount] = await Promise.all([
        db.claim.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        db.claim.count({ where }),
      ]);

      const edges = results.map((claim, index) => ({
        node: {
          id: claim.id,
          tenantId: claim.tenantId,
          canonicalText: claim.canonicalText,
          variants: claim.variants,
          decisiveness: claim.decisiveness,
          clusterId: claim.clusterId,
          createdAt: claim.createdAt,
        },
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    claimCluster: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const cluster = await db.claimCluster.findUnique({
        where: { id },
        include: {
          primaryClaim: true,
          claims: true,
        },
      });

      if (!cluster) return null;

      // Enforce tenant scoping
      if (cluster.tenantId !== tenantId) {
        return null;
      }

      return {
        id: cluster.id,
        tenantId: cluster.tenantId,
        primaryClaimId: cluster.primaryClaimId,
        primaryClaim: cluster.primaryClaim,
        claims: cluster.claims,
        size: cluster.size,
        decisiveness: cluster.decisiveness,
        createdAt: cluster.createdAt,
      };
    },

    // Belief Graph resolvers
    beliefNode: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const node = await db.beliefNode.findUnique({
        where: { id },
        include: {
          fromEdges: {
            include: { toNode: true },
          },
          toEdges: {
            include: { fromNode: true },
          },
        },
      });

      if (!node) return null;

      // Enforce tenant scoping
      if (node.tenantId !== tenantId) {
        return null;
      }

      return {
        ...node,
        fromEdges: node.fromEdges.map((edge) => ({
          ...edge,
          // fromEdges are edges where this node is the fromNode
          fromNode: node,
          toNode: edge.toNode,
        })),
        toEdges: node.toEdges.map((edge) => ({
          ...edge,
          fromNode: edge.fromNode,
          // toEdges are edges where this node is the toNode
          toNode: node,
        })),
      };
    },

    beliefGraph: async (
      _: any,
      {
        tenantId: clientTenantId,
        nodeId,
        depth = 2,
      }: {
        tenantId?: string;
        nodeId?: string;
        depth?: number;
      },
      context: any
    ) => {
      // Use tenantId from context, not client-provided
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      // Build graph starting from nodeId or all nodes for tenant
      const where: any = { tenantId }; // Always use context tenantId
      if (nodeId) where.id = nodeId;

      const nodes = await db.beliefNode.findMany({
        where,
        include: {
          fromEdges: {
            include: { toNode: true },
          },
          toEdges: {
            include: { fromNode: true },
          },
        },
        take: depth ? 100 : undefined, // Limit for performance
      });

      const edges = nodes.flatMap((node) => [
        ...node.fromEdges.map((edge) => ({
          ...edge,
          fromNode: node,
          toNode: edge.toNode,
        })),
        ...node.toEdges.map((edge) => ({
          ...edge,
          fromNode: edge.fromNode,
          toNode: node,
        })),
      ]);

      return {
        nodes: nodes.map((node) => ({
          ...node,
          fromEdges: node.fromEdges,
          toEdges: node.toEdges,
        })),
        edges,
        rootNode: nodeId ? nodes.find((n) => n.id === nodeId) || null : null,
      };
    },

    // Forecast resolvers
    forecast: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const forecast = await db.forecast.findUnique({ where: { id } });
      
      // Enforce tenant scoping
      if (forecast && forecast.tenantId !== tenantId) {
        return null;
      }

      return forecast;
    },

    forecasts: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId?: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      // Use tenantId from context, not client-provided
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const where: any = { tenantId }; // Always use context tenantId
      if (filters?.type) where.type = filters.type;
      if (filters?.targetMetric) where.targetMetric = filters.targetMetric;
      if (filters?.minConfidence) where.confidenceLevel = { gte: filters.minConfidence };

      const [results, totalCount] = await Promise.all([
        db.forecast.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        db.forecast.count({ where }),
      ]);

      const edges = results.map((forecast, index) => ({
        node: forecast,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    // Event resolvers
    event: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const event = await db.event.findUnique({
        where: { id },
        include: {
          evidenceRefs: {
            include: { evidence: true },
          },
        },
      });

      if (!event) return null;

      // Enforce tenant scoping
      if (event.tenantId !== tenantId) {
        return null;
      }

      return {
        ...event,
        evidence: event.evidenceRefs.map((ref) => ref.evidence),
      };
    },

    // Artifact resolvers
    artifact: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const artifact = await db.aAALArtifact.findUnique({
        where: { id },
        include: {
          evidenceRefs: {
            include: { evidence: true },
          },
          approvals: true,
        },
      });

      if (!artifact) return null;

      // Enforce tenant scoping
      if (artifact.tenantId !== tenantId) {
        return null;
      }

      return {
        ...artifact,
        evidence: artifact.evidenceRefs.map((ref) => ref.evidence),
        approvals: artifact.approvals,
      };
    },
  },

  Mutation: {
    // Evidence mutations
    createEvidence: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      // Ignore client-provided tenantId, use context
      const evidenceId = await evidenceVault.store({
        tenant_id: tenantId, // Always use context tenantId
        type: input.type.toLowerCase(),
        source: {
          type: input.source.type,
          id: input.source.id,
          url: input.source.url,
          collected_at: new Date().toISOString(),
          collected_by: input.source.collectedBy,
          method: input.source.method.toLowerCase(),
        },
        content: {
          raw: input.content.raw,
          normalized: input.content.normalized,
          metadata: input.content.metadata,
        },
        provenance: {
          collection_method: input.provenance.collectionMethod,
          retention_policy: input.provenance.retentionPolicy,
          compliance_flags: input.provenance.complianceFlags || [],
        },
        metadata: input.metadata,
      });

      return await evidenceVault.get(evidenceId);
    },

    // Claim mutations
    createClaim: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const claim = await db.claim.create({
        data: {
          tenantId: tenantId, // Always use context tenantId
          canonicalText: input.canonicalText,
          variants: input.variants || [],
          decisiveness: 0.5, // Default, will be calculated
        },
      });

      // Link evidence if provided
      if (input.evidenceIds && input.evidenceIds.length > 0) {
        await db.claimEvidence.createMany({
          data: input.evidenceIds.map((evidenceId: string) => ({
            claimId: claim.id,
            evidenceId,
          })),
          skipDuplicates: true,
        });
      }

      return claim;
    },

    // Artifact mutations
    createArtifact: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const artifact = await db.aAALArtifact.create({
        data: {
          tenantId: tenantId,
          title: input.title,
          content: input.content,
          version: input.version || "1.0.0",
          status: "DRAFT",
          requiredApprovals: 0,
        },
      });

      return artifact;
    },

    updateArtifact: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const artifact = await db.aAALArtifact.update({
        where: { id },
        data: {
          title: input.title,
          content: input.content,
          version: input.version,
        },
      });

      if (artifact.tenantId !== tenantId) {
        throw new Error("Unauthorized: artifact belongs to different tenant");
      }

      return artifact;
    },

    publishArtifact: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const artifact = await db.aAALArtifact.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      if (artifact.tenantId !== tenantId) {
        throw new Error("Unauthorized: artifact belongs to different tenant");
      }

      return artifact;
    },

    // Agent Protocol queries
    agent: async (_: any, { id }: { id: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const a2aProtocol = getA2AProtocol();
      const agent = a2aProtocol.getAgent(id);
      
      if (!agent) return null;

      return mapAgentToGraphQL(agent, a2aProtocol);
    },

    agents: async (
      _: any,
      {
        tenantId: clientTenantId,
        capabilities,
        filters,
        pagination,
      }: {
        tenantId?: string;
        capabilities?: string[];
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const a2aProtocol = getA2AProtocol();
      const discoveryRequest: any = {
        requesterAgentId: "system",
        requiredCapabilities: capabilities || [],
        filters: filters
          ? {
              ...filters,
              tags: filters.tags,
              version: filters.version,
              minUptime: filters.minUptime,
              maxCost: filters.maxCost,
              minReliability: filters.minReliability,
              requiredSkills: filters.requiredSkills,
              availableOnly: filters.availableOnly,
            }
          : undefined,
        maxResults: pagination?.limit || 50,
        sortBy: filters?.sortBy,
      };

      const result = await a2aProtocol.discoverAgents(discoveryRequest);
      const limit = pagination?.limit || 50;
      const offset = pagination?.offset || 0;
      const totalCount = result.totalFound;
      const agents = result.agents.slice(offset, offset + limit);

      const edges = agents.map((agent: any, index: number) => ({
        node: mapAgentToGraphQL(agent, a2aProtocol),
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    hireAgent: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const a2aProtocol = getA2AProtocol();
      const hiredAgent = await a2aProtocol.hireAgent({
        taskType: input.taskType,
        requiredCapabilities: input.requiredCapabilities,
        budget: input.budget,
        maxLatency: input.maxLatency,
        requiredSkills: input.requiredSkills,
      });

      if (!hiredAgent) {
        return null;
      }

      return mapAgentToGraphQL(hiredAgent, a2aProtocol);
    },

    // Agent Protocol mutations
    registerAgent: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const a2aProtocol = getA2AProtocol();
      await a2aProtocol.registerAgent({
        agentId: input.agentId,
        name: input.name,
        version: input.version,
        capabilities: input.capabilities,
        endpoint: input.endpoint,
        publicKey: input.publicKey,
        metadata: input.metadata,
      });

      const agent = a2aProtocol.getAgent(input.agentId);
      if (!agent) throw new Error("Failed to register agent");

      const profile = agent.metadata?.profile as any;

      return {
        id: agent.agentId,
        name: agent.name,
        version: agent.version,
        capabilities: agent.capabilities,
        endpoint: agent.endpoint,
        publicKey: agent.publicKey,
        metadata: agent.metadata,
        profile: profile ? mapProfileToGraphQL(profile) : null,
        connections: [],
        health: null,
        createdAt: new Date(),
      };
    },

    registerAgentWithProfile: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const a2aProtocol = getA2AProtocol();
      const profile = {
        agentId: input.agentId,
        name: input.name,
        version: input.version,
        description: input.description,
        capabilities: input.capabilities,
        skills: input.skills,
        cost: {
          baseCost: input.cost.baseCost,
          currency: input.cost.currency,
          pricingModel: input.cost.pricingModel.toLowerCase(),
          tokenCost: input.cost.tokenCost,
        },
        reliability: {
          uptime: input.reliability.uptime,
          successRate: input.reliability.successRate,
          averageLatency: input.reliability.averageLatency,
          lastVerified: new Date(input.reliability.lastVerified),
        },
        availability: {
          status: input.availability.status.toLowerCase(),
          maxConcurrentTasks: input.availability.maxConcurrentTasks,
          currentLoad: input.availability.currentLoad,
        },
        metadata: input.metadata,
      };

      await a2aProtocol.registerAgentWithProfile(profile, input.endpoint, input.publicKey);

      const agent = a2aProtocol.getAgent(input.agentId);
      if (!agent) throw new Error("Failed to register agent");

      return {
        id: agent.agentId,
        name: agent.name,
        version: agent.version,
        capabilities: agent.capabilities,
        endpoint: agent.endpoint,
        publicKey: agent.publicKey,
        metadata: agent.metadata,
        profile: mapProfileToGraphQL(profile),
        connections: [],
        health: null,
        createdAt: new Date(),
      };
    },

    unregisterAgent: async (_: any, { agentId }: { agentId: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const a2aProtocol = getA2AProtocol();
      await a2aProtocol.unregisterAgent(agentId);
      return true;
    },

    // POS (Perception Operating System) mutations
    createConsensusSignal: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { ConsensusHijackingService } = await import("@/lib/pos/consensus-hijacking");
      const service = new ConsensusHijackingService();
      const signalId = await service.createConsensusSignal({
        tenantId,
        ...input,
        publishedAt: new Date(input.publishedAt),
      });

      return await db.consensusSignal.findUnique({ where: { id: signalId } });
    },

    registerExternalValidator: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { TrustSubstitutionMechanism } = await import("@/lib/pos/trust-substitution");
      const service = new TrustSubstitutionMechanism();
      const validatorId = await service.registerValidator({
        tenantId,
        ...input,
      });

      return await db.externalValidator.findUnique({ where: { id: validatorId } });
    },

    createAudit: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { TrustSubstitutionMechanism } = await import("@/lib/pos/trust-substitution");
      const service = new TrustSubstitutionMechanism();
      const auditId = await service.createAudit({
        tenantId,
        ...input,
      });

      return await db.audit.findUnique({ where: { id: auditId } });
    },

    completeAudit: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { TrustSubstitutionMechanism } = await import("@/lib/pos/trust-substitution");
      const service = new TrustSubstitutionMechanism();
      await service.completeAudit(
        input.auditId,
        input.findings,
        input.recommendations,
        input.publicUrl
      );

      return await db.audit.findUnique({ where: { id: input.auditId } });
    },

    createSLA: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { TrustSubstitutionMechanism } = await import("@/lib/pos/trust-substitution");
      const service = new TrustSubstitutionMechanism();
      const slaId = await service.createSLA({
        tenantId,
        ...input,
      });

      return await db.sLA.findUnique({ where: { id: slaId } });
    },

    updateSLAMetric: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { TrustSubstitutionMechanism } = await import("@/lib/pos/trust-substitution");
      const service = new TrustSubstitutionMechanism();
      await service.updateSLAMetric(input.slaId, input.actual);

      return await db.sLA.findUnique({ where: { id: input.slaId } });
    },

    publishSLA: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { TrustSubstitutionMechanism } = await import("@/lib/pos/trust-substitution");
      const service = new TrustSubstitutionMechanism();
      await service.publishSLA(input.slaId, input.publicUrl);

      return await db.sLA.findUnique({ where: { id: input.slaId } });
    },

    createRebuttalDocument: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { AIAnswerAuthorityLayer } = await import("@/lib/pos/ai-answer-authority");
      const service = new AIAnswerAuthorityLayer();
      const documentId = await service.createRebuttalDocument({
        tenantId,
        ...input,
      });

      return await db.rebuttalDocument.findUnique({ where: { id: documentId } });
    },

    publishRebuttal: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { AIAnswerAuthorityLayer } = await import("@/lib/pos/ai-answer-authority");
      const service = new AIAnswerAuthorityLayer();
      await service.publishRebuttal(input.documentId, input.publicUrl);

      return await db.rebuttalDocument.findUnique({ where: { id: input.documentId } });
    },

    createIncidentExplanation: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { AIAnswerAuthorityLayer } = await import("@/lib/pos/ai-answer-authority");
      const service = new AIAnswerAuthorityLayer();
      const explanationId = await service.createIncidentExplanation({
        tenantId,
        ...input,
      });

      return await db.incidentExplanation.findUnique({ where: { id: explanationId } });
    },

    publishIncidentExplanation: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { AIAnswerAuthorityLayer } = await import("@/lib/pos/ai-answer-authority");
      const service = new AIAnswerAuthorityLayer();
      await service.publishIncidentExplanation(input.explanationId, input.publicUrl);

      return await db.incidentExplanation.findUnique({ where: { id: input.explanationId } });
    },

    createMetricsDashboard: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { AIAnswerAuthorityLayer } = await import("@/lib/pos/ai-answer-authority");
      const service = new AIAnswerAuthorityLayer();
      const dashboardId = await service.createMetricsDashboard({
        tenantId,
        ...input,
      });

      return await db.metricsDashboard.findUnique({ where: { id: dashboardId } });
    },

    publishMetricsDashboard: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { AIAnswerAuthorityLayer } = await import("@/lib/pos/ai-answer-authority");
      const service = new AIAnswerAuthorityLayer();
      await service.publishMetricsDashboard(input.dashboardId, input.publicUrl);

      return await db.metricsDashboard.findUnique({ where: { id: input.dashboardId } });
    },

    createPredictedComplaint: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const prediction = await db.predictedComplaint.create({
        data: {
          tenantId,
          predictedTopic: input.predictedTopic,
          predictedContent: input.predictedContent,
          probability: input.probability,
          confidence: input.confidence,
          horizonDays: input.horizonDays,
          triggers: input.triggers as any,
          evidenceRefs: input.evidenceRefs || [],
          status: "ACTIVE",
        },
      });

      return prediction;
    },

    generatePreemptiveAction: async (_: any, { predictionId }: { predictionId: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { NarrativePreemptionEngine } = await import("@/lib/pos/narrative-preemption");
      const service = new NarrativePreemptionEngine();
      return await service.generatePreemptiveAction(predictionId);
    },

    createDecisionCheckpoint: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { DecisionFunnelDomination } = await import("@/lib/pos/decision-funnel-domination");
      const service = new DecisionFunnelDomination();
      const checkpointId = await service.createCheckpoint({
        tenantId,
        ...input,
      });

      return await db.decisionCheckpoint.findUnique({ where: { id: checkpointId } });
    },

    setupCompleteFunnel: async (_: any, { tenantId: clientTenantId }: { tenantId: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { DecisionFunnelDomination } = await import("@/lib/pos/decision-funnel-domination");
      const service = new DecisionFunnelDomination();
      const checkpointIds = await service.setupCompleteFunnel(tenantId);

      return await db.decisionCheckpoint.findMany({
        where: { id: { in: checkpointIds } },
      });
    },

    executePOSCycle: async (_: any, { tenantId: clientTenantId }: { tenantId: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { POSOrchestrator } = await import("@/lib/pos/orchestrator");
      const orchestrator = new POSOrchestrator();
      return await orchestrator.executePOSCycle(tenantId);
    },

    createAgentNetwork: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const anpProtocol = getANPProtocol();
      await anpProtocol.createNetwork({
        networkId: input.networkId,
        name: input.name,
        description: input.description,
        agents: input.agents,
        topology: input.topology.toLowerCase(),
        metadata: input.metadata,
      });

      const network = anpProtocol.getNetwork(input.networkId);
      if (!network) throw new Error("Failed to create network");

      return {
        networkId: network.networkId,
        name: network.name,
        description: network.description,
        agents: [],
        topology: network.topology.toUpperCase(),
        metadata: network.metadata,
        health: null,
        createdAt: new Date(),
      };
    },

    joinNetwork: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const anpProtocol = getANPProtocol();
      const result = await anpProtocol.joinNetwork({
        agentId: input.agentId,
        networkId: input.networkId,
        credentials: input.credentials,
      });

      return {
        success: result.success,
        network: result.network
          ? {
              networkId: result.network.networkId,
              name: result.network.name,
              description: result.network.description,
              agents: [],
              topology: result.network.topology.toUpperCase(),
              metadata: result.network.metadata,
              health: null,
              createdAt: new Date(),
            }
          : null,
        assignedRole: result.assignedRole,
        error: result.error,
      };
    },

    leaveNetwork: async (
      _: any,
      { agentId, networkId }: { agentId: string; networkId: string },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const anpProtocol = getANPProtocol();
      await anpProtocol.leaveNetwork(agentId, networkId);
      return true;
    },

    sendAgentMessage: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const a2aProtocol = getA2AProtocol();
      await a2aProtocol.sendMessage({
        messageId: crypto.randomUUID(),
        fromAgentId: input.fromAgentId,
        toAgentId: input.toAgentId,
        type: input.type.toLowerCase(),
        payload: input.payload,
        timestamp: new Date(),
        correlationId: input.correlationId,
        metadata: input.metadata,
      });

      return true;
    },

    routeMessage: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const anpProtocol = getANPProtocol();
      const result = await anpProtocol.routeMessage(
        input.networkId,
        input.fromAgentId,
        input.toAgentId,
        {
          preferLowLatency: input.preferLowLatency,
          preferHighReliability: input.preferHighReliability,
          maxHops: input.maxHops,
        }
      );

      return {
        path: result.path,
        hops: result.hops,
        estimatedLatency: result.estimatedLatency,
        reliability: result.reliability,
      };
    },

    selectAgent: async (_: any, { input }: { input: any }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const anpProtocol = getANPProtocol();
      const agentId = await anpProtocol.selectAgent(input.networkId, {
        requiredCapabilities: input.requiredCapabilities,
        preferLowLatency: input.preferLowLatency,
        preferHighReliability: input.preferHighReliability,
        excludeAgentIds: input.excludeAgentIds,
      });

      if (!agentId) return null;

      const a2aProtocol = getA2AProtocol();
      const agent = a2aProtocol.getAgent(agentId);
      if (!agent) return null;

      return {
        id: agent.agentId,
        name: agent.name,
        version: agent.version,
        capabilities: agent.capabilities,
        endpoint: agent.endpoint,
        publicKey: agent.publicKey,
        metadata: agent.metadata,
        connections: [],
        health: null,
        createdAt: new Date(),
      };
    },

    // AP2 Payment Protocol queries
    paymentMandate: async (_: any, { mandateId }: { mandateId: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const ap2Protocol = getAP2Protocol();
      const mandate = await ap2Protocol.getMandate(mandateId);
      if (!mandate) return null;

      return {
        mandateId: mandate.mandateId,
        fromAgentId: mandate.fromAgentId,
        toAgentId: mandate.toAgentId,
        type: mandate.type.toUpperCase(),
        amount: mandate.amount,
        currency: mandate.currency,
        description: mandate.description,
        metadata: mandate.metadata,
        expiresAt: mandate.expiresAt,
        status: mandate.status.toUpperCase(),
        createdAt: mandate.createdAt,
        updatedAt: mandate.updatedAt,
      };
    },

    paymentMandates: async (
      _: any,
      { filters, limit }: { filters?: { fromAgentId?: string; toAgentId?: string; status?: string }; limit?: number },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const ap2Protocol = getAP2Protocol();
      const mandates = await ap2Protocol.listMandates({
        fromAgentId: filters?.fromAgentId,
        toAgentId: filters?.toAgentId,
        status: filters?.status?.toLowerCase() as any,
        limit: limit || 100,
      });

      return mandates.map((mandate) => ({
        mandateId: mandate.mandateId,
        fromAgentId: mandate.fromAgentId,
        toAgentId: mandate.toAgentId,
        type: mandate.type.toUpperCase(),
        amount: mandate.amount,
        currency: mandate.currency,
        description: mandate.description,
        metadata: mandate.metadata,
        expiresAt: mandate.expiresAt,
        status: mandate.status.toUpperCase(),
        createdAt: mandate.createdAt,
        updatedAt: mandate.updatedAt,
      }));
    },

    walletBalance: async (
      _: any,
      { walletId, currency }: { walletId: string; currency?: string },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const ap2Protocol = getAP2Protocol();
      const balance = await ap2Protocol.getWalletBalance(walletId, currency || "USD");
      const ledger = ap2Protocol.getWalletLedger(walletId, currency || "USD");
      const availableBalance = balance;

      // Extract agentId from walletId (format: wallet_agentId)
      const agentId = walletId.replace("wallet_", "");

      return {
        walletId,
        agentId,
        currency: currency || "USD",
        balance,
        availableBalance,
      };
    },

    walletLedger: async (
      _: any,
      {
        walletId,
        currency,
        limit,
      }: { walletId: string; currency?: string; limit?: number },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const ap2Protocol = getAP2Protocol();
      const entries = await ap2Protocol.getWalletLedger(walletId, currency);
      const limitedEntries = limit ? entries.slice(0, limit) : entries;

      const edges = limitedEntries.map((entry, index) => ({
        node: {
          entryId: entry.entryId,
          walletId: entry.walletId,
          agentId: entry.agentId,
          type: entry.type.toUpperCase(),
          amount: entry.amount,
          currency: entry.currency,
          mandateId: entry.mandateId,
          transactionId: entry.transactionId,
          description: entry.description,
          balance: entry.balance,
          timestamp: entry.timestamp,
        },
        cursor: Buffer.from(`${index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount: limitedEntries.length,
      };
    },

    paymentAuditLogs: async (
      _: any,
      {
        filters,
        pagination,
      }: {
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const ap2Protocol = getAP2Protocol();
      const logs = await ap2Protocol.getAuditLogs({
        mandateId: filters?.mandateId,
        transactionId: filters?.transactionId,
        agentId: filters?.fromAgentId || filters?.toAgentId, // Use agentId filter
        action: filters?.action,
        startTime: filters?.startTime,
        endTime: filters?.endTime,
      });

      const limit = pagination?.limit || 100;
      const offset = pagination?.offset || 0;
      const totalCount = logs.length;
      const paginatedLogs = logs.slice(offset, offset + limit);

      const edges = paginatedLogs.map((log, index) => ({
        node: {
          auditId: log.auditId,
          mandateId: log.mandateId,
          transactionId: log.transactionId,
          action: log.action,
          fromAgentId: log.fromAgentId,
          toAgentId: log.toAgentId,
          amount: log.amount,
          currency: log.currency,
          status: log.status.toUpperCase(),
          error: log.error,
          metadata: log.metadata,
          timestamp: log.timestamp,
        },
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    // POS (Perception Operating System) queries
    posMetrics: async (_: any, { tenantId: clientTenantId }: { tenantId: string }, context: any) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const { POSOrchestrator } = await import("@/lib/pos/orchestrator");
      const orchestrator = new POSOrchestrator();
      return await orchestrator.getMetrics(tenantId);
    },

    consensusSignals: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId };
      if (filters?.type) where.type = filters.type;
      if (filters?.minTrustScore) where.trustScore = { gte: filters.minTrustScore };
      if (filters?.minRelevanceScore) where.relevanceScore = { gte: filters.minRelevanceScore };
      if (filters?.publishedAfter) where.publishedAt = { gte: new Date(filters.publishedAfter) };

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [signals, totalCount] = await Promise.all([
        db.consensusSignal.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { publishedAt: "desc" },
        }),
        db.consensusSignal.count({ where }),
      ]);

      const edges = signals.map((signal, index) => ({
        node: signal,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    externalValidators: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId };
      if (filters?.type) where.type = filters.type;
      if (filters?.isActive !== undefined) where.isActive = filters.isActive;
      if (filters?.minTrustLevel) where.trustLevel = { gte: filters.minTrustLevel };

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [validators, totalCount] = await Promise.all([
        db.externalValidator.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { trustLevel: "desc" },
        }),
        db.externalValidator.count({ where }),
      ]);

      const edges = validators.map((validator, index) => ({
        node: validator,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    audits: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId };
      if (filters?.type) where.type = filters.type;
      if (filters?.status) where.status = filters.status;
      if (filters?.publishedAfter) where.publishedAt = { gte: new Date(filters.publishedAfter) };

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [audits, totalCount] = await Promise.all([
        db.audit.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
        }),
        db.audit.count({ where }),
      ]);

      const edges = audits.map((audit, index) => ({
        node: audit,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    slas: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId };
      if (filters?.isPublic !== undefined) where.isPublic = filters.isPublic;
      if (filters?.metric) where.metric = filters.metric;
      if (filters?.period) where.period = filters.period;

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [slas, totalCount] = await Promise.all([
        db.sLA.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { lastUpdated: "desc" },
        }),
        db.sLA.count({ where }),
      ]);

      const edges = slas.map((sla, index) => ({
        node: sla,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    rebuttalDocuments: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId };
      if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished;
      if (filters?.targetClaimId) where.targetClaimId = filters.targetClaimId;
      if (filters?.targetNodeId) where.targetNodeId = filters.targetNodeId;

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [documents, totalCount] = await Promise.all([
        db.rebuttalDocument.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
        }),
        db.rebuttalDocument.count({ where }),
      ]);

      const edges = documents.map((doc, index) => ({
        node: doc,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    incidentExplanations: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId };
      if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished;
      if (filters?.incidentId) where.incidentId = filters.incidentId;

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [explanations, totalCount] = await Promise.all([
        db.incidentExplanation.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
        }),
        db.incidentExplanation.count({ where }),
      ]);

      const edges = explanations.map((explanation, index) => ({
        node: explanation,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    predictedComplaints: async (
      _: any,
      {
        tenantId: clientTenantId,
        filters,
        pagination,
      }: {
        tenantId: string;
        filters?: any;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId };
      if (filters?.status) where.status = filters.status;
      if (filters?.minProbability) where.probability = { gte: filters.minProbability };
      if (filters?.horizonDays) where.horizonDays = filters.horizonDays;

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [predictions, totalCount] = await Promise.all([
        db.predictedComplaint.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { probability: "desc" },
        }),
        db.predictedComplaint.count({ where }),
      ]);

      const edges = predictions.map((prediction, index) => ({
        node: prediction,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    decisionCheckpoints: async (
      _: any,
      {
        tenantId: clientTenantId,
        stage,
        pagination,
      }: {
        tenantId: string;
        stage?: string;
        pagination?: { limit?: number; offset?: number };
      },
      context: any
    ) => {
      const tenantId = context.tenantId;
      if (!tenantId) {
        throw new Error("Unauthorized: tenant context required");
      }

      const where: any = { tenantId, isActive: true };
      if (stage) where.stage = stage;

      const limit = pagination?.limit || 10;
      const offset = pagination?.offset || 0;

      const [checkpoints, totalCount] = await Promise.all([
        db.decisionCheckpoint.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
        }),
        db.decisionCheckpoint.count({ where }),
      ]);

      const edges = checkpoints.map((checkpoint, index) => ({
        node: checkpoint,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },
  },

  // Field resolvers (with N+1 prevention)
  Evidence: {
    claims: async (parent: Evidence, _: any, context: any) => {
      // Batch load claims for evidence (N+1 prevention)
      const dataLoader = getDataLoader(context);
      
      // Get claim IDs for this evidence
      const claimEvidence = await db.claimEvidence.findMany({
        where: { evidenceId: parent.evidence_id },
        select: { claimId: true },
      });

      if (claimEvidence.length === 0) {
        return [];
      }

      const claimIds = claimEvidence.map((ce) => ce.claimId);
      const claims = await dataLoader.loadClaims(claimIds);

      return claims.filter((c) => c !== null);
    },
  },

  Claim: {
    evidence: async (parent: any, _: any, context: any) => {
      // Batch load evidence for claims (N+1 prevention)
      const dataLoader = getDataLoader(context);
      
      // This would be called for multiple claims, so batch load
      const evidenceMap = await dataLoader.loadEvidenceForClaims([parent.id]);
      const evidenceList = evidenceMap.get(parent.id) || [];

      return evidenceList.map((ev) => ({
        evidence_id: ev.id,
        tenant_id: ev.tenantId,
        type: ev.type.toLowerCase(),
        source: {
          type: ev.sourceType,
          id: ev.sourceId,
          url: ev.sourceUrl,
          collected_at: ev.collectedAt.toISOString(),
          collected_by: ev.collectedBy,
          method: ev.method.toLowerCase(),
        },
        content: {
          raw: ev.contentRaw,
          normalized: ev.contentNormalized,
          metadata: ev.contentMetadata,
        },
        provenance: {
          collection_method: ev.collectionMethod,
          retention_policy: ev.retentionPolicy,
          compliance_flags: ev.complianceFlags,
        },
        created_at: ev.createdAt.toISOString(),
        updated_at: ev.updatedAt.toISOString(),
      }));
    },
    cluster: async (parent: any) => {
      if (!parent.clusterId) return null;
      return await db.claimCluster.findUnique({
        where: { id: parent.clusterId },
        include: {
          primaryClaim: true,
          claims: true,
        },
      });
    },
  },
};
