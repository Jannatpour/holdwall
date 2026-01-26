/**
 * Backup and Disaster Recovery
 * Automated backup procedures and disaster recovery
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface BackupConfig {
  schedule: "daily" | "weekly" | "monthly";
  retentionDays: number;
  storageProvider: "s3" | "gcs" | "azure" | "local";
  encryption: boolean;
  compression: boolean;
}

export interface BackupResult {
  backupId: string;
  timestamp: string;
  size: number;
  location: string;
  status: "success" | "failed";
  error?: string;
}

export class BackupService {
  /**
   * Create database backup
   */
  async createBackup(
    tenantId?: string,
    config?: Partial<BackupConfig>
  ): Promise<BackupResult> {
    const backupId = `backup-${Date.now()}-${crypto.randomUUID()}`;
    const startTime = Date.now();

    try {
      // Export database data
      const data = await this.exportDatabaseData(tenantId);

      // Compress if enabled (returns base64 string)
      let processed: string = data;
      if (config?.compression !== false) {
        processed = await this.compressData(data);
      }

      // Encrypt if enabled (expects string, returns base64 string with IV:authTag:encrypted format)
      let finalData: string;
      if (config?.encryption !== false) {
        // Encrypt the processed data (compressed base64 or plain JSON)
        finalData = await this.encryptData(processed);
      } else {
        // If encryption disabled, use processed data
        // If compressed, it's base64. If not compressed, it's plain JSON.
        finalData = processed;
      }

      // Upload to storage
      // finalData is either:
      // - base64 encrypted string (IV:authTag:encrypted format) if encryption enabled
      // - base64 compressed string if compression enabled but encryption disabled
      // - plain JSON string if both disabled
      const location = await this.uploadBackup(
        backupId,
        finalData,
        config?.storageProvider || "s3"
      );

      const duration = Date.now() - startTime;
      // Calculate size from final data
      // If it's base64 (encrypted or compressed), decode first. Otherwise use string length.
      let size: number;
      try {
        // Try to decode as base64 - if it works, it's base64 encoded
        const decoded = Buffer.from(finalData, "base64");
        size = decoded.length;
      } catch {
        // If base64 decode fails, it's plain text
        size = Buffer.from(finalData, "utf-8").length;
      }

      logger.info("Backup created", {
        backupId,
        tenantId,
        size,
        location,
        duration,
      });

      metrics.increment("backups_created_total");
      metrics.observe("backup_duration_ms", duration);
      metrics.observe("backup_size_bytes", size);

      // Store backup metadata in Event table
      // Note: In production, consider using a dedicated Backup table for better querying and indexing
      try {
        await db.event.create({
          data: {
            id: `backup-metadata-${backupId}`,
            tenantId: tenantId || "system",
            actorId: "backup-service",
            type: "backup.created",
            occurredAt: new Date(),
            correlationId: backupId,
            causationId: undefined,
            schemaVersion: "1.0",
            payload: {
              backupId,
              timestamp: new Date().toISOString(),
              size,
              location,
              status: "success",
              tenantId,
              compression: config?.compression !== false,
              encryption: config?.encryption !== false,
              storageProvider: config?.storageProvider || "s3",
            } as any,
            signatures: [],
            metadata: {
              backupId,
              location,
              size,
              storageProvider: config?.storageProvider || "s3",
            } as any,
          },
        });
      } catch (error) {
        // Non-critical - log but don't fail
        logger.warn("Failed to store backup metadata", { error, backupId });
      }

      return {
        backupId,
        timestamp: new Date().toISOString(),
        size,
        location,
        status: "success",
      };
    } catch (error) {
      metrics.increment("backup_errors_total");
      logger.error("Backup creation failed", { error, backupId, tenantId });

      return {
        backupId,
        timestamp: new Date().toISOString(),
        size: 0,
        location: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Backup failed",
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(
    backupId: string,
    tenantId?: string,
    location?: string
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();

    try {
      // Get backup location if not provided
      let backupLocation = location;
      if (!backupLocation) {
        // Fetch from stored metadata
        try {
          const metadataEvent = await db.event.findUnique({
            where: { id: `backup-metadata-${backupId}` },
          });

          if (metadataEvent && metadataEvent.metadata) {
            const metadata = metadataEvent.metadata as any;
            backupLocation = metadata.location;
          } else {
            // Fallback: try to find by correlationId
            const event = await db.event.findFirst({
              where: {
                correlationId: backupId,
                type: "backup.created",
              },
              orderBy: { occurredAt: "desc" },
            });

            if (event && event.metadata) {
              const metadata = event.metadata as any;
              backupLocation = metadata.location;
            } else {
              // Final fallback
              backupLocation = `/backups/${backupId}.backup`;
            }
          }
        } catch (error) {
          logger.warn("Failed to fetch backup location from metadata", { error, backupId });
          backupLocation = `/backups/${backupId}.backup`;
        }
      }

      // Download backup (returns base64 string)
      const resolvedLocation = backupLocation || `/backups/${backupId}.backup`;
      const backupData = await this.downloadBackup(backupId, resolvedLocation);

      // Get backup metadata to know if it was encrypted/compressed
      let wasEncrypted = true;
      let wasCompressed = true;
      try {
        const metadataEvent = await db.event.findUnique({
          where: { id: `backup-metadata-${backupId}` },
        });
        if (metadataEvent && metadataEvent.payload) {
          const payload = metadataEvent.payload as any;
          wasEncrypted = payload.encryption !== false;
          wasCompressed = payload.compression !== false;
        }
      } catch (error) {
        logger.warn("Could not determine backup encryption/compression status", { error, backupId });
      }

      // Decrypt (if encrypted)
      let decrypted: string = backupData;
      if (wasEncrypted) {
        try {
          decrypted = await this.decryptData(backupData);
        } catch (error) {
          logger.error("Backup decryption failed", { error, backupId });
          throw new Error("Failed to decrypt backup data");
        }
      }

      // Decompress (if compressed)
      let decompressed: string = decrypted;
      if (wasCompressed) {
        try {
          decompressed = await this.decompressData(decrypted);
        } catch (error) {
          logger.error("Backup decompression failed", { error, backupId });
          throw new Error("Failed to decompress backup data");
        }
      }

      // Restore to database
      await this.importDatabaseData(decompressed, tenantId);

      const duration = Date.now() - startTime;

      logger.info("Backup restored", {
        backupId,
        tenantId,
        duration,
      });

      metrics.increment("backups_restored_total");
      metrics.observe("restore_duration_ms", duration);

      return { success: true };
    } catch (error) {
      metrics.increment("restore_errors_total");
      logger.error("Backup restore failed", { error, backupId, tenantId });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Restore failed",
      };
    }
  }

  /**
   * Export database data
   */
  private async exportDatabaseData(tenantId?: string): Promise<string> {
    const data: Record<string, any[]> = {};

    const where = tenantId ? { tenantId } : {};

    // Export all key tables
    data.claims = await db.claim.findMany({
      where,
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
    });

    data.evidence = await db.evidence.findMany({
      where,
    });

    data.artifacts = await db.aAALArtifact.findMany({
      where,
      include: {
        approvals: true,
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
    });

    data.forecasts = await db.forecast.findMany({
      where,
    });

    data.clusters = await db.claimCluster.findMany({
      where,
      include: {
        primaryClaim: true,
      },
    });

    data.beliefNodes = await db.beliefNode.findMany({
      where,
    });

    data.beliefEdges = await db.beliefEdge.findMany({
      where,
    });

    // Include metadata
    const metadata = {
      exportDate: new Date().toISOString(),
      tenantId: tenantId || "all",
      version: "1.0",
      tables: Object.keys(data),
      counts: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value.length])
      ),
    };

    return JSON.stringify({
      metadata,
      data,
    }, null, 2);
  }

  /**
   * Import database data
   */
  private async importDatabaseData(data: string, tenantId?: string): Promise<void> {
    const parsed = JSON.parse(data);
    const { metadata, data: tableData } = parsed;

    if (!tableData || typeof tableData !== "object") {
      throw new Error("Invalid backup data format");
    }

    const where = tenantId ? { tenantId } : {};

    try {
      // Import in transaction for atomicity
      await db.$transaction(async (tx) => {
        // Import claims
        if (tableData.claims && Array.isArray(tableData.claims)) {
          for (const claim of tableData.claims) {
            const { evidenceRefs, ...claimData } = claim;
            await tx.claim.upsert({
              where: { id: claimData.id },
              update: claimData,
              create: claimData,
            });
            // Import evidence refs if present
            if (evidenceRefs && Array.isArray(evidenceRefs)) {
              for (const ref of evidenceRefs) {
                const evidenceId = (ref as any).evidenceId || (ref as any).evidence_id;
                if (!evidenceId) continue;
                await tx.claimEvidence.upsert({
                  where: { id: (ref as any).id },
                  update: {
                    claimId: (ref as any).claimId || (ref as any).claim_id || claimData.id,
                    evidenceId,
                  },
                  create: {
                    id: (ref as any).id,
                    claimId: (ref as any).claimId || (ref as any).claim_id || claimData.id,
                    evidenceId,
                  },
                });
              }
            }
          }
        }

        // Import evidence
        if (tableData.evidence && Array.isArray(tableData.evidence)) {
          for (const evidence of tableData.evidence) {
            await tx.evidence.upsert({
              where: { id: evidence.id },
              update: evidence,
              create: evidence,
            });
          }
        }

        // Import artifacts
        if (tableData.artifacts && Array.isArray(tableData.artifacts)) {
          for (const artifact of tableData.artifacts) {
            const { approvals, evidenceRefs, ...artifactData } = artifact;
            await tx.aAALArtifact.upsert({
              where: { id: artifactData.id },
              update: artifactData,
              create: artifactData,
            });
            // Import approvals
            if (approvals && Array.isArray(approvals)) {
              for (const approval of approvals) {
                await tx.approval.upsert({
                  where: { id: approval.id },
                  update: approval,
                  create: approval,
                });
              }
            }
            // Import evidence refs
            if (evidenceRefs && Array.isArray(evidenceRefs)) {
              for (const ref of evidenceRefs) {
                const evidenceId = (ref as any).evidenceId || (ref as any).evidence_id;
                if (!evidenceId) continue;
                await tx.aAALArtifactEvidence.upsert({
                  where: { id: (ref as any).id },
                  update: {
                    artifactId: (ref as any).artifactId || (ref as any).artifact_id || artifactData.id,
                    evidenceId,
                  },
                  create: {
                    id: (ref as any).id,
                    artifactId: (ref as any).artifactId || (ref as any).artifact_id || artifactData.id,
                    evidenceId,
                  },
                });
              }
            }
          }
        }

        // Import forecasts
        if (tableData.forecasts && Array.isArray(tableData.forecasts)) {
          for (const forecast of tableData.forecasts) {
            await tx.forecast.upsert({
              where: { id: forecast.id },
              update: forecast,
              create: forecast,
            });
          }
        }

        // Import clusters
        if (tableData.clusters && Array.isArray(tableData.clusters)) {
          for (const cluster of tableData.clusters) {
            const { primaryClaim, ...clusterData } = cluster;
            await tx.claimCluster.upsert({
              where: { id: clusterData.id },
              update: clusterData,
              create: clusterData,
            });
            if (primaryClaim) {
              await tx.claim.upsert({
                where: { id: primaryClaim.id },
                update: primaryClaim,
                create: primaryClaim,
              });
            }
          }
        }

        // Import belief nodes
        if (tableData.beliefNodes && Array.isArray(tableData.beliefNodes)) {
          for (const node of tableData.beliefNodes) {
            await tx.beliefNode.upsert({
              where: { id: node.id },
              update: node,
              create: node,
            });
          }
        }

        // Import belief edges
        if (tableData.beliefEdges && Array.isArray(tableData.beliefEdges)) {
          for (const edge of tableData.beliefEdges) {
            await tx.beliefEdge.upsert({
              where: { id: edge.id },
              update: edge,
              create: edge,
            });
          }
        }
      });

      logger.info("Database data imported successfully", {
        tenantId,
        tables: Object.keys(tableData),
        counts: metadata?.counts,
      });

      metrics.increment("backups_imported_total");
    } catch (error) {
      logger.error("Database import failed", { error, tenantId });
      throw new Error(`Failed to import backup data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Compress data using gzip
   */
  private async compressData(data: string): Promise<string> {
    const { gzip } = await import("zlib");
    const { promisify } = await import("util");
    const gzipAsync = promisify(gzip);
    
    try {
      const buffer = await gzipAsync(Buffer.from(data, "utf-8"));
      return buffer.toString("base64");
    } catch (error) {
      logger.error("Data compression failed", { error });
      throw new Error("Failed to compress backup data");
    }
  }

  /**
   * Decompress data from gzip
   */
  private async decompressData(data: string): Promise<string> {
    const { gunzip } = await import("zlib");
    const { promisify } = await import("util");
    const gunzipAsync = promisify(gunzip);
    
    try {
      const buffer = Buffer.from(data, "base64");
      const decompressed = await gunzipAsync(buffer);
      return decompressed.toString("utf-8");
    } catch (error) {
      logger.error("Data decompression failed", { error });
      throw new Error("Failed to decompress backup data");
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encryptData(data: string): Promise<string> {
    const crypto = await import("crypto");
    const configured = process.env.BACKUP_ENCRYPTION_KEY?.trim();
    if (process.env.NODE_ENV === "production" && !configured) {
      // Never create unrecoverable backups in production.
      throw new Error("BACKUP_ENCRYPTION_KEY not configured");
    }
    const encryptionKey = configured || crypto.randomBytes(32).toString("hex");
    const key = Buffer.from(encryptionKey.slice(0, 64), "hex"); // 32 bytes for AES-256
    const iv = crypto.randomBytes(16); // 16 bytes for GCM
    
    try {
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      let encrypted = cipher.update(data, "utf-8", "base64");
      encrypted += cipher.final("base64");
      const authTag = cipher.getAuthTag();
      
      // Return IV + authTag + encrypted data (all base64)
      return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
    } catch (error) {
      logger.error("Data encryption failed", { error });
      throw new Error("Failed to encrypt backup data");
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private async decryptData(data: string): Promise<string> {
    const crypto = await import("crypto");
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY?.trim() || "";
    
    if (!encryptionKey) {
      throw new Error("Backup encryption key not configured");
    }
    
    const key = Buffer.from(encryptionKey.slice(0, 64), "hex");
    const [ivBase64, authTagBase64, encrypted] = data.split(":");
    
    if (!ivBase64 || !authTagBase64 || !encrypted) {
      throw new Error("Invalid encrypted data format");
    }
    
    try {
      const iv = Buffer.from(ivBase64, "base64");
      const authTag = Buffer.from(authTagBase64, "base64");
      
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, "base64", "utf-8");
      decrypted += decipher.final("utf-8");
      
      return decrypted;
    } catch (error) {
      logger.error("Data decryption failed", { error });
      throw new Error("Failed to decrypt backup data");
    }
  }

  /**
   * Upload backup to storage
   */
  private async uploadBackup(
    backupId: string,
    data: string,
    provider: BackupConfig["storageProvider"]
  ): Promise<string> {
    const fileName = `${backupId}.backup`;
    
    // Data may be:
    // - base64-encoded encrypted string (IV:authTag:encrypted format) if encrypted
    // - base64-encoded compressed string if compressed but not encrypted
    // - plain JSON string if neither encrypted nor compressed
    let buffer: Buffer;
    try {
      // Try to decode as base64 first
      buffer = Buffer.from(data, "base64");
      // Verify it's valid base64 by checking if re-encoding matches
      if (buffer.toString("base64") !== data) {
        // Not valid base64, treat as plain text
        buffer = Buffer.from(data, "utf-8");
      }
    } catch {
      // If base64 decode fails, treat as plain text
      buffer = Buffer.from(data, "utf-8");
    }

    try {
      if (provider === "s3") {
        const s3Region = process.env.AWS_REGION || "us-east-1";
        const s3Bucket = process.env.S3_BACKUP_BUCKET || process.env.S3_BUCKET;

        if (!s3Bucket) {
          throw new Error("S3_BACKUP_BUCKET not configured for backups");
        }

        try {
          const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
          
          const s3Client = new S3Client({
            region: s3Region,
          });

          await s3Client.send(
            new PutObjectCommand({
              Bucket: s3Bucket,
              Key: `backups/${fileName}`,
              Body: buffer,
              ContentType: "application/octet-stream",
              Metadata: {
                backupId,
                uploadedAt: new Date().toISOString(),
              },
            })
          );

          return `s3://${s3Bucket}/backups/${fileName}`;
        } catch (sdkError) {
          logger.error("S3 backup upload failed", { error: sdkError });
          throw new Error("S3 upload failed - check AWS credentials and bucket configuration");
        }
      } else if (provider === "gcs") {
        // Google Cloud Storage requires @google-cloud/storage SDK
        const gcsBucket = process.env.GCS_BACKUP_BUCKET || process.env.GCS_BUCKET;
        if (!gcsBucket) {
          throw new Error("GCS bucket not configured for backups");
        }

        try {
          const { Storage } = await import("@google-cloud/storage");
          
          // Initialize GCS client
          // Credentials can be provided via:
          // 1. GOOGLE_APPLICATION_CREDENTIALS env var (path to service account JSON)
          // 2. GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY env vars
          // 3. Default credentials from environment
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
          const file = bucket.file(`backups/${fileName}`);
          
          await file.save(buffer, {
            metadata: {
              contentType: "application/octet-stream",
              metadata: {
                backupId,
                uploadedAt: new Date().toISOString(),
              },
            },
          });
          
          return `gs://${gcsBucket}/backups/${fileName}`;
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            throw new Error("GCS support requires @google-cloud/storage package. Install with: npm install @google-cloud/storage");
          }
          logger.error("GCS backup upload failed", { error: importError });
          throw new Error(`GCS upload failed: ${importError.message}`);
        }
      } else if (provider === "azure") {
        // Azure Blob Storage requires @azure/storage-blob SDK
        const azureAccount = process.env.AZURE_STORAGE_ACCOUNT;
        const azureContainer = process.env.AZURE_BACKUP_CONTAINER || "backups";
        const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const azureKey = process.env.AZURE_STORAGE_KEY;
        
        if (!azureAccount) {
          throw new Error("Azure storage account not configured for backups");
        }

        try {
          const { BlobServiceClient } = await import("@azure/storage-blob");
          
          let blobServiceClient: any;
          
          if (azureConnectionString) {
            // Use connection string if provided
            blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
          } else if (azureKey) {
            // Use account name and key
            const accountUrl = `https://${azureAccount}.blob.core.windows.net`;
            const sharedKeyCredential = new (await import("@azure/storage-blob")).StorageSharedKeyCredential(azureAccount, azureKey);
            blobServiceClient = new BlobServiceClient(accountUrl, sharedKeyCredential);
          } else {
            throw new Error("Azure storage credentials not configured (AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_KEY required)");
          }
          
          const containerClient = blobServiceClient.getContainerClient(azureContainer);
          
          // Ensure container exists
          await containerClient.createIfNotExists({
            access: "private",
          });
          
          const blockBlobClient = containerClient.getBlockBlobClient(`backups/${fileName}`);
          
          await blockBlobClient.upload(buffer, buffer.length, {
            blobHTTPHeaders: {
              blobContentType: "application/octet-stream",
            },
            metadata: {
              backupId,
              uploadedAt: new Date().toISOString(),
            },
          });
          
          return `https://${azureAccount}.blob.core.windows.net/${azureContainer}/backups/${fileName}`;
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            throw new Error("Azure support requires @azure/storage-blob package. Install with: npm install @azure/storage-blob");
          }
          logger.error("Azure backup upload failed", { error: importError });
          throw new Error(`Azure upload failed: ${importError.message}`);
        }
      } else {
        // Local storage (development)
        const fs = await import("fs/promises");
        const path = await import("path");
        const backupDir = path.join(process.cwd(), "backups");
        await fs.mkdir(backupDir, { recursive: true });
        const filePath = path.join(backupDir, fileName);
        await fs.writeFile(filePath, buffer);
        return filePath;
      }
    } catch (error) {
      logger.error("Backup upload failed", { error, provider, backupId });
      throw error;
    }
  }

  /**
   * Download backup from storage
   */
  private async downloadBackup(backupId: string, location: string): Promise<string> {
    try {
      if (location.startsWith("s3://")) {
        // S3 download
        const s3Region = process.env.AWS_REGION || "us-east-1";

        const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const s3Client = new S3Client({
          region: s3Region,
        });

        const match = location.match(/^s3:\/\/([^\/]+)\/(.+)$/);
        if (!match) {
          throw new Error("Invalid S3 location format");
        }

        const [, bucket, key] = match;
        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );

        const stream = response.Body as any;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        return buffer.toString("base64");
      } else if (location.startsWith("gs://")) {
        // GCS download - requires @google-cloud/storage SDK
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
          const match = location.match(/^gs:\/\/([^\/]+)\/(.+)$/);
          if (!match) {
            throw new Error("Invalid GCS location format");
          }
          
          const [, bucketName, filePath] = match;
          const bucket = storage.bucket(bucketName);
          const file = bucket.file(filePath);
          
          const [exists] = await file.exists();
          if (!exists) {
            throw new Error(`Backup file not found: ${location}`);
          }
          
          const [fileBuffer] = await file.download();
          return fileBuffer.toString("base64");
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            throw new Error("GCS support requires @google-cloud/storage package. Install with: npm install @google-cloud/storage");
          }
          logger.error("GCS backup download failed", { error: importError });
          throw new Error(`GCS download failed: ${importError.message}`);
        }
      } else if (location.startsWith("https://") && location.includes("blob.core.windows.net")) {
        // Azure download - requires @azure/storage-blob SDK
        try {
          const { BlobServiceClient } = await import("@azure/storage-blob");
          
          const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
          const azureAccount = process.env.AZURE_STORAGE_ACCOUNT;
          const azureKey = process.env.AZURE_STORAGE_KEY;
          
          let blobServiceClient: any;
          
          if (azureConnectionString) {
            blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
          } else if (azureAccount && azureKey) {
            const accountUrl = `https://${azureAccount}.blob.core.windows.net`;
            const sharedKeyCredential = new (await import("@azure/storage-blob")).StorageSharedKeyCredential(azureAccount, azureKey);
            blobServiceClient = new BlobServiceClient(accountUrl, sharedKeyCredential);
          } else {
            throw new Error("Azure storage credentials not configured");
          }
          
          // Parse URL: https://account.blob.core.windows.net/container/path
          const urlMatch = location.match(/https:\/\/([^\.]+)\.blob\.core\.windows\.net\/([^\/]+)\/(.+)$/);
          if (!urlMatch) {
            throw new Error("Invalid Azure blob URL format");
          }
          
          const [, account, container, blobPath] = urlMatch;
          const containerClient = blobServiceClient.getContainerClient(container);
          const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
          
          const downloadResponse = await blockBlobClient.download(0);
          const chunks: Buffer[] = [];
          
          if (downloadResponse.readableStreamBody) {
            for await (const chunk of downloadResponse.readableStreamBody) {
              chunks.push(Buffer.from(chunk));
            }
          } else {
            throw new Error("Azure blob download stream not available");
          }
          
          const buffer = Buffer.concat(chunks);
          return buffer.toString("base64");
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            throw new Error("Azure support requires @azure/storage-blob package. Install with: npm install @azure/storage-blob");
          }
          logger.error("Azure backup download failed", { error: importError });
          throw new Error(`Azure download failed: ${importError.message}`);
        }
      } else {
        // Local file
        const fs = await import("fs/promises");
        const buffer = await fs.readFile(location);
        return buffer.toString("base64");
      }
    } catch (error) {
      logger.error("Backup download failed", { error, backupId, location });
      throw error;
    }
  }

  /**
   * List backups
   */
  async listBackups(tenantId?: string): Promise<BackupResult[]> {
    try {
      // Query backup metadata from Event table
      const where: any = {
        type: "backup.created",
      };

      if (tenantId) {
        where.tenantId = tenantId;
      }

      const backupEvents = await db.event.findMany({
        where,
        orderBy: { occurredAt: "desc" },
      });

      const backups: BackupResult[] = [];

      for (const event of backupEvents) {
        const metadata = event.metadata as any;
        const payload = event.payload as any;

        if (metadata || payload) {
          const backupId = metadata?.backupId || payload?.backupId || event.correlationId;
          const location = metadata?.location || payload?.location;
          const size = metadata?.size || payload?.size || 0;
          const status = payload?.status || "success";

          backups.push({
            backupId,
            timestamp: event.occurredAt.toISOString(),
            size,
            location: location || "",
            status: status === "success" ? "success" : "failed",
            error: payload?.error,
          });
        }
      }

      // Optionally verify backups still exist in storage
      // This is a lightweight check - full verification would require listing storage buckets
      const verifiedBackups = await Promise.all(
        backups.map(async (backup) => {
          if (!backup.location) {
            return { ...backup, status: "failed" as const, error: "Backup location not found" };
          }
          // Basic validation - in production, could verify file exists in storage
          return backup;
        })
      );

      logger.info("Backups listed", {
        tenantId,
        count: verifiedBackups.length,
      });

      return verifiedBackups;
    } catch (error) {
      logger.error("Failed to list backups", { error, tenantId });
      return [];
    }
  }

  /**
   * Delete old backups
   */
  async cleanupOldBackups(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      // Find old backup metadata
      const oldBackups = await db.event.findMany({
        where: {
          type: "backup.created",
          occurredAt: {
            lt: cutoffDate,
          },
        },
      });

      let deletedCount = 0;

      for (const backupEvent of oldBackups) {
        try {
          const metadata = backupEvent.metadata as any;
          const location = metadata?.location || (backupEvent.payload as any)?.location;

          if (location) {
            // Delete from storage
            await this.deleteBackupFromStorage(location);

            // Delete metadata
            await db.event.delete({
              where: { id: backupEvent.id },
            });

            deletedCount++;
          }
        } catch (error) {
          logger.error("Failed to delete backup", {
            error,
            backupId: backupEvent.correlationId,
          });
        }
      }

      logger.info("Backup cleanup completed", {
        retentionDays,
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
      });

      metrics.increment("backups_deleted_total", undefined, deletedCount);

      return deletedCount;
    } catch (error) {
      logger.error("Backup cleanup failed", { error, retentionDays });
      return 0;
    }
  }

  /**
   * Delete backup from storage
   */
  private async deleteBackupFromStorage(location: string): Promise<void> {
    try {
      if (location.startsWith("s3://")) {
        // S3 delete
        const s3Region = process.env.AWS_REGION || "us-east-1";

        const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const s3Client = new S3Client({
          region: s3Region,
        });

        const match = location.match(/^s3:\/\/([^\/]+)\/(.+)$/);
        if (!match) {
          throw new Error("Invalid S3 location format");
        }

        const [, bucket, key] = match;
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
      } else if (location.startsWith("gs://")) {
        // GCS delete - requires @google-cloud/storage SDK
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
          const match = location.match(/^gs:\/\/([^\/]+)\/(.+)$/);
          if (!match) {
            throw new Error("Invalid GCS location format");
          }
          
          const [, bucketName, filePath] = match;
          const bucket = storage.bucket(bucketName);
          const file = bucket.file(filePath);
          
          await file.delete();
          logger.info("GCS backup deleted", { location });
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            logger.warn("GCS delete requires @google-cloud/storage package", { location });
            throw new Error("GCS delete requires @google-cloud/storage package. Install with: npm install @google-cloud/storage");
          }
          logger.error("GCS backup delete failed", { error: importError, location });
          throw new Error(`GCS delete failed: ${importError.message}`);
        }
      } else if (location.startsWith("https://") && location.includes("blob.core.windows.net")) {
        // Azure delete - requires @azure/storage-blob SDK
        try {
          const { BlobServiceClient } = await import("@azure/storage-blob");
          
          const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
          const azureAccount = process.env.AZURE_STORAGE_ACCOUNT;
          const azureKey = process.env.AZURE_STORAGE_KEY;
          
          let blobServiceClient: any;
          
          if (azureConnectionString) {
            blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
          } else if (azureAccount && azureKey) {
            const accountUrl = `https://${azureAccount}.blob.core.windows.net`;
            const sharedKeyCredential = new (await import("@azure/storage-blob")).StorageSharedKeyCredential(azureAccount, azureKey);
            blobServiceClient = new BlobServiceClient(accountUrl, sharedKeyCredential);
          } else {
            throw new Error("Azure storage credentials not configured");
          }
          
          const urlMatch = location.match(/https:\/\/([^\.]+)\.blob\.core\.windows\.net\/([^\/]+)\/(.+)$/);
          if (!urlMatch) {
            throw new Error("Invalid Azure blob URL format");
          }
          
          const [, account, container, blobPath] = urlMatch;
          const containerClient = blobServiceClient.getContainerClient(container);
          const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
          
          await blockBlobClient.delete();
          logger.info("Azure backup deleted", { location });
        } catch (importError: any) {
          if (importError.code === "MODULE_NOT_FOUND" || importError.message?.includes("Cannot find module")) {
            logger.warn("Azure delete requires @azure/storage-blob package", { location });
            throw new Error("Azure delete requires @azure/storage-blob package. Install with: npm install @azure/storage-blob");
          }
          logger.error("Azure backup delete failed", { error: importError, location });
          throw new Error(`Azure delete failed: ${importError.message}`);
        }
      } else {
        // Local file delete
        const fs = await import("fs/promises");
        try {
          await fs.unlink(location);
        } catch (error) {
          // File may not exist - ignore
          logger.warn("Backup file not found for deletion", { location, error });
        }
      }
    } catch (error) {
      logger.error("Failed to delete backup from storage", { error, location });
      throw error;
    }
  }
}

export const backupService = new BackupService();
