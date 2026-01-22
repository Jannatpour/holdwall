# Holdwall POS (Perception Operating System)

Evidence-first, agentic perception engineering for the AI era. Build authoritative artifacts (AAAL), predict narrative risk (NPE), and route actions through human-gated autopilot—backed by immutable evidence, auditable workflows, and extensible agents (MCP/ACP).

## Product Vision

### What Holdwall POS Is

Holdwall POS is a **perception operating system** that helps organizations build and maintain authoritative, evidence-backed narratives in an AI-dominated information landscape. It provides:

- **Evidence-First Architecture**: Immutable evidence vault with provenance tracking ensures all claims are traceable to source material
- **AI-Powered Analysis**: Advanced RAG/KAG pipelines, graph neural networks, and multi-model orchestration extract insights from evidence
- **Belief Graph Engineering**: Time-decay, actor-weighted belief modeling tracks how narratives evolve and predicts risk
- **Human-Gated Autopilot**: Approval workflows and governance controls ensure human oversight of AI-generated content
- **Auditable Workflows**: Complete audit trails and compliance features (GDPR, source policies) ensure transparency and accountability
- **Extensible Agents**: MCP/ACP protocol support enables integration with external AI agents and tools

### What Holdwall POS Is Not

- **Not a social media management tool**: Focus is on evidence-backed narrative engineering, not social posting
- **Not a content marketing platform**: Emphasis is on authoritative artifacts (AAAL) and governance, not viral content
- **Not a generic AI platform**: Specialized for perception engineering with evidence traceability and narrative risk prediction
- **Not a replacement for human judgment**: Human-gated workflows ensure human oversight of all critical decisions

### Target Users

**Primary Users**:
1. **Communications Teams**: Build authoritative narratives backed by evidence, predict narrative risk, manage reputation
2. **Policy Teams**: Track belief evolution, forecast narrative drift, inform policy decisions
3. **Security Teams**: Monitor narrative threats, detect misinformation, track actor influence
4. **Executive Teams**: Narrative risk briefs, evidence-backed decision support, strategic intelligence

**Secondary Users**:
- **Researchers**: Evidence collection and analysis, citation management, knowledge graph exploration
- **Compliance Teams**: Audit trail management, GDPR compliance, source policy enforcement
- **Developers**: MCP/ACP agent integration, API access, custom workflows

### Value Proposition

**For Communications Teams**:
- Build evidence-backed narratives that stand up to scrutiny
- Predict narrative risk before it becomes a crisis
- Automate routine content creation while maintaining human oversight
- Track how narratives evolve across time and actors

**For Policy Teams**:
- Track belief evolution with time-decay modeling
- Forecast narrative drift and outbreak probability
- Make evidence-backed policy decisions
- Maintain audit trails for compliance

**For Security Teams**:
- Monitor narrative threats in real-time
- Detect misinformation and disinformation campaigns
- Track actor influence and coordination
- Predict narrative attacks before they materialize

**For Executive Teams**:
- Daily narrative risk briefs with AI-powered insights
- Evidence-backed strategic intelligence
- Predict narrative risk to business objectives
- Maintain authoritative public presence

### Core Workflows

**1. Evidence Collection & Ingestion**:
- Multi-source signal ingestion (RSS, GitHub, S3, Webhooks)
- Automatic normalization, enrichment, and indexing
- PII detection and redaction
- Evidence signing and verification for immutability

**2. Claim Extraction & Clustering**:
- LLM-based claim extraction from evidence
- Embedding-based clustering of related claims
- FactReasoner and VERITAS-NLI verification
- Belief inference and graph updates

**3. Narrative Risk Prediction**:
- Belief graph engineering with time-decay and actor weighting
- Forecast generation (drift, anomaly, outbreak probability)
- Narrative risk brief generation
- Alert generation for high-risk scenarios

**4. AAAL Authoring & Publishing**:
- Traceability-first artifact authoring in AAAL Studio
- Policy checks and approval workflows
- PADL publishing for public artifact delivery
- Citation management and evidence linking

**5. Governance & Compliance**:
- Approval workflows for critical decisions
- Audit bundle export for compliance
- Source policy enforcement
- GDPR compliance (export, deletion, access)

**6. Agent Integration**:
- MCP/ACP protocol support for external agents
- Tool registry with RBAC/ABAC
- Autonomous operation cycles
- Evaluation and monitoring

### Key Differentiators

1. **Evidence-First**: Every claim is traceable to immutable evidence with provenance
2. **AI-Powered but Human-Gated**: Advanced AI with human oversight via approval workflows
3. **Narrative Risk Prediction**: Forecast narrative drift and outbreak probability
4. **Auditable & Compliant**: Complete audit trails and GDPR compliance
5. **Extensible**: MCP/ACP protocol support for agent integration
6. **Production-Ready**: Enterprise-grade security, reliability, and observability

## Architecture

