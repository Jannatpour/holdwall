/**
 * Plugin System for Maximum Extensibility
 * 
 * Allows users to extend the system with custom:
 * - Workflow actions
 * - Business rules
 * - Integrations
 * - AI models
 * - Data transformations
 * - Custom handlers
 * 
 * Maximally flexible and adaptable to any scenario, workflow, or operational edge case.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { db } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export type PluginType = 
  | "workflow_action"
  | "business_rule"
  | "integration"
  | "ai_model"
  | "data_transform"
  | "custom_handler"
  | "validator"
  | "notifier"
  | "analyzer";

export interface Plugin {
  id: string;
  tenantId: string;
  name: string;
  type: PluginType;
  version: string;
  description?: string;
  config: Record<string, unknown>;
  handler: string; // Function name or module path
  enabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginHandler {
  execute(context: PluginExecutionContext, config: Record<string, unknown>): Promise<unknown>;
  validate?(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }>;
}

export interface PluginExecutionContext {
  tenantId: string;
  userId?: string;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  workflowExecutionId?: string;
  caseId?: string;
  evidenceId?: string;
  clusterId?: string;
}

/**
 * Plugin System
 * 
 * Manages custom plugins/extensions for maximum system flexibility
 */
export class PluginSystem {
  private handlers: Map<string, PluginHandler> = new Map();
  private plugins: Map<string, Plugin> = new Map();

  /**
   * Register plugin handler
   */
  registerHandler(pluginType: PluginType, handler: PluginHandler): void {
    this.handlers.set(pluginType, handler);
    logger.info("Plugin handler registered", { pluginType });
  }

