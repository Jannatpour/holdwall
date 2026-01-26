/**
 * NextAuth API Route
 * Production-ready authentication with JWT, OAuth2, SSO support
 */

/**
 * NextAuth v5 API Route
 * Production-ready authentication with JWT, OAuth2, SSO support
 */

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logging/logger";
import { handleAuthError, InvalidCredentialsError, DatabaseAuthError } from "@/lib/auth/error-handler";
import { validateAuthConfig } from "@/lib/auth/config-validator";

// Lazy load database client to prevent initialization errors
let db: any = null;
let dbInitialized = false;

async function getDb() {
  if (dbInitialized && db) {
    return db;
  }
  
  try {
    const { db: dbClient } = await import("@/lib/db/client");
    db = dbClient;
    dbInitialized = true;
    return db;
  } catch (error) {
    logger.error("Failed to initialize database client", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// OIDC provider support for enterprise SSO (optional)
// Only enabled if OIDC environment variables are configured

// NextAuth configuration
// Adapter is optional when using JWT strategy - only needed for OAuth database sessions
const providers: any[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        logger.warn("Authorize: Missing credentials");
        return null;
      }

      try {
        // Validate auth configuration
        const configStatus = validateAuthConfig();
        if (!configStatus.valid) {
          logger.error("Authorize: Authentication configuration invalid", {
            missing: configStatus.missing,
            errors: configStatus.errors,
          });
          // Return null to indicate authentication failure
          // This prevents exposing configuration details
          return null;
        }

        // Normalize email to lowercase for consistent lookup
        // This ensures case-insensitive email matching
        const normalizedEmail = (credentials.email as string).trim().toLowerCase();
        
        logger.info("Authorize: Attempting login", { 
          email: normalizedEmail,
          emailProvided: credentials.email as string 
        });

        const database = await getDb();
        
        // Try exact match with normalized email first
        let user = await database.user.findUnique({
          where: { email: normalizedEmail },
        });

        // If not found with normalized email, try case-insensitive search using raw query
        // This handles cases where emails were stored with mixed case before normalization
        if (!user) {
          logger.debug("Authorize: User not found with normalized email, trying case-insensitive search", { 
            email: normalizedEmail 
          });
          
          // Use raw SQL for case-insensitive email lookup
          // This handles legacy users with mixed-case emails
          try {
            const users = await database.$queryRaw<Array<{ id: string; email: string; name: string | null; image: string | null; passwordHash: string | null; role: string; tenantId: string }>>`
              SELECT id, email, name, image, "passwordHash", role, "tenantId"
              FROM "User"
              WHERE LOWER(email) = LOWER(${normalizedEmail})
              LIMIT 1
            `;
            
            if (users.length > 0) {
              user = users[0];
              logger.info("Authorize: Found user with case-insensitive search", {
                foundEmail: user.email,
                normalizedEmail,
                note: "Consider running normalize-user-emails.ts to update this user's email"
              });
            }
          } catch (rawQueryError) {
            logger.debug("Authorize: Raw query fallback failed, user not found", {
              error: rawQueryError instanceof Error ? rawQueryError.message : String(rawQueryError),
              email: normalizedEmail
            });
          }
        }

        if (!user) {
          logger.warn("Authorize: User not found", { 
            email: normalizedEmail,
            attemptedEmail: credentials.email as string 
          });
          return null;
        }

        if (!user.passwordHash) {
          logger.warn("Authorize: User has no password hash", { 
            email: normalizedEmail,
            userId: user.id 
          });
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          logger.warn("Authorize: Invalid password", { 
            email: normalizedEmail,
            userId: user.id 
          });
          return null;
        }

        logger.info("Authorize: Successfully authenticated", { 
          email: normalizedEmail,
          userId: user.id,
          role: user.role 
        });
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          tenantId: user.tenantId,
        };
      } catch (error) {
        const authError = handleAuthError(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Log detailed error information
        logger.error("Authorize: Database error", {
          error: authError.message,
          originalError: errorMessage,
          email: credentials.email as string,
          stack: error instanceof Error ? error.stack : undefined,
          databaseUrl: process.env.DATABASE_URL ? "configured" : "missing",
        });
        
        // Check for specific database connection errors
        if (
          errorMessage.includes("denied access") ||
          errorMessage.includes("not available") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("ENOTFOUND")
        ) {
          logger.error("Authorize: Database connection failed", {
            error: errorMessage,
            suggestion: "Check DATABASE_URL environment variable",
          });
        }
        
        return null;
      }
    },
  }),
];

