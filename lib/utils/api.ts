/**
 * API Utilities
 * Common API helpers
 */

import { NextResponse } from "next/server";
import { handleError, AppError } from "@/lib/errors/handler";
import { versionResponse } from "@/lib/api/versioning";

/**
 * API route wrapper with error handling
 */
export function apiHandler<T>(
  handler: () => Promise<T>
): Promise<NextResponse> {
  return handler()
    .then((data) => {
      return NextResponse.json(versionResponse(data));
    })
    .catch((error) => {
      return handleError(error);
    });
}

/**
 * Validate and parse request body
 */
export async function parseRequestBody<T>(
  request: Request,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR", {
      error,
    });
  }
}
