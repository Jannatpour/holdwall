/**
 * Authentication Error Handler
 * Centralized error handling for authentication flows
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class DatabaseAuthError extends AuthError {
  constructor(message: string = "Database error during authentication") {
    super(message, "DATABASE_ERROR", 500);
    this.name = "DatabaseAuthError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string = "Invalid email or password") {
    super(message, "INVALID_CREDENTIALS", 401);
    this.name = "InvalidCredentialsError";
  }
}

export class UserNotFoundError extends AuthError {
  constructor(email?: string) {
    super(
      email ? `User not found: ${email}` : "User not found",
      "USER_NOT_FOUND",
      404
    );
    this.name = "UserNotFoundError";
  }
}

export class SessionExpiredError extends AuthError {
  constructor(message: string = "Session has expired") {
    super(message, "SESSION_EXPIRED", 401);
    this.name = "SessionExpiredError";
  }
}

/**
 * Handle authentication errors consistently
 */
export function handleAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common database errors
    if (error.message.includes("denied access") || error.message.includes("not available")) {
      return new DatabaseAuthError("Database connection failed");
    }

    // Check for Prisma errors
    if (error.message.includes("Unique constraint")) {
      return new AuthError("User already exists", "USER_EXISTS", 409);
    }

    return new AuthError(error.message, "UNKNOWN_ERROR", 500);
  }

  return new AuthError("An unknown error occurred", "UNKNOWN_ERROR", 500);
}
