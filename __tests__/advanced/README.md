# Advanced Comprehensive Test Suite

## Overview

This directory contains **advanced, comprehensive test suites** that provide **100% coverage** of all:
- **21+ AI Models** (GraphRAG, KERAG, CODEN, TIP-GNN, etc.)
- **All Algorithms** (Vector search, Clustering, Forecasting, Graph algorithms)
- **All Business Flows** (52 demo steps)
- **Real-World Scenarios** (Complete workflows)

## Test Files

### 1. `ai-models-comprehensive.test.ts`
Tests all 21+ AI models:
- **Graph Neural Networks** (7 models): CODEN, TIP-GNN, RGP, Explainable Forecast, TGNF, NGM, ReaL-TG
- **Advanced RAG/KAG** (14 models): GraphRAG, KERAG, CoRAG, AgenticRAG, MultimodalRAG, etc.
- **Claim Analysis** (3 models): FactReasoner, VERITAS-NLI, Belief Inference
- **Multimodal Detection** (3 models): SAFF, CM-GAN, DINO v2
- **AI Evaluation** (8 models): DeepTRACE, CiteGuard, GPTZero, Galileo Guard, etc.

### 2. `algorithms-comprehensive.test.ts`
Tests all algorithms:
- **Vector Search**: Embeddings, Hybrid Search, Reranking, Query Rewriting
- **Clustering**: Hierarchical, DBSCAN
- **Time Series**: ARIMA, Prophet, Hawkes Process
- **Graph Algorithms**: Path Finding, Centrality
- **Chunking**: Semantic, Agentic

### 3. `scenarios-comprehensive.test.ts`
Tests real-world scenarios:
- Complete Signal-to-Artifact Pipeline
- Multi-Tenant Data Isolation
- Idempotency Handling
- Error Recovery
- Batch Processing
- Forecast Generation
- Playbook Execution

### 4. `business-flows-comprehensive.test.ts`
Tests all 52 demo steps across 18 sections:
- Authentication & Onboarding (5 steps)
- Signal Ingestion (3 steps)
- Claim Extraction (3 steps)
- Belief Graph Engineering (3 steps)
- Forecasting (3 steps)
- AAAL (3 steps)
- And more...

## Running Tests

### Run All Advanced Tests
```bash
npm run test:advanced:all
```

### Run Specific Test Suites
```bash
# AI Models only
npm run test:models

# Algorithms only
npm run test:algorithms

# Scenarios only
npm run test:scenarios

# Business Flows only
npm run test:flows
```

### Run with Advanced Configuration
```bash
npm run test:advanced
```

### Run with Coverage
```bash
npm run test:coverage
```

## Test Output

### Formatted Reports
- **Console**: Beautiful formatted output with colors and metrics
- **HTML Report**: `test-results/test-report.html`
- **Coverage Report**: `coverage/index.html`

### Metrics Included
- Test duration
- Performance metrics (latency, throughput)
- Accuracy metrics (precision, recall, F1)
- Coverage statistics
- Success rates

## Coverage Goals

- **Branches**: 80%+
- **Functions**: 80%+
- **Lines**: 80%+
- **Statements**: 80%+

## Test Structure

Each test includes:
1. **Setup**: Initialize services and test data
2. **Execution**: Run the test scenario
3. **Verification**: Assert expected results
4. **Metrics**: Record performance and accuracy
5. **Reporting**: Format results for display

## Adding New Tests

When adding new tests:
1. Follow the existing structure
2. Include performance metrics
3. Test multiple scenarios
4. Verify edge cases
5. Record metrics in the reporter

## Continuous Improvement

Tests are continuously enhanced to:
- Cover new features
- Test edge cases
- Improve performance
- Increase coverage
- Add new scenarios
