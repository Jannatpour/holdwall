/**
 * Session utilities
 * Get current user session server-side
 */

import { auth } from "./index";
import { RBACService } from "./rbac";

const rbacService = new RBACService();

export async function getCurrentUser() {
  try {
    const session = await auth();
    return session?.user || null;
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error getting current user", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function requireAuth() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Unauthorized");
    }
    return user;
  } catch (error) {
    // Re-throw auth errors as-is
    if (error instanceof Error && error.message === "Unauthorized") {
      throw error;
    }
    // Wrap other errors
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error in requireAuth", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Unauthorized");
  }
}

export async function requireRole(role: string) {
  const user = await requireAuth();
  const userRole = (user as any).role;
  
  if (userRole !== role && userRole !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Check if user has permission for resource/action
 */
export async function requirePermission(
  resource: string,
  action: string,
  attributes?: Array<{ key: string; value: unknown }>
) {
  const user = await requireAuth();
  const userId = (user as any).id;

  if (!userId) {
    throw new Error("User ID not found");
  }

  const hasPermission = await rbacService.hasPermission(
    userId,
    resource,
    action,
    attributes
  );

  if (!hasPermission) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user;
}
