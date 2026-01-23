-- CreateEnum
CREATE TYPE "SecurityIncidentType" AS ENUM ('DATA_BREACH', 'RANSOMWARE', 'DDOS', 'PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'INSIDER_THREAT', 'VULNERABILITY_EXPLOIT', 'ACCOUNT_COMPROMISE', 'SYSTEM_COMPROMISE', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "IncidentExplanation" ADD COLUMN "securityIncidentId" TEXT;

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "SecurityIncidentType" NOT NULL,
    "severity" "SecurityIncidentSeverity" NOT NULL,
    "status" "SecurityIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "source" TEXT,
    "sourceMetadata" JSONB,
    "narrativeRiskScore" DOUBLE PRECISION,
    "outbreakProbability" DOUBLE PRECISION,
    "evidenceRefs" TEXT[],
    "explanationId" TEXT,
    "aiCitationRate" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityIncident_tenantId_idx" ON "SecurityIncident"("tenantId");

-- CreateIndex
CREATE INDEX "SecurityIncident_externalId_idx" ON "SecurityIncident"("externalId");

-- CreateIndex
CREATE INDEX "SecurityIncident_type_idx" ON "SecurityIncident"("type");

-- CreateIndex
CREATE INDEX "SecurityIncident_severity_idx" ON "SecurityIncident"("severity");

-- CreateIndex
CREATE INDEX "SecurityIncident_status_idx" ON "SecurityIncident"("status");

-- CreateIndex
CREATE INDEX "SecurityIncident_detectedAt_idx" ON "SecurityIncident"("detectedAt");

-- CreateIndex
CREATE INDEX "SecurityIncident_narrativeRiskScore_idx" ON "SecurityIncident"("narrativeRiskScore");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityIncident_explanationId_key" ON "SecurityIncident"("explanationId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentExplanation_securityIncidentId_key" ON "IncidentExplanation"("securityIncidentId");

-- AddForeignKey
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "IncidentExplanation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentExplanation" ADD CONSTRAINT "IncidentExplanation_securityIncidentId_fkey" FOREIGN KEY ("securityIncidentId") REFERENCES "SecurityIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
