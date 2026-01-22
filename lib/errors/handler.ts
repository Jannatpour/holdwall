/**
 * Error Handling
 * Centralized error handling with proper logging
 */

import { logError } from "@/lib/logging/logger";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
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
