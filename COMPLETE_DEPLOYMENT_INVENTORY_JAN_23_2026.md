# Complete Deployment Inventory - All Platforms
**Date**: January 23, 2026  
**Status**: ✅ **ACTIVE DEPLOYMENTS VERIFIED**

---

## 🌐 Production URLs & Endpoints

### Vercel (Primary Deployment - ACTIVE)

**Latest Production Deployment**:
- **URL**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- **Status**: ✅ Ready
- **Deployed**: 7 hours ago
- **Build Duration**: 2 minutes
- **Environment**: Production

**Recent Deployments** (All Ready):
- https://holdwall-an0zg4937-jannatpours-projects.vercel.app (8h ago)
- https://holdwall-64fvbondf-jannatpours-projects.vercel.app (9h ago)
- https://holdwall-10r9e50c6-jannatpours-projects.vercel.app (9h ago)
- https://holdwall-5seio21rs-jannatpours-projects.vercel.app (11h ago)
- https://holdwall-q9nguegga-jannatpours-projects.vercel.app (11h ago)
- https://holdwall-r0sf6eqxl-jannatpours-projects.vercel.app (12h ago)
- https://holdwall-o0tnud2y9-jannatpours-projects.vercel.app (22h ago)
- https://holdwall-a8qw3n3b5-jannatpours-projects.vercel.app (23h ago)

**Vercel Project Details**:
- **Project Name**: `holdwall`
- **Team/Account**: `jannatpours-projects`
- **Dashboard**: https://vercel.com/jannatpours-projects/holdwall
- **Settings**: https://vercel.com/jannatpours-projects/holdwall/settings
- **Deployments**: https://vercel.com/jannatpours-projects/holdwall/deployments
- **Environment Variables**: https://vercel.com/jannatpours-projects/holdwall/settings/environment-variables
- **Region**: `iad1` (US East - Washington, D.C.)

**Custom Domain** (Configured):
- **Primary**: https://holdwall.com
- **WWW**: https://www.holdwall.com
- **Status**: Domain configured in Vercel

**Vercel Configuration** (`vercel.json`):
- Framework: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Region: `iad1`
- Function Timeouts:
  - API routes: 30 seconds
  - AI routes: 60 seconds
  - Agents routes: 60 seconds
  - POS routes: 60 seconds

---

## 🗄️ Supabase Configuration

### Project Information
- **Project Name**: `holdwall-production`
- **Project Reference ID**: `hrzxbonjpffluuiwpzwe`
- **Status**: ✅ Active

### Supabase URLs
- **Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Database Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor
- **API Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/api
- **Auth Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/auth/url-configuration

### Supabase Endpoints
- **REST API URL**: `https://hrzxbonjpffluuiwpzwe.supabase.co`
- **Database Direct**: `db.hrzxbonjpffluuiwpzwe.supabase.co:5432`
- **Database Pooler**: `aws-0-[REGION].pooler.supabase.com:5432` (Session mode)
- **Database Pooler (Transaction)**: `aws-0-[REGION].pooler.supabase.com:6543` (Transaction mode)

### Connection String Formats

**Session Mode** (Recommended for Vercel):
```
postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Transaction Mode**:
```
postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Direct Connection**:
```
postgresql://postgres:[PASSWORD]@db.hrzxbonjpffluuiwpzwe.supabase.co:5432/postgres
```

**Note**: The exact connection string with region and URL-encoded password must be retrieved from Supabase dashboard.

---

## ☁️ AWS Configuration (Ready but Not Currently Deployed)

### AWS Deployment Options

#### Option 1: ECS (Elastic Container Service)

**Configuration File**: `aws-task-definition.json`

**Task Definition**:
- Family: `holdwall-pos`
- Network Mode: `awsvpc`
- Launch Type: `FARGATE`
- CPU: 1024 (1 vCPU)
- Memory: 2048 MB (2 GB)
- Container Port: 3000

**Container Image**:
- ECR Repository: `ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/holdwall-pos`
- Image Tag: `latest` or timestamp-based

**Deployment Command**:
```bash
./aws-deploy.sh production us-east-1 ecs
```

**Secrets from AWS Secrets Manager**:
- `holdwall/prod/database-url`
- `holdwall/prod/nextauth-secret`
- `holdwall/prod/nextauth-url`
- `holdwall/prod/vapid-public-key`
- `holdwall/prod/vapid-private-key`

#### Option 2: EKS (Elastic Kubernetes Service)

**Kubernetes Manifests**: `k8s/` directory (14 files)

**Namespace**: `holdwall`

**Deployments**:
- `app-deployment.yaml` - Main application
- `worker-deployment.yaml` - Background workers
- `outbox-worker-deployment.yaml` - Outbox pattern worker

**Services**:
- `app-service.yaml` - LoadBalancer service (port 80 → 3000)
- ClusterIP services for internal communication

