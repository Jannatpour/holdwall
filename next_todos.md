# Next Todos

**Last updated**: 2026-01-25  
**Current status**: ✅ Local quality gates are green (`type-check`, `lint`, `test`, API verification). ✅ Production canary is green on `https://www.holdwall.com` (Auth + Public endpoints + SKU B/C/D).

## How to verify locally (canonical)

- **Dev server**:
  - `PORT=3002 DATABASE_URL=postgresql://holdwall:holdwall@127.0.0.1:15432/holdwall REDIS_URL=redis://127.0.0.1:16379 NEXTAUTH_URL=http://localhost:3002 npm run dev`
- **End-to-end verification (unattended, dev-only)**:
  - `BASE_URL=http://localhost:3002 VERIFY_TOKEN=dev-verify-token VERIFY_TENANT_ID=<tenantId> npm run verify`
- **Kafka runtime verification (requires broker)**:
  - `KAFKA_ENABLED=true KAFKA_BROKERS='broker:9092' npm run verify:kafka`

## Recently completed

- **Comprehensive system review and optimization**:
  - Enhanced architecture documentation: Updated `docs/ARCHITECTURE.md` with comprehensive coverage of agent protocols (A2A, ANP, AG-UI, AP2, MCP, ACP), LMOS transport abstraction, GraphQL federation, performance optimizations, security architecture, and observability.
  - Verified agent protocol implementations: All protocols (A2A with OASF/AGORA, ANP with health monitoring, AG-UI with streaming, AP2 with payment adapters) are production-ready with proper security, error handling, and integration.
  - Confirmed real-time features: WebSocket and Server-Sent Events fully implemented with proper connection management, heartbeat, and cleanup.
  - Verified internationalization: Multi-language support (en, es, fr, de, ja, zh) with proper locale detection and translation fallbacks.
  - Confirmed SEO implementation: Sitemap, robots.txt, OpenGraph, Twitter Cards, and structured data (JSON-LD) all properly implemented.
  - Verified PWA capabilities: Service worker, manifest, offline support, and push notifications properly configured.
  - Production-ready code improvements:
    - Fixed video generation implementation: Replaced placeholder with real integrations for Synthesia, D-ID, and HeyGen APIs with proper error handling and polling for completion.
    - Integrated multimedia converter with FileUploadService: Removed placeholder storage URLs, now properly uploads generated audio/video files to configured storage (S3, GCS, Azure) and returns real URLs.
    - Eliminated placeholder URLs: All multimedia generation now uses production-ready storage integration.
- **Production canary fully operational**:
  - Added a production-safe canary auth path for `/api/verification/run` (token + tenant scoping + optional IP allowlist).
  - Verified live canaries against production (`npm run verify:canary` with `CANARY_TOKEN`).
- **Access control hardening (pages)**:
  - Added `proxy.ts` page auth gate (Next.js 16+ replacement for middleware) so intended internal app surfaces are consistently auth-gated.
  - Preserved explicit public exceptions: `/padl/*` (public artifacts) and `/cases/track/*` (customer portal).
  - Added canonical access control inventory: `docs/ACCESS_CONTROL_MATRIX.md`.
- **Prisma ORM v7 deployment fix**:
  - Updated `prisma/schema.prisma` to remove `url`/`directUrl` (Prisma v7 requires URLs in `prisma.config.ts`).
  - Updated `prisma.config.ts` so Prisma CLI can load envs safely without breaking lightweight contexts.
- **Ops migration surface locked down**:
  - Added `/api/ops/migrate` for emergency migrations, then disabled it by default (`OPS_MIGRATIONS_ENABLED` required).
- **Kafka worker deploy correctness**:
  - Fixed Kubernetes worker entrypoints to instantiate worker classes (previous commands were invalid).
  - Added `startPipelineWorker()` / `startOutboxWorker()` convenience exports for container entrypoints.

