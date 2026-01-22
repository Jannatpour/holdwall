-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'APPROVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SIGNAL', 'DOCUMENT', 'ARTIFACT', 'METRIC', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('API', 'RSS', 'EXPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('CLAIM', 'EMOTION', 'PROOF_POINT', 'NARRATIVE');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('REINFORCEMENT', 'NEUTRALIZATION', 'DECAY');

-- CreateEnum
CREATE TYPE "ForecastType" AS ENUM ('DRIFT', 'ANOMALY', 'OUTBREAK', 'DIFFUSION');

-- CreateEnum
CREATE TYPE "ArtifactStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AutopilotMode" AS ENUM ('RECOMMEND_ONLY', 'AUTO_DRAFT', 'AUTO_ROUTE', 'AUTO_PUBLISH');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnforcementMode" AS ENUM ('SOFT', 'HARD', 'NONE');

-- CreateEnum
CREATE TYPE "CounterPeriod" AS ENUM ('DAY', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'SYNCING');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "collectedBy" TEXT NOT NULL,
    "method" "CollectionMethod" NOT NULL,
    "contentRaw" TEXT,
    "contentNormalized" TEXT,
    "contentMetadata" JSONB,
    "collectionMethod" TEXT NOT NULL,
    "retentionPolicy" TEXT NOT NULL,
    "complianceFlags" TEXT[],
    "signatureAlgorithm" TEXT,
    "signatureValue" TEXT,
    "signatureSignerId" TEXT,
    "metadata" JSONB,
    "contentHash" VARCHAR(64),
    "detectedLanguage" TEXT,
    "languageConfidence" DOUBLE PRECISION,
    "piiRedacted" BOOLEAN NOT NULL DEFAULT false,
    "piiRedactionMap" JSONB,
    "embedding" JSONB,
    "embeddingModel" TEXT,
    "embeddingGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "payload" JSONB NOT NULL,
    "signatures" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEvidence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "EventEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "partition" INTEGER,
    "key" TEXT,
    "value" TEXT NOT NULL,
    "headers" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "variants" TEXT[],
    "decisiveness" DOUBLE PRECISION NOT NULL,
    "clusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimCluster" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "primaryClaimId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "decisiveness" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeliefNode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "content" TEXT NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL,
    "decisiveness" DOUBLE PRECISION NOT NULL,
    "actorWeights" JSONB NOT NULL,
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.99,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeliefNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeliefEdge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "type" "EdgeType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "actorWeights" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeliefEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ForecastType" NOT NULL,
    "targetMetric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidenceLower" DOUBLE PRECISION NOT NULL,
    "confidenceUpper" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "evalScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "typeData" JSONB,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AAALArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "ArtifactStatus" NOT NULL,
    "approvers" TEXT[],
    "requiredApprovals" INTEGER NOT NULL,
    "policyChecks" JSONB,
    "padlPublished" BOOLEAN NOT NULL DEFAULT false,
    "padlUrl" TEXT,
    "padlHash" TEXT,
    "padlRobots" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "AAALArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AAALArtifactEvidence" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "AAALArtifactEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approvers" TEXT[],
    "decision" "ApprovalDecision",
    "approverId" TEXT,
    "reason" TEXT,
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template" JSONB NOT NULL,
    "autopilotMode" "AutopilotMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookExecution" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlaybookExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "allowedSources" TEXT[],
    "collectionMethod" "CollectionMethod" NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "autoDelete" BOOLEAN NOT NULL,
    "complianceFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "softLimit" INTEGER NOT NULL,
    "hardLimit" INTEGER NOT NULL,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "enforcement" "EnforcementMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeteringCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "period" "CounterPeriod" NOT NULL,
    "lastReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReset" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeteringCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'INACTIVE',
    "config" JSONB NOT NULL,
    "apiKeyId" TEXT,
    "lastSync" TIMESTAMP(3),
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "schedule" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorRun" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "cursor" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "maskedKey" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnswerSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "citations" TEXT[],
    "tone" TEXT,
    "model" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAnswerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Evidence_tenantId_idx" ON "Evidence"("tenantId");

-- CreateIndex
CREATE INDEX "Evidence_type_idx" ON "Evidence"("type");

-- CreateIndex
CREATE INDEX "Evidence_sourceType_sourceId_idx" ON "Evidence"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Evidence_createdAt_idx" ON "Evidence"("createdAt");

-- CreateIndex
CREATE INDEX "Evidence_contentHash_idx" ON "Evidence"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_tenantId_contentHash_key" ON "Evidence"("tenantId", "contentHash");

-- CreateIndex
CREATE INDEX "Event_tenantId_idx" ON "Event"("tenantId");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_correlationId_idx" ON "Event"("correlationId");

-- CreateIndex
CREATE INDEX "Event_occurredAt_idx" ON "Event"("occurredAt");

-- CreateIndex
CREATE INDEX "EventEvidence_eventId_idx" ON "EventEvidence"("eventId");

-- CreateIndex
CREATE INDEX "EventEvidence_evidenceId_idx" ON "EventEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EventEvidence_eventId_evidenceId_key" ON "EventEvidence"("eventId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOutbox_eventId_key" ON "EventOutbox"("eventId");

-- CreateIndex
CREATE INDEX "EventOutbox_published_idx" ON "EventOutbox"("published");

-- CreateIndex
CREATE INDEX "EventOutbox_createdAt_idx" ON "EventOutbox"("createdAt");

-- CreateIndex
CREATE INDEX "EventOutbox_tenantId_idx" ON "EventOutbox"("tenantId");

-- CreateIndex
CREATE INDEX "Claim_tenantId_idx" ON "Claim"("tenantId");

-- CreateIndex
CREATE INDEX "Claim_clusterId_idx" ON "Claim"("clusterId");

-- CreateIndex
CREATE INDEX "Claim_createdAt_idx" ON "Claim"("createdAt");

-- CreateIndex
CREATE INDEX "ClaimEvidence_claimId_idx" ON "ClaimEvidence"("claimId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_evidenceId_idx" ON "ClaimEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimEvidence_claimId_evidenceId_key" ON "ClaimEvidence"("claimId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimCluster_primaryClaimId_key" ON "ClaimCluster"("primaryClaimId");

-- CreateIndex
CREATE INDEX "ClaimCluster_tenantId_idx" ON "ClaimCluster"("tenantId");

-- CreateIndex
CREATE INDEX "ClaimCluster_createdAt_idx" ON "ClaimCluster"("createdAt");

-- CreateIndex
CREATE INDEX "BeliefNode_tenantId_idx" ON "BeliefNode"("tenantId");

-- CreateIndex
CREATE INDEX "BeliefNode_type_idx" ON "BeliefNode"("type");

-- CreateIndex
CREATE INDEX "BeliefNode_createdAt_idx" ON "BeliefNode"("createdAt");

-- CreateIndex
CREATE INDEX "BeliefEdge_tenantId_idx" ON "BeliefEdge"("tenantId");

-- CreateIndex
CREATE INDEX "BeliefEdge_fromNodeId_idx" ON "BeliefEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "BeliefEdge_toNodeId_idx" ON "BeliefEdge"("toNodeId");

-- CreateIndex
CREATE INDEX "BeliefEdge_type_idx" ON "BeliefEdge"("type");

-- CreateIndex
CREATE INDEX "Forecast_tenantId_idx" ON "Forecast"("tenantId");

-- CreateIndex
CREATE INDEX "Forecast_type_idx" ON "Forecast"("type");

-- CreateIndex
CREATE INDEX "Forecast_createdAt_idx" ON "Forecast"("createdAt");

-- CreateIndex
CREATE INDEX "AAALArtifact_tenantId_idx" ON "AAALArtifact"("tenantId");

-- CreateIndex
CREATE INDEX "AAALArtifact_status_idx" ON "AAALArtifact"("status");

-- CreateIndex
CREATE INDEX "AAALArtifact_createdAt_idx" ON "AAALArtifact"("createdAt");

-- CreateIndex
CREATE INDEX "AAALArtifactEvidence_artifactId_idx" ON "AAALArtifactEvidence"("artifactId");

-- CreateIndex
CREATE INDEX "AAALArtifactEvidence_evidenceId_idx" ON "AAALArtifactEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "AAALArtifactEvidence_artifactId_evidenceId_key" ON "AAALArtifactEvidence"("artifactId", "evidenceId");

-- CreateIndex
CREATE INDEX "Approval_tenantId_idx" ON "Approval"("tenantId");

-- CreateIndex
CREATE INDEX "Approval_resourceType_resourceId_idx" ON "Approval"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "Approval_decision_idx" ON "Approval"("decision");

-- CreateIndex
CREATE INDEX "Approval_createdAt_idx" ON "Approval"("createdAt");

-- CreateIndex
CREATE INDEX "Playbook_tenantId_idx" ON "Playbook"("tenantId");

-- CreateIndex
CREATE INDEX "PlaybookExecution_playbookId_idx" ON "PlaybookExecution"("playbookId");

-- CreateIndex
CREATE INDEX "PlaybookExecution_status_idx" ON "PlaybookExecution"("status");

-- CreateIndex
CREATE INDEX "PlaybookExecution_startedAt_idx" ON "PlaybookExecution"("startedAt");

-- CreateIndex
CREATE INDEX "SourcePolicy_tenantId_idx" ON "SourcePolicy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePolicy_tenantId_sourceType_key" ON "SourcePolicy"("tenantId", "sourceType");

-- CreateIndex
CREATE INDEX "Entitlement_tenantId_idx" ON "Entitlement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_tenantId_metric_key" ON "Entitlement"("tenantId", "metric");

-- CreateIndex
CREATE INDEX "MeteringCounter_tenantId_idx" ON "MeteringCounter"("tenantId");

-- CreateIndex
CREATE INDEX "MeteringCounter_nextReset_idx" ON "MeteringCounter"("nextReset");

-- CreateIndex
CREATE UNIQUE INDEX "MeteringCounter_tenantId_metric_period_key" ON "MeteringCounter"("tenantId", "metric", "period");

-- CreateIndex
CREATE INDEX "Connector_tenantId_idx" ON "Connector"("tenantId");

-- CreateIndex
CREATE INDEX "Connector_type_idx" ON "Connector"("type");

-- CreateIndex
CREATE INDEX "Connector_status_idx" ON "Connector"("status");

-- CreateIndex
CREATE INDEX "Connector_enabled_idx" ON "Connector"("enabled");

-- CreateIndex
CREATE INDEX "ConnectorRun_connectorId_idx" ON "ConnectorRun"("connectorId");

-- CreateIndex
CREATE INDEX "ConnectorRun_status_idx" ON "ConnectorRun"("status");

-- CreateIndex
CREATE INDEX "ConnectorRun_startedAt_idx" ON "ConnectorRun"("startedAt");

-- CreateIndex
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");

-- CreateIndex
CREATE INDEX "ApiKey_service_idx" ON "ApiKey"("service");

-- CreateIndex
CREATE INDEX "ApiKey_revoked_idx" ON "ApiKey"("revoked");

-- CreateIndex
CREATE INDEX "AIAnswerSnapshot_tenantId_idx" ON "AIAnswerSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "AIAnswerSnapshot_engine_idx" ON "AIAnswerSnapshot"("engine");

-- CreateIndex
CREATE INDEX "AIAnswerSnapshot_query_idx" ON "AIAnswerSnapshot"("query");

-- CreateIndex
CREATE INDEX "AIAnswerSnapshot_createdAt_idx" ON "AIAnswerSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEvidence" ADD CONSTRAINT "EventEvidence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEvidence" ADD CONSTRAINT "EventEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOutbox" ADD CONSTRAINT "EventOutbox_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClaimCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimCluster" ADD CONSTRAINT "ClaimCluster_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimCluster" ADD CONSTRAINT "ClaimCluster_primaryClaimId_fkey" FOREIGN KEY ("primaryClaimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefNode" ADD CONSTRAINT "BeliefNode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefEdge" ADD CONSTRAINT "BeliefEdge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefEdge" ADD CONSTRAINT "BeliefEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "BeliefNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefEdge" ADD CONSTRAINT "BeliefEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "BeliefNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AAALArtifact" ADD CONSTRAINT "AAALArtifact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AAALArtifactEvidence" ADD CONSTRAINT "AAALArtifactEvidence_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AAALArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AAALArtifactEvidence" ADD CONSTRAINT "AAALArtifactEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AAALArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookExecution" ADD CONSTRAINT "PlaybookExecution_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePolicy" ADD CONSTRAINT "SourcePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeteringCounter" ADD CONSTRAINT "MeteringCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRun" ADD CONSTRAINT "ConnectorRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnswerSnapshot" ADD CONSTRAINT "AIAnswerSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
