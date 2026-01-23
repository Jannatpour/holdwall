# Deployed System Inventory - Complete Overview
**Date**: January 23, 2026  
**Status**: ✅ **ACTIVE DEPLOYMENTS VERIFIED**

---

## 🌐 Production URLs

### Vercel Deployments (Primary)

**Latest Production Deployment**:
- **URL**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- **Status**: ✅ Ready (7 hours ago)
- **Environment**: Production
- **Build Duration**: 2 minutes

**Recent Deployments**:
- https://holdwall-an0zg4937-jannatpours-projects.vercel.app (8h ago, Ready)
- https://holdwall-64fvbondf-jannatpours-projects.vercel.app (9h ago, Ready)
- https://holdwall-10r9e50c6-jannatpours-projects.vercel.app (9h ago, Ready)
- https://holdwall-5seio21rs-jannatpours-projects.vercel.app (11h ago, Ready)
- https://holdwall-q9nguegga-jannatpours-projects.vercel.app (11h ago, Ready)
- https://holdwall-r0sf6eqxl-jannatpours-projects.vercel.app (12h ago, Ready)
- https://holdwall-o0tnud2y9-jannatpours-projects.vercel.app (22h ago, Ready)
- https://holdwall-a8qw3n3b5-jannatpours-projects.vercel.app (23h ago, Ready)

**Vercel Project**:
- **Project Name**: `holdwall`
- **Team**: `jannatpours-projects`
- **Dashboard**: https://vercel.com/jannatpours-projects/holdwall
- **Region**: `iad1` (US East - Washington, D.C.)

**Custom Domain** (Configured):
- **Primary**: https://holdwall.com
- **WWW**: https://www.holdwall.com
- **Status**: Domain configured in Vercel

---

## 🗄️ Supabase Configuration

### Project Details
- **Project Name**: `holdwall-production`
- **Project Ref**: `hrzxbonjpffluuiwpzwe`
- **Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Database Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor

### Supabase URLs
- **REST API**: `https://hrzxbonjpffluuiwpzwe.supabase.co`
- **Database Host**: `db.hrzxbonjpffluuiwpzwe.supabase.co` (direct)
- **Pooler Host**: `aws-0-[REGION].pooler.supabase.com` (connection pooler)

### Connection String Format
```
postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Note**: The exact connection string with region and password must be retrieved from Supabase dashboard.

### Supabase API Keys (Configured in Vercel)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Set
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Set
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - `https://hrzxbonjpffluuiwpzwe.supabase.co`

---

## ☁️ AWS Configuration

### AWS Deployment Options Available

#### Option 1: ECS (Elastic Container Service)
- **Task Definition**: `aws-task-definition.json`
- **Container Image**: `ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/holdwall-pos:latest`
- **CPU**: 1024 (1 vCPU)
- **Memory**: 2048 MB (2 GB)
- **Network Mode**: `awsvpc`
- **Launch Type**: Fargate
- **Port**: 3000

**Deployment Script**: `./aws-deploy.sh production us-east-1 ecs`

#### Option 2: EKS (Elastic Kubernetes Service)
- **Kubernetes Manifests**: `k8s/` directory (14 files)
- **Namespace**: `holdwall`
- **Deployments**: App, Workers (Outbox, Pipeline)
- **Services**: LoadBalancer, ClusterIP
- **Ingress**: Configured
- **HPA**: Auto-scaling configured
- **CronJobs**: Scheduled tasks

**Deployment Script**: `./aws-deploy.sh production us-east-1 eks`

**Kubernetes Files**:
- `app-deployment.yaml` - Main application deployment
- `app-service.yaml` - LoadBalancer service
- `app-hpa.yaml` - Horizontal Pod Autoscaler
- `app-pdb.yaml` - Pod Disruption Budget
- `worker-deployment.yaml` - Background workers
- `outbox-worker-deployment.yaml` - Outbox pattern worker
- `ingress.yaml` - Ingress configuration
- `configmap.yaml` - Configuration
- `secrets.yaml` - Secrets template
- `cronjobs.yaml` - Scheduled tasks
- `network-policy.yaml` - Network security
- `service-accounts.yaml` - Service accounts
- `namespace.yaml` - Namespace definition
- `kustomization.yaml` - Kustomize config

