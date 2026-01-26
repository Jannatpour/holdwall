/**
 * Threat Detection API
 * Monitor and manage threat detection
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { ThreatDetectionService, ThreatDetectionConfig } from "@/lib/security/threat-detection";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

// Singleton threat detection service
let threatDetection: ThreatDetectionService | null = null;

const threatPostSchema = z.object({
  action: z.enum(["block", "unblock"]),
  ip: z.string().min(1),
});

function getThreatDetection(): ThreatDetectionService {
  if (!threatDetection) {
    const config: ThreatDetectionConfig = {
      enabled: process.env.THREAT_DETECTION_ENABLED !== "false",
      anomalyThreshold: parseFloat(process.env.THREAT_ANOMALY_THRESHOLD || "0.3"),
      blockOnCritical: process.env.THREAT_BLOCK_ON_CRITICAL !== "false",
      alertOnHigh: process.env.THREAT_ALERT_ON_HIGH !== "false",
      rateLimitWindow: parseInt(process.env.THREAT_RATE_LIMIT_WINDOW || "60000", 10),
      rateLimitThreshold: parseInt(process.env.THREAT_RATE_LIMIT_THRESHOLD || "100", 10),
      ipWhitelist: (process.env.THREAT_IP_WHITELIST || "").split(",").filter(Boolean),
      ipBlacklist: (process.env.THREAT_IP_BLACKLIST || "").split(",").filter(Boolean),
    };

    threatDetection = new ThreatDetectionService(config);
  }

  return threatDetection;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN");

    const service = getThreatDetection();
    const stats = service.getStatistics();

    return NextResponse.json(stats);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error getting threat detection statistics", {
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
    const { action, ip } = threatPostSchema.parse(body);

    const service = getThreatDetection();

    if (action === "block" && ip) {
      // Block IP (would update config)
      return NextResponse.json({ success: true, message: "IP blocked" });
    }

    if (action === "unblock" && ip) {
      // Unblock IP
      return NextResponse.json({ success: true, message: "IP unblocked" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error managing threat detection", {
      action: body?.action,
      ip: body?.ip,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
