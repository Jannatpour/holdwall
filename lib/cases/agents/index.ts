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

export { intakeAgent, IntakeAgent } from "./intake-agent";
export { autonomousTriageAgent as triageAgent } from "../autonomous-triage";
export { AutonomousResolutionGenerator as resolutionAgent } from "../resolution-generator";
export { evidenceAgent, EvidenceAgent } from "./evidence-agent";
export { approvalAgent, ApprovalAgent } from "./approval-agent";
export { publishingAgent, PublishingAgent } from "./publishing-agent";
export { learningAgent, LearningAgent } from "./learning-agent";
export { preventionAgent, PreventionAgent } from "./prevention-agent";
export { claimsAdjudicationPattern, ClaimsAdjudicationPattern } from "./claims-adjudication";
export { hubSpokeOrchestrator, HubSpokeOrchestrator } from "./hub-spoke-orchestrator";

/**
 * Agent Orchestrator
 * 
 * Coordinates all 8 agents for end-to-end case processing
 */
export class CaseAgentOrchestrator {
  /**
   * Process case through all agents
   */
  async processCase(caseId: string, tenantId: string): Promise<{
    success: boolean;
    steps: Array<{ agent: string; status: string; result?: unknown }>;
  }> {
    const steps: Array<{ agent: string; status: string; result?: unknown }> = [];

    try {
      // Step 1: Evidence Agent - Gather evidence
      steps.push({ agent: "evidence", status: "running" });
      const { evidenceAgent } = await import("./evidence-agent");
      const case_ = await (await import("@/lib/db/client")).db.case.findUnique({
        where: { id: caseId },
      });
      const resolution = case_
        ? await (await import("@/lib/db/client")).db.caseResolution.findUnique({
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
      const { approvalAgent } = await import("./approval-agent");
      if (case_) {
        const approvalDecision = await approvalAgent.determineApprovalNecessity(
          case_,
          resolution || undefined
        );
        steps[steps.length - 1] = { agent: "approval", status: "completed", result: approvalDecision };
      }

      // Step 5: Publishing Agent - Determine publishing strategy
      steps.push({ agent: "publishing", status: "running" });
      const { publishingAgent } = await import("./publishing-agent");
      if (case_ && resolution) {
        const publishingDecision = await publishingAgent.determinePublishingStrategy(
          case_,
          resolution
        );
        steps[steps.length - 1] = { agent: "publishing", status: "completed", result: publishingDecision };
      }

      // Step 6: Learning Agent - Learn from outcome (async)
      setImmediate(async () => {
        try {
          const { learningAgent } = await import("./learning-agent");
          await learningAgent.learnFromOutcomes(tenantId);
        } catch (error) {
          (await import("@/lib/logging/logger")).logger.error("Learning agent failed", { error });
        }
      });

      // Step 7: Prevention Agent - Generate predictions (async)
      setImmediate(async () => {
        try {
          const { preventionAgent } = await import("./prevention-agent");
          await preventionAgent.predictIssues(tenantId);
        } catch (error) {
          (await import("@/lib/logging/logger")).logger.error("Prevention agent failed", { error });
        }
      });

      // Step 8: VIGIL Runtime - Monitor and self-heal (async)
      setImmediate(async () => {
        try {
          const { vigilRuntime } = await import("@/lib/ai/vigil-runtime");
          if (case_) {
            await vigilRuntime.inspect(
              "case-agent-orchestrator",
              case_.id,
              { caseId: case_.id, status: case_.status },
              ["quality", "consistency"],
              tenantId
            );
          }
        } catch (error) {
          (await import("@/lib/logging/logger")).logger.error("VIGIL runtime failed", { error });
        }
      });

      return {
        success: true,
        steps,
      };
    } catch (error) {
      (await import("@/lib/logging/logger")).logger.error("Agent orchestration failed", {
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

export const caseAgentOrchestrator = new CaseAgentOrchestrator();
