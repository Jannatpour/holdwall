-- CreateEnum
CREATE TYPE "EvidenceAccessType" AS ENUM ('READ', 'WRITE', 'DELETE', 'EXPORT', 'REDACT');

-- CreateEnum
CREATE TYPE "RedactionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('BRAND', 'REGION', 'DEPARTMENT', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsensusSignalType" AS ENUM ('THIRD_PARTY_ANALYSIS', 'EXPERT_COMMENTARY', 'COMPARATIVE_RESEARCH', 'BALANCED_PERSPECTIVE', 'INDEPENDENT_REVIEW');

-- CreateEnum
CREATE TYPE "ValidatorType" AS ENUM ('INDEPENDENT_AUDIT', 'CERTIFICATION_BODY', 'EXPERT_PANEL', 'RESEARCH_INSTITUTION', 'STANDARDS_ORGANIZATION');

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('SECURITY', 'COMPLIANCE', 'OPERATIONAL', 'FINANCIAL', 'QUALITY');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SLAPeriod" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('ACTIVE', 'ADDRESSED', 'FALSE_POSITIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DecisionStage" AS ENUM ('AWARENESS', 'RESEARCH', 'COMPARISON', 'DECISION', 'POST_PURCHASE');

-- CreateEnum
CREATE TYPE "ControlType" AS ENUM ('NARRATIVE_FRAMING', 'AI_SUMMARY', 'THIRD_PARTY_VALIDATOR', 'PROOF_DASHBOARD', 'REINFORCEMENT_LOOP');

-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('REFUND', 'ESCALATION', 'SUPPORT_TICKET', 'APOLOGY', 'CLARIFICATION');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ResolutionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'ORGANIZATION', 'POLICY', 'VENDOR', 'SYSTEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ChangeEventType" AS ENUM ('POLICY_REVISION', 'VENDOR_TERMINATION', 'LEADERSHIP_CHANGE', 'CONTROL_ADDED', 'PROCESS_CHANGE', 'SYSTEM_UPDATE', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('DISPUTE', 'FRAUD_ATO', 'OUTAGE_DELAY', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('SUBMITTED', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CaseSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "CaseEvidenceType" AS ENUM ('UPLOAD', 'LINK', 'INTERNAL_LOG', 'TRANSACTION');

-- CreateEnum
CREATE TYPE "CaseEvidenceRole" AS ENUM ('PRIMARY', 'SUPPORTING', 'REFUTATION');

