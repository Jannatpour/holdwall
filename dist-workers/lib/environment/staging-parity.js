"use strict";
/**
 * Staging Environment Parity
 *
 * Defines and enforces staging environment parity with production:
 * - Same environment variable structure (domains, secrets, DB, redis)
 * - Same database schema
 * - Same service contracts
 * - Enforced at startup and health checks
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENVIRONMENT_CONTRACTS = void 0;
exports.detectEnvironment = detectEnvironment;
exports.getEnvironmentContract = getEnvironmentContract;
exports.checkStagingParity = checkStagingParity;
exports.enforceStagingParity = enforceStagingParity;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const ioredis_1 = __importDefault(require("ioredis"));
/**
 * Environment contracts for each environment type
 */
exports.ENVIRONMENT_CONTRACTS = {
    development: {
        environment: "development",
        required_vars: ["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET"],
        optional_vars: [
            "REDIS_URL",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "EVIDENCE_SIGNING_SECRET",
            "CSRF_SECRET",
            "VERIFY_TOKEN",
        ],
        domain_patterns: {
            staging: [],
            production: [],
        },
        database: {
            required: true,
        },
        redis: {
            required: false,
        },
        secrets: {
            required: ["NEXTAUTH_SECRET"],
            optional: ["EVIDENCE_SIGNING_SECRET", "CSRF_SECRET"],
        },
    },
    staging: {
        environment: "staging",
        required_vars: [
            "DATABASE_URL",
            "NEXTAUTH_URL",
            "NEXTAUTH_SECRET",
            "EVIDENCE_SIGNING_SECRET",
            "CSRF_SECRET",
        ],
        optional_vars: [
            "REDIS_URL",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "VERIFY_TOKEN",
            "SENTRY_DSN",
        ],
        domain_patterns: {
            staging: ["staging.holdwall.com", "staging-", "-staging", "stage."],
            production: [],
        },
        database: {
            required: true,
        },
        redis: {
            required: false, // Optional but recommended
        },
        secrets: {
            required: ["NEXTAUTH_SECRET", "EVIDENCE_SIGNING_SECRET", "CSRF_SECRET"],
            optional: [],
        },
    },
    production: {
        environment: "production",
        required_vars: [
            "DATABASE_URL",
            "NEXTAUTH_URL",
            "NEXTAUTH_SECRET",
            "EVIDENCE_SIGNING_SECRET",
            "CSRF_SECRET",
        ],
        optional_vars: [
            "REDIS_URL",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "SENTRY_DSN",
        ],
        domain_patterns: {
            staging: [],
            production: ["holdwall.com", "www.holdwall.com"],
        },
        database: {
            required: true,
        },
        redis: {
            required: false, // Optional but recommended
        },
        secrets: {
            required: ["NEXTAUTH_SECRET", "EVIDENCE_SIGNING_SECRET", "CSRF_SECRET"],
            optional: [],
        },
    },
};
/**
 * Detect environment from NODE_ENV and domain patterns
 */
function detectEnvironment() {
    const nodeEnv = process.env.NODE_ENV;
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    // If NODE_ENV is explicitly set to production, check domain to distinguish staging vs production
    if (nodeEnv === "production") {
        const url = nextAuthUrl || baseUrl;
        if (url) {
            try {
                const parsedUrl = new URL(url);
                const hostname = parsedUrl.hostname.toLowerCase();
                // Check for staging patterns
                const stagingPatterns = exports.ENVIRONMENT_CONTRACTS.staging.domain_patterns.staging;
                if (stagingPatterns.some((pattern) => hostname.includes(pattern))) {
                    return "staging";
                }
                // Check for production patterns
                const productionPatterns = exports.ENVIRONMENT_CONTRACTS.production.domain_patterns.production;
                if (productionPatterns.some((pattern) => hostname.includes(pattern))) {
                    return "production";
                }
                // Default to production if NODE_ENV=production but no pattern match
                return "production";
            }
            catch {
                // Invalid URL, default to production
                return "production";
            }
        }
        return "production";
    }
    // Development by default
    return "development";
}
/**
 * Get environment contract for current environment
 */
function getEnvironmentContract() {
    const env = detectEnvironment();
    return exports.ENVIRONMENT_CONTRACTS[env];
}
/**
 * Check staging parity with production
 */
