# All Deployed URLs, Environment Variables, and Configuration
**Date**: January 23, 2026  
**Status**: ✅ **COMPLETE INVENTORY**

---

## 🌐 Production URLs

### Vercel Deployments (ACTIVE)

**Latest Production Deployment** (7 hours ago):
- **URL**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- **Status**: ✅ Ready
- **Environment**: Production
- **Build Duration**: 2 minutes
- **Note**: Protected by Vercel authentication (requires login)

**Recent Deployments** (All Ready):
1. https://holdwall-an0zg4937-jannatpours-projects.vercel.app (8h ago)
2. https://holdwall-64fvbondf-jannatpours-projects.vercel.app (9h ago)
3. https://holdwall-10r9e50c6-jannatpours-projects.vercel.app (9h ago)
4. https://holdwall-5seio21rs-jannatpours-projects.vercel.app (11h ago)
5. https://holdwall-q9nguegga-jannatpours-projects.vercel.app (11h ago)
6. https://holdwall-r0sf6eqxl-jannatpours-projects.vercel.app (12h ago)
7. https://holdwall-o0tnud2y9-jannatpours-projects.vercel.app (22h ago)
8. https://holdwall-a8qw3n3b5-jannatpours-projects.vercel.app (23h ago)

**Vercel Project**:
- **Project Name**: `holdwall`
- **Team/Account**: `jannatpours-projects`
- **Dashboard**: https://vercel.com/jannatpours-projects/holdwall
- **Deployments**: https://vercel.com/jannatpours-projects/holdwall/deployments
- **Settings**: https://vercel.com/jannatpours-projects/holdwall/settings
- **Environment Variables**: https://vercel.com/jannatpours-projects/holdwall/settings/environment-variables
- **Logs**: Available in dashboard or `vc logs --prod`
- **Region**: `iad1` (US East - Washington, D.C.)

**Custom Domain**:
- **Primary**: https://holdwall.com
- **WWW**: https://www.holdwall.com
- **Status**: Configured in Vercel

---

## 🗄️ Supabase Configuration

### Project Information
- **Project Name**: `holdwall-production`
- **Project Reference ID**: `hrzxbonjpffluuiwpzwe`
- **Status**: ✅ Active

### Supabase URLs

**Dashboard & Settings**:
- **Main Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Database Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor
- **API Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/api
- **Auth Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/auth/url-configuration
- **Connection Pooling**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database#connection-pooling

**API Endpoints**:
- **REST API**: `https://hrzxbonjpffluuiwpzwe.supabase.co`
- **Database Direct**: `db.hrzxbonjpffluuiwpzwe.supabase.co:5432`
- **Database Pooler (Session)**: `aws-0-[REGION].pooler.supabase.com:5432`
- **Database Pooler (Transaction)**: `aws-0-[REGION].pooler.supabase.com:6543`

**Connection String Formats**:
```
# Session Mode (Recommended for Vercel)
postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres

# Transaction Mode
postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Direct Connection
postgresql://postgres:[PASSWORD]@db.hrzxbonjpffluuiwpzwe.supabase.co:5432/postgres
```

**Note**: Get exact connection string from Supabase dashboard with correct region and URL-encoded password.

---

## ☁️ AWS Configuration

### AWS Account
- **Region**: `us-east-1` (default)
- **Account ID**: `597743362576` (from ECR image in k8s manifests)

### ECS (Elastic Container Service)

**ECR Repository**:
- **Repository**: `597743362576.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos`
- **Latest Image**: `597743362576.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos:20260122-141807`

**Task Definition**:
- **Family**: `holdwall-pos`
- **Network Mode**: `awsvpc`
- **Launch Type**: `FARGATE`
- **CPU**: 1024 (1 vCPU)
- **Memory**: 2048 MB (2 GB)
- **Container Port**: 3000

**Deployment Command**:
```bash
./aws-deploy.sh production us-east-1 ecs
```

### EKS (Elastic Kubernetes Service)

**Kubernetes Resources**:
- **Namespace**: `holdwall`
- **Deployments**: 
  - `holdwall-app` (3 replicas)
  - `holdwall-worker` (background workers)
  - `holdwall-outbox-worker` (outbox pattern)
- **Services**:
  - `holdwall-app` (ClusterIP, port 80 → 3000)
- **Ingress**: 
  - Host: `holdwall.example.com` (needs update to actual domain)
  - TLS: Let's Encrypt
- **HPA**: Auto-scaling (min 2, max 10 replicas)
- **CronJobs**: Scheduled maintenance tasks

**Deployment Command**:
```bash
./aws-deploy.sh production us-east-1 eks
```

