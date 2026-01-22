/**
 * File Upload API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { FileUploadService } from "@/lib/file/upload";
import { logger } from "@/lib/logging/logger";

const uploadService = new FileUploadService();

export async function POST(request: NextRequest) {
  let file: File | null = null;
  try {
    const user = await requireAuth();
    const formData = await request.formData();
    file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const result = await uploadService.processUpload(file);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ file_id: result.file_id });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error uploading file", {
      fileName: file?.name,
      fileSize: file?.size,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