async function checkStagingParity() {
    const detectedEnv = detectEnvironment();
    const contract = getEnvironmentContract();
    const issues = [];
    const recommendations = [];
    // Check 1: Environment detection
    const envCheck = {
        status: "pass",
        detected: detectedEnv,
        message: `Environment detected as: ${detectedEnv}`,
    };
    // Check 2: Required environment variables
    const missingVars = [];
    const presentVars = [];
    for (const varName of contract.required_vars) {
        if (process.env[varName]) {
            presentVars.push(varName);
        }
        else {
            missingVars.push(varName);
        }
    }
    const requiredVarsCheck = {
        status: (missingVars.length === 0 ? "pass" : missingVars.length === contract.required_vars.length ? "fail" : "partial"),
        missing: missingVars,
        present: presentVars,
        message: missingVars.length === 0
            ? "All required environment variables are present"
            : `Missing ${missingVars.length} required variable(s): ${missingVars.join(", ")}`,
    };
    if (missingVars.length > 0) {
        issues.push(`Missing required environment variables: ${missingVars.join(", ")}`);
        recommendations.push(`Set the following environment variables: ${missingVars.join(", ")}`);
    }
    // Check 3: Domain alignment
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    let domainAlignment = "pass";
    let domainMessage = "Domain alignment verified";
    if (nextAuthUrl) {
        try {
            const url = new URL(nextAuthUrl);
            const hostname = url.hostname.toLowerCase();
            // Check protocol (should be https in staging/production)
            if ((detectedEnv === "staging" || detectedEnv === "production") && url.protocol !== "https:") {
                domainAlignment = "warning";
                domainMessage = "NEXTAUTH_URL should use https:// in staging/production";
                issues.push("NEXTAUTH_URL uses http:// instead of https://");
                recommendations.push("Update NEXTAUTH_URL to use https://");
            }
            // Check domain patterns
            if (detectedEnv === "staging") {
                const stagingPatterns = contract.domain_patterns.staging;
                if (!stagingPatterns.some((pattern) => hostname.includes(pattern))) {
                    domainAlignment = "warning";
                    domainMessage = `Staging environment should use staging domain pattern (${stagingPatterns.join(", ")})`;
                    issues.push(`Domain ${hostname} does not match staging patterns`);
                }
            }
            else if (detectedEnv === "production") {
                const productionPatterns = contract.domain_patterns.production;
                if (!productionPatterns.some((pattern) => hostname.includes(pattern))) {
                    domainAlignment = "warning";
                    domainMessage = `Production environment should use production domain pattern (${productionPatterns.join(", ")})`;
                    issues.push(`Domain ${hostname} does not match production patterns`);
                }
            }
        }
        catch (error) {
            domainAlignment = "fail";
            domainMessage = `Invalid NEXTAUTH_URL: ${error instanceof Error ? error.message : "Unknown error"}`;
            issues.push(`Invalid NEXTAUTH_URL format: ${nextAuthUrl}`);
        }
    }
    else {
        domainAlignment = "fail";
        domainMessage = "NEXTAUTH_URL is not set";
        issues.push("NEXTAUTH_URL is required but not set");
    }
    const domainCheck = {
        status: domainAlignment,
        nextauth_url: nextAuthUrl,
        base_url: baseUrl,
        canonical_domain: baseUrl,
        message: domainMessage,
    };
    // Check 4: Database
    let dbReachable = false;
    let dbMessage = "Database check pending";
    try {
        await client_1.db.$queryRaw `SELECT 1`;
        dbReachable = true;
        dbMessage = "Database is reachable";
    }
    catch (error) {
        dbMessage = `Database unreachable: ${error instanceof Error ? error.message : "Unknown error"}`;
        issues.push(`Database connection failed: ${dbMessage}`);
    }
    const dbCheck = {
        status: (dbReachable ? "pass" : "fail"),
        reachable: dbReachable,
        message: dbMessage,
    };
    if (!dbReachable) {
        recommendations.push("Verify DATABASE_URL is correct and database is accessible");
    }
    // Check 5: Redis
    const redisUrl = process.env.REDIS_URL;
    let redisConfigured = !!redisUrl;
    let redisReachable = false;
    let redisMessage = "Redis check pending";
    if (redisUrl) {
        try {
            const redis = new ioredis_1.default(redisUrl);
            await redis.ping();
            redisReachable = true;
            redisMessage = "Redis is reachable";
            await redis.quit();
        }
        catch (error) {
            redisMessage = `Redis unreachable: ${error instanceof Error ? error.message : "Unknown error"}`;
            issues.push(`Redis connection failed: ${redisMessage}`);
        }
    }
    else {
        redisMessage = "Redis not configured (optional)";
    }
    const redisCheck = {
        status: (redisConfigured ? (redisReachable ? "pass" : "fail") : "warning"),
        reachable: redisReachable,
        configured: redisConfigured,
        message: redisMessage,
    };
    if (redisConfigured && !redisReachable) {
        recommendations.push("Verify REDIS_URL is correct and Redis is accessible");
    }
    // Check 6: Secrets
    const missingSecrets = [];
    const usingFallbacks = [];
    for (const secretName of contract.secrets.required) {
        const value = process.env[secretName];
        if (!value) {
            missingSecrets.push(secretName);
        }
        else if (value.includes("fallback") || value.includes("dev") || value.length < 16) {
            usingFallbacks.push(secretName);
        }
    }
    const secretsCheck = {
        status: (missingSecrets.length === 0 && usingFallbacks.length === 0 ? "pass" : missingSecrets.length > 0 ? "fail" : "warning"),
        missing_required: missingSecrets,
        using_fallbacks: usingFallbacks,
        message: missingSecrets.length > 0
            ? `Missing required secrets: ${missingSecrets.join(", ")}`
            : usingFallbacks.length > 0
                ? `Using fallback/weak secrets: ${usingFallbacks.join(", ")}`
                : "All required secrets are properly configured",
    };
    if (missingSecrets.length > 0) {
        issues.push(`Missing required secrets: ${missingSecrets.join(", ")}`);
        recommendations.push(`Set strong secrets for: ${missingSecrets.join(", ")}`);
    }
    if (usingFallbacks.length > 0 && (detectedEnv === "staging" || detectedEnv === "production")) {
        issues.push(`Using fallback/weak secrets in ${detectedEnv}: ${usingFallbacks.join(", ")}`);
        recommendations.push(`Replace fallback secrets with production-grade secrets: ${usingFallbacks.join(", ")}`);
    }
    // Determine overall parity status
    const allChecks = [envCheck, requiredVarsCheck, domainCheck, dbCheck, redisCheck, secretsCheck];
    const failedChecks = allChecks.filter((c) => c.status === "fail").length;
    const warningChecks = allChecks.filter((c) => c.status === "warning").length;
    let parityStatus = "compliant";
    if (failedChecks > 0) {
        parityStatus = "non_compliant";
    }
    else if (warningChecks > 0) {
        parityStatus = "partial";
    }
    return {
        environment: detectedEnv,
        parity_status: parityStatus,
        checks: {
            environment_detection: envCheck,
            required_vars: requiredVarsCheck,
            domain_alignment: domainCheck,
            database: dbCheck,
            redis: redisCheck,
            secrets: secretsCheck,
        },
        issues,
        recommendations,
    };
}
/**
 * Enforce staging parity at startup
 */
async function enforceStagingParity() {
    const result = await checkStagingParity();
    logger_1.logger.info("Staging parity check", {
        environment: result.environment,
        parity_status: result.parity_status,
        issues_count: result.issues.length,
    });
    if (result.parity_status === "non_compliant") {
        const errorMessage = `Staging parity check failed:\n${result.issues.join("\n")}\n\nRecommendations:\n${result.recommendations.join("\n")}`;
        logger_1.logger.error("Staging parity enforcement failed", {
            environment: result.environment,
            issues: result.issues,
            recommendations: result.recommendations,
        });
        // In production/staging, fail startup if critical issues
        if (result.environment === "production" || result.environment === "staging") {
            throw new Error(errorMessage);
        }
        else {
            // In development, just warn
            logger_1.logger.warn("Staging parity issues in development (non-blocking)", {
                issues: result.issues,
            });
        }
    }
    else if (result.parity_status === "partial") {
        logger_1.logger.warn("Staging parity check has warnings", {
            environment: result.environment,
            issues: result.issues,
            recommendations: result.recommendations,
        });
    }
}