- **Verification automation**:
  - Added `scripts/verify-all-api-routes.ts` and improved it to correctly detect both `export async function GET/POST` and `export const GET/POST = ...` patterns.
  - Added/updated request validation so the API verifier now reports **207/207 OK, 0 warnings, 0 errors**.
  - Added `scripts/verify-ai-integrations.ts` (structure verification; full runtime checks require DB + provider keys).
  - Added a canonical report: `docs/VERIFICATION_REPORT.md`.
- **Hardening small public endpoints**:
  - `/api/ip` now has defensive try/catch.
  - `/api/openapi.json` now has defensive try/catch (returns JSON 500 on failure).
- **Schema drift eliminated**: applied a corrective Prisma migration (`prisma/migrations/20260124160000_schema_sync`) so missing tables like `PaymentMandate`, `EvidenceVersion`, and `EvidenceAccessLog` exist in the local DB.
- **Verification operational**:
  - `/api/verification/run` supports a **dev-only** token bypass (`VERIFY_TOKEN` + `x-verify-token`) for unattended verification runs.
  - Seed now creates baseline `SourcePolicy` rows so signal ingestion validation works out of the box.
  - Artifact verification now generates valid rebuttal content + real citation URLs.
- **Health endpoint correctness**: memory saturation uses a safe heap limit signal (no false “critical” memory).
- **Authentication hardening**:
  - Added missing `/auth/error` page referenced by NextAuth.
  - Preserved NextAuth 302/303 redirects in the route wrapper to avoid stripping `Set-Cookie` headers during successful sign-in.
  - Improved auth page accessibility (keyboard-focusable password show/hide toggles).
- **Docs canonicalization**:
  - Kept a single canonical docs set: `README.md`, `docs/README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/AUTHENTICATION.md`, `HOW_TO_RUN.md`, `TESTING_GUIDE.md`, `PRODUCTION_DEPLOYMENT_GUIDE.md`, `OPERATIONAL_RUNBOOKS.md`, `VERIFY_EVERYTHING.md`.
  - Removed non-canonical “status / complete / final / verification” markdown duplicates.
  - Updated `.gitignore` to exclude Playwright artifacts (`test-results`, `playwright-report`).
- **Production readiness program implementation**:
  - **Staging parity**: Implemented comprehensive staging environment parity checks with contracts for development, staging, and production. Enforced at startup and included in health checks. API endpoint: `/api/environment/parity`.
  - **Compliance evidence packages**: Created service to generate SOC2, GDPR, and Financial Services audit evidence packages with exportable JSON/PDF/ZIP formats. API endpoint: `/api/compliance/evidence-package`.
  - **AI quality and safety gates**: Implemented continuous evaluation gates for citation faithfulness, refusal correctness, jailbreak resistance, and cost controls with golden scenario packs.
  - **Chaos drills**: Created executable chaos engineering drills (DB outage, Redis outage, provider outage, rate-limit abuse) that map to operational runbooks and produce artifacts. API endpoint: `/api/chaos/drills`.
  - **CI/CD quality gates**: Enhanced CI pipeline with `verify-everything` job and added performance/reliability budget tracking. API endpoint: `/api/ci/quality-gates`.
  - **Enhanced tenant isolation**: Expanded tenant isolation verification to test cases, claims, artifacts, events, and direct database queries across all data types.

## Next steps (priority order)

1. **Production database migration strategy**
   - Validate that `20260124160000_schema_sync` is safe for a non-empty production database (may need to split into smaller migrations if production already exists).

2. **Raise unit test coverage baseline**
   - Current unit test coverage is low (verification/E2E-heavy repo). Increase coverage in critical modules and steadily raise the CI threshold.

3. **Deployment (Vercel + AWS)**
   - Standardize env + secrets sourcing and document a single “Vercel web + AWS data/workers” reference path in `PRODUCTION_DEPLOYMENT_GUIDE.md`.

4. **Kafka production operationalization**
   - Run real broker-backed workers and monitor consumer lag + DLQ volume; add alert routing.

5. **Backups/DR drills**
   - Run staged restore drills on a schedule; verify with `verify:health` + `verify:canary`.

6. **Security hygiene**
   - Rotate any leaked keys immediately and document incident response steps (see `OPERATIONAL_RUNBOOKS.md`).