**Kubernetes Files** (14 files in `k8s/`):
1. `app-deployment.yaml` - Main app (3 replicas)
2. `app-service.yaml` - ClusterIP service
3. `app-hpa.yaml` - Auto-scaling
4. `app-pdb.yaml` - Pod disruption budget
5. `worker-deployment.yaml` - Background workers
6. `outbox-worker-deployment.yaml` - Outbox worker
7. `ingress.yaml` - Ingress configuration
8. `configmap.yaml` - Configuration
9. `secrets.yaml` - External secrets (AWS Parameter Store)
10. `cronjobs.yaml` - Scheduled tasks
11. `network-policy.yaml` - Network security
12. `service-accounts.yaml` - Service accounts
13. `namespace.yaml` - Namespace definition
14. `kustomization.yaml` - Kustomize config

### AWS Secrets Manager

**Secrets Paths** (if deployed to AWS):
- `/holdwall/prod/app/DATABASE_URL`
- `/holdwall/prod/app/NEXTAUTH_SECRET`
- `/holdwall/prod/app/NEXTAUTH_URL`
- `/holdwall/prod/app/CSRF_SECRET`
- `/holdwall/prod/app/EVIDENCE_SIGNING_SECRET`
- `/holdwall/prod/app/EVIDENCE_SIGNER_ID`
- `/holdwall/prod/integrations/OPENAI_API_KEY`
- `/holdwall/prod/integrations/ANTHROPIC_API_KEY`
- `/holdwall/prod/app/REDIS_URL`
- `/holdwall/prod/workers/KAFKA_BROKERS`
- `/holdwall/prod/workers/KAFKA_ENABLED`
- `/holdwall/prod/workers/KAFKA_EVENTS_TOPIC`
- `/holdwall/prod/app/CHROMA_URL`
- `/holdwall/prod/app/CHROMA_COLLECTION`
- `/holdwall/prod/app/CHROMA_API_KEY`
- `/holdwall/prod/app/SENTRY_DSN`

**Setup Script**: `./scripts/setup-deployment-secrets.sh`

---

## 🔐 Environment Variables (Vercel)

### All Environment Variables Set (15 total)

| Variable | Status | Environment | Last Updated |
|----------|--------|-------------|--------------|
| `DATABASE_URL` | ✅ Set (encrypted) | Production | 22h ago |
| `NEXTAUTH_URL` | ✅ Set | Production | 23h ago |
| `NEXTAUTH_SECRET` | ✅ Set (encrypted) | Production | 24h ago |
| `NEXT_PUBLIC_BASE_URL` | ✅ Set | Production | 23h ago |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | Production | 22h ago |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set (encrypted) | Production | 22h ago |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set (encrypted) | Production | 22h ago |
| `VAPID_PUBLIC_KEY` | ✅ Set (encrypted) | Production | 24h ago |
| `VAPID_PRIVATE_KEY` | ✅ Set (encrypted) | Production | 24h ago |
| `VAPID_SUBJECT` | ✅ Set | Production | 24h ago |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ Set | Production | 24h ago |
| `CSRF_SECRET` | ✅ Set (encrypted) | Production | 23h ago |
| `EVIDENCE_SIGNING_SECRET` | ✅ Set (encrypted) | Production | 23h ago |
| `OPENAI_API_KEY` | ✅ Set (encrypted) | Production | 23h ago |
| `REDIS_URL` | ✅ Set (encrypted) | Production | 23h ago |

### View Environment Variables

```bash
# List all variables
vc env ls

# Pull to local file
vc env pull .env.production --environment production

# View specific variable (decrypted)
vc env pull .env.production --environment production
cat .env.production | grep DATABASE_URL
```

---

## 📍 API Endpoints (198 Total)

### Base URLs

**Production**:
- Primary: `https://holdwall.com`
- Latest Vercel: `https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app`

### Key Endpoints

**Health & Status**:
- `GET /api/health` - Comprehensive health check
- `GET /api/auth/session` - Current session
- `GET /api/auth/providers` - OAuth providers

**Authentication**:
- `POST /api/auth/signup` - User registration
- `GET /api/auth/[...nextauth]` - NextAuth handlers
- `POST /api/auth/[...nextauth]` - NextAuth handlers

**Admin**:
- `POST /api/admin/normalize-emails` - Normalize emails
- `GET /api/admin/normalize-emails` - Endpoint info

**Core Features** (Sample):
- `GET /api/signals` - List signals
- `POST /api/signals` - Create signal
- `GET /api/claims` - List claims
- `POST /api/claims` - Create claim
- `GET /api/evidence` - List evidence
- `POST /api/evidence` - Create evidence
- `GET /api/graph` - Belief graph
- `GET /api/forecasts` - Forecasts
- `POST /api/forecasts` - Create forecast
- `GET /api/aaal` - AAAL artifacts
- `POST /api/aaal` - Create artifact
- `GET /api/playbooks` - Playbooks
- `POST /api/playbooks` - Create playbook
- `GET /api/approvals` - Approvals
- `POST /api/approvals` - Create approval
- `GET /api/cases` - List cases
- `POST /api/cases` - Create case
- `GET /api/security-incidents` - Security incidents
- `POST /api/security-incidents` - Create incident
- `POST /api/ai/orchestrate` - AI orchestration
- `POST /api/graphql` - GraphQL endpoint

