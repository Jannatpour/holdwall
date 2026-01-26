/**
 * Error Handling
 * Centralized error handling with proper logging
 * 
 * Canonical error handling module - use this for all error handling
 */

import { logError } from "@/lib/logging/logger";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Application Error
 * Canonical error class for API and service layers
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    context?: Record<string, unknown>,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
    this.details = details;
  }
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    logError(error, error.context);
    
    // Include error ID for tracking
    const errorId = randomUUID();
    
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        error_id: errorId,
        ...(process.env.NODE_ENV === "development" && error.context
          ? { context: error.context }
          : {}),
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    logError(error);
    const errorId = randomUUID();
    
    return NextResponse.json(
      {
        error: "Internal server error",
        error_id: errorId,
        ...(process.env.NODE_ENV === "development"
          ? { message: error.message, stack: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }

  logError(new Error("Unknown error"), { original: error });
  const errorId = randomUUID();
  
  return NextResponse.json(
    {
      error: "Internal server error",
      error_id: errorId,
    },
    { status: 500 }
  );
}