Holdwall POS is built as an event-first, evidence-traceable system with three deployable domains:

1. **Core**: Tenant/policy/governance, workflows, AAAL publishing, PADL portal
2. **Pipeline**: Ingestion → normalization → enrichment → indexing
3. **Agents**: Orchestrator + tool registry (MCP) + communications (ACP) + evaluation harness

### Entry Points & Dependency Graph

**Application Entry Points**:

1. **Next.js Server** (`app/layout.tsx`):
   - Initializes root layout, providers, and global state
   - Calls `lib/integration/startup.ts::initializeServices()` on startup
   - Handles graceful shutdown via SIGTERM/SIGINT

2. **API Routes** (`app/api/**/route.ts` - 98 endpoints):
   - HTTP request handlers for all API operations
   - Protected by middleware: rate limiting, authentication, tracing
   - Canonical entry: `app/api/auth/[...nextauth]/route.ts` for authentication

3. **Background Workers**:
   - **Outbox Worker** (`lib/workers/outbox-worker.ts`): Processes outbox events → Kafka
   - **Pipeline Worker** (`lib/workers/pipeline-worker.ts`): Consumes Kafka → claim extraction, graph updates, forecasts

4. **Kafka Consumers** (`lib/events/kafka-consumer.ts`):
   - Event stream processing for async workflows
   - Handles: `signal.ingested`, `claim.extracted`, `graph.updated` events

5. **Cron Jobs** (`k8s/cronjobs.yaml`):
   - Evidence reindex job (scheduled embeddings update)
   - Backup cleanup job (retention policy enforcement)

6. **AI Orchestration** (`lib/ai/integration.ts`):
   - Canonical unified interface for all AI capabilities
   - Entry point for: RAG/KAG, GNN, semantic search, multimodal detection, evaluation

**Dataflow Architecture**:

```
┌─────────────────┐
│  External       │
│  Sources        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  Signal         │────▶│  Evidence    │
│  Ingestion      │     │  Vault       │
│  (API/Connector)│     └──────┬───────┘
└─────────────────┘            │
                                ▼
                         ┌──────────────┐
                         │  Claim       │
                         │  Extraction  │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐     ┌──────────────┐
                         │  Belief      │────▶│  Forecasts   │
                         │  Graph       │     │  & Alerts    │
                         └──────┬───────┘     └──────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  RAG/KAG     │
                         │  + MCP Tools │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  AAAL Studio │
                         │  → PADL     │
                         └──────────────┘
```

**Event-Driven Flow**:

1. **API Action** → `lib/events/outbox-publisher.ts` → Outbox Table (PostgreSQL)
2. **Outbox Worker** → Polls outbox → Publishes to Kafka
3. **Pipeline Worker** → Consumes Kafka → Domain handlers (claims, graph, forecasts)
4. **Entity Broadcaster** → Real-time updates via SSE/WebSocket

**Dependency Chain**:

- **Startup**: `lib/integration/startup.ts` → Database → Redis → Health Monitor → Entity Broadcaster
- **Authentication**: NextAuth → `lib/auth/` → Database (User/Session)
- **Evidence**: API → `lib/evidence/vault-db.ts` → Database → `lib/vector/embeddings.ts` → Vector DB
- **Claims**: Evidence → `lib/claims/extraction.ts` → `lib/ai/orchestrator.ts` → LLM → Database
- **Graph**: Claims → `lib/graph/engine.ts` → `lib/graph/*.ts` (GNN models) → Database
- **AI**: `lib/ai/integration.ts` → RAG/KAG pipelines → MCP Gateway → Tool execution
- **Alerts**: Forecasts/Approvals → `lib/alerts/service.ts` → Email/Push/Slack

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Next.js API Routes, Prisma 7, PostgreSQL
- **Authentication**: NextAuth v5 (JWT, OAuth2, SSO)
- **Caching**: Redis (ioredis)
- **AI/ML**: RAG, KAG pipelines, LLM orchestration, MCP tool integration
- **Monitoring**: Winston logging, health checks, distributed tracing
- **Security**: Input validation, XSS prevention, CSRF protection, rate limiting

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (optional, for caching)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. Set up database:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

5. Run development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Docker

```bash
docker-compose up
```

## Project Structure

```
holdwall/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── overview/          # Dashboard pages
│   └── ...
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   └── ...
├── lib/                   # Core libraries
│   ├── acp/               # Agent Communication Protocol
│   ├── mcp/               # Model Context Protocol
│   ├── ai/                # RAG, KAG, orchestrator
│   ├── evidence/          # Evidence Vault
│   ├── claims/            # Claim extraction & clustering
│   ├── graph/             # Belief Graph Engineering
│   ├── forecasts/         # Forecast primitives
│   ├── aaal/              # AAAL Studio
│   ├── alerts/            # Alert service
│   ├── governance/        # Audit bundles
│   ├── compliance/        # Source compliance
│   ├── metering/          # Usage metering
│   └── ...
├── prisma/                # Database schema
└── public/                # Static assets
```