**Total**: 198 API route files

---

## 🗂️ Deployment Configuration Files

### Vercel
- **File**: `vercel.json`
- **Build Command**: `npm run build`
- **Framework**: Next.js
- **Region**: `iad1` (US East)
- **Function Timeouts**: 30-60 seconds
- **CORS**: Configured for `/api/*`

### AWS ECS
- **File**: `aws-task-definition.json`
- **Container Image**: ECR repository
- **CPU/Memory**: 1024 CPU, 2048 MB memory
- **Network**: `awsvpc`
- **Launch Type**: Fargate

### AWS EKS
- **Directory**: `k8s/` (14 files)
- **Namespace**: `holdwall`
- **Replicas**: 3 (app), 2 (workers)
- **Auto-scaling**: HPA configured
- **Ingress**: Nginx with Let's Encrypt

### Docker
- **File**: `Dockerfile`
- **Base Image**: Node.js
- **Port**: 3000
- **Health Check**: `/api/health`

---

## 🔍 Verification Commands

### Check Vercel Deployment

```bash
# List deployments
vc ls --prod

# View environment variables
vc env ls

# Pull environment variables
vc env pull .env.production --environment production

# View logs
vc logs --prod

# Check deployment status
vc inspect
```

### Check Supabase

**Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe

**Test Connection**:
```bash
# Get connection string from dashboard first
DATABASE_URL="your-connection-string" npx prisma db execute --stdin <<< "SELECT 1"
```

### Check Application

```bash
# Health check (may require authentication for preview deployments)
curl https://holdwall.com/api/health | jq

# Session check
curl https://holdwall.com/api/auth/session | jq

# Providers check
curl https://holdwall.com/api/auth/providers | jq
```

### Check AWS (If Deployed)

**ECS**:
```bash
aws ecs list-clusters --region us-east-1
aws ecs list-services --cluster <cluster> --region us-east-1
aws ecs describe-services --cluster <cluster> --services holdwall-pos --region us-east-1
```

**EKS**:
```bash
kubectl get deployments -n holdwall
kubectl get services -n holdwall
kubectl get ingress -n holdwall
kubectl get pods -n holdwall
```

**Secrets Manager**:
```bash
aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'holdwall')]"
```

---

## 📊 Deployment Status Summary

### ✅ Active Deployments

**Vercel**:
- ✅ **Status**: Active and operational
- ✅ **Latest**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app (7h ago)
- ✅ **Domain**: https://holdwall.com (configured)
- ✅ **Build**: Successful (~2 minutes)
- ✅ **Environment Variables**: 15 variables set
- ✅ **Total Deployments**: 15+ successful deployments

**Supabase**:
- ✅ **Project**: Active (`holdwall-production`)
- ✅ **Project Ref**: `hrzxbonjpffluuiwpzwe`
- ✅ **API Keys**: Configured in Vercel
- ✅ **Database**: Available
- ⚠️ **Connection String**: Needs verification

### ⚠️ Needs Verification

1. **DATABASE_URL Value**:
   - Set in Vercel but encrypted
   - Should be Supabase connection string
   - **Action**: `vc env pull .env.production` to verify

2. **Database Migrations**:
   - May need to be run
   - **Action**: Check with `npx prisma migrate status`

3. **Email Normalization**:
   - May need to run for existing users
   - **Action**: Run `scripts/normalize-emails-production.ts`

### 📋 AWS (Ready but Not Currently Deployed)

- ✅ **ECS**: Scripts and configs ready
- ✅ **EKS**: Kubernetes manifests ready (14 files)
- ✅ **Elastic Beanstalk**: Scripts ready
- ✅ **ECR**: Repository exists (`597743362576.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos`)
- ⚠️ **Status**: Not currently deployed (Vercel is primary)

---

## 🔗 Quick Access Links

### Vercel
- **Dashboard**: https://vercel.com/jannatpours-projects/holdwall
- **Deployments**: https://vercel.com/jannatpours-projects/holdwall/deployments
- **Settings**: https://vercel.com/jannatpours-projects/holdwall/settings
- **Environment Variables**: https://vercel.com/jannatpours-projects/holdwall/settings/environment-variables
- **Logs**: Available in dashboard

### Supabase
- **Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Database Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor
- **API Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/api

### Application
- **Production**: https://holdwall.com
- **Latest Vercel**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- **Health Check**: https://holdwall.com/api/health
- **Sign In**: https://holdwall.com/auth/signin
- **Sign Up**: https://holdwall.com/auth/signup

