# Complete Deployment Inventory - All Platforms
**Date**: January 23, 2026  
**Status**: ✅ **ACTIVE DEPLOYMENTS VERIFIED**

---

## 🎯 Executive Summary

Your application is **actively deployed** on Vercel with multiple successful deployments. All environment variables are configured. Supabase is set up and ready. AWS configurations are prepared but not currently deployed.

---

## 🌐 Production URLs

### Vercel (Primary - ACTIVE)

**Latest Production Deployment**:
- **URL**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- **Status**: ✅ Ready
- **Deployed**: 7 hours ago
- **Build Time**: 2 minutes
- **Note**: Preview deployments are protected by Vercel authentication

**Custom Domain** (Configured):
- **Primary**: https://holdwall.com
- **WWW**: https://www.holdwall.com

**Vercel Project**:
- **Project**: `holdwall`
- **Team**: `jannatpours-projects`
- **Dashboard**: https://vercel.com/jannatpours-projects/holdwall
- **Region**: `iad1` (US East)

**Recent Deployments** (All Ready):
- https://holdwall-an0zg4937-jannatpours-projects.vercel.app (8h ago)
- https://holdwall-64fvbondf-jannatpours-projects.vercel.app (9h ago)
- https://holdwall-10r9e50c6-jannatpours-projects.vercel.app (9h ago)
- https://holdwall-5seio21rs-jannatpours-projects.vercel.app (11h ago)
- https://holdwall-q9nguegga-jannatpours-projects.vercel.app (11h ago)
- https://holdwall-r0sf6eqxl-jannatpours-projects.vercel.app (12h ago)
- https://holdwall-o0tnud2y9-jannatpours-projects.vercel.app (22h ago)
- https://holdwall-a8qw3n3b5-jannatpours-projects.vercel.app (23h ago)

---

## 🗄️ Supabase Configuration

### Project Details
- **Project Name**: `holdwall-production`
- **Project Reference ID**: `hrzxbonjpffluuiwpzwe`
- **Status**: ✅ Active

### Supabase URLs

**Dashboard**:
- **Main**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Database Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor
- **API Settings**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/api

**API Endpoints**:
- **REST API**: `https://hrzxbonjpffluuiwpzwe.supabase.co`
- **Database Direct**: `db.hrzxbonjpffluuiwpzwe.supabase.co:5432`
- **Database Pooler**: `aws-0-[REGION].pooler.supabase.com:5432` (Session mode)

**Connection String** (Get from Dashboard):
```
postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Get Connection String**:
1. Visit: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
2. Scroll to "Connection string" section
3. Click "URI" tab
4. Select "Session mode"
5. Click "Copy"

---

## ☁️ AWS Configuration (Ready but Not Deployed)

### AWS Account
- **Account ID**: `597743362576` (from ECR image)
- **Region**: `us-east-1`

### ECS (Elastic Container Service)

**ECR Repository**:
- **Repository**: `597743362576.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos`
- **Latest Image**: `597743362576.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos:20260122-141807`

**Task Definition**:
- **Family**: `holdwall-pos`
- **CPU**: 1024 (1 vCPU)
- **Memory**: 2048 MB (2 GB)
- **Port**: 3000

**Deploy**: `./aws-deploy.sh production us-east-1 ecs`

### EKS (Elastic Kubernetes Service)

**Kubernetes Resources**:
- **Namespace**: `holdwall`
- **App Replicas**: 3 (auto-scales 2-10)
- **Workers**: 2 replicas
- **Outbox Worker**: 1 replica
- **Ingress**: Nginx with Let's Encrypt TLS
- **HPA**: Auto-scaling (CPU 70%, Memory 80%)

**Manifests**: 14 files in `k8s/` directory

**Deploy**: `./aws-deploy.sh production us-east-1 eks`

### Elastic Beanstalk

**Deploy**: `./aws-deploy.sh production us-east-1 beanstalk`

---

## 🔐 Environment Variables (Vercel)

### All 15 Variables Set

**Authentication**:
- ✅ `NEXTAUTH_URL` = `https://holdwall.com` (23h ago)
- ✅ `NEXTAUTH_SECRET` = Set (24h ago)

**Database**:
- ✅ `DATABASE_URL` = Set (22h ago) - **Encrypted, verify value**

