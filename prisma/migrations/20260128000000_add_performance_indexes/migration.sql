-- Add performance indexes for common query patterns
-- These indexes optimize tenant-scoped queries with filters

-- Case model: Optimize tenantId + status + createdAt queries (common in case lists)
CREATE INDEX IF NOT EXISTS "Case_tenantId_status_createdAt_idx" ON "Case"("tenantId", "status", "createdAt" DESC);

-- Case model: Optimize tenantId + type + createdAt queries
CREATE INDEX IF NOT EXISTS "Case_tenantId_type_createdAt_idx" ON "Case"("tenantId", "type", "createdAt" DESC);

-- Evidence model: Optimize tenantId + type + createdAt queries
CREATE INDEX IF NOT EXISTS "Evidence_tenantId_type_createdAt_idx" ON "Evidence"("tenantId", "type", "createdAt" DESC);

-- Evidence model: Optimize tenantId + sourceType + createdAt queries
CREATE INDEX IF NOT EXISTS "Evidence_tenantId_sourceType_createdAt_idx" ON "Evidence"("tenantId", "sourceType", "createdAt" DESC);

-- Claim model: Optimize tenantId + clusterId + createdAt queries
CREATE INDEX IF NOT EXISTS "Claim_tenantId_clusterId_createdAt_idx" ON "Claim"("tenantId", "clusterId", "createdAt" DESC);

-- EventOutbox model: Optimize tenantId + published + createdAt queries (for outbox worker)
CREATE INDEX IF NOT EXISTS "EventOutbox_tenantId_published_createdAt_idx" ON "EventOutbox"("tenantId", "published", "createdAt" ASC);

-- EventProcessing model: Optimize tenantId + status + startedAt queries (for worker monitoring)
CREATE INDEX IF NOT EXISTS "EventProcessing_tenantId_status_startedAt_idx" ON "EventProcessing"("tenantId", "status", "startedAt" DESC);
