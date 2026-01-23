/**
 * Workspace Scoping Service
 * 
 * Manages workspace scoping per brand/region for isolation and access control.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export type WorkspaceType = "BRAND" | "REGION" | "DEPARTMENT" | "PROJECT" | "OTHER";

export interface Workspace {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  region?: string;
  metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceUser {
  id: string;
  workspace_id: string;
  user_id: string;
  role?: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export class WorkspaceScopingService {
  /**
   * Create workspace
   */
  async createWorkspace(
    tenantId: string,
    name: string,
    type: WorkspaceType,
    options?: {
      region?: string;
      slug?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Workspace> {
    try {
      const slug = options?.slug || name.toLowerCase().replace(/\s+/g, "-");

      const workspace = await db.workspace.create({
        data: {
          tenantId,
          name,
          slug,
          type: type as any,
          region: options?.region || undefined,
          metadata: (options?.metadata as any) || undefined,
        },
      });

      logger.info("Workspace created", {
        workspace_id: workspace.id,
        tenant_id: tenantId,
        name,
        type,
      });

      return this.mapToWorkspace(workspace);
    } catch (error) {
      logger.error("Failed to create workspace", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        name,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Assign user to workspace
   */
  async assignUserToWorkspace(
    workspaceId: string,
    userId: string,
    tenantId: string,
    options?: {
      role?: string;
      permissions?: string[];
    }
  ): Promise<WorkspaceUser> {
    try {
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace || workspace.tenantId !== tenantId) {
        throw new Error("Workspace not found or tenant mismatch");
      }

      const workspaceUser = await db.workspaceUser.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
        create: {
          workspaceId,
          userId,
          role: options?.role || undefined,
          permissions: options?.permissions || [],
        },
        update: {
          role: options?.role || undefined,
          permissions: options?.permissions || [],
        },
      });

      return this.mapToWorkspaceUser(workspaceUser);
    } catch (error) {
      logger.error("Failed to assign user to workspace", {
        error: error instanceof Error ? error.message : String(error),
        workspace_id: workspaceId,
        user_id: userId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get user workspaces
   */
  async getUserWorkspaces(userId: string, tenantId: string): Promise<Workspace[]> {
    const workspaceUsers = await db.workspaceUser.findMany({
      where: {
        userId,
        workspace: {
          tenantId,
          isActive: true,
        },
      },
      include: {
        workspace: true,
      },
    });

    return workspaceUsers.map((wu) => this.mapToWorkspace(wu.workspace));
  }

  /**
   * Check if user has access to workspace
   */
  async hasWorkspaceAccess(
    userId: string,
    workspaceId: string,
    tenantId: string
  ): Promise<boolean> {
    const workspaceUser = await db.workspaceUser.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!workspaceUser || workspaceUser.workspace.tenantId !== tenantId) {
      return false;
    }

    return workspaceUser.workspace.isActive;
  }

  /**
   * Get workspace by slug
   */
  async getWorkspaceBySlug(slug: string, tenantId: string): Promise<Workspace | null> {
    const workspace = await db.workspace.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
    });

    if (!workspace) {
      return null;
    }

    return this.mapToWorkspace(workspace);
  }

  /**
   * Map database record to Workspace
   */
  private mapToWorkspace(workspace: any): Workspace {
    return {
      id: workspace.id,
      tenant_id: workspace.tenantId,
      name: workspace.name,
      slug: workspace.slug,
      type: workspace.type as WorkspaceType,
      region: workspace.region || undefined,
      metadata: (workspace.metadata as Record<string, unknown>) || undefined,
      is_active: workspace.isActive,
      created_at: workspace.createdAt.toISOString(),
      updated_at: workspace.updatedAt.toISOString(),
    };
  }

  /**
   * Map database record to WorkspaceUser
   */
  private mapToWorkspaceUser(workspaceUser: any): WorkspaceUser {
    return {
      id: workspaceUser.id,
      workspace_id: workspaceUser.workspaceId,
      user_id: workspaceUser.userId,
      role: workspaceUser.role || undefined,
      permissions: (workspaceUser.permissions as string[]) || [],
      created_at: workspaceUser.createdAt.toISOString(),
      updated_at: workspaceUser.updatedAt.toISOString(),
    };
  }
}
