/**
 * Environment Parity Check API
 * 
 * Check staging/production environment parity and contracts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { checkStagingParity, getEnvironmentContract, detectEnvironment } from "@/lib/environment/staging-parity";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN"); // Only admins can check parity
    const parityResult = await checkStagingParity();
    const contract = getEnvironmentContract();
    const detectedEnv = detectEnvironment();

    return NextResponse.json({
      environment: {
        detected: detectedEnv,
        contract: contract,
      },
      parity: parityResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Failed to check environment parity", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
