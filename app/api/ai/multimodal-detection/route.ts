/**
 * Multimodal Detection API
 * 
 * Endpoints for synthetic media and deepfake detection
 * Includes SAFF, CM-GAN, and DINO v2 advanced models
 */

import { NextRequest, NextResponse } from "next/server";
import { MultimodalDetector } from "@/lib/monitoring/multimodal-detector";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const detector = new MultimodalDetector();

const framesSchema = z.array(
  z.object({
    timestamp: z.number(),
    data: z.string().min(1), // base64 or raw string; converted to Blob for detector
  })
);

const multimodalDetectSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("detect"),
    type: z.enum(["text", "image", "video", "audio"]),
    url: z.string().url().optional(),
    text: z.string().optional(),
    file: z.string().optional(), // base64/raw; passed as BlobPart
  }).refine((v) => !!v.url || !!v.text || !!v.file, {
    message: "Provide at least one of url, text, or file for detect",
    path: ["url"],
  }),
  z.object({
    action: z.literal("saff"),
    type: z.enum(["video", "audio"]),
    url: z.string().url().optional(),
    file: z.string().optional(),
    frames: framesSchema.optional(),
  }).refine((v) => !!v.url || !!v.file, {
    message: "Provide url or file for saff",
    path: ["url"],
  }),
  z.object({
    action: z.literal("cmgan"),
    type: z.enum(["image", "video", "audio", "text"]).optional(),
    url: z.string().url().optional(),
    text: z.string().optional(),
  }).refine((v) => !!v.text || !!v.url, {
    message: "Provide text and/or url for cmgan",
    path: ["text"],
  }),
  z.object({
    action: z.literal("dinov2"),
    type: z.literal("image"),
    url: z.string().url(),
    patchSize: z.number().int().positive().optional(),
    numPatches: z.number().int().positive().optional(),
  }),
]);

const deepfakeSchema = z
  .object({
    type: z.enum(["image", "video"]),
    url: z.string().url().optional(),
    file: z.string().optional(), // base64/raw; passed as BlobPart
    text: z.string().optional(),
    advanced: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.url && !val.file) {
      ctx.addIssue({ code: "custom", message: "Provide url or file", path: ["url"] });
    }
  });

/**
 * POST /api/ai/multimodal-detection/detect
 * Detect synthetic media
 * 
 * Note: This endpoint may be intentionally public for certain AI model access patterns
 * Consider adding authentication if this should be restricted
 */
export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
    const validated = multimodalDetectSchema.parse(body);
    const { action } = validated;

    if (action === "detect") {
      const { type, url, text, file } = validated;
      const detection = await detector.detectSynthetic({
        type,
        url,
        text,
        file: file ? new Blob([file]) : undefined,
      });

      return NextResponse.json(detection);
    }

    if (action === "saff") {
      const { type, url, file, frames } = validated;
      if (!type || (type !== "video" && type !== "audio")) {
        return NextResponse.json(
          { error: "Type must be 'video' or 'audio' for SAFF" },
          { status: 400 }
        );
      }

      const features = await detector.extractSAFFFeatures({
        type,
        url,
        file: file ? new Blob([file]) : undefined,
        frames: frames?.map((f) => ({
          timestamp: f.timestamp,
          data: new Blob([f.data]),
        })),
      });

      return NextResponse.json(features);
    }

    if (action === "cmgan") {
      const { type, url, text } = validated;
      const features = await detector.extractCMGANFeatures({
        text,
        imageUrl: type === "image" ? url : undefined,
        videoUrl: type === "video" ? url : undefined,
        audioUrl: type === "audio" ? url : undefined,
      });

      return NextResponse.json(features);
    }

    if (action === "dinov2") {
      const { url, patchSize, numPatches } = validated;
      const features = await detector.extractDINOv2Features(url, {
        patchSize: validated.patchSize,
        numPatches: validated.numPatches,
      });

      return NextResponse.json(features);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Error in multimodal detection", {
      action: body?.action,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/multimodal-detection/deepfake
 * Detect deepfake specifically (basic)
 */
export async function PUT(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
    const validated = deepfakeSchema.parse(body);
    const { type, url, file, text, advanced } = validated;

    // Use advanced detection if requested
    if (advanced) {
      const detection = await detector.detectDeepfakeAdvanced({
        type,
        url,
        file: file ? new Blob([file]) : undefined,
        text,
      });

      return NextResponse.json(detection);
    }

    // Basic detection
    const detection = await detector.detectDeepfake({
      type,
      url,
      file: file ? new Blob([file]) : undefined,
    });

    return NextResponse.json(detection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Error in deepfake detection", {
      type: body?.type,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
