/**
 * User Registration API
 * Creates a new user account
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { handleAuthError } from "@/lib/auth/error-handler";
import { logger } from "@/lib/logging/logger";
import { validateAuthConfig, getAuthConfigErrorMessage } from "@/lib/auth/config-validator";

// Lazy load database client
async function getDb() {
  const { db } = await import("@/lib/db/client");
  return db;
}

type SupabaseRestSignupResult =
  | { status: "created"; user: { id: string; email: string; name: string } }
  | { status: "exists" }
  | { status: "failed"; error: string };

async function trySupabaseRestSignup(params: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<SupabaseRestSignupResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "failed", error: "Supabase REST not configured" };
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    // 1) Ensure default tenant exists.
    const tenantRes = await fetch(
      `${baseUrl}/rest/v1/Tenant?select=id&slug=eq.default&limit=1`,
      { method: "GET", headers }
    );
    if (!tenantRes.ok) {
      return { status: "failed", error: `Tenant lookup failed (${tenantRes.status})` };
    }
    const tenantRows = (await tenantRes.json()) as Array<{ id: string }>;
    let tenantId = tenantRows[0]?.id;

    if (!tenantId) {
      const createTenantRes = await fetch(`${baseUrl}/rest/v1/Tenant`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ name: "Default Tenant", slug: "default" }),
      });
      if (!createTenantRes.ok) {
        return { status: "failed", error: `Tenant create failed (${createTenantRes.status})` };
      }
      const created = (await createTenantRes.json()) as Array<{ id: string }>;
      tenantId = created[0]?.id;
      if (!tenantId) {
        return { status: "failed", error: "Tenant create returned no id" };
      }
    }

    // 2) Check existing user.
    const encodedEmail = encodeURIComponent(params.email);
    const userLookupRes = await fetch(
      `${baseUrl}/rest/v1/User?select=id&email=eq.${encodedEmail}&limit=1`,
      { method: "GET", headers }
    );
    if (!userLookupRes.ok) {
      return { status: "failed", error: `User lookup failed (${userLookupRes.status})` };
    }
    const existing = (await userLookupRes.json()) as Array<{ id: string }>;
    if (existing.length > 0) {
      return { status: "exists" };
    }

    // 3) Create user row (matches Prisma schema fields).
    const createUserRes = await fetch(`${baseUrl}/rest/v1/User`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        // Some deployments have the `User.id` column without a DB default.
        // Provide an ID explicitly to satisfy NOT NULL constraints.
        id: randomUUID(),
        email: params.email,
        name: params.name,
        passwordHash: params.passwordHash,
        tenantId,
        role: "USER",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    if (!createUserRes.ok) {
      const body = await createUserRes.text().catch(() => "");
      return {
        status: "failed",
        error: `User create failed (${createUserRes.status}) ${body}`.trim(),
      };
    }

    const createdUsers = (await createUserRes.json()) as Array<any>;
    const createdUser = createdUsers[0] as any;
    const id = typeof createdUser?.id === "string" ? createdUser.id : "";
    const email = typeof createdUser?.email === "string" ? createdUser.email : "";
    const name = typeof createdUser?.name === "string" ? createdUser.name : params.name;
    if (!id || !email) {
      return { status: "failed", error: "User create returned no id" };
    }

    // Never return sensitive DB fields (e.g. passwordHash) to the client.
    return { status: "created", user: { id, email, name } };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function OPTIONS(request: NextRequest) {
  // Handle CORS preflight requests
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: NextRequest) {
  // Wrap entire function to ensure JSON responses
  try {
    // Validate authentication configuration first
    const configStatus = validateAuthConfig();
    if (!configStatus.valid) {
      const errorMessage = getAuthConfigErrorMessage(configStatus);
      logger.error("Authentication configuration invalid", {
        missing: configStatus.missing,
        errors: configStatus.errors,
      });
      
      return NextResponse.json(
        {
          error: "Authentication service not configured",
          message: "The authentication service is not properly configured. Please contact support.",
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        },
        { status: 503 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error("Failed to parse request body", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return NextResponse.json(
        {
          error: "Invalid request",
          message: "Request body must be valid JSON.",
        },
        { status: 400 }
      );
    }
    const { email, password, name } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    try {
      const db = await getDb();
      
      // Normalize email to lowercase for consistent storage and lookup
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check if user already exists (case-insensitive)
      const existingUser = await db.user.findUnique({
        where: { email: normalizedEmail },
      }).catch(() => null);

      // Also check with case-insensitive search as fallback
      if (!existingUser) {
        const users = await db.user.findMany({
          where: {
            email: {
              equals: normalizedEmail,
              mode: 'insensitive',
            },
          },
          take: 1,
        });
        if (users.length > 0) {
          return NextResponse.json(
            { error: "User with this email already exists" },
            { status: 409 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 409 }
        );
      }

      // Get or create default tenant
      let tenant = await db.tenant.findFirst({
        where: { slug: "default" },
      }).catch(() => null);

      if (!tenant) {
        tenant = await db.tenant.create({
          data: {
            name: "Default Tenant",
            slug: "default",
          },
        }).catch(() => null);
      }

      if (!tenant) {
        return NextResponse.json(
          {
            error: "Database error",
            message: "Failed to create or retrieve tenant. Please check your database connection.",
          },
          { status: 500 }
        );
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user with normalized email
      const user = await db.user.create({
        data: {
          email: normalizedEmail, // Store normalized (lowercase) email
          name: name || normalizedEmail.split("@")[0],
          passwordHash,
          tenantId: tenant.id,
          role: "USER",
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
        },
      }).catch((dbError: unknown) => {
        logger.error("Database error creating user", {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          email,
        });
        throw new Error("Failed to create user. Database may not be accessible.");
      });

      return NextResponse.json(
        {
          message: "User created successfully",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        },
        { status: 201 }
      );
    } catch (dbError) {
      // Database-specific errors
      const errorMessage = dbError instanceof Error ? dbError.message : "Database error";
      const errorStack = dbError instanceof Error ? dbError.stack : undefined;
      const prismaCode =
        dbError && typeof dbError === "object" && "code" in dbError
          ? String((dbError as any).code)
          : undefined;
      
      logger.error("Database error in signup", {
        error: errorMessage,
        stack: errorStack,
        prismaCode,
        databaseUrl: process.env.DATABASE_URL ? "configured" : "missing",
      });
      
      // Check for specific database connection errors
      if (
        prismaCode === "P1000" || // Authentication failed
        prismaCode === "P1001" || // Can't reach database server
        prismaCode === "P1002" || // Database server timeout
        errorMessage.includes("Authentication failed") ||
        errorMessage.includes("password authentication failed") ||
        errorMessage.includes("denied access") ||
        errorMessage.includes("not available") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes("cant reach database server") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("EHOSTUNREACH") ||
        errorMessage.includes("ETIMEDOUT")
      ) {
        // Fallback: If serverless cannot reach Postgres (pooler down / network restricted),
        // try to create the user via Supabase PostgREST using the service role key.
        // This uses HTTPS to Supabase and avoids direct Postgres connectivity requirements.
        try {
          const normalizedEmail = String(body?.email ?? "").trim().toLowerCase();
          const passwordValue = String(body?.password ?? "");
          const nameValue =
            (typeof body?.name === "string" && body.name.trim()) ||
            normalizedEmail.split("@")[0] ||
            "User";

          if (normalizedEmail && passwordValue) {
            const passwordHash = await bcrypt.hash(passwordValue, 10);
            const fallback = await trySupabaseRestSignup({
              email: normalizedEmail,
              passwordHash,
              name: nameValue,
            });

            if (fallback.status === "created") {
              return NextResponse.json(
                {
                  message: "User created successfully",
                  user: fallback.user,
                },
                { status: 201 }
              );
            }

            if (fallback.status === "exists") {
              return NextResponse.json(
                { error: "User with this email already exists" },
                { status: 409 }
              );
            }

            if (fallback.status === "failed") {
              logger.warn("Supabase REST fallback signup failed", {
                error: fallback.error,
              });
            }
          }
        } catch (fallbackError) {
          logger.warn("Supabase REST fallback signup threw", {
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
        }

        return NextResponse.json(
          {
            error: "Database connection failed",
            message: "Unable to connect to the database. Please check your DATABASE_URL configuration.",
            details: process.env.NODE_ENV === "development" 
              ? `Database error: ${errorMessage}` 
              : "Please contact support if this issue persists.",
          },
          { status: 503 }
        );
      }
      
      // Check for schema/migration errors
      if (
        errorMessage.includes("relation") ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("table") ||
        errorMessage.includes("column")
      ) {
        return NextResponse.json(
          {
            error: "Database schema error",
            message: "Database schema is not set up correctly. Please run migrations.",
            details: process.env.NODE_ENV === "development"
              ? `Schema error: ${errorMessage}`
              : "Please contact support.",
          },
          { status: 500 }
        );
      }
      
      throw dbError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    // Top-level catch to ensure we always return JSON
    const authError = handleAuthError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error("Error creating user", {
      error: authError.message,
      code: authError.code,
      statusCode: authError.statusCode,
      originalError: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Ensure we always return JSON, never HTML
    return NextResponse.json(
      {
        error: authError.code || "INTERNAL_ERROR",
        message: process.env.NODE_ENV === "development" 
          ? authError.message 
          : "An error occurred while creating your account. Please try again.",
        ...(process.env.NODE_ENV === "development" && {
          details: errorMessage,
        }),
      },
      { status: authError.statusCode || 500 }
    );
  }
}
