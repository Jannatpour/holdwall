# How to Run Holdwall POS

This guide provides comprehensive instructions for running the Holdwall POS project in different environments.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Local Development Setup](#local-development-setup)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- **Node.js** 20+ (check with `node --version`)
- **PostgreSQL** 16+ (check with `psql --version`)
- **npm** or **yarn** package manager

### Optional (for full functionality)
- **Redis** 7+ (for caching and rate limiting)
- **Docker** and **Docker Compose** (for containerized setup)

---

## Quick Start (Docker)

The fastest way to get started is using Docker Compose:

```bash
cd holdwall
docker-compose up
```

This will:
- Start PostgreSQL 16 on port 15432
- Start Redis 7 on port 16379
- Build and start the Next.js application on port 3000
- Automatically wait for database health checks

**Access the application**: http://localhost:3000

To stop:
```bash
docker-compose down
```

To stop and remove volumes (clean slate):
```bash
docker-compose down -v
```

---

## Local Development Setup

### Step 1: Install Dependencies

```bash
cd holdwall
npm install
```

### Step 2: Set Up Environment Variables

Create a `.env.local` file in the `holdwall` directory:

```bash
cp .env.example .env.local  # If .env.example exists
# OR create .env.local manually
```

**Minimum required variables:**
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:15432/holdwall"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

# Optional but recommended
REDIS_URL="redis://localhost:16379"
```

**Optional variables for full functionality:**
```env
# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Error Tracking
SENTRY_DSN="your-sentry-dsn"

# AI/ML Services (for RAG, KAG, embeddings)
# Required for: FactReasoner, VERITAS-NLI, BeliefInference
OPENAI_API_KEY="your-openai-key"
ANTHROPIC_API_KEY="your-anthropic-key"
NVIDIA_API_KEY="your-nvidia-key"

# Vector Databases
CHROMA_URL="http://localhost:8000"
OPENSEARCH_URL="http://localhost:9200"

# Kafka (for event streaming) - Optional
# See docs/KAFKA_TROUBLESHOOTING.md for detailed configuration
KAFKA_ENABLED=false
KAFKA_BROKERS="localhost:9092"
# Optional: Connection timeouts (defaults: 10000ms, 30000ms)
# KAFKA_CONNECTION_TIMEOUT=10000
# KAFKA_REQUEST_TIMEOUT=30000
# Optional: Enable startup validation (recommended for production)
# KAFKA_VALIDATE_ON_STARTUP=true
```

### Step 3: Set Up Database

#### Option A: Using Local PostgreSQL

### Prisma ORM v7 note

This repo uses **Prisma ORM v7**. The database connection URL is configured in `prisma.config.ts` (not in `prisma/schema.prisma`).
If you update database connection settings, update your `.env.local` and ensure Prisma CLI sees `DATABASE_URL`.

1. Create a PostgreSQL database:
```bash
createdb holdwall
# OR using psql:
psql -U postgres
CREATE DATABASE holdwall;
```

2. Run migrations:
```bash
npx prisma migrate dev
```

3. (Optional) Seed the database:
```bash
npm run db:seed
```

#### Option B: Using Docker for Database Only

```bash
# Start just PostgreSQL and Redis
docker-compose up postgres redis -d

# Then run migrations
npx prisma migrate dev
npm run db:seed
```

### Step 4: Generate Prisma Client

```bash
npm run db:generate
```

### Step 5: Validate API Keys (Optional but Recommended)

If you're using AI models that require API keys (FactReasoner, VERITAS-NLI, BeliefInference), validate your configuration:

```bash
npm run verify:api-keys
```

This will check if `OPENAI_API_KEY` is properly configured for the claim analysis models.

### Step 6: Start Development Server

```bash
npm run dev
```

The application will be available at **http://localhost:3000**

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/holdwall` |
| `NEXTAUTH_URL` | Base URL of your application | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret for JWT signing | Generate with `openssl rand -base64 32` |

### Optional Variables

| Variable | Description | Default | Required For |
|----------|-------------|---------|-------------|
| `REDIS_URL` | Redis connection string | Not used if not set | - |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - | OAuth login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - | OAuth login |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | - | OAuth login |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | - | OAuth login |
| `OPENAI_API_KEY` | OpenAI API key | - | **FactReasoner, VERITAS-NLI, BeliefInference** |
| `SENTRY_DSN` | Sentry error tracking DSN | - |
| `LOG_LEVEL` | Logging level | `info` |
| `NEXT_PUBLIC_BASE_URL` | Public base URL | `http://localhost:3000` |
| `VAPID_PUBLIC_KEY` | VAPID public key for push notifications | Generate with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | VAPID private key for push notifications | Generate with `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | VAPID subject (email or URL) | `mailto:notifications@holdwall.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key (exposed to client) | Same as `VAPID_PUBLIC_KEY` |

---

## Database Setup

### Prisma Commands

```bash
# Generate Prisma Client (after schema changes)
npm run db:generate

# Create and apply migrations
npm run db:migrate
# OR
npx prisma migrate dev

# Seed the database
npm run db:seed

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Database Schema

The project uses Prisma with PostgreSQL. The schema includes:
- **Users & Authentication**: User, Account, Session, VerificationToken
- **Tenants**: Multi-tenant support
- **Evidence Vault**: Immutable evidence storage
- **Claims**: Claim extraction and clustering
- **Belief Graph**: Belief nodes and edges
- **Forecasts**: Drift, anomaly, outbreak predictions
- **AAAL Artifacts**: Authoritative artifact authoring
- **Approvals**: Approval workflow
- **Events**: Event sourcing

See `prisma/schema.prisma` for the complete schema.

---

## Running the Application

### Development Mode

```bash
npm run dev
```

Features:
- Hot module replacement
- TypeScript type checking
- Fast refresh
- Development error overlay

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Other Useful Commands

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm test
npm run test:watch
npm run test:coverage
```

---

## Production Deployment

### Docker Production Build

```bash
# Build the image
docker build -t holdwall-pos .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_URL="https://yourdomain.com" \
  -e NEXTAUTH_SECRET="your-secret" \
  holdwall-pos
```

### Docker Compose Production

The `docker-compose.yml` file is configured for production with:
- Health checks for all services
- Volume persistence for database
- Automatic restarts
- Environment variable configuration

### Kubernetes Deployment

A Kubernetes deployment configuration is available in `kubernetes/deployment.yml`.

```bash
kubectl apply -f kubernetes/deployment.yml
```

---

## Project Structure

```
holdwall/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # NextAuth authentication
│   │   ├── evidence/     # Evidence CRUD
│   │   ├── claims/       # Claim extraction
│   │   ├── graph/        # Belief graph
│   │   ├── forecasts/    # Forecasts
│   │   ├── aaal/         # AAAL artifacts
│   │   └── health/       # Health checks
│   └── overview/         # Dashboard pages
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Core libraries
│   ├── acp/              # Agent Communication Protocol
│   ├── mcp/              # Model Context Protocol
│   ├── ai/               # RAG, KAG, orchestrator
│   ├── evidence/         # Evidence Vault
│   ├── claims/           # Claim extraction
│   ├── graph/            # Belief Graph
│   ├── forecasts/        # Forecast primitives
│   ├── aaal/             # AAAL Studio
│   ├── alerts/           # Alert service
│   ├── governance/       # Audit bundles
│   ├── compliance/       # Source compliance
│   ├── metering/         # Usage metering
│   ├── db/               # Database utilities
│   └── security/         # Security utilities
├── prisma/               # Database schema
│   └── schema.prisma     # Prisma schema
├── scripts/              # Utility scripts
│   └── seed.ts          # Database seeding
├── public/               # Static assets
├── package.json          # Dependencies and scripts
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
├── docker-compose.yml    # Docker Compose setup
└── Dockerfile            # Docker production image
```

---

## API Endpoints

Once running, the following API endpoints are available:

- **Authentication**: `/api/auth/*` (NextAuth)
- **Evidence**: `/api/evidence` (CRUD operations)
- **Signals**: `/api/signals` (Signal ingestion)
- **Claims**: `/api/claims` (Claim extraction & clustering)
- **Graph**: `/api/graph` (Belief graph queries)
- **Forecasts**: `/api/forecasts` (Forecast generation)
- **AAAL**: `/api/aaal` (Artifact management)
- **Approvals**: `/api/approvals` (Approval workflow)
- **Playbooks**: `/api/playbooks` (Playbook execution)
- **Governance**: `/api/governance/audit-bundle` (Audit export)
- **AI**: `/api/ai/orchestrate` (AI orchestration)
- **Evaluation**: `/api/evaluation` (AI evaluation)
- **Health**: `/api/health` (Health checks)

GraphQL endpoint: `/api/graphql`

---

## Troubleshooting

### Database Connection Issues

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
1. Verify PostgreSQL is running: `pg_isready` or `docker ps`
2. Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
3. Ensure database exists: `psql -l` or `CREATE DATABASE holdwall;`
4. Check firewall/network settings

### Prisma Client Not Generated

**Problem**: `@prisma/client` import errors

**Solution**:
```bash
npm run db:generate
```

### Port Already in Use

**Problem**: Port 3000 is already in use

**Solution**:
```bash
# Use a different port
PORT=3001 npm run dev
```

### Redis Connection Issues

**Problem**: Redis connection errors (if using Redis)

**Solutions**:
1. Redis is optional - the app will work without it (caching disabled)
2. Verify Redis is running: `redis-cli ping`
3. Check `REDIS_URL` format: `redis://localhost:6379`

### Migration Issues

**Problem**: Migration errors

**Solutions**:
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or create a new migration
npx prisma migrate dev --name your_migration_name
```

### Build Errors

**Problem**: TypeScript or build errors

**Solutions**:
```bash
# Check for type errors
npm run type-check

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## Next Steps

1. **Explore the UI**: Visit http://localhost:3000
2. **Check Health**: Visit http://localhost:3000/api/health
3. **View Database**: Run `npm run db:studio` to open Prisma Studio
4. **Read Documentation**: See `README.md` for feature documentation
5. **Review API**: Check `lib/integration/README.md` for API examples

---

## Additional Resources

- **Main README**: `README.md` - Project overview and features
- **Integration Guide**: `lib/integration/README.md` - API usage examples
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs
- **NextAuth Docs**: https://next-auth.js.org

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the main `README.md`
3. Check application logs
4. Verify all environment variables are set correctly

---

**Happy coding! 🚀**