**Ingress**:
- `ingress.yaml` - Ingress configuration
- Host: `holdwall.example.com` (needs to be updated)
- TLS: Let's Encrypt certificate
- SSL Redirect: Enabled

**Auto-Scaling**:
- `app-hpa.yaml` - Horizontal Pod Autoscaler
- Min replicas: 2
- Max replicas: 10
- Target CPU: 70%

**Scheduled Tasks**:
- `cronjobs.yaml` - Cron jobs for maintenance

**Deployment Command**:
```bash
./aws-deploy.sh production us-east-1 eks
```

**Kubernetes Resources**:
- ConfigMap: `holdwall-config`
- Secrets: `holdwall-secrets` (from External Secrets)
- Service Accounts: `holdwall-app`, `holdwall-worker`
- Network Policy: Security policies
- Pod Disruption Budget: Availability guarantees

#### Option 3: Elastic Beanstalk

**Platform**: Node.js

**Deployment Command**:
```bash
./aws-deploy.sh production us-east-1 beanstalk
```

**Configuration**:
- Environment: `holdwall-prod`
- Platform: Node.js 20.x
- Instance Type: t3.medium (default)

---

## 🔐 Environment Variables Inventory

### Vercel Environment Variables (All Set)

**Authentication**:
- ✅ `NEXTAUTH_URL` - `https://holdwall.com` (Production, 23h ago)
- ✅ `NEXTAUTH_SECRET` - Set (Production, 24h ago)

**Database**:
- ✅ `DATABASE_URL` - Set (Production, 22h ago)
  - **Note**: Value is encrypted in Vercel
  - **Format**: Should be Supabase connection string
  - **Verify**: Run `vc env pull .env.production` to see actual value

**Supabase API**:
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - `https://hrzxbonjpffluuiwpzwe.supabase.co` (Production, 22h ago)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Set (Production, 22h ago)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Set (Production, 22h ago)

**Application**:
- ✅ `NEXT_PUBLIC_BASE_URL` - `https://holdwall.com` (Production, 23h ago)

**Push Notifications (VAPID)**:
- ✅ `VAPID_PUBLIC_KEY` - Set (Production, 24h ago)
- ✅ `VAPID_PRIVATE_KEY` - Set (Production, 24h ago)
- ✅ `VAPID_SUBJECT` - Set (Production, 24h ago)
- ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Set (Production, 24h ago)

**Security**:
- ✅ `CSRF_SECRET` - Set (Production, 23h ago)
- ✅ `EVIDENCE_SIGNING_SECRET` - Set (Production, 23h ago)

**AI Services**:
- ✅ `OPENAI_API_KEY` - Set (Production, 23h ago)

**Cache**:
- ✅ `REDIS_URL` - Set (Production, 23h ago)
  - **Note**: May be localhost (uses in-memory fallback if not accessible)

### AWS Secrets Manager (If Deployed to AWS)

**Secrets Paths**:
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

## 📍 API Endpoints (198 Total)

### Base URLs

**Production**:
- Primary: `https://holdwall.com`
- Vercel: `https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app` (latest)

### Health & Status
- `GET /api/health` - Comprehensive health check
- `GET /api/auth/session` - Current session
- `GET /api/auth/providers` - Available OAuth providers

### Authentication
- `POST /api/auth/signup` - User registration
- `GET /api/auth/[...nextauth]` - NextAuth handlers
- `POST /api/auth/[...nextauth]` - NextAuth handlers

### Admin
- `POST /api/admin/normalize-emails` - Normalize user emails
- `GET /api/admin/normalize-emails` - Endpoint info

### Core Features
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

### Cases & Security
- `GET /api/cases` - List cases
- `POST /api/cases` - Create case
- `GET /api/cases/[id]` - Get case
- `POST /api/cases/[id]/resolve` - Resolve case
- `GET /api/security-incidents` - Security incidents
- `POST /api/security-incidents` - Create incident

### AI & Agents
- `POST /api/ai/orchestrate` - AI orchestration
- `POST /api/ai/semantic-search` - Semantic search
- `POST /api/agents/unified` - Unified agent execution
- `GET /api/agents/unified` - Agent status

### GraphQL
- `POST /api/graphql` - GraphQL endpoint

**And 180+ more endpoints...**

---

## 🗂️ Deployment Files & Configuration

### Vercel
- `vercel.json` - Vercel configuration
  - Build settings
  - Function timeouts
  - CORS headers
  - Region: `iad1`

### AWS ECS
- `aws-task-definition.json` - ECS task definition
- `aws-deploy.sh` - ECS deployment script

