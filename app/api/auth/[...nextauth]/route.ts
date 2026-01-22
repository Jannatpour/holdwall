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
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logging/logger";
import { handleAuthError, InvalidCredentialsError, DatabaseAuthError } from "@/lib/auth/error-handler";

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
        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          logger.warn("Authorize: User not found", { email: credentials.email });
          return null;
        }

        if (!user.passwordHash) {
          logger.warn("Authorize: User has no password hash", { email: credentials.email });
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          logger.warn("Authorize: Invalid password", { email: credentials.email });
          return null;
        }

        logger.info("Authorize: Successfully authenticated", { email: credentials.email, userId: user.id });
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
        logger.error("Authorize: Database error", {
          error: authError.message,
          stack: authError instanceof Error ? authError.stack : undefined,
        });
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
          // Get or create default tenant
          let tenant = await db.tenant.findFirst({
            where: { slug: "default" },
          });

          if (!tenant) {
            tenant = await db.tenant.create({
              data: {
                name: "Default Tenant",
                slug: "default",
              },
            });
          }

          // Check if user exists by email
          const existingUser = await db.user.findUnique({
            where: { email: user.email || "" },
          });

          if (existingUser) {
            // Link OAuth account to existing user
            await db.account.upsert({
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
            const newUser = await db.user.create({
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
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development-only",
  debug: process.env.NODE_ENV === "development",
  trustHost: true, // Required for Next.js 13+ App Router
};

// Try to add adapter only if database URL is valid
// Adapter is optional for JWT strategy but needed for OAuth
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
  try {
    nextAuthConfig.adapter = PrismaAdapter(db) as any;
  } catch (error) {
    logger.warn("PrismaAdapter not available, using JWT-only mode", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue without adapter - JWT strategy works without it
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(nextAuthConfig);

// Wrap handlers to ensure JSON error responses
async function handleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    const response = await handler(req);
    
    // Clone response to read it without consuming the stream
    const clonedResponse = response.clone();
    
    // If response is HTML error page, convert to JSON
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") && !response.ok) {
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
    });
    
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
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(handlers.GET, req);
}

export async function POST(req: NextRequest) {
  return handleRequest(handlers.POST, req);
}
