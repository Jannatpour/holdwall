/**
 * Load Balancer API
 * Manage dynamic load balancing and auto-scaling
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { DynamicLoadBalancer, LoadBalancingConfig, AutoScalingPolicy } from "@/lib/load-balancing/distributor";
import { logger } from "@/lib/logging/logger";

// Singleton load balancer instance
let loadBalancer: DynamicLoadBalancer | null = null;

function getLoadBalancer(): DynamicLoadBalancer {
  if (!loadBalancer) {
    const config: LoadBalancingConfig = {
      strategy: (process.env.LB_STRATEGY as any) || "least-connections",
      healthCheckInterval: parseInt(process.env.LB_HEALTH_CHECK_INTERVAL || "30000", 10),
      healthCheckTimeout: parseInt(process.env.LB_HEALTH_CHECK_TIMEOUT || "5000", 10),
      maxRetries: 3,
      retryBackoff: 1000,
      enableAutoScaling: process.env.LB_AUTO_SCALING === "true",
      autoScalingPolicy: process.env.LB_AUTO_SCALING === "true" ? {
        minInstances: parseInt(process.env.LB_MIN_INSTANCES || "2", 10),
        maxInstances: parseInt(process.env.LB_MAX_INSTANCES || "10", 10),
        targetLoad: parseFloat(process.env.LB_TARGET_LOAD || "0.7"),
        scaleUpThreshold: parseFloat(process.env.LB_SCALE_UP_THRESHOLD || "0.8"),
        scaleDownThreshold: parseFloat(process.env.LB_SCALE_DOWN_THRESHOLD || "0.3"),
        scaleUpCooldown: parseInt(process.env.LB_SCALE_UP_COOLDOWN || "300000", 10),
        scaleDownCooldown: parseInt(process.env.LB_SCALE_DOWN_COOLDOWN || "600000", 10),
        scaleUpStep: parseInt(process.env.LB_SCALE_UP_STEP || "2", 10),
        scaleDownStep: parseInt(process.env.LB_SCALE_DOWN_STEP || "1", 10),
      } : undefined,
    };

    loadBalancer = new DynamicLoadBalancer(config);
  }

  return loadBalancer;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("VIEWER");

    const balancer = getLoadBalancer();
    const status = balancer.getStatus();

    return NextResponse.json(status);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error getting load balancer status", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    await requireAuth();
    await requireRole("ADMIN");

    body = await request.json();
    const { action, instance } = body;

    const balancer = getLoadBalancer();

    if (action === "register" && instance) {
      balancer.registerInstance(instance);
      return NextResponse.json({ success: true, message: "Instance registered" });
    }

    if (action === "unregister" && instance?.id) {
      balancer.unregisterInstance(instance.id);
      return NextResponse.json({ success: true, message: "Instance unregistered" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error managing load balancer", {
      action: body?.action,
      instance: body?.instance,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
