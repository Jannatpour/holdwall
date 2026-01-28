## Architecture

Holdwall POS is an **evidence-first** system: every claim, decision, and publishable artifact is traceable to source evidence and governed via policies + approvals.

### Deployable domains

- **Core**: tenant/governance, approvals, AAAL authoring, PADL publishing
- **Pipeline**: ingestion → normalization → enrichment → indexing → claim extraction → graph update → forecasts
- **Agents**: orchestration + tool execution (MCP) + protocol interoperability (A2A/ANP/AG-UI/AP2)

### Primary entry points

- **Next.js app**: `app/layout.tsx` initializes the app and service startup (`lib/integration/startup.ts`)
- **API routes**: `app/api/**/route.ts` (auth, evidence, signals, claims, graph, forecasts, governance, protocols)
- **Workers**:
  - `lib/workers/outbox-worker.ts` (outbox → Kafka)
  - `lib/workers/pipeline-worker.ts` (Kafka → domain handlers)
- **Cron**: Kubernetes CronJobs in `k8s/cronjobs.yaml` (reindex, retention, etc.)

### Event-driven flow (high level)

1. **Request**: API route validates + authenticates
2. **Write**: domain service writes to Postgres (Prisma) and appends an outbox event
3. **Publish**: outbox worker publishes to Kafka (optional)
4. **Process**: pipeline worker consumes events, runs domain handlers
5. **Notify**: broadcaster emits SSE updates and optional push notifications

### Data stores

- **PostgreSQL**: system of record (Prisma schema in `prisma/schema.prisma`)
- **Redis**: caching + rate limiting (optional)
- **Vector DB**: embeddings (optional; see `lib/vector/` and `lib/search/`)

### Agent Protocol Architecture

**Protocol Bridge** (`lib/agents/protocol-bridge.ts`): Unified orchestration across all agent protocols with production-grade resilience:
- **MCP (Model Context Protocol)**: Tool execution with RBAC/ABAC, safety enforcement, audit logging
- **ACP (Agent Communication Protocol)**: Message-based agent communication with LMOS transport abstraction
- **A2A (Agent-to-Agent Protocol)**: Direct agent discovery, connection, and communication with:
  - OASF (Open Agentic Schema) profiles for agent capabilities, costs, and reliability
  - AGORA-style optimization: Converts natural language to structured routines when possible
  - Agent hiring logic based on reliability, cost, availability, and skill proficiency
- **ANP (Agent Network Protocol)**: Network management with:
  - Health monitoring and intelligent routing
  - Topology support (mesh, star, hierarchical, ring)
  - Agent selection based on capabilities and health
- **AG-UI (Agent-User Interaction Protocol)**: Standardized agent-user interaction with:
  - Conversational flow management
  - Streaming support with AG-UI runtime events
  - Multi-modal input/output (text, voice, structured)
- **AP2 (Agent Payment Protocol)**: Autonomous financial transactions with:
  - Mandates (intent/cart/payment), signatures, wallet management
  - Payment adapters (Stripe, Adyen)
  - Circuit breakers and retry strategies

**Resilience Features**:
- **Circuit Breakers**: Per-protocol circuit breakers prevent cascading failures
- **Retry Logic**: Configurable exponential backoff with jitter for transient failures
- **Timeouts**: Protocol-specific timeouts prevent hanging operations
- **Metrics**: Comprehensive latency and error rate tracking per protocol
- **Health Monitoring**: Real-time protocol health status with circuit breaker state
- **Fallback Strategies**: Graceful degradation when protocols are unavailable

**LMOS Transport** (`lib/phoenix/transport.ts`): Transport-agnostic abstraction supporting:
- HTTP/SSE: Standard request/response with Server-Sent Events
- WebSocket: Real-time bidirectional communication with offline-first caching
- WebRTC: Peer-to-peer data channels for direct agent communication
- MQTT: IoT and edge deployments
- Gateway: Pluggable gateway for constrained networks (enterprise/on-prem)

**Protocol Security** (`lib/security/protocol-security.ts`): End-to-end security with:
- Identity verification (public key cryptography)
- RBAC/ABAC permission checks
- Cryptographic message signing
- mTLS support
- OIDC integration

