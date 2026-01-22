/**
 * Apollo Federation Setup
 * 
 * Enables federated GraphQL architecture for microservices.
 * Supports schema composition and distributed query execution.
 */

import { buildSubgraphSchema } from "@apollo/subgraph";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { logger } from "@/lib/logging/logger";
import { parse } from "graphql";

/**
 * Build federated subgraph schema with entity resolution
 */
export function buildFederatedSchema() {
  try {
    const parsedTypeDefs = typeof typeDefs === "string" ? parse(typeDefs) : (typeDefs as any);
    return buildSubgraphSchema({
      typeDefs: parsedTypeDefs,
      resolvers: {
        ...resolvers,
        ...entityResolvers,
      } as any,
    });
  } catch (error) {
    // Fallback to standard schema if federation fails
    logger.warn("Federation schema build failed, using standard schema", { error });
    const { makeExecutableSchema } = require("@graphql-tools/schema");
    return makeExecutableSchema({
      typeDefs: typeof typeDefs === "string" ? parse(typeDefs) : typeDefs,
      resolvers,
    });
  }
}

/**
 * Federation directives for entity resolution
 */
export const federationDirectives = `
  directive @key(fields: String!) on OBJECT | INTERFACE
  directive @requires(fields: String!) on FIELD_DEFINITION
  directive @provides(fields: String!) on FIELD_DEFINITION
  directive @external on FIELD_DEFINITION
  directive @extends on OBJECT | INTERFACE
`;

/**
 * Federation configuration
 */
export const federationConfig = {
  subgraph: {
    name: "holdwall-pos",
    version: "1.0.0",
  },
  gateway: {
    url: process.env.GRAPHQL_GATEWAY_URL || "http://localhost:4000",
    healthCheckInterval: 30000,
  },
};

/**
 * Entity resolvers for federation
 */
export const entityResolvers = {
  Evidence: {
    __resolveReference: async (reference: { id: string; tenantId?: string }) => {
      const { DatabaseEvidenceVault } = await import("../evidence/vault-db");
      const vault = new DatabaseEvidenceVault();
      return await vault.get(reference.id);
    },
  },
  Claim: {
    __resolveReference: async (reference: { id: string; tenantId?: string }) => {
      const { db } = await import("../db/client");
      return await db.claim.findUnique({ where: { id: reference.id } });
    },
  },
  BeliefNode: {
    __resolveReference: async (reference: { id: string; tenantId?: string }) => {
      const { db } = await import("../db/client");
      return await db.beliefNode.findUnique({ where: { id: reference.id } });
    },
  },
  Artifact: {
    __resolveReference: async (reference: { id: string; tenantId?: string }) => {
      const { db } = await import("../db/client");
      return await db.aAALArtifact.findUnique({ where: { id: reference.id } });
    },
  },
  Agent: {
    __resolveReference: async (reference: { id: string }) => {
      const { getA2AProtocol } = await import("../a2a/protocol");
      const { getANPProtocol } = await import("../anp/protocol");
      const a2aProtocol = getA2AProtocol();
      const anpProtocol = getANPProtocol();
      const agent = await a2aProtocol.getAgent(reference.id);
      if (!agent) return null;
      
      // Map to GraphQL Agent type (inline implementation)
      const connections = a2aProtocol.getConnections(agent.agentId);
      const profile = agent.metadata?.profile as any;
      
      return {
        id: agent.agentId,
        name: agent.name,
        version: agent.version,
        capabilities: agent.capabilities,
        endpoint: agent.endpoint,
        publicKey: agent.publicKey || null,
        metadata: agent.metadata || null,
        profile: profile ? {
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
          reliability: profile.reliability ? {
            uptime: profile.reliability.uptime,
            successRate: profile.reliability.successRate,
            averageLatency: profile.reliability.averageLatency,
            lastVerified: profile.reliability.lastVerified instanceof Date
              ? profile.reliability.lastVerified
              : new Date(profile.reliability.lastVerified),
          } : null,
          availability: profile.availability ? {
            status: (profile.availability.status || "offline").toUpperCase(),
            maxConcurrentTasks: profile.availability.maxConcurrentTasks || 1,
            currentLoad: profile.availability.currentLoad || 0,
          } : null,
          metadata: profile.metadata || null,
        } : null,
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
        health: anpProtocol.getAgentHealth(agent.agentId),
        createdAt: new Date(),
      };
    },
  },
};
