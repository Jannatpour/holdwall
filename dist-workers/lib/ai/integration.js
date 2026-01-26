"use strict";
/**
 * Advanced AI Integration Module
 *
 * Unified interface for all advanced AI capabilities including:
 * - Graph Neural Networks (CODEN, TIP-GNN, RGP, etc.)
 * - Advanced RAG/KAG (GraphRAG, KERAG, CoRAG, Agentic RAG, etc.)
 * - Semantic Search (Vector embeddings, ANN algorithms)
 * - Multimodal Detection (Synthetic media, deepfakes)
 * - AI Evaluation (DeepTRACE, CiteGuard, Judge Framework, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedAIIntegration = void 0;
const coden_1 = require("@/lib/graph/coden");
const tip_gnn_1 = require("@/lib/graph/tip-gnn");
const rgp_1 = require("@/lib/graph/rgp");
const explainable_forecast_1 = require("@/lib/graph/explainable-forecast");
const tgnf_1 = require("@/lib/graph/tgnf");
const ngm_1 = require("@/lib/graph/ngm");
const realtg_1 = require("@/lib/graph/realtg");
const graphrag_1 = require("@/lib/ai/graphrag");
const kerag_1 = require("@/lib/ai/kerag");
const corag_1 = require("@/lib/ai/corag");
const agentic_rag_1 = require("@/lib/ai/agentic-rag");
const multimodal_rag_1 = require("@/lib/ai/multimodal-rag");
const rag_1 = require("@/lib/ai/rag");
const adaptive_rag_1 = require("@/lib/ai/adaptive-rag");
const self_rag_1 = require("@/lib/ai/self-rag");
const recursive_rag_1 = require("@/lib/ai/recursive-rag");
const vault_db_1 = require("@/lib/evidence/vault-db");
const embeddings_1 = require("@/lib/search/embeddings");
const multimodal_embeddings_1 = require("@/lib/search/multimodal-embeddings");
const multimodal_detector_1 = require("@/lib/monitoring/multimodal-detector");
const deeptrace_1 = require("@/lib/ai/deeptrace");
const citeguard_1 = require("@/lib/ai/citeguard");
const gptzero_detector_1 = require("@/lib/ai/gptzero-detector");
const galileo_guard_1 = require("@/lib/ai/galileo-guard");
const groundedness_checker_1 = require("@/lib/ai/groundedness-checker");
const judge_framework_1 = require("@/lib/ai/judge-framework");
class AdvancedAIIntegration {
    constructor(config) {
        this.config = config;
        const evidenceVault = new vault_db_1.DatabaseEvidenceVault();
        this.ragPipeline = new rag_1.RAGPipeline(evidenceVault);
        // Initialize Graph Neural Networks
        this.coden = new coden_1.CODEN();
        this.tipGnn = new tip_gnn_1.TIPGNN();
        this.rgp = new rgp_1.RelationalGraphPerceiver();
        this.explainableForecast = new explainable_forecast_1.ExplainableForecastEngine();
        this.tgnf = new tgnf_1.TGNF();
        this.ngm = new ngm_1.NeuralGraphicalModel();
        this.realtg = new realtg_1.ReaLTG();
        // Initialize Advanced RAG/KAG
        this.graphRAG = new graphrag_1.GraphRAG();
        this.kerag = new kerag_1.KERAG(this.ragPipeline);
        this.corag = new corag_1.CoRAG(this.ragPipeline);
        this.agenticRAG = new agentic_rag_1.AgenticRAG(this.ragPipeline);
        this.multimodalRAG = new multimodal_rag_1.MultimodalRAG(this.ragPipeline);
        this.adaptiveRAG = new adaptive_rag_1.AdaptiveRAG(evidenceVault);
        this.selfRAG = new self_rag_1.SelfRAG(evidenceVault);
        this.recursiveRAG = new recursive_rag_1.RecursiveRAG(evidenceVault);
        // Initialize Semantic Search
        this.vectorEmbeddings = new embeddings_1.VectorEmbeddings();
        this.multimodalEmbeddings = new multimodal_embeddings_1.MultimodalEmbeddings();
        // Initialize Multimodal Detection
        this.multimodalDetector = new multimodal_detector_1.MultimodalDetector();
        // Initialize AI Evaluation
        this.deepTRACE = new deeptrace_1.DeepTRACE();
        this.citeGuard = new citeguard_1.CiteGuard(this.ragPipeline);
        this.gptZeroDetector = new gptzero_detector_1.GPTZeroDetector();
        this.galileoGuard = new galileo_guard_1.GalileoGuard();
        this.groundednessChecker = new groundedness_checker_1.GroundednessChecker();
        this.judgeFramework = new judge_framework_1.JudgeFramework();
    }
    /**
     * Graph Neural Networks: Continuous predictions
     */
    async predictContinuous(node, edges, timeWindow = 7) {
        if (!this.config.enableGraphNeuralNetworks) {
            return null;
        }
        this.coden.recordState(node);
        return this.coden.predict(node, edges, timeWindow);
    }
    /**
     * Graph Neural Networks: Transition-informed propagation
     */
    async predictTransitions(node, neighbors) {
        if (!this.config.enableGraphNeuralNetworks) {
            return null;
        }
        return this.tipGnn.predict(node, neighbors);
    }
    /**
     * Graph Neural Networks: Relational graph reasoning
     */
    async reasonGraph(query, nodes, edges) {
        if (!this.config.enableGraphNeuralNetworks) {
            return null;
        }
        return this.rgp.process(query, nodes, edges);
    }
    /**
     * Graph Neural Networks: Explainable forecasting
     */
    async forecastEvents(query, nodes, edges, timeWindow = 7) {
        if (!this.config.enableGraphNeuralNetworks) {
            return null;
        }
        return this.explainableForecast.forecast(query, nodes, edges, timeWindow);
    }
    /**
     * Graph Neural Networks: Misinformation detection
     */
    async detectMisinformation(node, edges, allNodes) {
        if (!this.config.enableGraphNeuralNetworks) {
            return null;
        }
        this.tgnf.recordState(node, edges);
        return this.tgnf.detect(node, edges, allNodes);
    }
    /**
     * Graph Neural Networks: Probabilistic reasoning
     */
    async reasonProbabilistic(query, nodes, edges) {
        if (!this.config.enableGraphNeuralNetworks) {
            return null;
        }
        return this.ngm.reason(query, nodes, edges);
    }
    /**
     * Graph Neural Networks: Link forecasting
     */
    async forecastLinks(query, nodes, existingEdges, timeWindow = 7) {
        if (!this.config.enableGraphNeuralNetworks) {
            return null;
        }
        return this.realtg.forecast(query, nodes, existingEdges, timeWindow);
    }
    /**
     * Advanced RAG: GraphRAG
     */
    async queryGraphRAG(query, evidence) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        await this.graphRAG.buildKnowledgeGraph(evidence);
        // graphRAG.query supports maxResults/minConfidence in this codebase.
        return this.graphRAG.query(query, { maxResults: 10, minConfidence: 0.2 });
    }
    /**
     * Advanced RAG: Knowledge-Enhanced RAG
     */
    async queryKERAG(query) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        return this.kerag.execute(query, this.config.tenantId);
    }
    /**
     * Advanced RAG: Chain-of-Retrieval
     */
    async queryCoRAG(query) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        return this.corag.execute(query, this.config.tenantId);
    }
    /**
     * Advanced RAG: Agentic RAG
     */
    async queryAgenticRAG(query) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        return this.agenticRAG.execute(query, this.config.tenantId);
    }
    /**
     * Advanced RAG: Multimodal RAG
     */
    async queryMultimodalRAG(query, options) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        return this.multimodalRAG.execute(query, this.config.tenantId, {
            includeImages: Boolean(options?.images?.length),
            includeVideos: Boolean(options?.videos?.length),
        });
    }
    /**
     * Advanced RAG: Adaptive RAG (dynamically decides retrieval strategy)
     */
    async queryAdaptiveRAG(query, options) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        return this.adaptiveRAG.execute(query, this.config.tenantId, options);
    }
    /**
     * Advanced RAG: Self-RAG (self-reflective with critique)
     */
    async querySelfRAG(query, options) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        return this.selfRAG.execute(query, this.config.tenantId, options);
    }
    /**
     * Advanced RAG: Recursive RAG (decomposes complex queries)
     */
    async queryRecursiveRAG(query, options) {
        if (!this.config.enableAdvancedRAG) {
            return null;
        }
        return this.recursiveRAG.execute(query, this.config.tenantId, options);
    }
    /**
     * Semantic Search: Embed text
     */
    async embedText(text, model) {
        if (!this.config.enableSemanticSearch) {
            return null;
        }
        return this.vectorEmbeddings.embed(text, { model });
    }
    /**
     * Semantic Search: Embed multimodal content
     */
    async embedMultimodal(items) {
        if (!this.config.enableSemanticSearch) {
            return null;
        }
        return this.multimodalEmbeddings.embedMultimodal(items);
    }
    /**
     * Multimodal Detection: Detect synthetic media
     */
    async detectSynthetic(content) {
        if (!this.config.enableMultimodalDetection) {
            return null;
        }
        return this.multimodalDetector.detectSynthetic(content);
    }
    /**
     * Multimodal Detection: Detect deepfake
     */
    async detectDeepfake(content) {
        if (!this.config.enableMultimodalDetection) {
            return null;
        }
        return this.multimodalDetector.detectDeepfake(content);
    }
    /**
     * AI Evaluation: DeepTRACE citation audit
     */
    async auditCitations(text, citations) {
        if (!this.config.enableAIEvaluation) {
            return null;
        }
        return this.deepTRACE.audit(text, citations);
    }
    /**
     * AI Evaluation: CiteGuard validation
     */
    async validateCitations(text, citations) {
        if (!this.config.enableAIEvaluation) {
            return null;
        }
        return this.citeGuard.validate(text, citations, this.config.tenantId);
    }
    /**
     * AI Evaluation: GPTZero hallucination detection
     */
    async detectHallucinations(text, citations) {
        if (!this.config.enableAIEvaluation) {
            return null;
        }
        return this.gptZeroDetector.detect(text, citations);
    }
    /**
     * AI Evaluation: Galileo guard
     */
    async guardContent(text, context) {
        if (!this.config.enableAIEvaluation) {
            return null;
        }
        return this.galileoGuard.guard(text, context);
    }
    /**
     * AI Evaluation: Groundedness check
     */
    async checkGroundedness(text, context) {
        if (!this.config.enableAIEvaluation) {
            return null;
        }
        return this.groundednessChecker.check(text, context);
    }
    /**
     * AI Evaluation: Judge framework
     */
    async evaluateWithJudges(query, response, context) {
        if (!this.config.enableAIEvaluation) {
            return null;
        }
        return this.judgeFramework.evaluate(query, response, context);
    }
}
exports.AdvancedAIIntegration = AdvancedAIIntegration;
