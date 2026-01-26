/**
 * Authentication Configuration Validator
 * Validates required environment variables for authentication in production
 */

import { logger } from "@/lib/logging/logger";

export interface AuthConfigStatus {
  valid: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Validate authentication configuration
 */
export function validateAuthConfig(): AuthConfigStatus {
  const normalizeUrl = (value: string | undefined) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    // Normalize trailing slash for comparisons
    return trimmed.endsWith("/") ? trimmed.replace(/\/+$/, "") : trimmed;
  };

  const status: AuthConfigStatus = {
    valid: true,
    missing: [],
    warnings: [],
    errors: [],
  };

  // Required environment variables
  const required = {
    DATABASE_URL: {
      name: "DATABASE_URL",
      description: "PostgreSQL database connection string",
      check: (value: string | undefined) => {
        const v = value?.trim();
        if (!v) return "Missing DATABASE_URL";
        if (v.includes("placeholder")) return "DATABASE_URL contains placeholder - not configured";
        if (!v.startsWith("postgresql://") && !v.startsWith("postgres://")) {
          return "DATABASE_URL must be a PostgreSQL connection string";
        }
        return null;
      },
    },
    NEXTAUTH_SECRET: {
      name: "NEXTAUTH_SECRET",
      description: "Secret for JWT token signing",
      check: (value: string | undefined) => {
        const v = value?.trim();
        if (!v) return "Missing NEXTAUTH_SECRET";
        if (v === "fallback-secret-for-development-only") {
          return "NEXTAUTH_SECRET is using fallback secret - not secure for production";
        }
        if (v.length < 32) {
          return "NEXTAUTH_SECRET should be at least 32 characters";
        }
        return null;
      },
    },
    NEXTAUTH_URL: {
      name: "NEXTAUTH_URL",
      description: "Base URL of your application",
      check: (value: string | undefined) => {
        const v = value?.trim();
        if (!v) return "Missing NEXTAUTH_URL";
        if (!v.startsWith("http://") && !v.startsWith("https://")) {
          return "NEXTAUTH_URL must be a valid URL starting with http:// or https://";
        }
        return null;
      },
    },
  };

  // Check required variables
  for (const [key, config] of Object.entries(required)) {
    const value = process.env[key];
    const error = config.check(value);
    
    if (error) {
      status.valid = false;
      status.missing.push(key);
      status.errors.push(`${key}: ${error}`);
      
      logger.error("Auth config validation failed", {
        variable: key,
        error,
        description: config.description,
      });
    }
  }

  // Check optional but recommended variables
  const optional = {
    DATABASE_URL: {
      name: "DATABASE_URL",
      description: "Database connection string (Supabase pooler recommended on serverless)",
      check: (value: string | undefined) => {
        const v = value?.trim();
        if (!v) return null; // handled in required
        try {
          const url = new URL(v);
          const host = url.hostname;
          // Heuristic: Supabase direct host often causes connectivity issues from serverless;
          // the pooler host is recommended for Vercel.
          if (
            (process.env.NODE_ENV === "production" || process.env.VERCEL) &&
            host.endsWith(".supabase.co") &&
            !host.includes("pooler")
          ) {
            return `Supabase direct host detected (${host}). For Vercel/serverless, prefer the Supabase Pooler connection string (pgBouncer).`;
          }
        } catch {
          // Ignore parsing errors here (required validator will catch invalid scheme)
        }
        return null;
      },
    },
    NEXT_PUBLIC_BASE_URL: {
      name: "NEXT_PUBLIC_BASE_URL",
      description: "Public base URL (should match NEXTAUTH_URL)",
      check: (value: string | undefined) => {
        const v = normalizeUrl(value);
        if (!v) {
          return "NEXT_PUBLIC_BASE_URL not set - may cause issues with OAuth callbacks";
        }
        const nextAuthUrl = normalizeUrl(process.env.NEXTAUTH_URL);
        if (nextAuthUrl && v !== nextAuthUrl) {
          return `NEXT_PUBLIC_BASE_URL (${v}) does not match NEXTAUTH_URL (${nextAuthUrl})`;
        }
        return null;
      },
    },
  };

  for (const [key, config] of Object.entries(optional)) {
    const value = process.env[key];
    const warning = config.check(value);
    
    if (warning) {
      status.warnings.push(`${key}: ${warning}`);
      logger.warn("Auth config warning", {
        variable: key,
        warning,
        description: config.description,
      });
    }
  }

  return status;
}

/**
 * Get user-friendly error message for authentication configuration issues
 */
export function getAuthConfigErrorMessage(status: AuthConfigStatus): string {
  if (status.valid && status.warnings.length === 0) {
    return "";
  }

  const messages: string[] = [];

  if (status.errors.length > 0) {
    messages.push("Authentication configuration errors:");
    status.errors.forEach((error) => {
      messages.push(`  • ${error}`);
    });
  }

  if (status.warnings.length > 0) {
    messages.push("\nWarnings:");
    status.warnings.forEach((warning) => {
      messages.push(`  • ${warning}`);
    });
  }

  if (status.missing.length > 0) {
    messages.push("\nTo fix:");
    messages.push("1. Set the following environment variables in your deployment platform:");
    status.missing.forEach((key) => {
      messages.push(`   - ${key}`);
    });
    messages.push("\n2. For Vercel:");
    messages.push("   - Go to Project Settings → Environment Variables");
    messages.push("   - Add each variable for Production environment");
    messages.push("\n3. For DATABASE_URL:");
    messages.push("   - Get your connection string from Supabase dashboard");
    messages.push("   - Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres");
    messages.push("\n4. For NEXTAUTH_SECRET:");
    messages.push("   - Generate with: openssl rand -base64 32");
    messages.push("   - Must be at least 32 characters");
    messages.push("\n5. For NEXTAUTH_URL:");
    messages.push("   - Set to your production URL (e.g., https://your-domain.vercel.app)");
  }

  return messages.join("\n");
}
