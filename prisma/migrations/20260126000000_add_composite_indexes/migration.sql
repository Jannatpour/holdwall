-- Add composite indexes for performance optimization
-- These indexes optimize common query patterns used in compliance evidence packages and time-range queries

-- Event model: Optimize tenantId + occurredAt queries (most common pattern)
CREATE INDEX IF NOT EXISTS "Event_tenantId_occurredAt_idx" ON "Event"("tenantId", "occurredAt");

-- Event model: Optimize tenantId + type queries for filtered event lookups
CREATE INDEX IF NOT EXISTS "Event_tenantId_type_idx" ON "Event"("tenantId", "type");

-- EvidenceAccessLog model: Optimize tenantId + createdAt queries for time-range access log queries
CREATE INDEX IF NOT EXISTS "EvidenceAccessLog_tenantId_createdAt_idx" ON "EvidenceAccessLog"("tenantId", "createdAt");