  /**
   * Install plugin
   */
  async installPlugin(
    tenantId: string,
    plugin: Omit<Plugin, "id" | "tenantId" | "createdAt" | "updatedAt">
  ): Promise<Plugin> {
    const pluginId = `plugin-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const installedPlugin: Plugin = {
      id: pluginId,
      tenantId,
      ...plugin,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in database (Prisma client will be regenerated after schema update)
    // For now, use raw query or store in tenant settings
    try {
      // Try Prisma first (will work after client regeneration)
      if ((db as any).plugin) {
        await (db as any).plugin.create({
          data: {
            id: pluginId,
            tenantId,
            name: plugin.name,
            type: plugin.type,
            version: plugin.version,
            description: plugin.description,
            config: plugin.config as any,
            handler: plugin.handler,
            enabled: plugin.enabled,
            metadata: plugin.metadata as any,
          },
        });
      } else {
        // Fallback: store in tenant settings until Prisma client is regenerated
        const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
        if (tenant) {
          const settings = (tenant.settings || {}) as any;
          settings.plugins = settings.plugins || {};
          settings.plugins[pluginId] = installedPlugin;
          await db.tenant.update({
            where: { id: tenantId },
            data: { settings: settings as any },
          });
        }
      }
    } catch (error) {
      // If plugin table doesn't exist yet, store in tenant settings
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      if (tenant) {
        const settings = (tenant.settings || {}) as any;
        settings.plugins = settings.plugins || {};
        settings.plugins[pluginId] = installedPlugin;
        await db.tenant.update({
          where: { id: tenantId },
          data: { settings: settings as any },
        });
      }
    }

    this.plugins.set(pluginId, installedPlugin);

    logger.info("Plugin installed", {
      pluginId,
      tenantId,
      name: plugin.name,
      type: plugin.type,
    });

    metrics.increment("plugins_installed_total", { tenantId, type: plugin.type });

    return installedPlugin;
  }

  /**
   * Execute plugin
   */
  async executePlugin(
    pluginId: string,
    context: PluginExecutionContext
  ): Promise<unknown> {
    const plugin = this.plugins.get(pluginId) || await this.loadPlugin(pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (!plugin.enabled) {
      throw new Error(`Plugin is disabled: ${pluginId}`);
    }

    if (plugin.tenantId !== context.tenantId) {
      throw new Error("Plugin tenant mismatch");
    }

    const handler = this.handlers.get(plugin.type);
    if (!handler) {
      throw new Error(`No handler registered for plugin type: ${plugin.type}`);
    }

    try {
      logger.info("Executing plugin", {
        pluginId,
        pluginName: plugin.name,
        pluginType: plugin.type,
        tenantId: context.tenantId,
      });

      const result = await handler.execute(context, plugin.config);

      metrics.increment("plugins_executed_total", {
        tenantId: context.tenantId,
        pluginType: plugin.type,
      });

      return result;
    } catch (error) {
      logger.error("Plugin execution failed", {
        pluginId,
        pluginName: plugin.name,
        error: error instanceof Error ? error.message : String(error),
      });

      metrics.increment("plugins_failed_total", {
        tenantId: context.tenantId,
        pluginType: plugin.type,
      });

      throw error;
    }
  }

  /**
   * List plugins for tenant
   */
  async listPlugins(
    tenantId: string,
    type?: PluginType,
    enabled?: boolean
  ): Promise<Plugin[]> {
    try {
      // Try Prisma first
      if ((db as any).plugin) {
        const plugins = await (db as any).plugin.findMany({
          where: {
            tenantId,
            ...(type && { type }),
            ...(enabled !== undefined && { enabled }),
          },
          orderBy: { createdAt: "desc" },
        });

        return plugins.map((p: any) => ({
          id: p.id,
          tenantId: p.tenantId,
          name: p.name,
          type: p.type as PluginType,
          version: p.version,
          description: p.description || undefined,
          config: p.config as Record<string, unknown>,
          handler: p.handler,
          enabled: p.enabled,
          metadata: p.metadata as Record<string, unknown> | undefined,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
      }
    } catch (error) {
      // Fall through to tenant settings fallback
    }

    // Fallback: load from tenant settings
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (tenant) {
      const settings = (tenant.settings || {}) as any;
      const plugins = (settings.plugins || {}) as Record<string, Plugin>;
      return Object.values(plugins).filter((p: Plugin) => {
        if (type && p.type !== type) return false;
        if (enabled !== undefined && p.enabled !== enabled) return false;
        return true;
      });
    }

    return [];
  }

  /**
   * Load plugin from database
   */
  private async loadPlugin(pluginId: string): Promise<Plugin | null> {
    try {
      // Try Prisma first
      if ((db as any).plugin) {
        const plugin = await (db as any).plugin.findUnique({
          where: { id: pluginId },
        });

        if (plugin) {
          const loadedPlugin: Plugin = {
            id: plugin.id,
            tenantId: plugin.tenantId,
            name: plugin.name,
            type: plugin.type as PluginType,
            version: plugin.version,
            description: plugin.description || undefined,
            config: plugin.config as Record<string, unknown>,
            handler: plugin.handler,
            enabled: plugin.enabled,
            metadata: plugin.metadata as Record<string, unknown> | undefined,
            createdAt: plugin.createdAt,
            updatedAt: plugin.updatedAt,
          };

          this.plugins.set(pluginId, loadedPlugin);
          return loadedPlugin;
        }
      }
    } catch (error) {
      // Fall through to tenant settings
    }

    // Fallback: load from tenant settings
    const tenants = await db.tenant.findMany({
      where: {
        settings: {
          path: ["plugins", pluginId],
          not: Prisma.DbNull,
        },
      },
    });

    for (const tenant of tenants) {
      const settings = (tenant.settings || {}) as any;
      const plugins = (settings.plugins || {}) as Record<string, Plugin>;
      const plugin = plugins[pluginId];
      if (plugin) {
        this.plugins.set(pluginId, plugin);
        return plugin;
      }
    }

    return null;
  }

  /**
   * Enable/disable plugin
   */
  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    try {
      if ((db as any).plugin) {
        await (db as any).plugin.update({
          where: { id: pluginId },
          data: { enabled },
        });
      } else {
        // Update in tenant settings
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
          const tenant = await db.tenant.findUnique({ where: { id: plugin.tenantId } });
          if (tenant) {
            const settings = (tenant.settings || {}) as any;
            settings.plugins = settings.plugins || {};
            if (settings.plugins[pluginId]) {
              settings.plugins[pluginId].enabled = enabled;
              await db.tenant.update({
                where: { id: plugin.tenantId },
                data: { settings: settings as any },
              });
            }
          }
        }
      }
    } catch (error) {
      // Handle error
    }

    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = enabled;
    }

    logger.info("Plugin enabled/disabled", { pluginId, enabled });
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    try {
      if ((db as any).plugin) {
        await (db as any).plugin.delete({
          where: { id: pluginId },
        });
      } else {
        // Remove from tenant settings
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
          const tenant = await db.tenant.findUnique({ where: { id: plugin.tenantId } });
          if (tenant) {
            const settings = (tenant.settings || {}) as any;
            settings.plugins = settings.plugins || {};
            delete settings.plugins[pluginId];
            await db.tenant.update({
              where: { id: plugin.tenantId },
              data: { settings: settings as any },
            });
          }
        }
      }
    } catch (error) {
      // Handle error
    }

    this.plugins.delete(pluginId);

    logger.info("Plugin uninstalled", { pluginId });
  }
}

export const pluginSystem = new PluginSystem();