### AI Architecture

**AI Integration** (`lib/ai/integration.ts`): Unified interface for all AI capabilities:
- **RAG Pipeline**: Retrieval-augmented generation with hybrid search (BM25 + embeddings), reranking, citation-aware selection
- **KAG Pipeline**: Knowledge-augmented generation from belief graph
- **Advanced RAG/KAG Variants**: GraphRAG, KERAG, CoRAG, AgenticRAG, MultimodalRAG, CAG, SelfRAG, RecursiveRAG, AdaptiveRAG, GORAG
- **Graph Neural Networks**: CODEN, TIP-GNN, RGP, TGNF, NGM, ReaL-TG for belief graph predictions
- **Model Router**: Task-based model selection with circuit breakers and provider health monitoring
- **Evaluation Harness**: Citation capture, narrative drift, harmful content detection

### GraphQL Architecture

**Federation** (`lib/graphql/federation.ts`): Apollo Federation support for microservices:
- Subgraph schema composition
- Entity resolution across services
- Distributed query execution

**Query Optimization** (`lib/graphql/query-optimizer.ts`): Global query efficiency:
- Query complexity analysis (depth, field count, cost estimation)
- Query caching (Redis-backed in production, in-memory fallback)
- Query optimization (field selection, batching, deduplication)
- Query validation (complexity limits, depth limits)

### Performance Architecture

**Connection Pooling**:
- PostgreSQL: Prisma-managed connection pool with configurable limits
- Redis: ioredis connection pool with retry strategies
- Custom pools: `lib/performance/connection-pool.ts` for direct database access

**Caching Strategy** (`lib/cache/strategy.ts`):
- Multi-tier caching (in-memory → Redis → database)
- **Tenant-aware caching**: Cache keys include tenantId for isolation
- Cache warming and invalidation with tenant-scoped invalidation
- TTL management and cache hit/miss tracking
- Tenant-scoped cache operations: `getTenantScoped()`, `setTenantScoped()`, `invalidateTenant()`

**Database Optimization**:
- **Composite Indexes**: Optimized for common query patterns
  - `Case_tenantId_status_createdAt_idx` - Case list queries
  - `Evidence_tenantId_type_createdAt_idx` - Evidence type queries
  - `EventOutbox_tenantId_published_createdAt_idx` - Outbox worker queries
  - Additional indexes for Claims, Events, and EventProcessing
- **Query Patterns**: All queries enforce tenantId first (indexed field)
- **GraphQL Caching**: Tenant-aware query result caching

**Load Balancing** (`lib/load-balancing/distributor.ts`):
- Dynamic load balancer with multiple strategies (least-connections, round-robin, weighted)
- Auto-scaling support with health checks
- Circuit breakers and retry logic

**CDN Integration**: 
- Next.js static asset optimization with content-hashed URLs
- Image optimization (AVIF, WebP formats)
- Edge caching via Vercel Edge Network (when deployed on Vercel)
- Custom CDN configuration via `next.config.ts` headers

### Security Architecture

**Authentication**: NextAuth v5 with JWT, OAuth2, SSO support
**Authorization**: RBAC/ABAC with tenant isolation
**Input Validation**: Zod schemas with sanitization (`lib/security/input-sanitizer.ts`)
**Output Encoding**: XSS prevention via DOMPurify
**CSRF Protection**: Token-based CSRF protection
**Rate Limiting**: Redis-backed rate limiting with sliding window
**Encryption**: TLS/SSL for in-transit, encryption at rest for sensitive data
**OWASP Top 10**: Comprehensive protection against common vulnerabilities

### Observability Architecture

**Logging**: Winston with structured JSON logging
**Metrics**: Prometheus-compatible metrics collection
**Tracing**: Distributed tracing support
**Health Checks**: Database, cache, memory, and service health monitoring
**Error Tracking**: Sentry integration for error tracking

### Operational references

- Runbooks: `../OPERATIONAL_RUNBOOKS.md` and `../lib/observability/runbooks.md`
- Deployment: `../PRODUCTION_DEPLOYMENT_GUIDE.md`

