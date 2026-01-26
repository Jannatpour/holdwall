## API overview

Holdwall POS exposes a Next.js App Router API surface under `app/api/**/route.ts`.

### Core endpoints

- **Health**: `GET /api/health`
- **Auth**: `GET|POST /api/auth/*` (NextAuth) + `POST /api/auth/signup`
- **Evidence**: `GET|POST /api/evidence`
- **Signals**: `GET|POST /api/signals` + streaming under `/api/signals/stream`
- **Claims**: `GET|POST /api/claims` + clustering endpoints under `/api/claims/*`
- **Graph**: `GET /api/graph/*`
- **Forecasts**: `GET|POST /api/forecasts/*`
- **AAAL**: `GET|POST /api/aaal/*` (drafting + policy checks + publish)
- **Approvals / Governance**: `/api/approvals/*`, `/api/governance/*`

### Protocol interoperability

- **MCP**: `/api/mcp/*` and tool execution via `lib/mcp/*`
- **ACP**: `/api/acp/*`
- **A2A**: `/api/a2a/*`
- **ANP**: `/api/anp/*`
- **AG-UI**: `/api/ag-ui/*` (supports SSE streaming)
- **AP2**: `/api/ap2/*` (mandates, payments, wallet, audit)

### GraphQL

- `POST /api/graphql` (schema/resolvers in `lib/graphql/*`)

### Conventions

- **Validation**: request payloads validated with Zod in route handlers
- **Auth**: protected routes use `requireAuth()` (tenant-scoped)
- **Rate limiting**: enforced by middleware wrappers where applicable
- **Errors**: JSON responses with consistent status codes (no HTML error pages)

