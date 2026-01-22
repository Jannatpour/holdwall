/**
 * S3 Presigned URL API
 * 
 * Generates presigned URLs for secure file uploads to S3
 * This endpoint allows clients to upload files directly to S3 without exposing AWS credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const presignSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  contentType: z.string().optional(),
  expiresIn: z.number().optional().default(3600), // Default 1 hour
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const userId = (user as any).id;
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = presignSchema.parse(body);

    const storageProvider = process.env.FILE_STORAGE_PROVIDER || "s3";
    
    if (storageProvider !== "s3" && storageProvider !== "aws") {
      return NextResponse.json(
        { error: "Presigned URLs only supported for S3 storage" },
        { status: 400 }
      );
    }

    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.FILE_STORAGE_REGION || process.env.AWS_REGION || "us-east-1";

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      return NextResponse.json(
        { error: "AWS credentials not configured" },
        { status: 500 }
      );
    }

    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
        },
      });

      const command = new PutObjectCommand({
        Bucket: validated.bucket,
        Key: validated.key,
        ContentType: validated.contentType || "application/octet-stream",
        Metadata: {
          uploadedBy: userId,
          tenantId: tenantId,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Generate presigned URL (valid for specified duration)
      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: validated.expiresIn,
      });

      logger.info("Presigned URL generated", {
        userId,
        tenantId,
        bucket: validated.bucket,
        key: validated.key,
        expiresIn: validated.expiresIn,
      });

      return NextResponse.json({
        uploadUrl,
        bucket: validated.bucket,
        key: validated.key,
        expiresIn: validated.expiresIn,
        expiresAt: new Date(Date.now() + validated.expiresIn * 1000).toISOString(),
      });
    } catch (sdkError: any) {
      if (sdkError.code === "MODULE_NOT_FOUND" || sdkError.message?.includes("Cannot find module")) {
        logger.warn("AWS SDK not installed for presigned URL generation", {
          note: "Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner",
        });
        return NextResponse.json(
          {
            error: "S3 presigned URL support requires AWS SDK",
            note: "Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner",
          },
          { status: 503 }
        );
      }
      throw sdkError;
    }
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Presigned URL generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