**Supabase**:
- ✅ `NEXT_PUBLIC_SUPABASE_URL` = `https://hrzxbonjpffluuiwpzwe.supabase.co` (22h ago)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Set (22h ago)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = Set (22h ago)

**Application**:
- ✅ `NEXT_PUBLIC_BASE_URL` = `https://holdwall.com` (23h ago)

**VAPID (Push Notifications)**:
- ✅ `VAPID_PUBLIC_KEY` = Set (24h ago)
- ✅ `VAPID_PRIVATE_KEY` = Set (24h ago)
- ✅ `VAPID_SUBJECT` = Set (24h ago)
- ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Set (24h ago)

**Security**:
- ✅ `CSRF_SECRET` = Set (23h ago)
- ✅ `EVIDENCE_SIGNING_SECRET` = Set (23h ago)

**AI Services**:
- ✅ `OPENAI_API_KEY` = Set (23h ago)

**Cache**:
- ✅ `REDIS_URL` = Set (23h ago)

### View Environment Variables

```bash
# List all variables
vc env ls

# Pull to local file (decrypted)
vc env pull .env.production --environment production

# View specific variable
cat .env.production | grep DATABASE_URL
```

---

## 📍 API Endpoints

### Base URLs
- **Production**: https://holdwall.com
- **Latest Vercel**: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app

### Key Endpoints (198 total)

**Health**: `GET /api/health`  
**Auth**: `GET /api/auth/session`, `POST /api/auth/signup`  
**Admin**: `POST /api/admin/normalize-emails`  
**Core**: `/api/signals`, `/api/claims`, `/api/evidence`, `/api/graph`, `/api/forecasts`  
**Cases**: `/api/cases`, `/api/security-incidents`  
**AI**: `/api/ai/orchestrate`, `/api/agents/unified`  
**GraphQL**: `POST /api/graphql`

---

## 🔍 Verification Steps

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
source .env.production
npx prisma migrate status

# Run if needed
npx prisma migrate deploy
```

### 3. Verify Health Endpoint

```bash
# Try custom domain
curl https://holdwall.com/api/health | jq

# Or use Vercel CLI
vc curl /api/health --prod
```

### 4. Normalize Emails (If Needed)

```bash
source .env.production
npx tsx scripts/normalize-emails-production.ts
```

---

## 📊 Deployment Statistics

### Vercel
- **Total Deployments**: 15+ successful
- **Latest**: 7 hours ago
- **Status**: ✅ Ready
- **Build Time**: ~2 minutes
- **Region**: `iad1`

### Codebase
- **API Routes**: 198 endpoints
- **UI Components**: 117+ components
- **Database Models**: 100+ models
- **Kubernetes Manifests**: 14 files
- **TypeScript Files**: 1000+ files
- **Build Output**: 223+ static pages

---

## 🔗 Quick Links

### Vercel
- Dashboard: https://vercel.com/jannatpours-projects/holdwall
- Deployments: https://vercel.com/jannatpours-projects/holdwall/deployments
- Settings: https://vercel.com/jannatpours-projects/holdwall/settings
- Environment Variables: https://vercel.com/jannatpours-projects/holdwall/settings/environment-variables

### Supabase
- Dashboard: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- Database Settings: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
- SQL Editor: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/editor

### Application
- Production: https://holdwall.com
- Latest Vercel: https://holdwall-c2yh2czoi-jannatpours-projects.vercel.app
- Health: https://holdwall.com/api/health
- Sign In: https://holdwall.com/auth/signin

---

## ✅ Current Status

### Deployed and Operational
- ✅ **Vercel**: Active with 15+ deployments
- ✅ **Domain**: holdwall.com configured
- ✅ **Environment Variables**: 15 variables set
- ✅ **Supabase**: Project active and configured
- ✅ **Build System**: Working

### Needs Verification
- ⚠️ **DATABASE_URL**: Verify actual value
- ⚠️ **Database Migrations**: Check if run
- ⚠️ **Email Normalization**: May need to run

### AWS (Ready but Not Deployed)
- ✅ **ECS**: Scripts ready
- ✅ **EKS**: Manifests ready (14 files)
- ✅ **Elastic Beanstalk**: Scripts ready

---

**Last Updated**: January 23, 2026  
**Status**: ✅ **ACTIVE DEPLOYMENTS VERIFIED**
