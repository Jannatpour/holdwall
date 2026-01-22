/**
 * S3/Object Storage Connector
 * Ingests documents from S3, GCS, or Azure Blob Storage
 */

import type { ConnectorExecutor, ConnectorConfig, ConnectorResult } from "./base";
import type { Signal } from "@/lib/signals/ingestion";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";
import { BlobServiceClient } from "@azure/storage-blob";

export class S3Connector implements ConnectorExecutor {
  async sync(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<ConnectorResult> {
    const provider = (config.provider as string) || "s3";
    const tenantId = config.tenantId as string;
    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    const signals: Signal[] = [];

    switch (provider) {
      case "s3":
        signals.push(...await this.syncS3(config, cursor));
        break;
      case "gcs":
        signals.push(...await this.syncGCS(config, cursor));
        break;
      case "azure":
        signals.push(...await this.syncAzure(config, cursor));
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return {
      signals,
      cursor: new Date().toISOString(),
      metadata: {
        provider,
        itemsProcessed: signals.length,
      },
    };
  }

  async validate(config: ConnectorConfig): Promise<{ valid: boolean; error?: string }> {
    const provider = (config.provider as string) || "s3";
    
    if (provider === "s3") {
      if (!config.bucket) {
        return { valid: false, error: "S3 bucket is required" };
      }
      if (!config.region && !config.endpoint) {
        return { valid: false, error: "S3 region or endpoint is required" };
      }
    } else if (provider === "gcs") {
      if (!config.bucket) {
        return { valid: false, error: "GCS bucket is required" };
      }
    } else if (provider === "azure") {
      if (!config.container) {
        return { valid: false, error: "Azure container is required" };
      }
    } else {
      return { valid: false, error: `Unsupported provider: ${provider}` };
    }

    return { valid: true };
  }

  async test(config: ConnectorConfig): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const provider = (config.provider as string) || "s3";
      if (provider === "s3") {
        const client = this.createS3Client(config);
        await client.send(new ListObjectsV2Command({
          Bucket: config.bucket as string,
          MaxKeys: 1,
        }));
      } else if (provider === "gcs") {
        const storage = new Storage({
          keyFilename: config.keyFilename as string,
          projectId: config.projectId as string,
        });
        const bucket = storage.bucket(config.bucket as string);
        await bucket.getMetadata();
      } else if (provider === "azure") {
        const client = BlobServiceClient.fromConnectionString(
          config.connectionString as string
        );
        const container = client.getContainerClient(config.container as string);
        await container.getProperties();
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Sync from S3
   */
  private async syncS3(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<Signal[]> {
    const client = this.createS3Client(config);
    const bucket = config.bucket as string;
    const prefix = (config.prefix as string) || "";
    const tenantId = config.tenantId as string;

    const signals: Signal[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await client.send(command);
      if (!response.Contents) {
        break;
      }

      for (const object of response.Contents) {
        if (!object.Key) continue;

        // Skip if before cursor
        if (cursor && object.LastModified && object.LastModified <= new Date(cursor)) {
          continue;
        }

        // Only process text files
        if (!this.isTextFile(object.Key)) {
          continue;
        }

        // Fetch object content
        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: object.Key,
        });

        const getResponse = await client.send(getCommand);
        const content = await getResponse.Body?.transformToString() || "";

        signals.push({
          signal_id: crypto.randomUUID(),
          tenant_id: tenantId,
          source: {
            type: "s3",
            id: object.Key,
            url: `s3://${bucket}/${object.Key}`,
          },
          content: {
            raw: content,
            normalized: this.normalizeContent(content),
          },
          metadata: {
            bucket,
            key: object.Key,
            size: object.Size,
            lastModified: object.LastModified?.toISOString(),
          },
          compliance: {
            source_allowed: true,
            collection_method: "api",
            retention_policy: config.retentionPolicy as string || "90 days",
          },
          created_at: new Date().toISOString(),
        });
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return signals;
  }

  /**
   * Sync from GCS
   */
  private async syncGCS(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<Signal[]> {
    const storage = new Storage({
      keyFilename: config.keyFilename as string,
      projectId: config.projectId as string,
    });
    const bucket = storage.bucket(config.bucket as string);
    const prefix = (config.prefix as string) || "";
    const tenantId = config.tenantId as string;

    const signals: Signal[] = [];
    const [files] = await bucket.getFiles({ prefix });

    for (const file of files) {
      if (cursor && file.metadata.updated && file.metadata.updated <= cursor) {
        continue;
      }

      if (!this.isTextFile(file.name)) {
        continue;
      }

      const [content] = await file.download();
      const textContent = content.toString("utf-8");

      signals.push({
        signal_id: crypto.randomUUID(),
        tenant_id: tenantId,
        source: {
          type: "gcs",
          id: file.name,
          url: `gs://${bucket.name}/${file.name}`,
        },
        content: {
          raw: textContent,
          normalized: this.normalizeContent(textContent),
        },
        metadata: {
          bucket: bucket.name,
          name: file.name,
          size: file.metadata.size,
          updated: file.metadata.updated,
        },
        compliance: {
          source_allowed: true,
          collection_method: "api",
          retention_policy: config.retentionPolicy as string || "90 days",
        },
        created_at: new Date().toISOString(),
      });
    }

    return signals;
  }

  /**
   * Sync from Azure Blob Storage
   */
  private async syncAzure(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<Signal[]> {
    const client = BlobServiceClient.fromConnectionString(
      config.connectionString as string
    );
    const container = client.getContainerClient(config.container as string);
    const prefix = (config.prefix as string) || "";
    const tenantId = config.tenantId as string;

    const signals: Signal[] = [];

    for await (const blob of container.listBlobsFlat({ prefix })) {
      if (cursor && blob.properties.lastModified && blob.properties.lastModified <= new Date(cursor)) {
        continue;
      }

      if (!this.isTextFile(blob.name)) {
        continue;
      }

      const blobClient = container.getBlobClient(blob.name);
      const downloadResponse = await blobClient.download();
      const content = await this.streamToString(downloadResponse.readableStreamBody!);

      signals.push({
        signal_id: crypto.randomUUID(),
        tenant_id: tenantId,
        source: {
          type: "azure",
          id: blob.name,
          url: blobClient.url,
        },
        content: {
          raw: content,
          normalized: this.normalizeContent(content),
        },
        metadata: {
          container: config.container as string,
          name: blob.name,
          size: blob.properties.contentLength,
          lastModified: blob.properties.lastModified?.toISOString(),
        },
        compliance: {
          source_allowed: true,
          collection_method: "api",
          retention_policy: config.retentionPolicy as string || "90 days",
        },
        created_at: new Date().toISOString(),
      });
    }

    return signals;
  }

  /**
   * Create S3 client from config
   */
  private createS3Client(config: ConnectorConfig): S3Client {
    return new S3Client({
      region: config.region as string,
      endpoint: config.endpoint as string,
      credentials: config.accessKeyId
        ? {
            accessKeyId: config.accessKeyId as string,
            secretAccessKey: config.secretAccessKey as string,
          }
        : undefined,
    });
  }

  /**
   * Check if file is a text file
   */
  private isTextFile(filename: string): boolean {
    const textExtensions = [".txt", ".md", ".json", ".xml", ".csv", ".log", ".yml", ".yaml"];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return textExtensions.includes(ext);
  }

  /**
   * Normalize content
   */
  private normalizeContent(content: string): string {
    return content
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Convert stream to string
   */
  private async streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of readableStream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }
}
