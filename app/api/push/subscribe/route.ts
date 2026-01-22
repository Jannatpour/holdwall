/**
 * Push Notification Subscription API
 * Handles push notification subscription and unsubscription
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const userId = (user as any).id || "";

    const body = await request.json();
    const validated = subscribeSchema.parse(body);

    // Store subscription in database
    // Note: Requires PushSubscription model in Prisma schema
    // Run: npx prisma migrate dev --name add_push_subscriptions
    const subscription = await (db as any).pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: validated.endpoint,
        },
      },
      create: {
        userId,
        tenantId,
        endpoint: validated.endpoint,
        p256dhKey: validated.keys.p256dh,
        authKey: validated.keys.auth,
        enabled: true,
      },
      update: {
        p256dhKey: validated.keys.p256dh,
        authKey: validated.keys.auth,
        enabled: true,
        updatedAt: new Date(),
      },
    });

    logger.info("Push subscription created", { userId, endpoint: validated.endpoint });

    return NextResponse.json({ success: true });
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

    logger.error("Push subscription error", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const userId = (user as any).id || "";

    const body = await request.json();
    const endpoint = body.endpoint;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint required" },
        { status: 400 }
      );
    }

    // Delete subscription
    await (db as any).pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });

    logger.info("Push subscription deleted", { userId, endpoint });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Push unsubscription error", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
