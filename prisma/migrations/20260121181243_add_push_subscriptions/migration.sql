-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EnforcementLevel" AS ENUM ('WARNING', 'BLOCK', 'REQUIRE_FIX');

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "service" TEXT,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rotationPolicy" TEXT NOT NULL DEFAULT 'manual',
    "rotationIntervalDays" INTEGER,
    "lastRotated" TIMESTAMP(3),
    "nextRotation" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "category" TEXT,
    "model" TEXT,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "parameters" JSONB,
    "policyChecks" JSONB,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "deprecatedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptEvaluation" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "evaluationId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB NOT NULL,
    "evaluator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "version" TEXT,
    "status" "ModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "capabilities" TEXT[],
    "rateLimit" JSONB,
    "costPerToken" JSONB,
    "policyChecks" JSONB,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "deprecatedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minCitations" INTEGER NOT NULL DEFAULT 1,
    "maxCitations" INTEGER,
    "requiredTypes" TEXT[],
    "qualityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "enforcement" "EnforcementLevel" NOT NULL DEFAULT 'WARNING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_idx" ON "PushSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "PushSubscription_enabled_idx" ON "PushSubscription"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "Secret_tenantId_idx" ON "Secret"("tenantId");

-- CreateIndex
CREATE INDEX "Secret_name_idx" ON "Secret"("name");

-- CreateIndex
CREATE INDEX "Secret_service_idx" ON "Secret"("service");

-- CreateIndex
CREATE INDEX "Secret_revoked_idx" ON "Secret"("revoked");

-- CreateIndex
CREATE INDEX "Secret_nextRotation_idx" ON "Secret"("nextRotation");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_tenantId_name_version_key" ON "Secret"("tenantId", "name", "version");

-- CreateIndex
CREATE INDEX "Prompt_tenantId_idx" ON "Prompt"("tenantId");

-- CreateIndex
CREATE INDEX "Prompt_name_idx" ON "Prompt"("name");

-- CreateIndex
CREATE INDEX "Prompt_category_idx" ON "Prompt"("category");

-- CreateIndex
CREATE INDEX "Prompt_approved_idx" ON "Prompt"("approved");

-- CreateIndex
CREATE INDEX "Prompt_deprecated_idx" ON "Prompt"("deprecated");

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_tenantId_name_version_key" ON "Prompt"("tenantId", "name", "version");

-- CreateIndex
CREATE INDEX "PromptEvaluation_promptId_idx" ON "PromptEvaluation"("promptId");

-- CreateIndex
CREATE INDEX "PromptEvaluation_score_idx" ON "PromptEvaluation"("score");

-- CreateIndex
CREATE INDEX "PromptEvaluation_createdAt_idx" ON "PromptEvaluation"("createdAt");

-- CreateIndex
CREATE INDEX "AIModel_tenantId_idx" ON "AIModel"("tenantId");

-- CreateIndex
CREATE INDEX "AIModel_name_idx" ON "AIModel"("name");

-- CreateIndex
CREATE INDEX "AIModel_provider_idx" ON "AIModel"("provider");

-- CreateIndex
CREATE INDEX "AIModel_status_idx" ON "AIModel"("status");

-- CreateIndex
CREATE INDEX "AIModel_approved_idx" ON "AIModel"("approved");

-- CreateIndex
CREATE UNIQUE INDEX "AIModel_tenantId_name_version_key" ON "AIModel"("tenantId", "name", "version");

-- CreateIndex
CREATE INDEX "CitationRule_tenantId_idx" ON "CitationRule"("tenantId");

-- CreateIndex
CREATE INDEX "CitationRule_enabled_idx" ON "CitationRule"("enabled");

-- CreateIndex
CREATE INDEX "CitationRule_enforcement_idx" ON "CitationRule"("enforcement");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptEvaluation" ADD CONSTRAINT "PromptEvaluation_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIModel" ADD CONSTRAINT "AIModel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationRule" ADD CONSTRAINT "CitationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
