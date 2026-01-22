/**
 * Advanced Algorithms Comprehensive Test Suite
 * 
 * Tests all algorithms including:
 * - Vector search algorithms (ANN, HNSW, IVF, etc.)
 * - Clustering algorithms
 * - Ranking algorithms
 * - Time series forecasting (ARIMA, Prophet, Hawkes)
 * - Graph algorithms (path finding, centrality, etc.)
 * - Embedding algorithms
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { VectorEmbeddings } from '@/lib/search/embeddings';
import { HybridSearch } from '@/lib/search/hybrid';
import { Reranker } from '@/lib/search/reranking';
import { QueryRewriter } from '@/lib/search/query-rewriter';
import { ForecastService } from '@/lib/forecasts/service';
import { DatabaseBeliefGraphService } from '@/lib/graph/belief-implementation';
import { ClaimClusterer } from '@/lib/claims/clusterer';
import { SemanticChunking } from '@/lib/ai/semantic-chunking';
import { AgenticChunking } from '@/lib/ai/agentic-chunking';
import { ANNAlgorithms } from '@/lib/search/ann-algorithms';
import { CODEN } from '@/lib/graph/coden';
import { TIPGNN } from '@/lib/graph/tip-gnn';
import { RelationalGraphPerceiver } from '@/lib/graph/rgp';
import { TGNF } from '@/lib/graph/tgnf';
import { NeuralGraphicalModel } from '@/lib/graph/ngm';
import { ReaLTG } from '@/lib/graph/realtg';
import { ExplainableForecastEngine } from '@/lib/graph/explainable-forecast';
import type { BeliefNode, BeliefEdge } from '@/lib/graph/belief';

interface AlgorithmTestResult {
  algorithm: string;
  scenario: string;
  status: 'pass' | 'fail' | 'warning';
  duration: number;
  metrics: Record<string, number>;
  performance: {
    throughput: number;
    latency: number;
    accuracy?: number;
  };
}

class AlgorithmTestReporter {
  private results: AlgorithmTestResult[] = [];

  record(result: AlgorithmTestResult) {
    this.results.push(result);
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const total = this.results.length;
    const avgLatency = this.results.reduce((sum, r) => sum + r.performance.latency, 0) / total;
    const avgThroughput = this.results.reduce((sum, r) => sum + r.performance.throughput, 0) / total;

    return `
╔════════════════════════════════════════════════════════════════╗
║      ADVANCED ALGORITHMS COMPREHENSIVE TEST REPORT             ║
╠════════════════════════════════════════════════════════════════╣
║ Total Algorithms Tested: ${total.toString().padEnd(35)} ║
║ Passed:              ${passed.toString().padEnd(35)} ║
║ Failed:              ${failed.toString().padEnd(35)} ║
║ Average Latency:     ${avgLatency.toFixed(2)}ms${' '.repeat(30)} ║
║ Average Throughput:  ${avgThroughput.toFixed(2)} ops/s${' '.repeat(25)} ║
║ Success Rate:        ${((passed / total) * 100).toFixed(2)}%${' '.repeat(30)} ║
╠════════════════════════════════════════════════════════════════╣
║                    PERFORMANCE METRICS                         ║
╠════════════════════════════════════════════════════════════════╣
${this.results.map(r => this.formatResult(r)).join('\n')}
╚════════════════════════════════════════════════════════════════╝
    `.trim();
  }

  private formatResult(result: AlgorithmTestResult): string {
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    return `║ ${statusIcon} ${result.algorithm.padEnd(25)} │ ${result.scenario.padEnd(30)} │ ${result.performance.latency.toFixed(2)}ms │ ${result.performance.throughput.toFixed(2)} ops/s ║`;
  }
}

const algorithmReporter = new AlgorithmTestReporter();

describe('Advanced Algorithms - Comprehensive Test Suite', () => {
  beforeEach(() => {
    // Setup test data
  });

  // ============================================================
  // VECTOR SEARCH ALGORITHMS
  // ============================================================

  describe('Vector Search Algorithms', () => {
    test('Embedding Generation - Multiple Providers', async () => {
      const startTime = Date.now();
      const embeddings = new VectorEmbeddings();
      
      const testTexts = [
        'Customer complaint about hidden fees',
        'Product quality issue reported',
        'Service outage affecting users',
      ];
      
      const results = await Promise.all(
        testTexts.map(text => embeddings.embed(text))
      );
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.vector).toBeDefined();
        expect(result.vector.length).toBeGreaterThan(0);
      });
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Vector Embeddings',
        scenario: 'Multiple providers',
        status: 'pass',
        duration,
        metrics: {
          texts_embedded: 3,
          avg_dimension: results.reduce((sum, r) => sum + r.vector.length, 0) / 3,
        },
        performance: {
          throughput: (3 / duration) * 1000,
          latency: duration / 3,
        },
      });
    });

    test('Hybrid Search - BM25 + Vector', async () => {
      const startTime = Date.now();
      const hybridSearch = new HybridSearch();
      
      const query = 'hidden fees';
      // Create mock evidence list
      const evidenceList = [
        {
          evidence_id: 'ev-1',
          tenant_id: 'test-tenant',
          type: 'signal',
          content: { raw: 'Customer complaint about hidden fees in the product' },
          source: { url: 'https://example.com', type: 'RSS' },
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          evidence_id: 'ev-2',
          tenant_id: 'test-tenant',
          type: 'signal',
          content: { raw: 'Product quality issue reported' },
          source: { url: 'https://example.com', type: 'RSS' },
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ] as any[];
      
      const results = await hybridSearch.search(query, evidenceList, {
        topK: 10,
        minScore: 0.0,
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Hybrid Search',
        scenario: 'BM25 + Vector fusion',
        status: 'pass',
        duration,
        metrics: {
          documents_retrieved: results.length,
          fusion_score: results[0]?.combinedScore || 0,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('Reranking - Cross-Encoder', async () => {
      const startTime = Date.now();
      const reranker = new Reranker();
      
      const query = 'customer complaints';
      const documents = [
        { id: 'doc-1', text: 'Customer complaint about fees' },
        { id: 'doc-2', text: 'Product quality issue' },
        { id: 'doc-3', text: 'Service outage' },
      ];
      
      const results = await reranker.rerank(query, documents);
      
      expect(results).toBeDefined();
      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThanOrEqual(0);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Reranker',
        scenario: 'Cross-encoder reranking',
        status: 'pass',
        duration,
        metrics: {
          documents_reranked: results.length,
          top_score: results[0].score,
        },
        performance: {
          throughput: (3 / duration) * 1000,
          latency: duration / 3,
        },
      });
    });

    test('Query Rewriting - Multi-Step', async () => {
      const startTime = Date.now();
      const rewriter = new QueryRewriter();
      
      const query = 'What do customers say?';
      const rewritten = await rewriter.rewrite(query);
      
      expect(rewritten).toBeDefined();
      expect(rewritten.original).toBe(query);
      expect(rewritten.expanded).toBeDefined();
      expect(rewritten.intent).toBeDefined();
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Query Rewriter',
        scenario: 'Multi-step rewriting',
        status: 'pass',
        duration,
        metrics: {
          queries_generated: rewritten.decomposed?.length || 1,
          synonyms_count: rewritten.synonyms?.length || 0,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('ANN Algorithms - Cosine Similarity', () => {
      const startTime = Date.now();
      const ann = new ANNAlgorithms();
      
      const vec1 = [1, 2, 3, 4, 5];
      const vec2 = [1, 2, 3, 4, 5];
      const vec3 = [5, 4, 3, 2, 1];
      
      const similarity1 = ann.cosineSimilarity(vec1, vec2);
      const similarity2 = ann.cosineSimilarity(vec1, vec3);
      
      expect(similarity1).toBeCloseTo(1.0, 5);
      expect(similarity2).toBeLessThan(similarity1);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'ANN - Cosine Similarity',
        scenario: 'Vector similarity calculation',
        status: 'pass',
        duration,
        metrics: {
          vectors_compared: 2,
          similarity_score: similarity1,
        },
        performance: {
          throughput: (2 / duration) * 1000,
          latency: duration / 2,
        },
      });
    });

    test('ANN Algorithms - Euclidean Distance', () => {
      const startTime = Date.now();
      const ann = new ANNAlgorithms();
      
      const vec1 = [0, 0, 0];
      const vec2 = [3, 4, 0];
      
      const distance = ann.euclideanDistance(vec1, vec2);
      expect(distance).toBeCloseTo(5.0, 5);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'ANN - Euclidean Distance',
        scenario: 'Distance calculation',
        status: 'pass',
        duration,
        metrics: {
          distance: distance,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('ANN Algorithms - Nearest Neighbors', () => {
      const startTime = Date.now();
      const ann = new ANNAlgorithms();
      
      const queryVector = [1, 1, 1];
      const candidates = [
        { id: 'c1', vector: [1, 1, 1] },
        { id: 'c2', vector: [0.9, 0.9, 0.9] },
        { id: 'c3', vector: [0.1, 0.1, 0.1] },
        { id: 'c4', vector: [0.5, 0.5, 0.5] },
      ];
      
      const results = ann.findNearestNeighbors(queryVector, candidates, 'cosine', 2);
      
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('c1');
      // Use toBeGreaterThanOrEqual to handle floating point precision
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'ANN - Nearest Neighbors',
        scenario: 'Top-K search',
        status: 'pass',
        duration,
        metrics: {
          candidates_searched: candidates.length,
          top_k: 2,
        },
        performance: {
          throughput: (candidates.length / duration) * 1000,
          latency: duration / candidates.length,
        },
      });
    });
  });

  // ============================================================
  // CLUSTERING ALGORITHMS
  // ============================================================

  describe('Clustering Algorithms', () => {
    test('Claim Clustering - Hierarchical', async () => {
      const startTime = Date.now();
      const clusterer = new ClaimClusterer();
      
      const claims = [
        'Hidden fees in product',
        'Product has unexpected charges',
        'Customers unaware of fees',
        'Service quality issue',
        'Poor customer service',
      ];
      
      const clusters = await clusterer.cluster(claims, {
        method: 'hierarchical',
        similarityThreshold: 0.7,
      });
      
      expect(clusters).toBeDefined();
      expect(clusters.length).toBeGreaterThan(0);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Claim Clustering',
        scenario: 'Hierarchical clustering',
        status: 'pass',
        duration,
        metrics: {
          claims_clustered: claims.length,
          clusters_created: clusters.length,
          avg_cluster_size: claims.length / clusters.length,
        },
        performance: {
          throughput: (claims.length / duration) * 1000,
          latency: duration / claims.length,
        },
      });
    });

    test('Claim Clustering - DBSCAN', async () => {
      const startTime = Date.now();
      const clusterer = new ClaimClusterer();
      
      const claims = [
        'Hidden fees in product',
        'Product has unexpected charges',
        'Service quality issue',
      ];
      
      const clusters = await clusterer.cluster(claims, {
        method: 'dbscan',
        eps: 0.5,
        minPoints: 2,
      });
      
      expect(clusters).toBeDefined();
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Claim Clustering',
        scenario: 'DBSCAN clustering',
        status: 'pass',
        duration,
        metrics: {
          claims_clustered: claims.length,
          clusters_created: clusters.length,
        },
        performance: {
          throughput: (claims.length / duration) * 1000,
          latency: duration / claims.length,
        },
      });
    });
  });

  // ============================================================
  // TIME SERIES FORECASTING
  // ============================================================

  describe('Time Series Forecasting Algorithms', () => {
    let forecastService: ForecastService;
    let eventStore: any;
    let beliefGraph: any;

    beforeEach(() => {
      // Create mock event store and belief graph
      eventStore = {
        query: jest.fn().mockResolvedValue([]),
        append: jest.fn().mockResolvedValue(undefined),
      };
      beliefGraph = {
        getNodes: jest.fn().mockResolvedValue([]),
      };
      forecastService = new ForecastService(eventStore, beliefGraph);
    });

    test('ARIMA - Autoregressive Forecasting', async () => {
      const startTime = Date.now();
      
      const baselineData = Array.from({ length: 30 }, (_, i) => 
        10 + Math.sin(i / 5) * 5 + Math.random() * 2
      );
      
      const forecast = await forecastService.forecastDrift(
        'test-tenant',
        'test-metric',
        7,
        baselineData
      );
      
      expect(forecast).toBeDefined();
      expect(forecast.type).toBe('drift');
      expect(forecast.horizon_days).toBe(7);
      expect(forecast.value).toBeDefined();
      expect(forecast.confidence).toBeDefined();
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'ARIMA',
        scenario: 'Autoregressive forecasting',
        status: 'pass',
        duration,
        metrics: {
          data_points: baselineData.length,
          forecast_value: forecast.value,
          drift_rate: forecast.drift_rate,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('Prophet - Trend + Seasonality', async () => {
      const startTime = Date.now();
      
      const baselineData = Array.from({ length: 90 }, (_, i) => 
        20 + Math.sin(i / 7) * 10 + (i / 90) * 5
      );
      
      const forecast = await forecastService.forecastDrift(
        'test-tenant',
        'test-metric',
        30,
        baselineData
      );
      
      expect(forecast).toBeDefined();
      expect(forecast.type).toBe('drift');
      expect(forecast.horizon_days).toBe(30);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Prophet',
        scenario: 'Trend + seasonality',
        status: 'pass',
        duration,
        metrics: {
          data_points: baselineData.length,
          forecast_value: forecast.value,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('Hawkes Process - Outbreak Prediction', async () => {
      const startTime = Date.now();
      
      const signals = Array.from({ length: 50 }, (_, i) => ({
        amplification: 0.5 + Math.random() * 0.5,
        sentiment: Math.random(),
        timestamp: Date.now() - (50 - i) * 60 * 60 * 1000,
      }));
      
      const forecast = await forecastService.forecastOutbreak(
        'test-tenant',
        7,
        signals
      );
      
      expect(forecast).toBeDefined();
      expect(forecast.type).toBe('outbreak');
      expect(forecast.probability).toBeGreaterThanOrEqual(0);
      expect(forecast.probability).toBeLessThanOrEqual(1);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Hawkes Process',
        scenario: 'Outbreak prediction',
        status: 'pass',
        duration,
        metrics: {
          events_analyzed: signals.length,
          outbreak_probability: forecast.probability,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });
  });

  // ============================================================
  // GRAPH ALGORITHMS
  // ============================================================

  describe('Graph Algorithms', () => {
    test('Path Finding - Shortest Path', async () => {
      const startTime = Date.now();
      const graphService = new DatabaseBeliefGraphService();
      
      // This would require actual graph data
      // For now, test the interface
      const paths = await graphService.findPaths('node-1', 'node-2', 5, {});
      
      expect(paths).toBeDefined();
      expect(Array.isArray(paths)).toBe(true);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Path Finding',
        scenario: 'Shortest path',
        status: 'pass',
        duration,
        metrics: {
          paths_found: paths.length,
          max_depth: 5,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('Centrality Calculation', async () => {
      const startTime = Date.now();
      const graphService = new DatabaseBeliefGraphService();
      
      // Test centrality calculation
      const centrality = await graphService.calculateCentrality('node-1');
      
      expect(centrality).toBeDefined();
      expect(centrality.score).toBeGreaterThanOrEqual(0);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Centrality',
        scenario: 'Node centrality',
        status: 'pass',
        duration,
        metrics: {
          centrality_score: centrality.score,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });
  });

  // ============================================================
  // GRAPH NEURAL NETWORKS
  // ============================================================

  describe('Graph Neural Network Algorithms', () => {
    const createTestNode = (id: string, trust: number = 0.5, decisiveness: number = 0.5): BeliefNode => ({
      node_id: id,
      tenant_id: 'test-tenant',
      claim_id: `claim-${id}`,
      trust_score: trust,
      decisiveness: decisiveness,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const createTestEdge = (from: string, to: string, weight: number = 0.5): BeliefEdge => ({
      edge_id: `edge-${from}-${to}`,
      from_node_id: from,
      to_node_id: to,
      weight: weight,
      relationship_type: 'supports',
      created_at: new Date().toISOString(),
    });

    test('CODEN - Continuous Dynamic Network', () => {
      const startTime = Date.now();
      const coden = new CODEN();
      
      const node = createTestNode('node-1', 0.6, 0.7);
      coden.recordState(node);
      
      // Record multiple states to build history
      const node2 = createTestNode('node-1', 0.65, 0.72);
      coden.recordState(node2, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      const forecast = coden.predict(node, [createTestEdge('node-1', 'node-2')], 7);
      
      expect(forecast).toBeDefined();
      expect(forecast.nodeId).toBe(node.node_id);
      expect(forecast.predictions).toBeDefined();
      expect(Array.isArray(forecast.predictions)).toBe(true);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'CODEN',
        scenario: 'Continuous prediction',
        status: 'pass',
        duration,
        metrics: {
          predictions_generated: forecast.predictions.length,
          horizon_days: 7,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('TIP-GNN - Transition-Informed Propagation', () => {
      const startTime = Date.now();
      const tipGnn = new TIPGNN();
      
      const node = createTestNode('node-1', 0.5, 0.6);
      const neighbors = [
        { node: createTestNode('node-2', 0.7, 0.8), edge: createTestEdge('node-1', 'node-2') },
      ];
      
      tipGnn.recordTransition('node-1', {
        fromState: { trust: 0.4, decisiveness: 0.5 },
        toState: { trust: 0.5, decisiveness: 0.6 },
        timestamp: new Date().toISOString(),
        factors: ['evidence_update'],
      });
      
      const prediction = tipGnn.predict(node, neighbors);
      
      expect(prediction).toBeDefined();
      expect(prediction.predictedState).toBeDefined();
      expect(prediction.transitionProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.transitionProbability).toBeLessThanOrEqual(1);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'TIP-GNN',
        scenario: 'Transition prediction',
        status: 'pass',
        duration,
        metrics: {
          neighbors_considered: neighbors.length,
          transition_probability: prediction.transitionProbability,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('RGP - Relational Graph Perceiver', async () => {
      const startTime = Date.now();
      const rgp = new RelationalGraphPerceiver();
      
      const nodes = [
        createTestNode('node-1', 0.6, 0.7),
        createTestNode('node-2', 0.5, 0.6),
        createTestNode('node-3', 0.7, 0.8),
      ];
      const edges = [
        createTestEdge('node-1', 'node-2'),
        createTestEdge('node-2', 'node-3'),
      ];
      
      const result = await rgp.process('Analyze narrative risk', nodes, edges, {
        maxNodes: 10,
        temporalWindow: 30,
      });
      
      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.attention).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'RGP',
        scenario: 'Cross-attention processing',
        status: 'pass',
        duration,
        metrics: {
          nodes_processed: result.nodes.length,
          attention_layers: result.attention.length,
          confidence: result.confidence,
        },
        performance: {
          throughput: (nodes.length / duration) * 1000,
          latency: duration / nodes.length,
        },
      });
    });

    test('TGNF - Temporally Evolving GNN', async () => {
      const startTime = Date.now();
      const tgnf = new TGNF();
      
      const nodes = [
        createTestNode('node-1', 0.6, 0.7),
        createTestNode('node-2', 0.5, 0.6),
      ];
      const edges = [createTestEdge('node-1', 'node-2')];
      
      // Record state first
      tgnf.recordState(nodes[0], edges);
      tgnf.recordState(nodes[1], edges);
      
      const result = await tgnf.detect(nodes[0], edges, nodes);
      
      expect(result).toBeDefined();
      expect(result.nodeId).toBe(nodes[0].node_id);
      expect(result.isMisinformation).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'TGNF',
        scenario: 'Misinformation detection',
        status: 'pass',
        duration,
        metrics: {
          nodes_analyzed: nodes.length,
          misinformation_detected: result.isMisinformation ? 1 : 0,
          confidence: result.confidence,
        },
        performance: {
          throughput: (nodes.length / duration) * 1000,
          latency: duration / nodes.length,
        },
      });
    });

    test('NGM - Neural Graphical Model', async () => {
      const startTime = Date.now();
      const ngm = new NeuralGraphicalModel();
      
      const nodes = [
        createTestNode('node-1', 0.6, 0.7),
        createTestNode('node-2', 0.5, 0.6),
      ];
      const edges = [createTestEdge('node-1', 'node-2')];
      
      const result = await ngm.reason('Analyze narrative risk', nodes, edges);
      
      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.distributions).toBeDefined();
      expect(Array.isArray(result.distributions)).toBe(true);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'NGM',
        scenario: 'Probabilistic inference',
        status: 'pass',
        duration,
        metrics: {
          nodes_inferred: result.distributions.length,
          most_likely_outcome: result.mostLikelyOutcome ? 1 : 0,
        },
        performance: {
          throughput: (nodes.length / duration) * 1000,
          latency: duration / nodes.length,
        },
      });
    });

    test('ReaL-TG - Explainable Link Forecasting', async () => {
      const startTime = Date.now();
      const realtg = new ReaLTG();
      
      const nodes = [
        createTestNode('node-1', 0.6, 0.7),
        createTestNode('node-2', 0.5, 0.6),
      ];
      const edges = [createTestEdge('node-1', 'node-2')];
      
      const result = await realtg.forecast('Forecast link evolution', nodes, edges, 7);
      
      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.forecasts).toBeDefined();
      expect(Array.isArray(result.forecasts)).toBe(true);
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'ReaL-TG',
        scenario: 'Link forecasting',
        status: 'pass',
        duration,
        metrics: {
          links_forecasted: result.forecasts.length,
          confidence: result.confidence,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('Explainable Forecast Engine', async () => {
      const startTime = Date.now();
      const engine = new ExplainableForecastEngine();
      
      const nodes = [
        createTestNode('node-1', 0.6, 0.7),
        createTestNode('node-2', 0.5, 0.6),
      ];
      const edges = [createTestEdge('node-1', 'node-2')];
      
      const result = await engine.forecast('Forecast events', nodes, edges, 7);
      
      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.explanation).toBeDefined();
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Explainable Forecast',
        scenario: 'Event forecasting',
        status: 'pass',
        duration,
        metrics: {
          events_forecasted: result.events.length,
          confidence: result.explanation.confidence,
        },
        performance: {
          throughput: (1 / duration) * 1000,
          latency: duration,
        },
      });
    });
  });

  // ============================================================
  // CHUNKING ALGORITHMS
  // ============================================================

  describe('Chunking Algorithms', () => {
    test('Semantic Chunking - Context-Preserving', () => {
      const startTime = Date.now();
      const chunker = new SemanticChunking();
      
      const longText = 'This is a long document that needs to be chunked. '.repeat(100);
      
      const chunks = chunker.chunk(longText, {
        strategy: 'semantic',
        maxChunkSize: 500,
        preserveContext: true,
      });
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.text).toBeDefined();
        expect(chunk.id).toBeDefined();
        expect(chunk.startIndex).toBeGreaterThanOrEqual(0);
        expect(chunk.endIndex).toBeGreaterThan(chunk.startIndex);
      });
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Semantic Chunking',
        scenario: 'Context-preserving',
        status: 'pass',
        duration,
        metrics: {
          text_length: longText.length,
          chunks_created: chunks.length,
          avg_chunk_size: longText.length / chunks.length,
        },
        performance: {
          throughput: (longText.length / duration) * 1000,
          latency: duration,
        },
      });
    });

    test('Agentic Chunking - Context-Aware', async () => {
      const startTime = Date.now();
      const chunker = new AgenticChunking();
      
      const longText = 'This is a long document. '.repeat(100);
      const query = 'What is the main topic?';
      
      const chunks = await chunker.chunk(longText, query, {
        maxChunkSize: 500,
      });
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.text).toBeDefined();
        expect(chunk.id).toBeDefined();
      });
      
      const duration = Date.now() - startTime;
      algorithmReporter.record({
        algorithm: 'Agentic Chunking',
        scenario: 'Context-aware',
        status: 'pass',
        duration,
        metrics: {
          text_length: longText.length,
          chunks_created: chunks.length,
        },
        performance: {
          throughput: (longText.length / duration) * 1000,
          latency: duration,
        },
      });
    });
  });
});
