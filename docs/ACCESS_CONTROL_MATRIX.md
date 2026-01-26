# Access Control Matrix

This document is the canonical, human-readable inventory of **what requires login** (and what does not) for Holdwall POS.

If a route is not listed explicitly, apply the **default rules** below and treat any deviation as a bug.

## Defaults (fail-closed)

- **Pages**
  - **Public**: marketing, docs, and public-sharing/portals explicitly intended for unauthenticated users.
  - **Authenticated**: everything that mounts the product UI (`AppShell`) unless explicitly marked public.
- **API**
  - **Authenticated** by default (session cookie via NextAuth).
  - **Role-gated** when mutating sensitive operational state (governance, ops, backups, admin).
  - **Secret-gated** for machine callers (cron/ops), never anonymous.

## Pages

### Public marketing / docs (no login)

- `/`
- `/demo`
- `/product/*`
- `/solutions/*`
- `/resources/*`
- `/security`
- `/ethics`
- `/compliance`
- `/offline`
- `/auth/signin`
- `/auth/signup`
- `/auth/error`

### Public sharing / portals (no login)

- **PADL artifacts (public-facing)**: `/padl/[artifactId]`
  - Only shows artifacts where `padlPublished: true`
- **Customer case tracking (public)**: `/cases/track/[caseNumber]`
  - Uses case-number + email verification flow

### Authenticated app (login required)

All of the following are intended as internal product surfaces and must require a valid session:

- `/overview`
- `/signals`
- `/claims` and `/claims/[id]`
- `/evidence/[id]`
- `/graph`
- `/forecasts`
- `/studio`
- `/trust`
- `/funnel`
- `/playbooks`
- `/governance/*`
- `/pos`
- `/onboarding/*`
- `/cases` and `/cases/[id]` and `/cases/analytics/*` (excluding `/cases/track/*`)
- `/security-incidents` and `/security-incidents/[id]`
- `/financial-services`
- `/ai-answer-monitor`
- `/integrations`
- `/source-compliance`
- `/metering`
- `/report`

## API routes

### Public (no session)

- `GET /api/health` (health/readiness summary)
- `GET /api/ip` (diagnostic client IP)
- `GET /api/openapi.json` (OpenAPI export)
- `GET /api/og` (OpenGraph image)
- `GET /api/docs` (docs export)
- `POST /api/auth/signup` (registration)
- NextAuth endpoints under `/api/auth/*` (session establishment, providers, callbacks)

### Public but rate-limited (no session)

- `POST /api/cases` (case submission)
  - Explicitly configured with `requireAuth: false` + IP rate limit.

### Session required (default)

- All other `/api/**` routes should require a valid NextAuth session cookie unless explicitly documented otherwise.

### Role required (session + role)

Any endpoint performing admin/ops actions must require roles (typically `ADMIN`, sometimes `APPROVER`):

- **Admin**: `/api/admin/*`
- **Backups/DR**: `/api/backup/*`
- **Ops / security-sensitive**: `/api/system/*`, `/api/approvals/*`, `/api/governance/*` (role depends on endpoint)

### Secret required (machine callers)

Endpoints intended for cron/ops automation must require an explicit secret header/token and must not be anonymously callable:

- `/api/cases/cron/process` (cron)
- `/api/ops/migrate` (ops)

## Enforcement points (code)

- **Pages (edge gate)**: `proxy.ts` redirects unauthenticated requests to `/auth/signin`, while allowing the public exceptions above.
- **API (canonical wrapper)**: `lib/middleware/api-wrapper.ts` defaults to auth-on and supports roles + rate limits.
- **Server-side auth helpers**: `lib/auth/session.ts` (`requireAuth`, `requireRole`, `requirePermission`).

