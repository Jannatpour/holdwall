"use strict";
/**
 * Model Registry (AI Governance)
 * Track AI model versions, policies, and usage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelRegistry = exports.ModelRegistry = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
class ModelRegistry {
    /**
     * Register a new model
     */
    async register(tenantId, name, provider, options) {
        // Run policy checks
        const policyChecks = await this.runPolicyChecks(name, provider, tenantId);
        // Create model
        const model = await client_1.db.aIModel.create({
            data: {
                tenantId,
                name,
                provider,
                version: options?.version,
                status: "ACTIVE",
                capabilities: options?.capabilities || [],
                rateLimit: options?.rateLimit,
                costPerToken: options?.costPerToken,
                policyChecks: policyChecks,
                approved: false,
            },
        });
        logger_1.logger.info("Model registered", {
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
    async get(tenantId, name, version) {
        const where = {
            tenantId,
            name,
            status: {
                not: "BLOCKED",
            },
        };
        if (version) {
            where.version = version;
        }
        const model = await client_1.db.aIModel.findFirst({
            where,
            orderBy: version ? undefined : { createdAt: "desc" },
        });
        if (!model) {
            return null;
        }
        // Update usage stats
        await client_1.db.aIModel.update({
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
    async list(tenantId, options) {
        const where = {
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
        const models = await client_1.db.aIModel.findMany({
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
    async approve(modelId, approvedBy) {
        await client_1.db.aIModel.update({
            where: { id: modelId },
            data: {
                approved: true,
                approvedBy,
                approvedAt: new Date(),
            },
        });
        logger_1.logger.info("Model approved", {
            modelId,
            approvedBy,
        });
    }
    /**
     * Deprecate a model
     */
    async deprecate(modelId) {
        await client_1.db.aIModel.update({
            where: { id: modelId },
            data: {
                status: "DEPRECATED",
                deprecated: true,
                deprecatedAt: new Date(),
            },
        });
        logger_1.logger.info("Model deprecated", {
            modelId,
        });
    }
    /**
     * Block a model
     */
    async block(modelId) {
        await client_1.db.aIModel.update({
            where: { id: modelId },
            data: {
                status: "BLOCKED",
                updatedAt: new Date(),
            },
        });
        logger_1.logger.info("Model blocked", {
            modelId,
        });
    }
    /**
     * Run policy checks on model
     */
    async runPolicyChecks(name, provider, tenantId) {
        const checks = {
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
        }
        else {
            checks.providerAllowed = true;
        }
        return checks;
    }
    /**
     * Map database model to ModelVersion
     */
    mapToModelVersion(model) {
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
exports.ModelRegistry = ModelRegistry;
exports.modelRegistry = new ModelRegistry();
