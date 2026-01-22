/**
 * Multimodal Detection API
 * 
 * Endpoints for synthetic media and deepfake detection
 * Includes SAFF, CM-GAN, and DINO v2 advanced models
 */

import { NextRequest, NextResponse } from "next/server";
import { MultimodalDetector } from "@/lib/monitoring/multimodal-detector";
import { logger } from "@/lib/logging/logger";

const detector = new MultimodalDetector();

/**
 * POST /api/ai/multimodal-detection/detect
 * Detect synthetic media
 */
export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
    const { action, type, url, text, file, frames } = body;

    if (action === "detect") {
      if (!type) {
        return NextResponse.json({ error: "Type is required" }, { status: 400 });
      }

      const detection = await detector.detectSynthetic({
        type,
        url,
        text,
        file: file ? new Blob([file]) : undefined,
      });

      return NextResponse.json(detection);
    }

    if (action === "saff") {
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
        frames,
      });

      return NextResponse.json(features);
    }

    if (action === "cmgan") {
      const features = await detector.extractCMGANFeatures({
        text,
        imageUrl: type === "image" ? url : undefined,
        videoUrl: type === "video" ? url : undefined,
        audioUrl: type === "audio" ? url : undefined,
      });

      return NextResponse.json(features);
    }

    if (action === "dinov2") {
      if (!url || type !== "image") {
        return NextResponse.json(
          { error: "DINO v2 requires image URL" },
          { status: 400 }
        );
      }

      const features = await detector.extractDINOv2Features(url, {
        patchSize: body.patchSize,
        numPatches: body.numPatches,
      });

      return NextResponse.json(features);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
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
    const { type, url, file, text, advanced } = body;

    if (!type || (type !== "image" && type !== "video")) {
      return NextResponse.json(
        { error: "Type must be 'image' or 'video'" },
        { status: 400 }
      );
    }

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