-- CreateEnum
CREATE TYPE "CaseResolutionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CaseNotificationType" AS ENUM ('EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "CaseNotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'OPENED', 'FAILED');

-- CreateEnum
CREATE TYPE "CaseVerificationMethod" AS ENUM ('EMAIL', 'PHONE', 'DOCUMENT', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "CaseVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CaseRelationshipType" AS ENUM ('RELATED', 'DUPLICATE', 'PARENT', 'CHILD', 'LINKED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('running', 'completed', 'failed', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "PluginType" AS ENUM ('workflow_action', 'business_rule', 'integration', 'ai_model', 'data_transform', 'custom_handler', 'validator', 'notifier', 'analyzer');

-- DropForeignKey
ALTER TABLE "SecurityIncident" DROP CONSTRAINT "SecurityIncident_explanationId_fkey";

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "breakGlass" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breakGlassAt" TIMESTAMP(3),
ADD COLUMN     "breakGlassBy" TEXT,
ADD COLUMN     "breakGlassReason" TEXT,
ADD COLUMN     "currentStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSteps" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "workflowId" TEXT,
ADD COLUMN     "workspaceId" TEXT;

-- CreateTable
CREATE TABLE "EvidenceVersion" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "contentHash" VARCHAR(64) NOT NULL,
    "merkleHash" VARCHAR(64),
    "signature" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "EvidenceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAccessLog" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "accessType" "EvidenceAccessType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRedaction" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "redactedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "beforeContent" TEXT,
    "afterContent" TEXT,
    "redactionMap" JSONB NOT NULL,
    "reason" TEXT,
    "status" "RedactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "EvidenceRedaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventProcessing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worker" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PROCESSING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "EventProcessing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverRole" TEXT,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "decision" "ApprovalDecision",
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resourceType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalBreakGlass" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "justification" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalBreakGlass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL DEFAULT 'BRAND',
    "region" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceUser" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMandate" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSignature" (
    "id" TEXT NOT NULL,
    "signatureId" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "mandateId" TEXT,
    "transactionId" TEXT,
    "description" TEXT,
    "balance" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLimit" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "limitType" TEXT NOT NULL,
    "limitAmount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "mandateId" TEXT,
    "transactionId" TEXT,
    "action" TEXT NOT NULL,
    "fromAgentId" TEXT,
    "toAgentId" TEXT,
    "amount" INTEGER,
    "currency" VARCHAR(3),
    "status" TEXT NOT NULL,
    "error" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsensusSignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ConsensusSignalType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "author" TEXT,
    "authorCredential" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "amplification" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "evidenceRefs" TEXT[],
    "relatedNodeIds" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsensusSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalValidator" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ValidatorType" NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "publicKey" TEXT,
    "trustLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastValidated" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalValidator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AuditType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "auditorId" TEXT,
    "status" "AuditStatus" NOT NULL,
    "findings" JSONB,
    "recommendations" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publicUrl" TEXT,
    "evidenceRefs" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "actual" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "period" "SLAPeriod" NOT NULL,
    "publicUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SLA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebuttalDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetClaimId" TEXT,
    "targetNodeId" TEXT,
    "evidenceRefs" TEXT[],
    "structuredData" JSONB,
    "publicUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RebuttalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricsDashboard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metrics" JSONB NOT NULL,
    "publicUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "refreshInterval" INTEGER,
    "lastRefreshed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricsDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictedComplaint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "predictedTopic" TEXT NOT NULL,
    "predictedContent" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "triggers" JSONB NOT NULL,
    "preemptiveActionId" TEXT,
    "status" "PredictionStatus" NOT NULL,
    "evidenceRefs" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PredictedComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionCheckpoint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stage" "DecisionStage" NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "controlType" "ControlType" NOT NULL,
    "content" JSONB NOT NULL,
    "metrics" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdversarialPattern" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "indicators" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdversarialPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SockpuppetCluster" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "accountIds" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "indicators" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SockpuppetCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "variants" TEXT[],
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossPlatformCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platforms" TEXT[],
    "evidenceIds" TEXT[],
    "timingCorrelation" DOUBLE PRECISION NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossPlatformCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerResolution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "type" "ResolutionType" NOT NULL,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ResolutionPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "customerInfo" JSONB,
    "assignedTo" TEXT,
    "supportTicketId" TEXT,
    "externalTicketId" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionDetails" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationAction" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RemediationStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resolutionId" TEXT,
    "externalSystem" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "currentState" JSONB NOT NULL,
    "stateHistory" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "oldState" JSONB,
    "newState" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRelationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "result" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "effectiveness" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreventiveAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "effectiveness" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreventiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionOwner" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ChangeEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctiveActionId" TEXT,
    "preventiveActionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "correctiveActionId" TEXT,
    "preventiveActionId" TEXT,
    "evidenceId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "type" "CaseType" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "severity" "CaseSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "CasePriority",
    "submittedBy" TEXT NOT NULL,
    "submittedByEmail" TEXT,
    "submittedByName" TEXT,
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "preferredResolution" TEXT,
    "regulatorySensitivity" BOOLEAN NOT NULL DEFAULT false,
    "slaDeadline" TIMESTAMP(3),
    "assignedTo" TEXT,
    "assignedTeam" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "evidenceType" "CaseEvidenceType" NOT NULL,
    "role" "CaseEvidenceRole" NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseResolution" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "customerPlan" JSONB NOT NULL,
    "internalPlan" JSONB NOT NULL,
    "recommendedDecision" TEXT,
    "evidenceChecklist" JSONB NOT NULL,
    "chargebackReadiness" JSONB,
    "safetySteps" JSONB,
    "timeline" JSONB,
    "resolutionArtifactId" TEXT,
    "internalPacketId" TEXT,
    "status" "CaseResolutionStatus" NOT NULL DEFAULT 'DRAFT',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePlaybookExecution" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" JSONB,
    "tenantId" TEXT,

    CONSTRAINT "CasePlaybookExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseComment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "parentCommentId" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#3B82F6',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTagAssignment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "CaseTagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseWebhook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseNotification" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "type" "CaseNotificationType" NOT NULL,
    "status" "CaseNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseVerification" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "method" "CaseVerificationMethod" NOT NULL,
    "status" "CaseVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEscalation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fromLevel" TEXT NOT NULL,
    "toLevel" TEXT NOT NULL,
    "escalatedBy" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CaseType" NOT NULL,
    "description" TEXT,
    "template" JSONB NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRelationship" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "relatedCaseId" TEXT NOT NULL,
    "relationshipType" "CaseRelationshipType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'draft',
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "variables" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'running',
    "currentStepId" TEXT,
    "stepResults" JSONB,
    "context" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PluginType" NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "handler" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceVersion_evidenceId_idx" ON "EvidenceVersion"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceVersion_tenantId_idx" ON "EvidenceVersion"("tenantId");

-- CreateIndex
CREATE INDEX "EvidenceVersion_contentHash_idx" ON "EvidenceVersion"("contentHash");

-- CreateIndex
CREATE INDEX "EvidenceVersion_createdAt_idx" ON "EvidenceVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceVersion_evidenceId_versionNumber_key" ON "EvidenceVersion"("evidenceId", "versionNumber");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_evidenceId_idx" ON "EvidenceAccessLog"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_tenantId_idx" ON "EvidenceAccessLog"("tenantId");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_actorId_idx" ON "EvidenceAccessLog"("actorId");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_accessType_idx" ON "EvidenceAccessLog"("accessType");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_createdAt_idx" ON "EvidenceAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "EvidenceRedaction_evidenceId_idx" ON "EvidenceRedaction"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceRedaction_tenantId_idx" ON "EvidenceRedaction"("tenantId");

-- CreateIndex
CREATE INDEX "EvidenceRedaction_status_idx" ON "EvidenceRedaction"("status");

-- CreateIndex
CREATE INDEX "EvidenceRedaction_createdAt_idx" ON "EvidenceRedaction"("createdAt");

-- CreateIndex
CREATE INDEX "EventProcessing_tenantId_idx" ON "EventProcessing"("tenantId");

-- CreateIndex
CREATE INDEX "EventProcessing_status_idx" ON "EventProcessing"("status");

-- CreateIndex
CREATE INDEX "EventProcessing_startedAt_idx" ON "EventProcessing"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventProcessing_worker_eventId_key" ON "EventProcessing"("worker", "eventId");

-- CreateIndex
CREATE INDEX "ApprovalStep_approvalId_idx" ON "ApprovalStep"("approvalId");

-- CreateIndex
CREATE INDEX "ApprovalStep_status_idx" ON "ApprovalStep"("status");

-- CreateIndex
CREATE INDEX "ApprovalStep_createdAt_idx" ON "ApprovalStep"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_approvalId_stepNumber_key" ON "ApprovalStep"("approvalId", "stepNumber");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_tenantId_idx" ON "ApprovalWorkflow"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_isActive_idx" ON "ApprovalWorkflow"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_tenantId_resourceType_action_key" ON "ApprovalWorkflow"("tenantId", "resourceType", "action");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalBreakGlass_approvalId_key" ON "ApprovalBreakGlass"("approvalId");

-- CreateIndex
CREATE INDEX "ApprovalBreakGlass_tenantId_idx" ON "ApprovalBreakGlass"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalBreakGlass_createdAt_idx" ON "ApprovalBreakGlass"("createdAt");

-- CreateIndex
CREATE INDEX "Workspace_tenantId_idx" ON "Workspace"("tenantId");

-- CreateIndex
CREATE INDEX "Workspace_type_idx" ON "Workspace"("type");

-- CreateIndex
CREATE INDEX "Workspace_isActive_idx" ON "Workspace"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_tenantId_slug_key" ON "Workspace"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "WorkspaceUser_workspaceId_idx" ON "WorkspaceUser"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceUser_userId_idx" ON "WorkspaceUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceUser_workspaceId_userId_key" ON "WorkspaceUser"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMandate_mandateId_key" ON "PaymentMandate"("mandateId");

-- CreateIndex
CREATE INDEX "PaymentMandate_mandateId_idx" ON "PaymentMandate"("mandateId");

-- CreateIndex
CREATE INDEX "PaymentMandate_fromAgentId_idx" ON "PaymentMandate"("fromAgentId");

-- CreateIndex
CREATE INDEX "PaymentMandate_toAgentId_idx" ON "PaymentMandate"("toAgentId");

-- CreateIndex
CREATE INDEX "PaymentMandate_status_idx" ON "PaymentMandate"("status");

-- CreateIndex
CREATE INDEX "PaymentMandate_expiresAt_idx" ON "PaymentMandate"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSignature_signatureId_key" ON "PaymentSignature"("signatureId");

-- CreateIndex
CREATE INDEX "PaymentSignature_mandateId_idx" ON "PaymentSignature"("mandateId");

-- CreateIndex
CREATE INDEX "PaymentSignature_agentId_idx" ON "PaymentSignature"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedgerEntry_entryId_key" ON "WalletLedgerEntry"("entryId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_walletId_idx" ON "WalletLedgerEntry"("walletId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_agentId_idx" ON "WalletLedgerEntry"("agentId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_currency_idx" ON "WalletLedgerEntry"("currency");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_mandateId_idx" ON "WalletLedgerEntry"("mandateId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_transactionId_idx" ON "WalletLedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_timestamp_idx" ON "WalletLedgerEntry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLimit_walletId_key" ON "WalletLimit"("walletId");

-- CreateIndex
CREATE INDEX "WalletLimit_agentId_idx" ON "WalletLimit"("agentId");

-- CreateIndex
CREATE INDEX "WalletLimit_currency_idx" ON "WalletLimit"("currency");

-- CreateIndex
CREATE INDEX "WalletLimit_resetAt_idx" ON "WalletLimit"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAuditLog_auditId_key" ON "PaymentAuditLog"("auditId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_mandateId_idx" ON "PaymentAuditLog"("mandateId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_transactionId_idx" ON "PaymentAuditLog"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_fromAgentId_idx" ON "PaymentAuditLog"("fromAgentId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_toAgentId_idx" ON "PaymentAuditLog"("toAgentId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_action_idx" ON "PaymentAuditLog"("action");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_timestamp_idx" ON "PaymentAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "ConsensusSignal_tenantId_idx" ON "ConsensusSignal"("tenantId");

-- CreateIndex
CREATE INDEX "ConsensusSignal_type_idx" ON "ConsensusSignal"("type");

-- CreateIndex
CREATE INDEX "ConsensusSignal_publishedAt_idx" ON "ConsensusSignal"("publishedAt");

-- CreateIndex
CREATE INDEX "ConsensusSignal_relevanceScore_idx" ON "ConsensusSignal"("relevanceScore");

-- CreateIndex
CREATE INDEX "ConsensusSignal_trustScore_idx" ON "ConsensusSignal"("trustScore");

-- CreateIndex
CREATE INDEX "ExternalValidator_tenantId_idx" ON "ExternalValidator"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalValidator_type_idx" ON "ExternalValidator"("type");

-- CreateIndex
CREATE INDEX "ExternalValidator_isActive_idx" ON "ExternalValidator"("isActive");

-- CreateIndex
CREATE INDEX "Audit_tenantId_idx" ON "Audit"("tenantId");

-- CreateIndex
CREATE INDEX "Audit_type_idx" ON "Audit"("type");

-- CreateIndex
CREATE INDEX "Audit_status_idx" ON "Audit"("status");

-- CreateIndex
CREATE INDEX "Audit_publishedAt_idx" ON "Audit"("publishedAt");

-- CreateIndex
CREATE INDEX "SLA_tenantId_idx" ON "SLA"("tenantId");

-- CreateIndex
CREATE INDEX "SLA_isPublic_idx" ON "SLA"("isPublic");

-- CreateIndex
CREATE INDEX "SLA_lastUpdated_idx" ON "SLA"("lastUpdated");

-- CreateIndex
CREATE INDEX "RebuttalDocument_tenantId_idx" ON "RebuttalDocument"("tenantId");

-- CreateIndex
CREATE INDEX "RebuttalDocument_targetClaimId_idx" ON "RebuttalDocument"("targetClaimId");

-- CreateIndex
CREATE INDEX "RebuttalDocument_targetNodeId_idx" ON "RebuttalDocument"("targetNodeId");

-- CreateIndex
CREATE INDEX "RebuttalDocument_isPublished_idx" ON "RebuttalDocument"("isPublished");

-- CreateIndex
CREATE INDEX "MetricsDashboard_tenantId_idx" ON "MetricsDashboard"("tenantId");

-- CreateIndex
CREATE INDEX "MetricsDashboard_isPublic_idx" ON "MetricsDashboard"("isPublic");

-- CreateIndex
CREATE INDEX "PredictedComplaint_tenantId_idx" ON "PredictedComplaint"("tenantId");

-- CreateIndex
CREATE INDEX "PredictedComplaint_status_idx" ON "PredictedComplaint"("status");

-- CreateIndex
CREATE INDEX "PredictedComplaint_probability_idx" ON "PredictedComplaint"("probability");

-- CreateIndex
CREATE INDEX "PredictedComplaint_createdAt_idx" ON "PredictedComplaint"("createdAt");

-- CreateIndex
CREATE INDEX "DecisionCheckpoint_tenantId_idx" ON "DecisionCheckpoint"("tenantId");

-- CreateIndex
CREATE INDEX "DecisionCheckpoint_stage_idx" ON "DecisionCheckpoint"("stage");

-- CreateIndex
CREATE INDEX "DecisionCheckpoint_isActive_idx" ON "DecisionCheckpoint"("isActive");

-- CreateIndex
CREATE INDEX "AdversarialPattern_tenantId_idx" ON "AdversarialPattern"("tenantId");

-- CreateIndex
CREATE INDEX "AdversarialPattern_evidenceId_idx" ON "AdversarialPattern"("evidenceId");

-- CreateIndex
CREATE INDEX "AdversarialPattern_patternType_idx" ON "AdversarialPattern"("patternType");

-- CreateIndex
CREATE INDEX "AdversarialPattern_createdAt_idx" ON "AdversarialPattern"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SockpuppetCluster_clusterId_key" ON "SockpuppetCluster"("clusterId");

-- CreateIndex
CREATE INDEX "SockpuppetCluster_tenantId_idx" ON "SockpuppetCluster"("tenantId");

-- CreateIndex
CREATE INDEX "SockpuppetCluster_createdAt_idx" ON "SockpuppetCluster"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimTemplate_templateId_key" ON "ClaimTemplate"("templateId");

-- CreateIndex
CREATE INDEX "ClaimTemplate_tenantId_idx" ON "ClaimTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "ClaimTemplate_templateId_idx" ON "ClaimTemplate"("templateId");

-- CreateIndex
CREATE INDEX "ClaimTemplate_lastSeen_idx" ON "ClaimTemplate"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "CrossPlatformCampaign_campaignId_key" ON "CrossPlatformCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "CrossPlatformCampaign_tenantId_idx" ON "CrossPlatformCampaign"("tenantId");

-- CreateIndex
CREATE INDEX "CrossPlatformCampaign_campaignId_idx" ON "CrossPlatformCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "CrossPlatformCampaign_createdAt_idx" ON "CrossPlatformCampaign"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerResolution_supportTicketId_key" ON "CustomerResolution"("supportTicketId");

-- CreateIndex
CREATE INDEX "CustomerResolution_tenantId_idx" ON "CustomerResolution"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerResolution_clusterId_idx" ON "CustomerResolution"("clusterId");

-- CreateIndex
CREATE INDEX "CustomerResolution_status_idx" ON "CustomerResolution"("status");

-- CreateIndex
CREATE INDEX "CustomerResolution_priority_idx" ON "CustomerResolution"("priority");

-- CreateIndex
CREATE INDEX "CustomerResolution_assignedTo_idx" ON "CustomerResolution"("assignedTo");

-- CreateIndex
CREATE INDEX "CustomerResolution_createdAt_idx" ON "CustomerResolution"("createdAt");

-- CreateIndex
CREATE INDEX "RemediationAction_tenantId_idx" ON "RemediationAction"("tenantId");

-- CreateIndex
CREATE INDEX "RemediationAction_resolutionId_idx" ON "RemediationAction"("resolutionId");

-- CreateIndex
CREATE INDEX "RemediationAction_status_idx" ON "RemediationAction"("status");

-- CreateIndex
CREATE INDEX "RemediationAction_assignedTo_idx" ON "RemediationAction"("assignedTo");

-- CreateIndex
CREATE INDEX "RemediationAction_createdAt_idx" ON "RemediationAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_resolutionId_key" ON "SupportTicket"("resolutionId");

-- CreateIndex
CREATE INDEX "SupportTicket_tenantId_idx" ON "SupportTicket"("tenantId");

-- CreateIndex
CREATE INDEX "SupportTicket_externalSystem_idx" ON "SupportTicket"("externalSystem");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "Entity_tenantId_idx" ON "Entity"("tenantId");

-- CreateIndex
CREATE INDEX "Entity_type_idx" ON "Entity"("type");

-- CreateIndex
CREATE INDEX "Entity_name_idx" ON "Entity"("name");

-- CreateIndex
CREATE INDEX "Entity_createdAt_idx" ON "Entity"("createdAt");

-- CreateIndex
CREATE INDEX "EntityEvent_tenantId_idx" ON "EntityEvent"("tenantId");

-- CreateIndex
CREATE INDEX "EntityEvent_entityId_idx" ON "EntityEvent"("entityId");

-- CreateIndex
CREATE INDEX "EntityEvent_type_idx" ON "EntityEvent"("type");

-- CreateIndex
CREATE INDEX "EntityEvent_changedAt_idx" ON "EntityEvent"("changedAt");

-- CreateIndex
CREATE INDEX "EntityRelationship_tenantId_idx" ON "EntityRelationship"("tenantId");

-- CreateIndex
CREATE INDEX "EntityRelationship_fromEntityId_idx" ON "EntityRelationship"("fromEntityId");

-- CreateIndex
CREATE INDEX "EntityRelationship_toEntityId_idx" ON "EntityRelationship"("toEntityId");

-- CreateIndex
CREATE INDEX "EntityRelationship_relationshipType_idx" ON "EntityRelationship"("relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRelationship_fromEntityId_toEntityId_relationshipType_key" ON "EntityRelationship"("fromEntityId", "toEntityId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_tenantId_idx" ON "IdempotencyKey"("tenantId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_operation_idx" ON "IdempotencyKey"("operation");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "CorrectiveAction_tenantId_idx" ON "CorrectiveAction"("tenantId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_clusterId_idx" ON "CorrectiveAction"("clusterId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_status_idx" ON "CorrectiveAction"("status");

-- CreateIndex
CREATE INDEX "CorrectiveAction_ownerId_idx" ON "CorrectiveAction"("ownerId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_createdAt_idx" ON "CorrectiveAction"("createdAt");

-- CreateIndex
CREATE INDEX "PreventiveAction_tenantId_idx" ON "PreventiveAction"("tenantId");

-- CreateIndex
CREATE INDEX "PreventiveAction_clusterId_idx" ON "PreventiveAction"("clusterId");

-- CreateIndex
CREATE INDEX "PreventiveAction_status_idx" ON "PreventiveAction"("status");

-- CreateIndex
CREATE INDEX "PreventiveAction_ownerId_idx" ON "PreventiveAction"("ownerId");

-- CreateIndex
CREATE INDEX "PreventiveAction_createdAt_idx" ON "PreventiveAction"("createdAt");

-- CreateIndex
CREATE INDEX "ActionOwner_tenantId_idx" ON "ActionOwner"("tenantId");

-- CreateIndex
CREATE INDEX "ActionOwner_userId_idx" ON "ActionOwner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionOwner_tenantId_userId_key" ON "ActionOwner"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ChangeEvent_tenantId_idx" ON "ChangeEvent"("tenantId");

-- CreateIndex
CREATE INDEX "ChangeEvent_type_idx" ON "ChangeEvent"("type");

-- CreateIndex
CREATE INDEX "ChangeEvent_changedAt_idx" ON "ChangeEvent"("changedAt");

-- CreateIndex
CREATE INDEX "ChangeEvent_correctiveActionId_idx" ON "ChangeEvent"("correctiveActionId");

-- CreateIndex
CREATE INDEX "ChangeEvent_preventiveActionId_idx" ON "ChangeEvent"("preventiveActionId");

-- CreateIndex
CREATE INDEX "ActionEvidence_tenantId_idx" ON "ActionEvidence"("tenantId");

-- CreateIndex
CREATE INDEX "ActionEvidence_evidenceId_idx" ON "ActionEvidence"("evidenceId");

-- CreateIndex
CREATE INDEX "ActionEvidence_correctiveActionId_idx" ON "ActionEvidence"("correctiveActionId");

-- CreateIndex
CREATE INDEX "ActionEvidence_preventiveActionId_idx" ON "ActionEvidence"("preventiveActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionEvidence_correctiveActionId_evidenceId_key" ON "ActionEvidence"("correctiveActionId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionEvidence_preventiveActionId_evidenceId_key" ON "ActionEvidence"("preventiveActionId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");

-- CreateIndex
CREATE INDEX "Case_tenantId_status_idx" ON "Case"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Case_tenantId_type_idx" ON "Case"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Case_tenantId_severity_idx" ON "Case"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "Case_caseNumber_idx" ON "Case"("caseNumber");

-- CreateIndex
CREATE INDEX "Case_submittedBy_idx" ON "Case"("submittedBy");

-- CreateIndex
CREATE INDEX "Case_slaDeadline_idx" ON "Case"("slaDeadline");

-- CreateIndex
CREATE INDEX "Case_priority_idx" ON "Case"("priority");

-- CreateIndex
CREATE INDEX "Case_assignedTo_idx" ON "Case"("assignedTo");

-- CreateIndex
CREATE INDEX "Case_createdAt_idx" ON "Case"("createdAt");

-- CreateIndex
CREATE INDEX "CaseEvidence_caseId_idx" ON "CaseEvidence"("caseId");

-- CreateIndex
CREATE INDEX "CaseEvidence_evidenceId_idx" ON "CaseEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseEvidence_caseId_evidenceId_key" ON "CaseEvidence"("caseId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseResolution_caseId_key" ON "CaseResolution"("caseId");

-- CreateIndex
CREATE INDEX "CaseResolution_caseId_idx" ON "CaseResolution"("caseId");

-- CreateIndex
CREATE INDEX "CaseResolution_status_idx" ON "CaseResolution"("status");

-- CreateIndex
CREATE INDEX "CasePlaybookExecution_caseId_idx" ON "CasePlaybookExecution"("caseId");

-- CreateIndex
CREATE INDEX "CasePlaybookExecution_playbookId_idx" ON "CasePlaybookExecution"("playbookId");

-- CreateIndex
CREATE INDEX "CasePlaybookExecution_triggeredAt_idx" ON "CasePlaybookExecution"("triggeredAt");

-- CreateIndex
CREATE INDEX "CaseComment_caseId_idx" ON "CaseComment"("caseId");

-- CreateIndex
CREATE INDEX "CaseComment_authorId_idx" ON "CaseComment"("authorId");

-- CreateIndex
CREATE INDEX "CaseComment_createdAt_idx" ON "CaseComment"("createdAt");

-- CreateIndex
CREATE INDEX "CaseComment_parentCommentId_idx" ON "CaseComment"("parentCommentId");

-- CreateIndex
CREATE INDEX "CaseTag_tenantId_idx" ON "CaseTag"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseTag_tenantId_name_key" ON "CaseTag"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CaseTagAssignment_caseId_idx" ON "CaseTagAssignment"("caseId");

-- CreateIndex
CREATE INDEX "CaseTagAssignment_tagId_idx" ON "CaseTagAssignment"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseTagAssignment_caseId_tagId_key" ON "CaseTagAssignment"("caseId", "tagId");

-- CreateIndex
CREATE INDEX "CaseWebhook_tenantId_idx" ON "CaseWebhook"("tenantId");

-- CreateIndex
CREATE INDEX "CaseWebhook_enabled_idx" ON "CaseWebhook"("enabled");

-- CreateIndex
CREATE INDEX "CaseNotification_caseId_idx" ON "CaseNotification"("caseId");

-- CreateIndex
CREATE INDEX "CaseNotification_recipient_idx" ON "CaseNotification"("recipient");

-- CreateIndex
CREATE INDEX "CaseNotification_status_idx" ON "CaseNotification"("status");

-- CreateIndex
CREATE INDEX "CaseVerification_caseId_idx" ON "CaseVerification"("caseId");

-- CreateIndex
CREATE INDEX "CaseVerification_status_idx" ON "CaseVerification"("status");

-- CreateIndex
CREATE INDEX "CaseEscalation_caseId_idx" ON "CaseEscalation"("caseId");

-- CreateIndex
CREATE INDEX "CaseEscalation_createdAt_idx" ON "CaseEscalation"("createdAt");

-- CreateIndex
CREATE INDEX "CaseTemplate_tenantId_idx" ON "CaseTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "CaseTemplate_type_idx" ON "CaseTemplate"("type");

-- CreateIndex
CREATE INDEX "CaseRelationship_caseId_idx" ON "CaseRelationship"("caseId");

-- CreateIndex
CREATE INDEX "CaseRelationship_relatedCaseId_idx" ON "CaseRelationship"("relatedCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRelationship_caseId_relatedCaseId_relationshipType_key" ON "CaseRelationship"("caseId", "relatedCaseId", "relationshipType");

-- CreateIndex
CREATE INDEX "Workflow_tenantId_status_idx" ON "Workflow"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Workflow_tenantId_name_idx" ON "Workflow"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Workflow_status_idx" ON "Workflow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_tenantId_name_version_key" ON "Workflow"("tenantId", "name", "version");

-- CreateIndex
CREATE INDEX "WorkflowExecution_workflowId_idx" ON "WorkflowExecution"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_tenantId_status_idx" ON "WorkflowExecution"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WorkflowExecution_tenantId_startedAt_idx" ON "WorkflowExecution"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");

-- CreateIndex
CREATE INDEX "Plugin_tenantId_type_idx" ON "Plugin"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Plugin_tenantId_enabled_idx" ON "Plugin"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "Plugin_type_idx" ON "Plugin"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_tenantId_name_version_key" ON "Plugin"("tenantId", "name", "version");

-- CreateIndex
CREATE INDEX "Approval_workspaceId_idx" ON "Approval"("workspaceId");

-- CreateIndex
CREATE INDEX "IncidentExplanation_securityIncidentId_idx" ON "IncidentExplanation"("securityIncidentId");

-- AddForeignKey
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAccessLog" ADD CONSTRAINT "EvidenceAccessLog_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAccessLog" ADD CONSTRAINT "EvidenceAccessLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRedaction" ADD CONSTRAINT "EvidenceRedaction_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRedaction" ADD CONSTRAINT "EvidenceRedaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalBreakGlass" ADD CONSTRAINT "ApprovalBreakGlass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalBreakGlass" ADD CONSTRAINT "ApprovalBreakGlass_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUser" ADD CONSTRAINT "WorkspaceUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsensusSignal" ADD CONSTRAINT "ConsensusSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalValidator" ADD CONSTRAINT "ExternalValidator_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLA" ADD CONSTRAINT "SLA_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuttalDocument" ADD CONSTRAINT "RebuttalDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricsDashboard" ADD CONSTRAINT "MetricsDashboard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictedComplaint" ADD CONSTRAINT "PredictedComplaint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionCheckpoint" ADD CONSTRAINT "DecisionCheckpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdversarialPattern" ADD CONSTRAINT "AdversarialPattern_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdversarialPattern" ADD CONSTRAINT "AdversarialPattern_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SockpuppetCluster" ADD CONSTRAINT "SockpuppetCluster_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTemplate" ADD CONSTRAINT "ClaimTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossPlatformCampaign" ADD CONSTRAINT "CrossPlatformCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerResolution" ADD CONSTRAINT "CustomerResolution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerResolution" ADD CONSTRAINT "CustomerResolution_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClaimCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerResolution" ADD CONSTRAINT "CustomerResolution_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "CustomerResolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityEvent" ADD CONSTRAINT "EntityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityEvent" ADD CONSTRAINT "EntityEvent_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelationship" ADD CONSTRAINT "EntityRelationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelationship" ADD CONSTRAINT "EntityRelationship_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelationship" ADD CONSTRAINT "EntityRelationship_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClaimCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ActionOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAction" ADD CONSTRAINT "PreventiveAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAction" ADD CONSTRAINT "PreventiveAction_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClaimCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAction" ADD CONSTRAINT "PreventiveAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ActionOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionOwner" ADD CONSTRAINT "ActionOwner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_preventiveActionId_fkey" FOREIGN KEY ("preventiveActionId") REFERENCES "PreventiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_preventiveActionId_fkey" FOREIGN KEY ("preventiveActionId") REFERENCES "PreventiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseResolution" ADD CONSTRAINT "CaseResolution_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePlaybookExecution" ADD CONSTRAINT "CasePlaybookExecution_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePlaybookExecution" ADD CONSTRAINT "CasePlaybookExecution_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePlaybookExecution" ADD CONSTRAINT "CasePlaybookExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseComment" ADD CONSTRAINT "CaseComment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseComment" ADD CONSTRAINT "CaseComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "CaseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTag" ADD CONSTRAINT "CaseTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTagAssignment" ADD CONSTRAINT "CaseTagAssignment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTagAssignment" ADD CONSTRAINT "CaseTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CaseTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWebhook" ADD CONSTRAINT "CaseWebhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNotification" ADD CONSTRAINT "CaseNotification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseVerification" ADD CONSTRAINT "CaseVerification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEscalation" ADD CONSTRAINT "CaseEscalation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTemplate" ADD CONSTRAINT "CaseTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelationship" ADD CONSTRAINT "CaseRelationship_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelationship" ADD CONSTRAINT "CaseRelationship_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plugin" ADD CONSTRAINT "Plugin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
