/**
 * Business Rules Engine
 * 
 * Enforces real-world business logic and validation rules across the platform.
 * Ensures data integrity, business constraints, and operational requirements.
 */

import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import { db } from "@/lib/db/client";

/**
 * Signal Validation Rules
 */
export const SignalValidationRules = {
  /**
   * Validate signal content meets minimum requirements
   */
  validateContent: (content: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push("Content cannot be empty");
    }

    if (content.length < 3) {
      errors.push("Content must be at least 3 characters");
    }

    if (content.length > 1_000_000) {
      errors.push("Content exceeds maximum length of 1MB");
    }

    // Check for suspicious patterns (potential injection attempts)
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        errors.push("Content contains potentially malicious patterns");
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate signal source is allowed and active
   */
  validateSource: async (
    tenantId: string,
    sourceType: string,
    sourceId: string
  ): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];

    try {
      // Check if source policy exists (sources are configured via SourcePolicy)
      const sourcePolicy = await db.sourcePolicy.findFirst({
        where: {
          tenantId,
          sourceType,
        },
      });

      if (!sourcePolicy) {
        errors.push(`Source policy for ${sourceType} not found`);
      } else {
        // Check if source is in allowed sources list
        if (sourcePolicy.allowedSources.length > 0 && !sourcePolicy.allowedSources.includes(sourceId)) {
          errors.push(`Source ${sourceType}:${sourceId} is not in allowed sources list`);
        }

        // Check recent evidence from this source to determine health
        const recentEvidence = await db.evidence.findFirst({
          where: {
            tenantId,
            sourceType,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!recentEvidence) {
          // No recent evidence - could indicate source is unhealthy
          // But don't fail validation, just log a warning
          logger.warn("No recent evidence from source", {
            tenantId,
            sourceType,
            sourceId,
          });
        }
      }
    } catch (error) {
      logger.error("Error validating source", {
        tenantId,
        sourceType,
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push("Failed to validate source");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate signal metadata
   */
  validateMetadata: (metadata: Record<string, unknown>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate timestamp if present
    if (metadata.timestamp) {
      const timestamp = new Date(metadata.timestamp as string);
      if (isNaN(timestamp.getTime())) {
        errors.push("Invalid timestamp format");
      } else {
        // Timestamp should not be too far in the future (max 1 hour)
        const now = Date.now();
        const maxFuture = now + 3600 * 1000;
        if (timestamp.getTime() > maxFuture) {
          errors.push("Timestamp cannot be more than 1 hour in the future");
        }
        // Timestamp should not be too far in the past (max 1 year)
        const maxPast = now - 365 * 24 * 3600 * 1000;
        if (timestamp.getTime() < maxPast) {
          errors.push("Timestamp cannot be more than 1 year in the past");
        }
      }
    }

    // Validate amplification if present
    if (metadata.amplification !== undefined) {
      const amplification = Number(metadata.amplification);
      if (isNaN(amplification) || amplification < 0 || amplification > 1_000_000) {
        errors.push("Amplification must be a number between 0 and 1,000,000");
      }
    }

    // Validate sentiment if present
    if (metadata.sentiment !== undefined) {
      const sentiment = Number(metadata.sentiment);
      if (isNaN(sentiment) || sentiment < -1 || sentiment > 1) {
        errors.push("Sentiment must be a number between -1 and 1");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Claim Validation Rules
 */
export const ClaimValidationRules = {
  /**
   * Validate claim text meets requirements
   */
  validateClaimText: (text: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!text || text.trim().length === 0) {
      errors.push("Claim text cannot be empty");
    }

    if (text.length < 10) {
      errors.push("Claim text must be at least 10 characters");
    }

    if (text.length > 10_000) {
      errors.push("Claim text exceeds maximum length of 10,000 characters");
    }

    // Check for minimum word count
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 3) {
      errors.push("Claim text must contain at least 3 words");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate claim has required evidence
   */
  validateEvidence: async (
    tenantId: string,
    evidenceIds: string[]
  ): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];

    if (!evidenceIds || evidenceIds.length === 0) {
      errors.push("Claim must have at least one evidence reference");
      return { valid: false, errors };
    }

    try {
      // Verify all evidence exists and belongs to tenant
      const evidence = await db.evidence.findMany({
        where: {
          id: { in: evidenceIds },
          tenantId,
        },
        select: { id: true },
      });

      if (evidence.length !== evidenceIds.length) {
        const foundIds = new Set(evidence.map((e) => e.id));
        const missingIds = evidenceIds.filter((id) => !foundIds.has(id));
        errors.push(`Evidence not found: ${missingIds.join(", ")}`);
      }
    } catch (error) {
      logger.error("Error validating evidence", {
        tenantId,
        evidenceIds,
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push("Failed to validate evidence");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Artifact Validation Rules
 */
export const ArtifactValidationRules = {
  /**
   * Validate artifact content
   */
  validateContent: (content: string, type: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push("Artifact content cannot be empty");
    }

    // Type-specific validation
    if (type === "REBUTTAL") {
      if (content.length < 100) {
        errors.push("Rebuttal must be at least 100 characters");
      }
      if (content.length > 50_000) {
        errors.push("Rebuttal exceeds maximum length of 50,000 characters");
      }
    } else if (type === "INCIDENT_EXPLANATION") {
      if (content.length < 200) {
        errors.push("Incident explanation must be at least 200 characters");
      }
      if (content.length > 100_000) {
        errors.push("Incident explanation exceeds maximum length of 100,000 characters");
      }
    }

    // Check for required sections in structured content
    if (type === "REBUTTAL") {
      const hasSummary = /summary|overview|introduction/i.test(content);
      const hasEvidence = /evidence|proof|support/i.test(content);
      if (!hasSummary) {
        errors.push("Rebuttal should include a summary or introduction");
      }
      if (!hasEvidence) {
        errors.push("Rebuttal should reference evidence or supporting information");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate artifact has required citations
   */
  validateCitations: (citations: Array<{ url: string; title?: string }>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!citations || citations.length === 0) {
      errors.push("Artifact must have at least one citation");
      return { valid: false, errors };
    }

    for (const citation of citations) {
      if (!citation.url || citation.url.trim().length === 0) {
        errors.push("Citation URL cannot be empty");
      } else {
        try {
          new URL(citation.url);
        } catch {
          errors.push(`Invalid citation URL: ${citation.url}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Forecast Validation Rules
 */
export const ForecastValidationRules = {
  /**
   * Validate forecast parameters
   */
  validateParameters: (params: {
    horizon?: number;
    clusterId?: string;
    type?: string;
  }): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (params.horizon !== undefined) {
      if (params.horizon < 1 || params.horizon > 365) {
        errors.push("Forecast horizon must be between 1 and 365 days");
      }
    }

    if (params.type) {
      const validTypes = ["DRIFT", "OUTBREAK", "ANOMALY"];
      if (!validTypes.includes(params.type)) {
        errors.push(`Forecast type must be one of: ${validTypes.join(", ")}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate cluster has sufficient data for forecasting
   */
  validateClusterData: async (
    tenantId: string,
    clusterId: string,
    minSignals: number = 5
  ): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];

    try {
      const cluster = await db.claimCluster.findFirst({
        where: {
          id: clusterId,
          tenantId,
        },
        include: {
          _count: {
            select: {
              claims: true,
            },
          },
        },
      });

      if (!cluster) {
        errors.push(`Cluster ${clusterId} not found`);
      } else if (cluster._count.claims < minSignals) {
        errors.push(
          `Cluster has insufficient data: ${cluster._count.claims} claims (minimum: ${minSignals})`
        );
      }
    } catch (error) {
      logger.error("Error validating cluster data", {
        tenantId,
        clusterId,
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push("Failed to validate cluster data");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Playbook Validation Rules
 */
export const PlaybookValidationRules = {
  /**
   * Validate playbook configuration
   */
  validateConfiguration: (config: {
    triggers?: Array<{ type: string; conditions?: Record<string, unknown> }>;
    actions?: Array<{ type: string; parameters?: Record<string, unknown> }>;
  }): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config.triggers || config.triggers.length === 0) {
      errors.push("Playbook must have at least one trigger");
    }

    if (!config.actions || config.actions.length === 0) {
      errors.push("Playbook must have at least one action");
    }

    // Validate trigger types
    const validTriggerTypes = ["SIGNAL", "CLAIM", "FORECAST", "METRIC", "SCHEDULE"];
    for (const trigger of config.triggers || []) {
      if (!validTriggerTypes.includes(trigger.type)) {
        errors.push(`Invalid trigger type: ${trigger.type}`);
      }
    }

    // Validate action types
    const validActionTypes = [
      "CREATE_ARTIFACT",
      "SEND_NOTIFICATION",
      "CREATE_APPROVAL",
      "EXECUTE_POS_CYCLE",
      "UPDATE_SEVERITY",
      "ESCALATE",
    ];
    for (const action of config.actions || []) {
      if (!validActionTypes.includes(action.type)) {
        errors.push(`Invalid action type: ${action.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Comprehensive validation function
 */
export async function validateBusinessRules(
  entityType: "signal" | "claim" | "artifact" | "forecast" | "playbook",
  data: Record<string, unknown>,
  tenantId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const allErrors: string[] = [];

  try {
    switch (entityType) {
      case "signal": {
        const content = data.content as string;
        const contentValidation = SignalValidationRules.validateContent(content);
        allErrors.push(...contentValidation.errors);

        if (data.source) {
          const source = data.source as { type: string; id: string };
          const sourceValidation = await SignalValidationRules.validateSource(
            tenantId,
            source.type,
            source.id
          );
          allErrors.push(...sourceValidation.errors);
        }

        if (data.metadata) {
          const metadataValidation = SignalValidationRules.validateMetadata(
            data.metadata as Record<string, unknown>
          );
          allErrors.push(...metadataValidation.errors);
        }
        break;
      }

      case "claim": {
        const text = data.text as string;
        const textValidation = ClaimValidationRules.validateClaimText(text);
        allErrors.push(...textValidation.errors);

        if (data.evidenceIds) {
          const evidenceValidation = await ClaimValidationRules.validateEvidence(
            tenantId,
            data.evidenceIds as string[]
          );
          allErrors.push(...evidenceValidation.errors);
        }
        break;
      }

      case "artifact": {
        const content = data.content as string;
        const type = data.type as string;
        const contentValidation = ArtifactValidationRules.validateContent(content, type);
        allErrors.push(...contentValidation.errors);

        if (data.citations) {
          const citationsValidation = ArtifactValidationRules.validateCitations(
            data.citations as Array<{ url: string; title?: string }>
          );
          allErrors.push(...citationsValidation.errors);
        }
        break;
      }

      case "forecast": {
        const paramsValidation = ForecastValidationRules.validateParameters({
          horizon: data.horizon as number,
          clusterId: data.clusterId as string,
          type: data.type as string,
        });
        allErrors.push(...paramsValidation.errors);

        if (data.clusterId) {
          const clusterValidation = await ForecastValidationRules.validateClusterData(
            tenantId,
            data.clusterId as string
          );
          allErrors.push(...clusterValidation.errors);
        }
        break;
      }

      case "playbook": {
        const configValidation = PlaybookValidationRules.validateConfiguration({
          triggers: data.triggers as Array<{ type: string; conditions?: Record<string, unknown> }>,
          actions: data.actions as Array<{ type: string; parameters?: Record<string, unknown> }>,
        });
        allErrors.push(...configValidation.errors);
        break;
      }
    }
  } catch (error) {
    logger.error("Error in business rules validation", {
      entityType,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    allErrors.push("Validation error occurred");
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