// Only add OAuth providers if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

// OIDC provider for enterprise SSO (optional - only if configured)
// Note: OIDC support is disabled to prevent build errors
// To enable OIDC, install next-auth/providers/openid-connect and configure it here
// if (process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
//   // OIDC provider configuration would go here
// }

const nextAuthConfig: any = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
      }
      
      // Handle OAuth account linking
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
      }
      
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
      }
      return session;
    },
    async signIn({ user, account, profile }: any) {
      // For OAuth providers, create or link user account
      if (account?.provider && account.provider !== "credentials") {
        try {
          const database = await getDb();
          
          // Get or create default tenant
          let tenant = await database.tenant.findFirst({
            where: { slug: "default" },
          });

          if (!tenant) {
            tenant = await database.tenant.create({
              data: {
                name: "Default Tenant",
                slug: "default",
              },
            });
          }

          // Check if user exists by email
          const existingUser = await database.user.findUnique({
            where: { email: user.email || "" },
          });

          if (existingUser) {
            // Link OAuth account to existing user
            await database.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              update: {
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
              },
              create: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
              },
            });
            
            // Update user object for JWT
            user.id = existingUser.id;
            user.role = existingUser.role;
            user.tenantId = existingUser.tenantId;
          } else {
            // Create new user from OAuth
            const newUser = await database.user.create({
              data: {
                email: user.email || "",
                name: user.name || user.email?.split("@")[0] || "User",
                image: user.image,
                tenantId: tenant.id,
                role: "USER",
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                    session_state: account.session_state,
                  },
                },
              },
            });
            
            user.id = newUser.id;
            user.role = newUser.role;
            user.tenantId = newUser.tenantId;
          }
        } catch (error) {
          logger.error("Error during OAuth sign in", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          return false; // Reject sign in
        }
      }
      
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  // Never use a hardcoded secret in production.
  // In development/test we allow a fallback to keep local onboarding friction low,
  // but production must set NEXTAUTH_SECRET.
  secret:
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "fallback-secret-for-development-only"),
  debug: process.env.NODE_ENV === "development",
  trustHost: true, // Required for Next.js 13+ App Router
  // Ensure local http environments (e.g. E2E on localhost) can set session cookies
  // even when running a production build. In real prod (https), cookies stay secure.
  useSecureCookies: !!process.env.NEXTAUTH_URL?.startsWith("https://"),
};

// Try to add adapter only if database URL is valid
// Adapter is optional for JWT strategy but needed for OAuth
// We'll add it lazily to prevent initialization errors
let adapterAdded = false;

async function ensureAdapter() {
  if (adapterAdded || nextAuthConfig.adapter) {
    return;
  }
  
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    try {
      const database = await getDb();
      nextAuthConfig.adapter = PrismaAdapter(database) as any;
      adapterAdded = true;
      logger.info("PrismaAdapter added successfully");
    } catch (error) {
      logger.warn("PrismaAdapter not available, using JWT-only mode", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without adapter - JWT strategy works without it
    }
  }
}

// Initialize NextAuth - adapter will be added lazily if needed
let handlers: any = null;
let authRaw: any = null;
let signIn: any = null;
let signOut: any = null;

