/**
 * User Registration API
 * Creates a new user account
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import bcrypt from "bcryptjs";
import { handleAuthError } from "@/lib/auth/error-handler";
import { logger } from "@/lib/logging/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Check database connection
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("placeholder")) {
      return NextResponse.json(
        {
          error: "Database not configured",
          message: "Please configure DATABASE_URL in your environment variables",
        },
        { status: 503 }
      );
    }

    try {
      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email },
      }).catch(() => null);

      if (existingUser) {
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

      // Create user
      const user = await db.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
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
      logger.error("Database error in signup", {
        error: errorMessage,
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      
      if (errorMessage.includes("denied access") || errorMessage.includes("not available")) {
        return NextResponse.json(
          {
            error: "Database connection failed",
            message: "Unable to connect to the database. Please ensure your database is running and DATABASE_URL is correctly configured.",
          },
          { status: 503 }
        );
      }
      
      throw dbError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    const authError = handleAuthError(error);
    logger.error("Error creating user", {
      error: authError.message,
      code: authError.code,
      statusCode: authError.statusCode,
    });
    
    return NextResponse.json(
      {
        error: authError.code,
        message: process.env.NODE_ENV === "development" 
          ? authError.message 
          : "An error occurred while creating your account. Please try again.",
      },
      { status: authError.statusCode }
    );
  }
}
