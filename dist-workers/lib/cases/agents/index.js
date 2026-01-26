"use strict";
/**
 * Autonomous Agent Architecture
 *
 * 8 specialized agents for end-to-end autonomous case management:
 * 1. Intake Agent - Autonomous case creation and enrichment
 * 2. Triage Agent - Self-healing triage with continuous learning
 * 3. Resolution Agent - Autonomous resolution plan generation
 * 4. Evidence Agent - Self-directed evidence gathering
 * 5. Approval Agent - Intelligent approval routing
 * 6. Publishing Agent - Autonomous artifact publishing
 * 7. Learning Agent - Continuous improvement from outcomes
 * 8. Prevention Agent - Predictive issue prevention
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.caseAgentOrchestrator = exports.CaseAgentOrchestrator = exports.HubSpokeOrchestrator = exports.hubSpokeOrchestrator = exports.ClaimsAdjudicationPattern = exports.claimsAdjudicationPattern = exports.PreventionAgent = exports.preventionAgent = exports.LearningAgent = exports.learningAgent = exports.PublishingAgent = exports.publishingAgent = exports.ApprovalAgent = exports.approvalAgent = exports.EvidenceAgent = exports.evidenceAgent = exports.resolutionAgent = exports.triageAgent = exports.IntakeAgent = exports.intakeAgent = void 0;
var intake_agent_1 = require("./intake-agent");
Object.defineProperty(exports, "intakeAgent", { enumerable: true, get: function () { return intake_agent_1.intakeAgent; } });
Object.defineProperty(exports, "IntakeAgent", { enumerable: true, get: function () { return intake_agent_1.IntakeAgent; } });
var autonomous_triage_1 = require("../autonomous-triage");
Object.defineProperty(exports, "triageAgent", { enumerable: true, get: function () { return autonomous_triage_1.autonomousTriageAgent; } });
var resolution_generator_1 = require("../resolution-generator");
Object.defineProperty(exports, "resolutionAgent", { enumerable: true, get: function () { return resolution_generator_1.AutonomousResolutionGenerator; } });
var evidence_agent_1 = require("./evidence-agent");
Object.defineProperty(exports, "evidenceAgent", { enumerable: true, get: function () { return evidence_agent_1.evidenceAgent; } });
Object.defineProperty(exports, "EvidenceAgent", { enumerable: true, get: function () { return evidence_agent_1.EvidenceAgent; } });
var approval_agent_1 = require("./approval-agent");
Object.defineProperty(exports, "approvalAgent", { enumerable: true, get: function () { return approval_agent_1.approvalAgent; } });
Object.defineProperty(exports, "ApprovalAgent", { enumerable: true, get: function () { return approval_agent_1.ApprovalAgent; } });
var publishing_agent_1 = require("./publishing-agent");
Object.defineProperty(exports, "publishingAgent", { enumerable: true, get: function () { return publishing_agent_1.publishingAgent; } });
Object.defineProperty(exports, "PublishingAgent", { enumerable: true, get: function () { return publishing_agent_1.PublishingAgent; } });
var learning_agent_1 = require("./learning-agent");
Object.defineProperty(exports, "learningAgent", { enumerable: true, get: function () { return learning_agent_1.learningAgent; } });
Object.defineProperty(exports, "LearningAgent", { enumerable: true, get: function () { return learning_agent_1.LearningAgent; } });
var prevention_agent_1 = require("./prevention-agent");
Object.defineProperty(exports, "preventionAgent", { enumerable: true, get: function () { return prevention_agent_1.preventionAgent; } });
Object.defineProperty(exports, "PreventionAgent", { enumerable: true, get: function () { return prevention_agent_1.PreventionAgent; } });
var claims_adjudication_1 = require("./claims-adjudication");
Object.defineProperty(exports, "claimsAdjudicationPattern", { enumerable: true, get: function () { return claims_adjudication_1.claimsAdjudicationPattern; } });
Object.defineProperty(exports, "ClaimsAdjudicationPattern", { enumerable: true, get: function () { return claims_adjudication_1.ClaimsAdjudicationPattern; } });
var hub_spoke_orchestrator_1 = require("./hub-spoke-orchestrator");
Object.defineProperty(exports, "hubSpokeOrchestrator", { enumerable: true, get: function () { return hub_spoke_orchestrator_1.hubSpokeOrchestrator; } });
Object.defineProperty(exports, "HubSpokeOrchestrator", { enumerable: true, get: function () { return hub_spoke_orchestrator_1.HubSpokeOrchestrator; } });
/**
 * Agent Orchestrator
 *
 * Coordinates all 8 agents for end-to-end case processing
 */