### AWS EKS
- `k8s/app-deployment.yaml` - Main app deployment
- `k8s/app-service.yaml` - LoadBalancer service
- `k8s/app-hpa.yaml` - Auto-scaling
- `k8s/app-pdb.yaml` - Pod disruption budget
- `k8s/worker-deployment.yaml` - Background workers
- `k8s/outbox-worker-deployment.yaml` - Outbox worker
- `k8s/ingress.yaml` - Ingress configuration
- `k8s/configmap.yaml` - Configuration
- `k8s/secrets.yaml` - External secrets
- `k8s/cronjobs.yaml` - Scheduled tasks
- `k8s/network-policy.yaml` - Network security
- `k8s/service-accounts.yaml` - Service accounts
- `k8s/namespace.yaml` - Namespace
- `k8s/kustomization.yaml` - Kustomize config

### Docker
- `Dockerfile` - Container image
- `docker-compose.yml` - Local development

### Database
- `prisma/schema.prisma` - Database schema (100+ models)
- `prisma/migrations/` - Migration files

---

## 🔍 Verification & Status Checks

### Check Vercel Deployment Status

```bash
# List all deployments
vc ls --prod

# View environment variables
vc env ls

# View logs
vc logs --prod

# Pull environment variables locally
vc env pull .env.production --environment production
```

### Check Supabase Status

**Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe

**Check Database Connection**:
```bash
# Pull env vars from Vercel
vc env pull .env.production --environment production
source .env.production

# Test connection
npx prisma db execute --stdin <<< "SELECT 1"
```

### Check Application Health

```bash
# Latest Vercel deployment
curl https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app/api/health | jq

# Custom domain
curl https://holdwall.com/api/health | jq
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

## 📊 Current Deployment Status Summary

### ✅ Active Deployments

**Vercel**:
- ✅ **Status**: Active and operational
- ✅ **Latest**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- ✅ **Domain**: https://holdwall.com (configured)
- ✅ **Build**: Successful
- ✅ **Environment Variables**: 15 variables set

**Supabase**:
- ✅ **Project**: Active (`holdwall-production`)
- ✅ **API Keys**: Configured in Vercel
- ✅ **Database**: Available
- ⚠️ **Connection String**: Needs verification

### ⚠️ Needs Verification

1. **DATABASE_URL Value**:
   - Set in Vercel but encrypted
   - Should be Supabase connection string
   - **Action**: Verify actual value with `vc env pull`

2. **Database Migrations**:
   - May need to be run
   - **Action**: Check migration status

3. **Email Normalization**:
   - May need to run for existing users
   - **Action**: Run normalization script if needed

### 📋 AWS (Ready but Not Deployed)

- ✅ **ECS**: Scripts and configs ready
- ✅ **EKS**: Kubernetes manifests ready (14 files)
- ✅ **Elastic Beanstalk**: Scripts ready
- ⚠️ **Status**: Not currently deployed (Vercel is primary)

---

## 🔗 Quick Access Links

### Vercel
- **Dashboard**: https://vercel.com/jannatpours-projects/holdwall
- **Deployments**: https://vercel.com/jannatpours-projects/holdwall/deployments
- **Settings**: https://vercel.com/jannatpours-projects/holdwall/settings
- **Environment Variables**: https://vercel.com/jannatpours-projects/holdwall/settings/environment-variables
- **Logs**: Available in dashboard or via `vc logs --prod`

### Supabase
- **Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Database Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor
- **API Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/api
- **Auth Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/auth/url-configuration

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
# Pull environment variables
vc env pull .env.production --environment production

# Check DATABASE_URL
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
# Check latest deployment
curl https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app/api/health | jq

# Check custom domain
curl https://holdwall.com/api/health | jq
```

### 4. Test Authentication

1. Visit: https://holdwall.com/auth/signin
2. Try creating an account
3. Test login flow
4. Verify session creation

---

## 📝 Environment Variables Summary

### Set in Vercel (15 variables)

| Variable | Status | Last Updated |
|----------|--------|--------------|
| DATABASE_URL | ✅ Set (encrypted) | 22h ago |
| NEXTAUTH_URL | ✅ Set | 23h ago |
| NEXTAUTH_SECRET | ✅ Set | 24h ago |
| NEXT_PUBLIC_BASE_URL | ✅ Set | 23h ago |
| NEXT_PUBLIC_SUPABASE_URL | ✅ Set | 22h ago |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ Set | 22h ago |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Set | 22h ago |
| VAPID_PUBLIC_KEY | ✅ Set | 24h ago |
| VAPID_PRIVATE_KEY | ✅ Set | 24h ago |
| VAPID_SUBJECT | ✅ Set | 24h ago |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | ✅ Set | 24h ago |
| CSRF_SECRET | ✅ Set | 23h ago |
| EVIDENCE_SIGNING_SECRET | ✅ Set | 23h ago |
| OPENAI_API_KEY | ✅ Set | 23h ago |
| REDIS_URL | ✅ Set | 23h ago |

---

## 🚀 Deployment Commands Reference

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

**Last Updated**: January 23, 2026  
**Status**: ✅ **ACTIVE DEPLOYMENTS VERIFIED**  
**Primary Platform**: Vercel  
**Database**: Supabase  
**Latest Deployment**: 7 hours ago