---

## 🎯 Immediate Actions

### 1. Verify DATABASE_URL

```bash
# Pull environment variables from Vercel
vc env pull .env.production --environment production

# Check DATABASE_URL value
cat .env.production | grep DATABASE_URL

# Test connection
source .env.production
npx prisma db execute --stdin <<< "SELECT 1"
```

### 2. Check Database Migrations

```bash
# Check migration status
source .env.production
npx prisma migrate status

# Run migrations if needed
npx prisma migrate deploy
```

### 3. Verify Health Endpoint

```bash
# Try custom domain (may work without auth)
curl https://holdwall.com/api/health | jq

# Or use Vercel CLI
vc curl /api/health --prod
```

### 4. Normalize Emails (If Needed)

```bash
# Pull env vars first
vc env pull .env.production --environment production
source .env.production

# Run normalization
npx tsx scripts/normalize-emails-production.ts
```

---

## 📝 Complete Environment Variables List

### Required Variables (All Set in Vercel)

1. ✅ `DATABASE_URL` - Supabase connection string
2. ✅ `NEXTAUTH_URL` - `https://holdwall.com`
3. ✅ `NEXTAUTH_SECRET` - JWT signing secret
4. ✅ `NEXT_PUBLIC_BASE_URL` - `https://holdwall.com`
5. ✅ `NEXT_PUBLIC_SUPABASE_URL` - `https://hrzxbonjpffluuiwpzwe.supabase.co`
6. ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
7. ✅ `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
8. ✅ `VAPID_PUBLIC_KEY` - VAPID public key
9. ✅ `VAPID_PRIVATE_KEY` - VAPID private key
10. ✅ `VAPID_SUBJECT` - `mailto:notifications@holdwall.com`
11. ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key (public)
12. ✅ `CSRF_SECRET` - CSRF protection secret
13. ✅ `EVIDENCE_SIGNING_SECRET` - Evidence signing secret
14. ✅ `OPENAI_API_KEY` - OpenAI API key
15. ✅ `REDIS_URL` - Redis connection string (optional)

### Optional Variables (Not Set)

- `KAFKA_BROKERS` - Kafka brokers (uses database if not set)
- `KAFKA_ENABLED` - Enable Kafka
- `GOOGLE_CLIENT_ID` - Google OAuth
- `GOOGLE_CLIENT_SECRET` - Google OAuth
- `GITHUB_CLIENT_ID` - GitHub OAuth
- `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `SENTRY_DSN` - Error tracking
- `ANTHROPIC_API_KEY` - Anthropic API
- `CHROMA_URL` - ChromaDB URL
- `CHROMA_API_KEY` - ChromaDB API key

---

## 🚀 Deployment Commands

### Vercel

```bash
# Deploy to production
vercel --prod

# View deployments
vc ls --prod

# View environment variables
vc env ls

# Pull environment variables
vc env pull .env.production --environment production

# View logs
vc logs --prod

# Add environment variable
echo 'value' | vc env add VARIABLE_NAME production

# Remove environment variable
echo 'y' | vc env rm VARIABLE_NAME production
```

### Supabase

```bash
# Get connection string from dashboard
# Visit: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database

# Test connection
DATABASE_URL="your-connection-string" npx prisma db execute --stdin <<< "SELECT 1"
```

### AWS

```bash
# Deploy to ECS
./aws-deploy.sh production us-east-1 ecs

# Deploy to EKS
./aws-deploy.sh production us-east-1 eks

# Deploy to Elastic Beanstalk
./aws-deploy.sh production us-east-1 beanstalk
```

---

## 📋 Summary

### ✅ Deployed and Operational

- ✅ **Vercel**: 15+ successful deployments
- ✅ **Latest**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- ✅ **Domain**: https://holdwall.com
- ✅ **Environment Variables**: 15 variables set
- ✅ **Supabase**: Project active and configured
- ✅ **Build System**: Working
- ✅ **API Routes**: 198 endpoints

### ⚠️ Needs Verification

- ⚠️ **DATABASE_URL**: Verify actual value
- ⚠️ **Database Migrations**: Check if run
- ⚠️ **Email Normalization**: May need to run

### 📋 AWS (Ready but Not Deployed)

- ✅ **ECS**: Ready
- ✅ **EKS**: Ready (14 Kubernetes manifests)
- ✅ **Elastic Beanstalk**: Ready
- ⚠️ **Status**: Not currently deployed

---

**Last Updated**: January 23, 2026  
**Status**: ✅ **ACTIVE DEPLOYMENTS VERIFIED**  
**Primary Platform**: Vercel  
**Database**: Supabase  
**Latest Deployment**: 7 hours ago
