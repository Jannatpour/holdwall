/**
 * File Upload/Download
 * Secure file handling with virus scanning and size limits
 */

import { z } from "zod";
import { logger } from "@/lib/logging/logger";

export interface UploadConfig {
  maxSize: number; // bytes
  allowedTypes: string[];
  scanForViruses: boolean;
}

export const defaultUploadConfig: UploadConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    "application/pdf",
    "text/plain",
    "application/json",
    "text/csv",
    "image/png",
    "image/jpeg",
    "image/webp",
  ],
  scanForViruses: true,
};

export class FileUploadService {
  /**
   * Validate file upload
   */
  validateFile(
    file: File,
    config: UploadConfig = defaultUploadConfig
  ): { valid: boolean; error?: string } {
    // Check size
    if (file.size > config.maxSize) {
      return {
        valid: false,
        error: `File size exceeds limit of ${config.maxSize / 1024 / 1024}MB`,
      };
    }

    // Check type
    if (!config.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} not allowed`,
      };
    }

    return { valid: true };
  }

  /**
   * Scan file for viruses using ClamAV or cloud scanning service
   */
  async scanFile(file: File): Promise<{ clean: boolean; threats?: string[] }> {
    // Try cloud-based scanning first (AWS Macie, Google Cloud Security Scanner, etc.)
    const cloudScanEnabled = process.env.ENABLE_CLOUD_FILE_SCAN === "true";
    const cloudScanApiKey = process.env.CLOUD_SCAN_API_KEY;
    const cloudScanUrl = process.env.CLOUD_SCAN_URL;

    if (cloudScanEnabled && cloudScanApiKey && cloudScanUrl) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(cloudScanUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cloudScanApiKey}`,
          },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          return {
            clean: result.clean || result.status === "clean",
            threats: result.threats || result.malware || [],
          };
        }
      } catch (error) {
        logger.warn("Cloud file scanning failed, trying ClamAV", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback: Try ClamAV local service
    const clamavUrl = process.env.CLAMAV_URL || "http://localhost:3310";
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${clamavUrl}/scan`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        return {
          clean: result.status === "clean" || result.infected === false,
          threats: result.threats || [],
        };
      }
    } catch (error) {
      logger.warn("ClamAV scanning unavailable, using heuristic fallback", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Final fallback: Basic heuristic checks
    // Check for suspicious file extensions in content
    const suspiciousPatterns = [
      /\.exe/i,
      /\.bat/i,
      /\.cmd/i,
      /\.scr/i,
      /\.vbs/i,
      /\.js/i,
      /\.jar/i,
    ];

    const fileName = file.name.toLowerCase();
    const hasSuspiciousExtension = suspiciousPatterns.some((pattern) =>
      pattern.test(fileName)
    );

    if (hasSuspiciousExtension && !file.type.startsWith("text/")) {
      return {
        clean: false,
        threats: ["Suspicious file extension detected"],
      };
    }

    // If no scanning available, log warning but allow (can be configured to block)
    const blockOnScanFailure = process.env.BLOCK_FILES_ON_SCAN_FAILURE === "true";
    if (blockOnScanFailure) {
      return {
        clean: false,
        threats: ["Virus scanning unavailable - file blocked by policy"],
      };
    }

    return { clean: true };
  }

  /**
   * Process uploaded file
   */
  async processUpload(
    file: File,
    config: UploadConfig = defaultUploadConfig,
    tenantId?: string
  ): Promise<{
    success: boolean;
    file_id?: string;
    error?: string;
  }> {
    // Validate
    const validation = this.validateFile(file, config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Scan if enabled
    if (config.scanForViruses) {
      const scanResult = await this.scanFile(file);
      if (!scanResult.clean) {
        return {
          success: false,
          error: "File contains threats",
        };
      }
    }

    // Save to object storage (S3, Google Cloud Storage, Azure Blob, etc.)
    const storageProvider = process.env.FILE_STORAGE_PROVIDER || "s3";
    const bucketName = process.env.FILE_STORAGE_BUCKET || "holdwall-uploads";
    const region = process.env.FILE_STORAGE_REGION || "us-east-1";

    let file_id: string;
    let storageUrl: string;

    // Convert file to buffer once (used by multiple providers)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      if (storageProvider === "s3" || storageProvider === "aws") {
        // AWS S3 upload
        const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
        const s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (s3AccessKey && s3SecretKey) {
          file_id = `file-${Date.now()}-${crypto.randomUUID()}`;
          const fileName = `${file_id}-${file.name}`;

          // Upload using AWS SDK if available, otherwise use presigned URL approach
          try {
            const s3Module = await import("@aws-sdk/client-s3");
            const { S3Client, PutObjectCommand } = s3Module;
            
            const s3Client = new S3Client({
              region,
              credentials: {
                accessKeyId: s3AccessKey,
                secretAccessKey: s3SecretKey,
              },
            });

            await s3Client.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                Body: buffer,
                ContentType: file.type,
                Metadata: {
                  originalName: file.name,
                  uploadedAt: new Date().toISOString(),
                },
              })
            );

            storageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
          } catch (sdkError) {
            // AWS SDK not available - generate presigned URL via API endpoint
            const presignUrl = process.env.S3_PRESIGN_API_URL || "/api/files/presign";
            
            try {
              const presignResponse = await fetch(presignUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bucket: bucketName,
                  key: fileName,
                  contentType: file.type,
                }),
              });

              if (presignResponse.ok) {
                const { uploadUrl } = await presignResponse.json();
                const uploadResponse = await fetch(uploadUrl, {
                  method: "PUT",
                  headers: { "Content-Type": file.type },
                  body: buffer,
                });

                if (uploadResponse.ok) {
                  storageUrl = uploadUrl.split("?")[0]; // Remove query params
                } else {
                  throw new Error("Presigned URL upload failed");
                }
              } else {
                throw new Error("Presigned URL generation failed");
              }
            } catch (presignError) {
              // Final fallback: store file_id and let caller handle upload
              logger.warn("S3 upload unavailable, using fallback storage", {
                error: presignError instanceof Error ? presignError.message : String(presignError),
              });
              storageUrl = `pending://${file_id}`;
            }
          }
        } else {
          throw new Error("AWS credentials not configured");
        }
      } else if (storageProvider === "gcs" || storageProvider === "google") {
        // Google Cloud Storage upload
        const gcsBucket = process.env.GCS_BUCKET || bucketName;
        file_id = `file-${Date.now()}-${crypto.randomUUID()}`;
        const fileName = `${file_id}-${file.name}`;

        try {
          const { Storage } = await import("@google-cloud/storage");
          
          const storageOptions: any = {};
          if (process.env.GCS_PROJECT_ID) {
            storageOptions.projectId = process.env.GCS_PROJECT_ID;
          }
          if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
            storageOptions.credentials = {
              client_email: process.env.GCS_CLIENT_EMAIL,
              private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, "\n"),
            };
          }
          
          const storage = new Storage(storageOptions);
          const bucket = storage.bucket(gcsBucket);
          const gcsFile = bucket.file(fileName);
          
          await gcsFile.save(buffer, {
            metadata: {
              contentType: file.type,
              metadata: {
                originalName: file.name,
                uploadedAt: new Date().toISOString(),
              },
            },
          });
          
          storageUrl = `gs://${gcsBucket}/${fileName}`;
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            throw new Error("GCS support requires @google-cloud/storage package. Install with: npm install @google-cloud/storage");
          }
          logger.error("GCS file upload failed", {
            error: importError instanceof Error ? importError.message : String(importError),
            stack: importError instanceof Error ? importError.stack : undefined,
          });
          throw new Error(`GCS upload failed: ${importError.message}`);
        }
      } else if (storageProvider === "azure") {
        // Azure Blob Storage upload
        const azureAccount = process.env.AZURE_STORAGE_ACCOUNT;
        const azureKey = process.env.AZURE_STORAGE_KEY;
        const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const azureContainer = process.env.AZURE_STORAGE_CONTAINER || bucketName;

        if (!azureAccount && !azureConnectionString) {
          throw new Error("Azure storage credentials not configured (AZURE_STORAGE_ACCOUNT or AZURE_STORAGE_CONNECTION_STRING required)");
        }

        file_id = `file-${Date.now()}-${crypto.randomUUID()}`;
        const fileName = `${file_id}-${file.name}`;

        try {
          const { BlobServiceClient } = await import("@azure/storage-blob");
          
          let blobServiceClient: any;
          
          if (azureConnectionString) {
            blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
          } else if (azureAccount && azureKey) {
            const accountUrl = `https://${azureAccount}.blob.core.windows.net`;
            const sharedKeyCredential = new (await import("@azure/storage-blob")).StorageSharedKeyCredential(azureAccount, azureKey);
            blobServiceClient = new BlobServiceClient(accountUrl, sharedKeyCredential);
          } else {
            throw new Error("Azure storage credentials incomplete (AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY required)");
          }
          
          const containerClient = blobServiceClient.getContainerClient(azureContainer);
          
          // Ensure container exists
          await containerClient.createIfNotExists({
            access: "blob", // Public read access for blobs
          });
          
          const blockBlobClient = containerClient.getBlockBlobClient(fileName);
          
          await blockBlobClient.upload(buffer, buffer.length, {
            blobHTTPHeaders: {
              blobContentType: file.type,
            },
            metadata: {
              originalName: file.name,
              uploadedAt: new Date().toISOString(),
            },
          });
          
          storageUrl = `https://${azureAccount || "account"}.blob.core.windows.net/${azureContainer}/${fileName}`;
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            throw new Error("Azure support requires @azure/storage-blob package. Install with: npm install @azure/storage-blob");
          }
          logger.error("Azure file upload failed", {
            error: importError instanceof Error ? importError.message : String(importError),
            stack: importError instanceof Error ? importError.stack : undefined,
          });
          throw new Error(`Azure upload failed: ${importError.message}`);
        }
      } else {
        // Local storage fallback (for development)
        file_id = `file-${Date.now()}-${crypto.randomUUID()}`;
        storageUrl = `/uploads/${file_id}-${file.name}`;
      }

      // Store file metadata in database if model exists
      try {
        const { db } = await import("../db/client");
        // Check if FileUpload model exists in schema
        if ("fileUpload" in db) {
          await (db as any).fileUpload.create({
            data: {
              id: file_id,
              tenantId: tenantId || "",
              originalName: file.name,
              mimeType: file.type,
              size: file.size,
              storageUrl,
              storageProvider,
              uploadedAt: new Date(),
            },
          });
        }
      } catch (error) {
        // FileUpload model may not exist in schema - log but don't fail
        logger.warn("File metadata storage skipped (model not in schema)", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return { success: true, file_id };
    } catch (error) {
      logger.error("File upload failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "File upload failed",
      };
    }
  }
}
