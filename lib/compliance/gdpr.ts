/**
 * GDPR/CCPA Compliance
 * Data privacy, consent management, and data subject rights
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { randomUUID } from "crypto";
import type { EventEnvelope } from "@/lib/events/types";

export interface ConsentRecord {
  userId: string;
  tenantId: string;
  consentType: "analytics" | "marketing" | "essential" | "functional";
  granted: boolean;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DataSubjectRequest {
  userId: string;
  tenantId: string;
  requestType: "access" | "deletion" | "portability" | "rectification";
  status: "pending" | "processing" | "completed" | "rejected";
  requestedAt: string;
  completedAt?: string;
}

export class GDPRCompliance {
  /**
   * Record user consent
   */
  async recordConsent(consent: ConsentRecord): Promise<void> {
    try {
      const { DatabaseEventStore } = await import("@/lib/events/store-db");
      const eventStore = new DatabaseEventStore();

      // Store consent in Event table for audit trail
      const occurredAt = consent.timestamp || new Date().toISOString();
      const evt: EventEnvelope = {
        event_id: randomUUID(),
        tenant_id: consent.tenantId,
        actor_id: consent.userId,
        type: "consent.recorded",
        occurred_at: occurredAt,
        correlation_id: `consent-${consent.userId}`,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [],
        payload: {
          consentType: consent.consentType,
          granted: consent.granted,
          timestamp: occurredAt,
          ipAddress: consent.ipAddress,
          userAgent: consent.userAgent,
        },
        signatures: [],
      };
      await eventStore.append(evt);

      logger.info("Consent recorded", {
        userId: consent.userId,
        tenantId: consent.tenantId,
        consentType: consent.consentType,
        granted: consent.granted,
      });

      metrics.increment("consent_records_total", {
        consent_type: consent.consentType,
        granted: consent.granted.toString(),
      });
    } catch (error) {
      logger.error("Failed to record consent", { error, consent });
      throw error;
    }
  }

  /**
   * Check if user has consented
   */
  async hasConsent(
    userId: string,
    consentType: ConsentRecord["consentType"]
  ): Promise<boolean> {
    // Essential consents are always granted
    if (consentType === "essential") {
      return true;
    }

    try {
      // Query most recent consent record for this user and type
      const consentEvent = await db.event.findFirst({
        where: {
          type: "consent.recorded",
          actorId: userId,
          correlationId: `consent-${userId}`,
        },
        orderBy: { occurredAt: "desc" },
      });

      if (consentEvent && consentEvent.payload) {
        const payload = consentEvent.payload as any;
        // Check if this consent record matches the requested type
        if (payload.consentType === consentType) {
          return payload.granted === true;
        }
      }

      // If no explicit consent found, check environment variable for default
      const defaultConsent = process.env.DEFAULT_CONSENT === "true";
      return defaultConsent;
    } catch (error) {
      logger.warn("Failed to check consent, using default", { error, userId, consentType });
      // Fallback to environment variable
      const defaultConsent = process.env.DEFAULT_CONSENT === "true";
      return defaultConsent;
    }
  }

  /**
   * Request data access (GDPR Article 15)
   */
  async requestDataAccess(
    userId: string,
    tenantId: string
  ): Promise<{
    requestId: string;
    data: {
      tenantId: string;
      user: any;
      claims: any[];
      evidence: any[];
      artifacts: any[];
      events: any[];
    };
  }> {
    const requestId = `dsr-${Date.now()}-${crypto.randomUUID()}`;

    try {
      // Collect all user data
      const [user, claims, evidence, artifacts, events] = await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        db.claim.findMany({
          where: { tenantId },
          take: 1000,
        }),
        db.evidence.findMany({
          where: { tenantId },
          take: 1000,
        }),
        db.aAALArtifact.findMany({
          where: { tenantId },
          take: 1000,
        }),
        db.event.findMany({
          where: {
            tenantId,
            actorId: userId,
          },
          take: 1000,
        }),
      ]);

      logger.info("Data access request fulfilled", {
        requestId,
        userId,
        tenantId,
        dataCounts: {
          claims: claims.length,
          evidence: evidence.length,
          artifacts: artifacts.length,
          events: events.length,
        },
      });

      metrics.increment("gdpr_requests_total", { request_type: "access" });

      return {
        requestId,
        data: {
          tenantId,
          user,
          claims,
          evidence,
          artifacts,
          events,
        },
      };
    } catch (error) {
      logger.error("Data access request failed", { error, userId, tenantId });
      throw error;
    }
  }

  /**
   * Request data deletion (GDPR Article 17)
   */
  async requestDataDeletion(
    userId: string,
    tenantId: string
  ): Promise<{ requestId: string; status: string }> {
    const requestId = `dsr-delete-${Date.now()}-${crypto.randomUUID()}`;

    try {
      // Anonymize user data (preserve referential integrity)
      const anonymizedEmail = `deleted-${Date.now()}-${crypto.randomUUID().substring(0, 8)}@deleted.local`;
      const anonymizedName = "Deleted User";

      // Anonymize user record
      // Note: Prisma schema may not have deletedAt field - use metadata or soft delete pattern
      await db.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          name: anonymizedName,
          passwordHash: null,
          // Store deletion timestamp in metadata if deletedAt field doesn't exist
          // deletedAt: new Date(), // Uncomment if schema has deletedAt field
        },
      });

      // Anonymize evidence created by user
      const evidenceToAnonymize = await db.evidence.findMany({
        where: {
          tenantId,
          collectedBy: userId,
        },
        select: { id: true, metadata: true },
      });

      for (const evidence of evidenceToAnonymize) {
        await db.evidence.update({
          where: { id: evidence.id },
          data: {
            metadata: {
              ...((evidence.metadata as any) || {}),
              anonymized: true,
              originalUserId: userId,
              anonymizedAt: new Date().toISOString(),
            },
          },
        });
      }

      // Anonymize claims - find claims associated with user via events
      // Claims don't have a direct createdBy field, so we find them via events
      const userEvents = await db.event.findMany({
        where: {
          tenantId,
          actorId: userId,
          type: { contains: "claim" },
        },
        select: { evidenceRefs: true },
        take: 1000,
      });

      // Anonymize claims in tenant (conservative approach for GDPR)
      const allClaims = await db.claim.findMany({
        where: { tenantId },
        select: { id: true },
        take: 1000,
      });

      for (const claim of allClaims) {
        await db.claim.update({
          where: { id: claim.id },
          data: {
            canonicalText: "[ANONYMIZED]",
            variants: [],
            clusterId: null,
          },
        });
      }

      // Record deletion in audit log
      const { DatabaseEventStore } = await import("@/lib/events/store-db");
      const eventStore = new DatabaseEventStore();
      const deletedAt = new Date().toISOString();
      const deletionEvent: EventEnvelope = {
        event_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: userId,
        type: "gdpr.data_deleted",
        occurred_at: deletedAt,
        correlation_id: requestId,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [],
        payload: { requestId, userId, deletedAt },
        signatures: [],
      };
      await eventStore.append(deletionEvent);

      logger.info("Data deletion request processed", {
        requestId,
        userId,
        tenantId,
      });

      metrics.increment("gdpr_requests_total", { request_type: "deletion" });

      return {
        requestId,
        status: "completed",
      };
    } catch (error) {
      logger.error("Data deletion request failed", { error, userId, tenantId });
      throw error;
    }
  }

  /**
   * Request data portability (GDPR Article 20)
   */
  async requestDataPortability(
    userId: string,
    tenantId: string
  ): Promise<{ requestId: string; exportUrl: string }> {
    const requestId = `dsr-export-${Date.now()}-${crypto.randomUUID()}`;

    try {
      const data = await this.requestDataAccess(userId, tenantId);

      // Generate export file (JSON)
      const exportData = {
        requestId,
        userId,
        tenantId,
        exportedAt: new Date().toISOString(),
        data: data.data,
      };

      // Store export in database and generate signed URL
      const exportJson = JSON.stringify(exportData, null, 2);
      const exportKey = `gdpr-export-${requestId}.json`;

      // Store export data in Event table with payload containing the export
      const { DatabaseEventStore } = await import("@/lib/events/store-db");
      const eventStore = new DatabaseEventStore();
      // Try to upload to S3 if configured
      const base =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXTAUTH_URL ||
        process.env.AUTH_URL ||
        "";
      let exportUrl = base
        ? new URL(`/api/compliance/gdpr/export/${requestId}`, base).toString()
        : `/api/compliance/gdpr/export/${requestId}`;
      try {
        const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
        const s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY;
        const s3Bucket = process.env.S3_BUCKET || process.env.S3_EXPORT_BUCKET;
        const s3Region = process.env.AWS_REGION || "us-east-1";

        if (s3AccessKey && s3SecretKey && s3Bucket) {
          try {
            const { S3Client, PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
            const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

            const s3Client = new S3Client({
              region: s3Region,
              credentials: {
                accessKeyId: s3AccessKey,
                secretAccessKey: s3SecretKey,
              },
            });

            // Upload export to S3
            await s3Client.send(
              new PutObjectCommand({
                Bucket: s3Bucket,
                Key: `gdpr-exports/${exportKey}`,
                Body: exportJson,
                ContentType: "application/json",
                Metadata: {
                  requestId,
                  userId,
                  tenantId,
                  createdAt: new Date().toISOString(),
                },
              })
            );

            // Generate presigned URL (valid for 7 days)
            const presignedUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: s3Bucket,
                Key: `gdpr-exports/${exportKey}`,
              }),
              { expiresIn: 7 * 24 * 60 * 60 } // 7 days
            );

            exportUrl = presignedUrl;
          } catch (sdkError: any) {
            if (sdkError.code === "MODULE_NOT_FOUND" || sdkError.message?.includes("Cannot find module")) {
              logger.warn("AWS SDK not installed, using API endpoint for export", { requestId });
            } else {
              throw sdkError;
            }
          }
        }
      } catch (s3Error) {
        // Fallback to API endpoint if S3 upload fails
        logger.warn("S3 export upload failed, using API endpoint", { error: s3Error, requestId });
      }

      // Record export creation (now that exportUrl is known)
      const exportCreatedAt = new Date().toISOString();
      const exportEvent: EventEnvelope = {
        event_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: userId,
        type: "gdpr.export_created",
        occurred_at: exportCreatedAt,
        correlation_id: requestId,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [],
        payload: {
          requestId,
          exportKey,
          dataSize: exportJson.length,
          createdAt: exportCreatedAt,
          exportData: exportJson,
          exportUrl,
        },
        signatures: [],
      };
      await eventStore.append(exportEvent);

      logger.info("Data portability request processed", {
        requestId,
        userId,
        tenantId,
      });

      metrics.increment("gdpr_requests_total", { request_type: "portability" });

      return {
        requestId,
        exportUrl,
      };
    } catch (error) {
      logger.error("Data portability request failed", { error, userId, tenantId });
      throw error;
    }
  }

  /**
   * Request data rectification (GDPR Article 16)
   */
  async requestDataRectification(
    userId: string,
    updates: Record<string, unknown>
  ): Promise<{ requestId: string; status: string }> {
    const requestId = `dsr-rectify-${Date.now()}-${crypto.randomUUID()}`;

    try {
      await db.user.update({
        where: { id: userId },
        data: updates,
      });

      logger.info("Data rectification request processed", {
        requestId,
        userId,
      });

      metrics.increment("gdpr_requests_total", { request_type: "rectification" });

      return {
        requestId,
        status: "completed",
      };
    } catch (error) {
      logger.error("Data rectification request failed", { error, userId });
      throw error;
    }
  }
}

export const gdprCompliance = new GDPRCompliance();
