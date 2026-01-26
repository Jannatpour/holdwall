"use strict";
/**
 * Pipeline Worker
 * Processes events from Kafka for claim extraction, graph updates, forecasts, etc.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineWorker = void 0;
exports.startPipelineWorker = startPipelineWorker;
const kafka_consumer_1 = require("@/lib/events/kafka-consumer");
const client_1 = require("@/lib/db/client");
const vault_db_1 = require("@/lib/evidence/vault-db");
const store_db_1 = require("@/lib/events/store-db");
const extraction_1 = require("@/lib/claims/extraction");
const belief_implementation_1 = require("@/lib/graph/belief-implementation");
const service_1 = require("@/lib/forecasts/service");
const orchestrator_1 = require("@/lib/adversarial/orchestrator");
const safety_orchestrator_1 = require("@/lib/evaluation/safety-orchestrator");
const service_2 = require("@/lib/capa/service");
const service_3 = require("@/lib/resolution/service");
const entity_graph_1 = require("@/lib/knowledge/entity-graph");
const timeline_extractor_1 = require("@/lib/temporal/timeline-extractor");
const logger_1 = require("@/lib/logging/logger");
const client_2 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Convenience entrypoint for container/K8s execution.
 * Reads configuration from environment variables.
 */
async function startPipelineWorker() {
    const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const topics = (process.env.KAFKA_EVENTS_TOPIC || "holdwall-events")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const groupId = (process.env.KAFKA_GROUP_ID || "holdwall-pipeline-worker").trim();
    const worker = new PipelineWorker({ brokers, topics, groupId });
    await worker.start();
}
class PipelineWorker {
    constructor(config) {
        this.consumer = null;
        this.workerName = "pipeline-worker";
        this.evidenceVault = new vault_db_1.DatabaseEvidenceVault();
        this.eventStore = new store_db_1.DatabaseEventStore();
        this.claimExtractor = new extraction_1.ClaimExtractionService(this.evidenceVault, this.eventStore);
        this.beliefGraph = new belief_implementation_1.DatabaseBeliefGraphService();
        // DatabaseBeliefGraphService implements the same interface as BeliefGraphService
        this.forecastService = new service_1.ForecastService(this.eventStore, this.beliefGraph);
        this.adversarialOrchestrator = new orchestrator_1.AdversarialOrchestrator();
        this.safetyOrchestrator = new safety_orchestrator_1.SafetyOrchestrator();
        this.capaService = new service_2.CAPAService();
        this.resolutionService = new service_3.CustomerResolutionService();
        this.entityGraph = new entity_graph_1.EntityKnowledgeGraph();
        this.timelineExtractor = new timeline_extractor_1.TimelineExtractor();
        this.consumer = new kafka_consumer_1.KafkaConsumer({
            brokers: config.brokers,
            groupId: config.groupId,
            topics: config.topics,
            fromBeginning: false,
        });
    }
    /**
     * Start processing events
     */
    async start() {
        if (!this.consumer) {
            throw new Error("Kafka consumer not initialized");
        }
        await this.consumer.start(async (event, message) => {
            try {
                const acquired = await this.acquireEvent(event);
                if (!acquired) {
                    return;
                }
                await this.processEvent(event);
                await this.markEventCompleted(event);
            }
            catch (error) {
                logger_1.logger.error("Error processing event", {
                    eventId: event.event_id,
                    eventType: event.type,
                    tenantId: event.tenant_id,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                await this.markEventFailed(event, error);
                // Event will be retried by the consumer / DLQ handler
                throw error;
            }
        });
    }
    /**
     * Stop processing
     */
    async stop() {
        if (this.consumer) {
            await this.consumer.stop();
        }
    }
    /**
     * Process event based on type
     */
    async processEvent(event) {
        switch (event.type) {
            case "signal.ingested":
                await this.processSignalIngested(event);
                break;
            case "claim.extracted":
                await this.processClaimExtracted(event);
                break;
            case "claim.clustered":
                await this.processClaimClustered(event);
                break;
            case "artifact.created":
                await this.processArtifactCreated(event);
                break;
            case "graph.updated":
                await this.processGraphUpdated(event);
                break;
            case "case.created":
                await this.processCaseCreated(event);
                break;
            case "bge.structural_irrelevance_applied":
            case "consensus.signal.created":
            case "aaal.rebuttal.created":
            case "aaal.incident_explanation.created":
            case "npe.complaint.predicted":
            case "tsm.validator.registered":
            case "tsm.audit.published":
            case "dfd.checkpoint.created":
                // POS events are processed by their respective services
                // These are logged for observability
                logger_1.logger.debug("POS event received", {
                    eventType: event.type,
                    tenantId: event.tenant_id,
                });
                break;
            default:
                // Unknown event type, skip
                break;
        }
    }
    /**
     * Process signal.ingested event - extract claims
     */
    async processSignalIngested(event) {
        if (event.evidence_refs.length === 0) {
            return;
        }
        // Get evidence
        const evidence = await this.evidenceVault.get(event.evidence_refs[0]);
        if (!evidence) {
            return;
        }
        // Extract claims from evidence
        const content = evidence.content.normalized || evidence.content.raw || "";
        if (!content.trim()) {
            return;
        }
        try {
            // Extract claims using the service
            const claims = await this.claimExtractor.extractClaims(evidence.evidence_id, {
                use_llm: true,
            });
            // Claims are already stored and events emitted by the extraction service
            // This worker just triggers the extraction
        }
        catch (error) {
            logger_1.logger.error("Error extracting claims", {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.event_id,
                evidenceId: event.payload.evidence_id,
                tenantId: event.tenant_id,
            });
            // Don't throw - allow event to be processed by other handlers
        }
    }
    /**
     * Process claim.extracted event - update belief graph
     */
    async processClaimExtracted(event) {
        const claimId = event.payload.claim_id;
        if (!claimId) {
            return;
        }
        try {
            // Update belief graph with new claim
            await this.beliefGraph.upsertNode({
                tenant_id: event.tenant_id,
                type: "claim",
                content: event.payload.text || "",
                trust_score: 0.5, // Default trust score
                decisiveness: 0.5, // Default decisiveness
                actor_weights: {},
                decay_factor: 0.95,
            });
            // Emit graph.updated event
            const graphEvent = {
                event_id: crypto_1.default.randomUUID(),
                tenant_id: event.tenant_id,
                actor_id: "pipeline-worker",
                type: "graph.updated",
                occurred_at: new Date().toISOString(),
                correlation_id: event.correlation_id,
                causation_id: event.event_id,
                schema_version: "1.0",
                evidence_refs: event.evidence_refs,
                payload: {
                    claim_id: claimId,
                },
                signatures: [],
            };
            await this.eventStore.append(graphEvent);
        }
        catch (error) {
            logger_1.logger.error("Error updating belief graph", {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.event_id,
                claimId,
                tenantId: event.tenant_id,
            });
        }
    }
    /**
     * Process claim.clustered event - run adversarial detection, create CAPA, route resolutions
     */
    async processClaimClustered(event) {
        const clusterId = event.payload.cluster_id;
        if (!clusterId) {
            return;
        }
        try {
            const cluster = await client_1.db.claimCluster.findUnique({
                where: { id: clusterId },
                include: {
                    primaryClaim: {
                        include: {
                            evidenceRefs: true,
                        },
                    },
                },
            });
            if (!cluster) {
                return;
            }
            // Run adversarial detection on evidence (autonomous)
            for (const evidenceRef of cluster.primaryClaim.evidenceRefs.slice(0, 10)) {
                try {
                    await this.adversarialOrchestrator.detectAdversarialPatterns(evidenceRef.evidenceId, event.tenant_id);
                }
                catch (error) {
                    logger_1.logger.warn("Failed to run adversarial detection", {
                        error: error instanceof Error ? error.message : String(error),
                        evidence_id: evidenceRef.evidenceId,
                    });
                }
            }
            // Create CAPA action for high-decisiveness clusters (autonomous)
            if (cluster.decisiveness > 0.7) {
                try {
                    await this.capaService.createCorrectiveAction(event.tenant_id, clusterId, `Address high-decisiveness claim cluster`, `Automated corrective action for cluster with decisiveness: ${cluster.decisiveness}`, {
                        priority: cluster.decisiveness > 0.9 ? "CRITICAL" : "HIGH",
                    });
                }
                catch (error) {
                    logger_1.logger.warn("Failed to create CAPA action", {
                        error: error instanceof Error ? error.message : String(error),
                        cluster_id: clusterId,
                    });
                }
            }
            // Route customer resolution for high-decisiveness clusters (autonomous)
            if (cluster.decisiveness > 0.8) {
                try {
                    await this.resolutionService.createResolution(event.tenant_id, clusterId, "CLARIFICATION", `Clarification needed for high-decisiveness claim`, `Automated resolution for cluster with decisiveness: ${cluster.decisiveness}`, {
                        priority: "HIGH",
                    });
                }
                catch (error) {
                    logger_1.logger.warn("Failed to create resolution", {
                        error: error instanceof Error ? error.message : String(error),
                        cluster_id: clusterId,
                    });
                }
            }
            // Extract entities and relationships (autonomous)
            for (const evidenceRef of cluster.primaryClaim.evidenceRefs.slice(0, 10)) {
                try {
                    await this.entityGraph.extractEntitiesFromEvidence(evidenceRef.evidenceId, event.tenant_id);
                    await this.entityGraph.extractRelationshipsFromEvidence(evidenceRef.evidenceId, event.tenant_id);
                }
                catch (error) {
                    logger_1.logger.warn("Failed to extract entities/relationships", {
                        error: error instanceof Error ? error.message : String(error),
                        evidence_id: evidenceRef.evidenceId,
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error("Error processing claim cluster", {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.event_id,
                tenantId: event.tenant_id,
            });
        }
    }
    /**
     * Process case.created event - trigger autonomous triage and resolution
     */
    async processCaseCreated(event) {
        const caseId = event.payload.case_id;
        if (!caseId) {
            return;
        }
        try {
            // Get case details
            const case_ = await client_1.db.case.findUnique({
                where: { id: caseId },
                include: {
                    evidence: {
                        include: {
                            evidence: true,
                        },
                    },
                },
            });
            if (!case_) {
                logger_1.logger.warn("Case not found for processing", {
                    case_id: caseId,
                    event_id: event.event_id,
                });
                return;
            }
            // Skip if already processed
            if (case_.status !== "SUBMITTED") {
                logger_1.logger.debug("Case already processed", {
                    case_id: caseId,
                    status: case_.status,
                });
                return;
            }
            logger_1.logger.info("Processing case.created event", {
                case_id: caseId,
                case_number: case_.caseNumber,
                case_type: case_.type,
                tenant_id: event.tenant_id,
            });
            // Step 1: Run autonomous triage with fallback
            let triageResult;
            try {
                const { autonomousTriageAgent } = await Promise.resolve().then(() => __importStar(require("@/lib/cases/autonomous-triage")));
                triageResult = await autonomousTriageAgent.triage({
                    caseId,
                    tenantId: event.tenant_id,
                    caseType: case_.type,
                    description: case_.description || "",
                    impact: case_.impact || undefined,
                    evidenceIds: case_.evidence?.map((e) => e.evidenceId) || [],
                    submittedBy: case_.submittedBy || undefined,
                    metadata: case_.metadata,
                });
            }
            catch (triageError) {
                logger_1.logger.error("Triage failed, using defaults", {
                    case_id: caseId,
                    error: triageError instanceof Error ? triageError.message : String(triageError),
                });
                // Fallback to default triage values
                triageResult = {
                    severity: "MEDIUM",
                    priority: client_2.CasePriority.P2, // P2 is medium priority
                    status: "TRIAGED",
                    confidence: 0.5,
                    routing: [],
                    reasoning: "Default triage due to processing error",
                    requiresApproval: false,
                    riskFactors: [],
                    metadata: {
                        modelUsed: "fallback",
                        latencyMs: 0,
                    },
                };
            }
            // Update case with triage results
            await client_1.db.case.update({
                where: { id: caseId },
                data: {
                    severity: triageResult.severity,
                    priority: triageResult.priority,
                    status: triageResult.status,
                },
            });
            // Step 2: Generate resolution plan with fallback
            let resolution;
            try {
                const { autonomousResolutionGenerator } = await Promise.resolve().then(() => __importStar(require("@/lib/cases/resolution-generator")));
                resolution = await autonomousResolutionGenerator.generateResolution({
                    caseId,
                    tenantId: event.tenant_id,
                    caseType: case_.type,
                    description: case_.description || "",
                    severity: triageResult.severity,
                    evidenceIds: case_.evidence?.map((e) => e.evidenceId) || [],
                    metadata: case_.metadata,
                });
            }
            catch (resolutionError) {
                logger_1.logger.error("Resolution generation failed, using defaults", {
                    case_id: caseId,
                    error: resolutionError instanceof Error ? resolutionError.message : String(resolutionError),
                });
                // Fallback to default resolution plan
                const { autonomousResolutionGenerator } = await Promise.resolve().then(() => __importStar(require("@/lib/cases/resolution-generator")));
                resolution = {
                    customerPlan: {
                        title: "Resolution Plan",
                        summary: "We are reviewing your case and will provide updates soon.",
                        steps: [
                            {
                                stepNumber: 1,
                                title: "Case Review",
                                description: "Our team is reviewing your case and gathering necessary information.",
                            },
                        ],
                        nextSteps: ["We will contact you with updates within 24-48 hours"],
                    },
                    internalPlan: {
                        title: "Internal Resolution Plan",
                        summary: "Standard resolution process",
                        phases: [
                            {
                                phaseNumber: 1,
                                name: "Investigation",
                                description: "Investigate the case and gather evidence",
                                tasks: [],
                            },
                        ],
                    },
                    recommendedDecision: "Review case and gather additional information if needed",
                    evidenceChecklist: (case_.evidence?.map((e) => ({
                        item: `Evidence ${e.evidenceId}`,
                        status: "collected",
                        source: "evidence_vault",
                    })) || []),
                    metadata: {
                        modelUsed: "fallback",
                        latencyMs: 0,
                        confidence: 0.5,
                        learningApplied: false,
                        historicalPatternsUsed: 0,
                    },
                };
            }
            // Save resolution
            await client_1.db.caseResolution.upsert({
                where: { caseId },
                create: {
                    caseId,
                    customerPlan: resolution.customerPlan,
                    internalPlan: resolution.internalPlan,
                    recommendedDecision: resolution.recommendedDecision,
                    evidenceChecklist: resolution.evidenceChecklist,
                    status: "DRAFT",
                },
                update: {
                    customerPlan: resolution.customerPlan,
                    internalPlan: resolution.internalPlan,
                    recommendedDecision: resolution.recommendedDecision,
                    evidenceChecklist: resolution.evidenceChecklist,
                },
            });
            // Step 3: Trigger full agent orchestration (async)
            setImmediate(async () => {
                try {
                    const { caseAgentOrchestrator } = await Promise.resolve().then(() => __importStar(require("@/lib/cases/agents")));
                    await caseAgentOrchestrator.processCase(caseId, event.tenant_id);
                }
                catch (error) {
                    logger_1.logger.error("Failed to run agent orchestration", {
                        case_id: caseId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            });
            // Emit case.triaged event
            await this.eventStore.append({
                event_id: crypto_1.default.randomUUID(),
                tenant_id: event.tenant_id,
                actor_id: "autonomous-triage-agent",
                type: "case.triaged",
                occurred_at: new Date().toISOString(),
                correlation_id: caseId,
                causation_id: event.event_id,
                schema_version: "1.0",
                evidence_refs: event.evidence_refs,
                payload: {
                    case_id: caseId,
                    severity: triageResult.severity,
                    priority: triageResult.priority,
                    confidence: triageResult.confidence,
                },
                signatures: [],
            });
            // Emit case.resolution.generated event
            await this.eventStore.append({
                event_id: crypto_1.default.randomUUID(),
                tenant_id: event.tenant_id,
                actor_id: "autonomous-resolution-generator",
                type: "case.resolution.generated",
                occurred_at: new Date().toISOString(),
                correlation_id: caseId,
                causation_id: event.event_id,
                schema_version: "1.0",
                evidence_refs: event.evidence_refs,
                payload: {
                    case_id: caseId,
                    resolution_id: (await client_1.db.caseResolution.findUnique({ where: { caseId } }))?.id,
                    confidence: resolution.metadata.confidence,
                },
                signatures: [],
            });
            logger_1.logger.info("Case processing completed", {
                case_id: caseId,
                severity: triageResult.severity,
                priority: triageResult.priority,
                resolution_confidence: resolution.metadata.confidence,
            });
        }
        catch (error) {
            logger_1.logger.error("Error processing case.created event", {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.event_id,
                caseId: event.payload.case_id,
                tenantId: event.tenant_id,
            });
            // Don't throw - allow event to be processed by other handlers
        }
    }
    /**
     * Process artifact.created event - run safety checks
     */
    async processArtifactCreated(event) {
        const artifactId = event.payload.artifact_id;
        if (!artifactId) {
            return;
        }
        try {
            const artifact = await client_1.db.aAALArtifact.findUnique({
                where: { id: artifactId },
                include: {
                    evidenceRefs: true,
                },
            });
            if (!artifact) {
                return;
            }
            // Run safety evaluation (autonomous)
            const safety = await this.safetyOrchestrator.evaluateSafety(artifact.content, event.tenant_id, {
                artifact_id: artifactId,
                evidence_refs: artifact.evidenceRefs.map((r) => r.evidenceId),
            });
            // Update artifact metadata with safety results
            await client_1.db.aAALArtifact.update({
                where: { id: artifactId },
                data: {
                    policyChecks: {
                        ...(artifact.policyChecks || {}),
                        safety_evaluation: safety,
                    },
                },
            });
            // If safety checks failed, require additional approval
            if (!safety.overall_safe) {
                // Create additional approval requirement
                await this.eventStore.append({
                    event_id: crypto_1.default.randomUUID(),
                    tenant_id: event.tenant_id,
                    actor_id: "safety-evaluator",
                    type: "artifact.safety_check_failed",
                    occurred_at: new Date().toISOString(),
                    correlation_id: event.correlation_id,
                    causation_id: event.event_id,
                    schema_version: "1.0",
                    evidence_refs: [],
                    payload: {
                        artifact_id: artifactId,
                        safety_issues: [
                            ...(safety.citation_grounded.issues || []),
                            ...(safety.defamation.issues || []),
                            ...(safety.privacy_safe.compliance_issues || []),
                            ...(safety.consistent.inconsistencies || []),
                            ...(safety.non_escalating.issues || []),
                        ],
                    },
                    signatures: [],
                });
            }
        }
        catch (error) {
            logger_1.logger.error("Error processing artifact safety", {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.event_id,
                tenantId: event.tenant_id,
            });
        }
    }
    /**
     * Process graph.updated event - generate forecasts
     */
    async processGraphUpdated(event) {
        // Generate forecasts based on graph updates
        try {
            // Get recent graph metrics for forecasting
            const nodes = await this.beliefGraph.getNodes(event.tenant_id, { limit: 100 });
            if (nodes.length === 0) {
                return;
            }
            // Extract time series data from graph updates
            const metrics = [];
            const timestamps = [];
            // Analyze belief strength trends over time
            for (const node of nodes) {
                // Use trust_score * decisiveness as strength metric
                const strength = node.trust_score * node.decisiveness;
                metrics.push(strength);
                timestamps.push(node.updated_at ? new Date(node.updated_at).getTime() : new Date(node.created_at).getTime());
            }
            if (metrics.length >= 5) {
                // Generate drift forecast
                const driftForecast = await this.forecastService.forecastDrift(event.tenant_id, "belief_strength", 7, // 7-day horizon
                metrics);
                // Store forecast in database
                await this.eventStore.append({
                    event_id: crypto_1.default.randomUUID(),
                    tenant_id: event.tenant_id,
                    actor_id: "pipeline-worker",
                    type: "forecast.generated",
                    occurred_at: new Date().toISOString(),
                    correlation_id: event.correlation_id,
                    causation_id: event.event_id,
                    schema_version: "1.0",
                    evidence_refs: driftForecast.evidence_refs || [],
                    signatures: [],
                    payload: {
                        forecast_id: driftForecast.forecast_id,
                        type: driftForecast.type,
                        target_metric: driftForecast.target_metric,
                        value: driftForecast.value,
                        horizon_days: driftForecast.horizon_days,
                    },
                });
            }
        }
        catch (error) {
            logger_1.logger.error("Error generating forecasts", {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.event_id,
                tenantId: event.tenant_id,
            });
        }
    }
    async acquireEvent(event) {
        const now = new Date();
        try {
            await client_1.db.eventProcessing.create({
                data: {
                    tenantId: event.tenant_id,
                    worker: this.workerName,
                    eventId: event.event_id,
                    status: "PROCESSING",
                    attempt: 1,
                    startedAt: now,
                },
            });
            return true;
        }
        catch (error) {
            // Unique constraint: decide whether to skip or re-acquire (stale/failed)
            if (error instanceof client_2.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const existing = await client_1.db.eventProcessing.findUnique({
                    where: {
                        worker_eventId: {
                            worker: this.workerName,
                            eventId: event.event_id,
                        },
                    },
                });
                if (!existing) {
                    return false;
                }
                if (existing.status === "COMPLETED") {
                    return false;
                }
                // If another worker is actively processing and it's not stale, skip.
                const ageMs = now.getTime() - existing.startedAt.getTime();
                const staleMs = 15 * 60 * 1000; // 15 minutes
                if (existing.status === "PROCESSING" && ageMs < staleMs) {
                    return false;
                }
                // Re-acquire (stale PROCESSING or FAILED)
                await client_1.db.eventProcessing.update({
                    where: {
                        worker_eventId: {
                            worker: this.workerName,
                            eventId: event.event_id,
                        },
                    },
                    data: {
                        tenantId: event.tenant_id,
                        status: "PROCESSING",
                        attempt: { increment: 1 },
                        startedAt: now,
                        completedAt: null,
                        lastError: null,
                    },
                });
                return true;
            }
            throw error;
        }
    }
    async markEventCompleted(event) {
        await client_1.db.eventProcessing.update({
            where: {
                worker_eventId: {
                    worker: this.workerName,
                    eventId: event.event_id,
                },
            },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });
    }
    async markEventFailed(event, error) {
        const message = error instanceof Error ? error.message : String(error);
        await client_1.db.eventProcessing.update({
            where: {
                worker_eventId: {
                    worker: this.workerName,
                    eventId: event.event_id,
                },
            },
            data: {
                status: "FAILED",
                completedAt: new Date(),
                lastError: message,
            },
        });
    }
}
exports.PipelineWorker = PipelineWorker;