#### Option 3: Elastic Beanstalk
- **Platform**: Node.js
- **Deployment Script**: `./aws-deploy.sh production us-east-1 beanstalk`

### AWS Secrets Manager
Secrets are stored in AWS Secrets Manager with the following paths:
- `holdwall/prod/database-url`
- `holdwall/prod/nextauth-secret`
- `holdwall/prod/nextauth-url`
- `holdwall/prod/vapid-public-key`
- `holdwall/prod/vapid-private-key`

**Setup Script**: `./scripts/setup-deployment-secrets.sh`

---

## 🔐 Environment Variables

### Required Variables (Set in Vercel)

#### Authentication
- ✅ `NEXTAUTH_URL` - `https://holdwall.com`
- ✅ `NEXTAUTH_SECRET` - Set (JWT signing secret)
- ✅ `NEXT_PUBLIC_BASE_URL` - `https://holdwall.com`

#### Database
- ⚠️ `DATABASE_URL` - Needs Supabase connection string
  - Format: `postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
  - **Get from**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database

#### Supabase API
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Set
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Set
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - `https://hrzxbonjpffluuiwpzwe.supabase.co`

#### Push Notifications (VAPID)
- ✅ `VAPID_PUBLIC_KEY` - Set
- ✅ `VAPID_PRIVATE_KEY` - Set
- ✅ `VAPID_SUBJECT` - `mailto:notifications@holdwall.com`
- ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Set

#### Security
- ✅ `CSRF_SECRET` - Set
- ✅ `EVIDENCE_SIGNING_SECRET` - Set

#### AI Services
- ✅ `OPENAI_API_KEY` - Set

### Optional Variables

#### Cache
- ⚠️ `REDIS_URL` - Optional (uses in-memory fallback if not set)

#### Event Streaming
- ⚠️ `KAFKA_BROKERS` - Optional (uses database if not set)
- ⚠️ `KAFKA_ENABLED` - Optional

#### OAuth Providers
- ⚠️ `GOOGLE_CLIENT_ID` - Optional
- ⚠️ `GOOGLE_CLIENT_SECRET` - Optional
- ⚠️ `GITHUB_CLIENT_ID` - Optional
- ⚠️ `GITHUB_CLIENT_SECRET` - Optional

#### Monitoring
- ⚠️ `SENTRY_DSN` - Optional (error tracking)

---

## 📍 API Endpoints

### Production Endpoints

**Base URL**: `https://holdwall.com` (or latest Vercel deployment URL)

#### Health & Status
- `GET /api/health` - Comprehensive health check
- `GET /api/auth/session` - Current session status
- `GET /api/auth/providers` - Available OAuth providers

#### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handlers (signin, signout, callback)
- `GET /api/auth/session` - Get current session

#### Admin
- `POST /api/admin/normalize-emails` - Normalize user emails (requires auth)

#### Core APIs (198 endpoints total)
- `/api/signals` - Signal ingestion
- `/api/claims` - Claim management
- `/api/evidence` - Evidence vault
- `/api/graph` - Belief graph
- `/api/forecasts` - Forecasting
- `/api/aaal` - AAAL artifacts
- `/api/playbooks` - Playbooks
- `/api/approvals` - Approval workflows
- `/api/cases` - Case management
- `/api/security-incidents` - Security incidents
- `/api/ai/orchestrate` - AI orchestration
- `/api/graphql` - GraphQL endpoint
- And 186+ more endpoints...

---

## 🗂️ Deployment Files

### Vercel Configuration
- `vercel.json` - Vercel deployment configuration
  - Build command: `npm run build`
  - Framework: Next.js
  - Region: `iad1` (US East)
  - Function timeouts: 30-60 seconds
  - CORS headers configured

### AWS Configuration
- `aws-task-definition.json` - ECS task definition
- `aws-deploy.sh` - AWS deployment automation script
- `k8s/` - Kubernetes manifests (14 files)
  - Deployments, Services, Ingress, HPA, CronJobs, etc.

### Docker
- `Dockerfile` - Container image definition
- `docker-compose.yml` - Local development setup

### Database
- `prisma/schema.prisma` - Database schema (100+ models)
- `prisma/migrations/` - Database migration files

---

## 🔍 How to Check Current Deployment Status

### Vercel

**List Deployments**:
```bash
vc ls --prod
```