try {
  const instance = NextAuth(nextAuthConfig);
  handlers = instance.handlers;
  authRaw = instance.auth;
  signIn = instance.signIn;
  signOut = instance.signOut;
  
  // Try to add adapter in background (non-blocking)
  ensureAdapter().catch((error) => {
    logger.warn("Failed to add adapter in background", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
} catch (error) {
  logger.error("NextAuth initialization error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  // Create fallback handlers that return errors
  handlers = {
    GET: async () => new Response(JSON.stringify({ error: "Authentication service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }),
    POST: async () => new Response(JSON.stringify({ error: "Authentication service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }),
  };
  authRaw = async () => null;
  signIn = async () => ({ error: "Authentication service unavailable" });
  signOut = async () => ({ error: "Authentication service unavailable" });
}

// Wrap auth function to catch errors and return null instead of throwing
// This prevents 500 errors when auth() is called in server components
const auth = async () => {
  try {
    if (!authRaw) {
      return null;
    }
    return await authRaw();
  } catch (error) {
    logger.warn("Auth function error, returning null session", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};

export { handlers, auth, signIn, signOut };

// Wrap handlers to ensure JSON error responses
async function handleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    const response = await handler(req);
    
    // Clone response to read it without consuming the stream
    const clonedResponse = response.clone();
    
    // If response is an HTML *error* page, convert to JSON.
    // Important: NextAuth frequently uses 302/303 redirects (especially for sign-in flows).
    // Redirects are not errors and must preserve headers (e.g. Set-Cookie).
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") && response.status >= 400) {
      try {
        const text = await clonedResponse.text();
        logger.error("NextAuth returned HTML error", {
          errorPreview: text.substring(0, 200),
          status: response.status,
        });
      } catch (e) {
        // Ignore read errors
      }
      
      // For session endpoint, return null session instead of error
      if (req.nextUrl.pathname.includes("/session")) {
        return new Response(
          JSON.stringify({ user: null, expires: null }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Authentication error",
          message: "Endpoint unavailable"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    return response;
  } catch (error) {
    logger.error("NextAuth handler error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      pathname: req.nextUrl.pathname,
    });
    
    // For session endpoint, always return null session instead of error
    if (req.nextUrl.pathname.includes("/session")) {
      return new Response(
        JSON.stringify({ user: null, expires: null }),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-store, must-revalidate",
          },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: "Authentication error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Enhanced error handling wrapper that catches all errors
async function safeHandleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    return await handleRequest(handler, req);
  } catch (error) {
    logger.error("NextAuth safe handler error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      pathname: req.nextUrl.pathname,
    });
    
    // For session endpoint, always return null session
    if (req.nextUrl.pathname.includes("/session")) {
      return new Response(
        JSON.stringify({ user: null, expires: null }),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-store, must-revalidate",
          },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: "Authentication service unavailable",
        message: "Please try again later"
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  // Wrap entire function in try-catch to ensure JSON responses
  try {
    // Handle session endpoint with special error handling
    if (req.nextUrl.pathname.includes("/session")) {
      try {
        // Ensure adapter is available for OAuth flows (non-blocking)
        ensureAdapter().catch((error) => {
          logger.warn("Failed to ensure adapter", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
        
        // Check if handlers are available
        if (!handlers || !handlers.GET) {
          logger.warn("NextAuth handlers not available, returning null session");
          return NextResponse.json(
            { user: null, expires: null },
            {
              status: 200,
              headers: { 
                "Cache-Control": "no-store, must-revalidate",
              },
            }
          );
        }
        
        // Try to get session, but always return JSON
        try {
          const response = await handlers.GET(req);
          
          // Clone response to check content without consuming stream
          const clonedResponse = response.clone();
          
          // If response is HTML error, convert to null session
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("text/html")) {
            logger.warn("NextAuth session returned HTML, returning null session", {
              status: response.status,
            });
            return NextResponse.json(
              { user: null, expires: null },
              {
                status: 200,
                headers: { 
                  "Cache-Control": "no-store, must-revalidate",
                },
              }
            );
          }
          
          // Ensure response is JSON
          if (!contentType.includes("application/json")) {
            // Try to parse as JSON, if fails return null session
            try {
              const text = await clonedResponse.text();
              const parsed = JSON.parse(text);
              return NextResponse.json(parsed, {
                status: response.status,
                headers: {
                  "Cache-Control": "no-store, must-revalidate",
                },
              });
            } catch {
              logger.warn("NextAuth session response is not valid JSON, returning null session");
              return NextResponse.json(
                { user: null, expires: null },
                {
                  status: 200,
                  headers: { 
                    "Cache-Control": "no-store, must-revalidate",
                  },
                }
              );
            }
          }
          
          // If response is not OK, return null session instead of error
          if (!response.ok) {
            logger.warn("NextAuth session returned error status, returning null session", {
              status: response.status,
            });
            return NextResponse.json(
              { user: null, expires: null },
              {
                status: 200,
                headers: { 
                  "Cache-Control": "no-store, must-revalidate",
                },
              }
            );
          }
          
          return response;
        } catch (error) {
          logger.error("Error in NextAuth session handler", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          return NextResponse.json(
            { user: null, expires: null },
            {
              status: 200,
              headers: { 
                "Cache-Control": "no-store, must-revalidate",
              },
            }
          );
        }
      } catch (error) {
        logger.error("NextAuth GET session error", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
          { user: null, expires: null },
          {
            status: 200,
            headers: { 
              "Cache-Control": "no-store, must-revalidate",
            },
          }
        );
      }
    }
  
    // Providers endpoint must conform to NextAuth's expected shape.
    // next-auth/react uses `/api/auth/providers` to validate provider existence (including "credentials").
    if (req.nextUrl.pathname.includes("/providers")) {
      try {
        if (!handlers || !handlers.GET) {
          // Fail open with empty providers so client can render fallback UI without redirect loops.
          return NextResponse.json({}, { status: 200 });
        }

        const response = await handlers.GET(req);
        const contentType = response.headers.get("content-type") || "";

        // If NextAuth returns an error or HTML, return an empty object (client treats as "no providers").
        if (!response.ok || contentType.includes("text/html")) {
          return NextResponse.json({}, { status: 200 });
        }

        // Normalize via JSON to ensure a stable response for clients.
        const data = await response.clone().json().catch(() => ({}));
        if (!data || typeof data !== "object") {
          return NextResponse.json({}, { status: 200 });
        }
        return NextResponse.json(data as Record<string, unknown>, { status: 200 });
      } catch (error) {
        logger.error("Error getting providers", {
          error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({}, { status: 200 });
      }
    }
    
    // Handle all other NextAuth endpoints
    try {
      // Ensure adapter is available for OAuth flows (non-blocking)
      ensureAdapter().catch((error) => {
        logger.warn("Failed to ensure adapter", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      
      // Check if handlers are available
      if (!handlers || !handlers.GET) {
        logger.error("NextAuth handlers not available");
        return NextResponse.json(
          { error: "Authentication service unavailable" },
          { status: 503 }
        );
      }
      return await safeHandleRequest(handlers.GET, req);
    } catch (error) {
      logger.error("NextAuth GET handler error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        pathname: req.nextUrl.pathname,
      });
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
  } catch (error) {
    // Top-level catch to ensure we always return JSON, never HTML
    logger.error("NextAuth GET top-level error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      pathname: req.nextUrl.pathname,
    });
    
    // For session endpoint, return null session
    if (req.nextUrl.pathname.includes("/session")) {
      return NextResponse.json(
        { user: null, expires: null },
        {
          status: 200,
          headers: { 
            "Cache-Control": "no-store, must-revalidate",
          },
        }
      );
    }
    
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Ensure adapter is available for OAuth flows (non-blocking)
    ensureAdapter().catch((error) => {
      logger.warn("Failed to ensure adapter", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    
    // Check if handlers are available
    if (!handlers || !handlers.POST) {
      logger.error("NextAuth handlers not available");
      return new Response(
        JSON.stringify({ error: "Authentication service unavailable" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    return await safeHandleRequest(handlers.POST, req);
  } catch (error) {
    logger.error("NextAuth POST handler error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      pathname: req.nextUrl.pathname,
    });
    return new Response(
      JSON.stringify({ error: "Authentication service unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  // Handle CORS preflight requests
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