class CaseAgentOrchestrator {
    /**
     * Process case through all agents
     */
    async processCase(caseId, tenantId) {
        const steps = [];
        try {
            // Step 1: Evidence Agent - Gather evidence
            steps.push({ agent: "evidence", status: "running" });
            const { evidenceAgent } = await Promise.resolve().then(() => __importStar(require("./evidence-agent")));
            const case_ = await (await Promise.resolve().then(() => __importStar(require("@/lib/db/client")))).db.case.findUnique({
                where: { id: caseId },
            });
            const resolution = case_
                ? await (await Promise.resolve().then(() => __importStar(require("@/lib/db/client")))).db.caseResolution.findUnique({
                    where: { caseId },
                })
                : null;
            if (case_) {
                const evidenceResult = await evidenceAgent.gatherEvidence(case_);
                steps[steps.length - 1] = { agent: "evidence", status: "completed", result: evidenceResult };
            }
            // Step 2: Triage Agent - Already handled in playbook execution
            steps.push({ agent: "triage", status: "completed" });
            // Step 3: Resolution Agent - Already handled in playbook execution
            steps.push({ agent: "resolution", status: "completed" });
            // Step 4: Approval Agent - Check if approval needed
            steps.push({ agent: "approval", status: "running" });
            const { approvalAgent } = await Promise.resolve().then(() => __importStar(require("./approval-agent")));
            if (case_) {
                const approvalDecision = await approvalAgent.determineApprovalNecessity(case_, resolution || undefined);
                steps[steps.length - 1] = { agent: "approval", status: "completed", result: approvalDecision };
            }
            // Step 5: Publishing Agent - Determine publishing strategy
            steps.push({ agent: "publishing", status: "running" });
            const { publishingAgent } = await Promise.resolve().then(() => __importStar(require("./publishing-agent")));
            if (case_ && resolution) {
                const publishingDecision = await publishingAgent.determinePublishingStrategy(case_, resolution);
                steps[steps.length - 1] = { agent: "publishing", status: "completed", result: publishingDecision };
            }
            // Step 6: Learning Agent - Learn from outcome (async)
            setImmediate(async () => {
                try {
                    const { learningAgent } = await Promise.resolve().then(() => __importStar(require("./learning-agent")));
                    await learningAgent.learnFromOutcomes(tenantId);
                }
                catch (error) {
                    (await Promise.resolve().then(() => __importStar(require("@/lib/logging/logger")))).logger.error("Learning agent failed", { error });
                }
            });
            // Step 7: Prevention Agent - Generate predictions (async)
            setImmediate(async () => {
                try {
                    const { preventionAgent } = await Promise.resolve().then(() => __importStar(require("./prevention-agent")));
                    await preventionAgent.predictIssues(tenantId);
                }
                catch (error) {
                    (await Promise.resolve().then(() => __importStar(require("@/lib/logging/logger")))).logger.error("Prevention agent failed", { error });
                }
            });
            // Step 8: VIGIL Runtime - Monitor and self-heal (async)
            setImmediate(async () => {
                try {
                    const { vigilRuntime } = await Promise.resolve().then(() => __importStar(require("@/lib/ai/vigil-runtime")));
                    if (case_) {
                        await vigilRuntime.inspect("case-agent-orchestrator", case_.id, { caseId: case_.id, status: case_.status }, ["quality", "consistency"], tenantId);
                    }
                }
                catch (error) {
                    (await Promise.resolve().then(() => __importStar(require("@/lib/logging/logger")))).logger.error("VIGIL runtime failed", { error });
                }
            });
            return {
                success: true,
                steps,
            };
        }
        catch (error) {
            (await Promise.resolve().then(() => __importStar(require("@/lib/logging/logger")))).logger.error("Agent orchestration failed", {
                case_id: caseId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                steps,
            };
        }
    }
}
exports.CaseAgentOrchestrator = CaseAgentOrchestrator;
exports.caseAgentOrchestrator = new CaseAgentOrchestrator();