## Key Features

### Core POS Modules

- **Evidence Vault**: Immutable evidence storage with provenance tracking
- **Signals Ingestion**: Multi-source signal ingestion with compliance checks
- **Claim Extraction & Clustering**: LLM-based extraction with embedding clustering
- **Belief Graph Engineering**: Time-decay, actor-weighted belief modeling
- **Forecasts**: Drift, anomaly, and outbreak probability forecasting
- **AAAL Studio**: Traceability-first artifact authoring
- **PADL Publishing**: Public artifact delivery layer
- **Alerts**: SNS/SES integration for notifications
- **Governance**: Approvals, audit bundle export, policies

### AI Capabilities

- **RAG Pipeline**: Retrieval-augmented generation for evidence context with hybrid search (BM25 + embeddings), reranking, and citation-aware selection
- **KAG Pipeline**: Knowledge-augmented generation from belief graph
- **AI Orchestrator**: Coordinates RAG/KAG/LLM calls with intelligent model routing, automatic fallbacks, and cost tracking
- **Model Router**: Task-based model selection (extract/cluster → fast models, judge/eval → high-quality models) with circuit breakers and provider health monitoring
- **Evaluation Harness**: Citation capture, narrative drift, harmful content detection with golden sets and continuous evaluation
- **Advanced RAG/KAG**: GraphRAG, KERAG, CoRAG, Agentic RAG, Multimodal RAG, CAG, and more
- **Graph Neural Networks**: CODEN, TIP-GNN, RGP, TGNF, NGM, ReaL-TG for belief graph predictions
- **21+ AI Models**: FactReasoner, VERITAS-NLI, Belief Inference, and comprehensive evaluation frameworks

### Agent Protocols

- **MCP (Model Context Protocol)**: Tool execution with RBAC/ABAC, safety enforcement, and audit logging
- **ACP (Agent Communication Protocol)**: Message-based agent communication
- **A2A (Agent-to-Agent Protocol)**: Direct agent discovery, connection, and communication with AGORA-style optimization and OASF profiles
- **ANP (Agent Network Protocol)**: Network management with health monitoring, intelligent routing, and agent selection
- **AG-UI (Agent-User Interaction Protocol)**: Standardized agent-user interaction with conversational flow management
- **AP2 (Agent Payment Protocol)**: Autonomous financial transactions with mandates, signatures, wallet management, and payment adapters
- **Protocol Security**: End-to-end security with identity verification, RBAC/ABAC, cryptographic signing, mTLS, and OIDC
- **LMOS Transport**: Transport-agnostic abstraction supporting HTTP, SSE, WebSocket, WebRTC, MQTT, and Gateway protocols
- **Protocol Bridge**: Unified orchestration across all protocols

### Production Features

- **Security**: JWT/OAuth2/SSO, RBAC/ABAC, encryption, OWASP Top 10 compliance
- **Monitoring**: Structured logging, error tracking, performance metrics, distributed tracing
- **Caching**: Redis integration for performance
- **Rate Limiting**: IP-based rate limiting with Redis
- **Health Checks**: Database, cache, memory monitoring
- **GDPR Compliance**: Data export, deletion, anonymization
- **PWA Support**: Service workers, offline caching, manifest
- **SEO**: Sitemap, robots.txt, structured data, OpenGraph
- **Accessibility**: WCAG 2.1 AA/AAA compliance
- **Internationalization**: Multi-language support (i18n)

## API Routes

- `/api/auth/*` - Authentication (NextAuth)
- `/api/evidence` - Evidence CRUD
- `/api/signals` - Signal ingestion
- `/api/claims` - Claim extraction & clustering
- `/api/graph` - Belief graph queries
- `/api/forecasts` - Forecast generation
- `/api/aaal` - AAAL artifact management
- `/api/approvals` - Approval workflow
- `/api/playbooks` - Playbook execution
- `/api/governance/audit-bundle` - Audit bundle export
- `/api/ai/orchestrate` - AI orchestration
- `/api/evaluation` - AI evaluation harness
- `/api/health` - Health checks (includes protocol health)
- `/api/a2a/*` - A2A protocol (register, discover, hire, card)
- `/api/anp/networks` - ANP network management
- `/api/ag-ui/sessions` - AG-UI session management
- `/api/ap2/*` - AP2 payment protocol (mandates, payments, wallet, audit)
- `/api/security/*` - Protocol security (identity, permissions)
- `/api/agents/unified` - Unified protocol bridge

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run type-check` - TypeScript type checking
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database
- `npm run db:studio` - Open Prisma Studio

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Deployment

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - Secret for JWT signing

Optional:
- `REDIS_URL` - Redis connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - OAuth
- `SENTRY_DSN` - Error tracking

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t holdwall-pos .
docker run -p 3000:3000 holdwall-pos
```

## License

Proprietary
