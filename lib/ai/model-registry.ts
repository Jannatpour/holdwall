/**
 * Model Registry (AI Governance)
 * Track AI model versions, policies, and usage
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export interface ModelVersion {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  version?: string;
  status: "ACTIVE" | "DEPRECATED" | "BLOCKED";
  capabilities: string[];
  rateLimit?: Record<string, unknown>;
  costPerToken?: Record<string, unknown>;
  policyChecks?: Record<string, unknown>;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  deprecated: boolean;
  deprecatedAt?: Date;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ModelRegistry {
  /**
   * Register a new model
   */
  async register(
    tenantId: string,
    name: string,
    provider: string,
    options?: {
      version?: string;
      capabilities?: string[];
      rateLimit?: Record<string, unknown>;
      costPerToken?: Record<string, unknown>;
    }
  ): Promise<string> {
    // Run policy checks
    const policyChecks = await this.runPolicyChecks(name, provider, tenantId);

    // Create model
    const model = await db.aIModel.create({
      data: {
        tenantId,
        name,
        provider,
        version: options?.version,
        status: "ACTIVE",
        capabilities: options?.capabilities || [],
        rateLimit: options?.rateLimit as any,
        costPerToken: options?.costPerToken as any,
        policyChecks: policyChecks as any,
        approved: false,
      },
    });

    logger.info("Model registered", {
      tenantId,
      name,
      provider,
      version: options?.version,
    });

    return model.id;
  }

  /**
   * Get a model
   */
  async get(
    tenantId: string,
    name: string,
    version?: string
  ): Promise<ModelVersion | null> {
    const where: any = {
      tenantId,
      name,
      status: {
        not: "BLOCKED",
      },
    };

    if (version) {
      where.version = version;
    }

    const model = await db.aIModel.findFirst({
      where,
      orderBy: version ? undefined : { createdAt: "desc" },
    });

    if (!model) {
      return null;
    }

    // Update usage stats
    await db.aIModel.update({
      where: { id: model.id },
      data: {
        usageCount: {
          increment: 1,
        },
        lastUsed: new Date(),
      },
    });

    return this.mapToModelVersion(model);
  }

  /**
   * List models for a tenant
   */
  async list(
    tenantId: string,
    options?: {
      provider?: string;
      status?: "ACTIVE" | "DEPRECATED" | "BLOCKED";
      approved?: boolean;
    }
  ): Promise<ModelVersion[]> {
    const where: any = {
      tenantId,
    };

    if (options?.provider) {
      where.provider = options.provider;
    }
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.approved !== undefined) {
      where.approved = options.approved;
    }

    const models = await db.aIModel.findMany({
      where,
      orderBy: [
        { name: "asc" },
        { createdAt: "desc" },
      ],
    });

    return models.map((m) => this.mapToModelVersion(m));
  }

  /**
   * Approve a model
   */
  async approve(modelId: string, approvedBy: string): Promise<void> {
    await db.aIModel.update({
      where: { id: modelId },
      data: {
        approved: true,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    logger.info("Model approved", {
      modelId,
      approvedBy,
    });
  }

  /**
   * Deprecate a model
   */
  async deprecate(modelId: string): Promise<void> {
    await db.aIModel.update({
      where: { id: modelId },
      data: {
        status: "DEPRECATED",
        deprecated: true,
        deprecatedAt: new Date(),
      },
    });

    logger.info("Model deprecated", {
      modelId,
    });
  }

  /**
   * Block a model
   */
  async block(modelId: string): Promise<void> {
    await db.aIModel.update({
      where: { id: modelId },
      data: {
        status: "BLOCKED",
        updatedAt: new Date(),
      },
    });

    logger.info("Model blocked", {
      modelId,
    });
  }

  /**
   * Run policy checks on model
   */
  private async runPolicyChecks(
    name: string,
    provider: string,
    tenantId: string
  ): Promise<Record<string, unknown>> {
    const checks: Record<string, unknown> = {
      provider,
      timestamp: new Date().toISOString(),
    };

    // Check for known problematic models
    const blockedModels = [
      "gpt-3.5-turbo-0301", // Old version with known issues
    ];
    checks.isBlocked = blockedModels.includes(name);

    // Check provider compliance
    const allowedProviders = process.env.ALLOWED_AI_PROVIDERS?.split(",") || [];
    if (allowedProviders.length > 0) {
      checks.providerAllowed = allowedProviders.includes(provider);
    } else {
      checks.providerAllowed = true;
    }

    return checks;
  }

  /**
   * Map database model to ModelVersion
   */
  private mapToModelVersion(model: any): ModelVersion {
    return {
      id: model.id,
      tenantId: model.tenantId,
      name: model.name,
      provider: model.provider,
      version: model.version || undefined,
      status: model.status,
      capabilities: model.capabilities || [],
      rateLimit: model.rateLimit || undefined,
      costPerToken: model.costPerToken || undefined,
      policyChecks: model.policyChecks || undefined,
      approved: model.approved,
      approvedBy: model.approvedBy || undefined,
      approvedAt: model.approvedAt || undefined,
      deprecated: model.deprecated,
      deprecatedAt: model.deprecatedAt || undefined,
      usageCount: model.usageCount,
      lastUsed: model.lastUsed || undefined,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}

export const modelRegistry = new ModelRegistry();