**View Environment Variables**:
```bash
vc env ls
```

**View Logs**:
```bash
vc logs --prod
```

**Inspect Latest Deployment**:
```bash
vc inspect --prod
```

**Vercel Dashboard**:
- https://vercel.com/jannatpours-projects/holdwall

### Supabase

**Dashboard**:
- https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe

**Database Settings**:
- https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database

**SQL Editor**:
- https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor

**API Settings**:
- https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/api

### AWS

**Check ECS** (if deployed):
```bash
aws ecs list-clusters --region us-east-1
aws ecs list-services --cluster <cluster-name> --region us-east-1
```

**Check EKS** (if deployed):
```bash
kubectl get deployments -n holdwall
kubectl get services -n holdwall
kubectl get ingress -n holdwall
```

**Check Secrets Manager**:
```bash
aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'holdwall')]"
```

---

## ✅ Verification Commands

### Check Health
```bash
# Latest deployment
curl https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app/api/health | jq

# Custom domain (if configured)
curl https://holdwall.com/api/health | jq
```

### Check Authentication
```bash
# Session endpoint
curl https://holdwall.com/api/auth/session | jq

# Providers
curl https://holdwall.com/api/auth/providers | jq
```

### Check Database Connection
```bash
# Pull env vars
vc env pull .env.production --environment production
source .env.production

# Test connection
npx prisma db execute --stdin <<< "SELECT 1"
```

---

## 📊 Deployment Statistics

### Vercel
- **Total Deployments**: 15+ deployments
- **Latest**: 7 hours ago
- **Status**: ✅ Ready
- **Build Time**: ~2 minutes
- **Region**: `iad1` (US East)

### Codebase
- **API Routes**: 198 endpoints
- **UI Components**: 117+ components
- **Database Models**: 100+ models
- **Kubernetes Manifests**: 14 files
- **TypeScript Files**: 1000+ files
- **Build Output**: 223+ static pages

---

## 🎯 Current Deployment Status

### ✅ Deployed and Operational
- ✅ **Vercel**: Multiple successful deployments
- ✅ **Domain**: holdwall.com configured
- ✅ **Build System**: Working
- ✅ **Environment Variables**: Most configured

### ⚠️ Needs Attention
- ⚠️ **DATABASE_URL**: Needs exact Supabase connection string
- ⚠️ **Database Migrations**: May need to be run
- ⚠️ **Email Normalization**: May need to run for existing users

### 📋 AWS (Ready but Not Deployed)
- ✅ **ECS**: Scripts and configs ready
- ✅ **EKS**: Kubernetes manifests ready
- ✅ **Elastic Beanstalk**: Scripts ready
- ⚠️ **Status**: Not currently deployed to AWS (Vercel is primary)

---

## 🔗 Quick Links

### Vercel
- **Dashboard**: https://vercel.com/jannatpours-projects/holdwall
- **Latest Deployment**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- **Project Settings**: https://vercel.com/jannatpours-projects/holdwall/settings

### Supabase
- **Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Database Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor
- **API Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/api

### Application
- **Production**: https://holdwall.com
- **Health Check**: https://holdwall.com/api/health
- **Sign In**: https://holdwall.com/auth/signin
- **Sign Up**: https://holdwall.com/auth/signup

---

## 📝 Next Actions

1. **Verify DATABASE_URL** in Vercel:
   ```bash
   vc env ls | grep DATABASE_URL
   ```

2. **Get Supabase Connection String**:
   - Visit: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
   - Copy connection string (Session mode)

3. **Update DATABASE_URL** (if needed):
   ```bash
   echo 'your-supabase-connection-string' | vc env add DATABASE_URL production
   ```

4. **Run Migrations** (if needed):
   ```bash
   vc env pull .env.production --environment production
   source .env.production
   npx prisma migrate deploy
   ```

5. **Normalize Emails** (if needed):
   ```bash
   DATABASE_URL="your-supabase-url" npx tsx scripts/normalize-emails-production.ts
   ```

6. **Verify Health**:
   ```bash
   curl https://holdwall.com/api/health | jq
   ```

---

**Last Updated**: January 23, 2026  
**Status**: ✅ **ACTIVE DEPLOYMENTS VERIFIED**  
**Primary Platform**: Vercel  
**Database**: Supabase
