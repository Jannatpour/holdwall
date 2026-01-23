# Production Deployment Steps - Complete Guide
**Date**: January 23, 2026  
**Status**: ✅ **READY FOR PRODUCTION**

## Overview

This guide provides step-by-step instructions for deploying Holdwall POS to production using Supabase (database) and Vercel (hosting).

---

## Prerequisites

- ✅ Supabase project: `holdwall-production` (Project Ref: `hrzxbonjpffluuiwpzwe`)
- ✅ Vercel account with project connected
- ✅ Vercel CLI installed (`npm i -g vercel`)
- ✅ Node.js and npm installed

---

## Step 1: Get Supabase Connection String

### 1.1 Access Supabase Dashboard

Visit: **https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database**

### 1.2 Copy Connection String

1. Scroll to **"Connection string"** section (at the top of the page)
2. Click the **"URI"** tab
3. Select **"Session mode"** (recommended for serverless/Vercel)
4. Click the **"Copy"** button

The connection string will look like:
```
postgresql://postgres.hrzxbonjpffluuiwpzwe:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Important**: 
- Use the **exact** connection string from Supabase dashboard
- It includes the correct region and formatting
- Password may be URL-encoded (Supabase handles this)

---

## Step 2: Run Email Normalization (If Needed)

### Option A: Run Locally Before Deployment

If you have existing users with mixed-case emails, normalize them first:

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Run normalization script
cd /Users/amir/holdwall/holdwall
npx tsx scripts/normalize-emails-production.ts
```

**Expected Output**:
```
📊 Email Normalization Results:
============================================================
   Total users: X
   ✅ Updated: Y
   ⏭️  Skipped: Z
   ⚠️  Conflicts: 0
   ❌ Errors: 0

✅ Success! All emails normalized.
💡 Users can now login with any email case variation.
```

### Option B: Run After Deployment via API

After deployment, you can run normalization via API endpoint:

```bash
# Get your production URL first (from Vercel dashboard)
export PROD_URL="https://your-domain.vercel.app"
export ADMIN_SECRET="your-nextauth-secret"

# Run normalization
curl -X POST "${PROD_URL}/api/admin/normalize-emails" \
  -H "Authorization: Bearer ${ADMIN_SECRET}" \
  -H "Content-Type: application/json"
```

---

## Step 3: Verify System Locally

Before deploying, verify everything works with your Supabase database:

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
export NEXTAUTH_SECRET="your-secret-here"
export NEXTAUTH_URL="https://your-domain.vercel.app"

# Run comprehensive verification
cd /Users/amir/holdwall/holdwall
npx tsx scripts/comprehensive-system-verification.ts
```

**Expected Output**:
```
🔍 Comprehensive System Verification
============================================================

✅ Environment Variables: All required environment variables present
✅ Database Connection: Database connection successful
✅ Database Schema: Schema valid, X users found
✅ Database Tenants: X tenants found
✅ Redis Cache: Redis not configured, using in-memory fallback
✅ Authentication Config: NextAuth configuration complete
✅ Authentication Users: X users with passwords found
✅ Email Normalization: All emails are normalized (lowercase)
✅ Service Initialization: All services initialized successfully
✅ Health Endpoint: Health check passed

============================================================
📊 Verification Summary
============================================================
✅ Passed: 10
⚠️  Warnings: 1
❌ Failed: 0
📋 Total: 11

✅ System verification complete - All critical components operational
```

**If you see failures**, fix them before proceeding to deployment.

---

## Step 4: Set Environment Variables in Vercel

### 4.1 Required Environment Variables

You need to set these in Vercel Dashboard:

**Required**:
- `DATABASE_URL` - Your Supabase connection string
- `NEXTAUTH_URL` - Your production URL (e.g., `https://holdwall.vercel.app`)
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`

**Optional but Recommended**:
- `REDIS_URL` - Redis connection string (uses in-memory fallback if not set)
- `KAFKA_BROKERS` - Kafka brokers (uses database if not set)
- `OPENAI_API_KEY` - For AI features

### 4.2 Set Variables via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
cd /Users/amir/holdwall/holdwall
vercel link

# Set environment variables
# Replace values with your actual values

# DATABASE_URL (from Supabase)
echo 'your-supabase-connection-string' | vercel env add DATABASE_URL production

# NEXTAUTH_SECRET (generate if you don't have one)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "$NEXTAUTH_SECRET" | vercel env add NEXTAUTH_SECRET production

# NEXTAUTH_URL (your production URL - set after first deployment if needed)
echo 'https://your-domain.vercel.app' | vercel env add NEXTAUTH_URL production

# Optional: Redis
# echo 'your-redis-url' | vercel env add REDIS_URL production

# Optional: OpenAI
# echo 'your-openai-key' | vercel env add OPENAI_API_KEY production
```

### 4.3 Set Variables via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `holdwall`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Supabase connection string
   - **Environment**: Production (and Preview if needed)
   - Click **Save**

Repeat for all required variables.

---

## Step 5: Deploy to Vercel

### Option A: Automatic Deployment (Recommended)

If your repository is connected to Vercel, push to main branch:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

Vercel will automatically:
1. Build the project
2. Run tests
3. Deploy to production

### Option B: Manual Deployment via CLI

```bash
cd /Users/amir/holdwall/holdwall

# Deploy to production
vercel --prod
```

### Option C: Use Deployment Script

```bash
cd /Users/amir/holdwall/holdwall

# This script will:
# 1. Update DATABASE_URL in Vercel
# 2. Test database connection
# 3. Run migrations
# 4. Deploy to production
npm run deploy:complete 'your-supabase-connection-string'
```

---

## Step 6: Run Database Migrations

After deployment, run Prisma migrations:

```bash
# Option 1: Via Vercel CLI (pull env vars first)
vercel env pull .env.production --environment production
source .env.production
npx prisma migrate deploy

# Option 2: Directly with DATABASE_URL
DATABASE_URL="your-supabase-connection-string" npx prisma migrate deploy
```

**Expected Output**:
```
Environment variables loaded from .env.production
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-[REGION].pooler.supabase.com:5432"

X migrations found in prisma/migrations

Applying migration `20260121135618_init`
✅ Migration applied successfully

✅ All migrations have been successfully applied.
```

---

## Step 7: Verify Health Endpoint

After deployment, verify the health endpoint:

```bash
# Get your production URL from Vercel dashboard
export PROD_URL="https://your-domain.vercel.app"

# Check health
curl "${PROD_URL}/api/health" | jq
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-23T...",
  "services": {
    "database": true,
    "cache": false,
    "metrics": true
  },
  "uptime": 123.45
}
```

If you see `"status": "healthy"`, your deployment is successful!

---

## Step 8: Test Login Flow

1. **Visit Sign-in Page**:
   ```
   https://your-domain.vercel.app/auth/signin
   ```

2. **Test Login**:
   - If you have existing users, try logging in
   - If not, create a new account at `/auth/signup`
   - Test with various email cases (should work with any case)

3. **Verify Session**:
   - After login, you should be redirected to `/overview`
   - Check browser DevTools → Application → Cookies
   - Should see `next-auth.session-token`

---

## Step 9: Post-Deployment Verification

### 9.1 Run Comprehensive Verification

After deployment, verify everything works:

```bash
# Set production environment variables
export DATABASE_URL="your-supabase-connection-string"
export NEXTAUTH_URL="https://your-domain.vercel.app"
export NEXTAUTH_SECRET="your-secret"

# Run verification
cd /Users/amir/holdwall/holdwall
npx tsx scripts/comprehensive-system-verification.ts
```

### 9.2 Check Vercel Deployment Logs

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Deployments** tab
4. Click on the latest deployment
5. Check **Build Logs** and **Function Logs** for any errors

### 9.3 Monitor Application

- **Health Endpoint**: `https://your-domain.vercel.app/api/health`
- **Vercel Analytics**: Available in Vercel dashboard
- **Error Tracking**: Check Vercel logs for errors

---

## Troubleshooting

### Issue: Database Connection Failed

**Symptoms**: Health endpoint shows `"database": false`

**Solutions**:
1. Verify `DATABASE_URL` is set correctly in Vercel
2. Check Supabase connection string format
3. Ensure Supabase project is active
4. Check Supabase network restrictions

### Issue: Authentication Not Working

**Symptoms**: Can't login, session not created

**Solutions**:
1. Verify `NEXTAUTH_SECRET` is set
2. Verify `NEXTAUTH_URL` matches your production URL
3. Check browser console for errors
4. Run email normalization if needed

### Issue: Build Fails

**Symptoms**: Deployment fails during build

**Solutions**:
1. Check build logs in Vercel dashboard
2. Verify all dependencies are in `package.json`
3. Check for TypeScript errors: `npm run type-check`
4. Test build locally: `npm run build`

### Issue: Migrations Fail

**Symptoms**: `prisma migrate deploy` fails

**Solutions**:
1. Verify `DATABASE_URL` is correct
2. Check database permissions
3. Ensure Supabase project is active
4. Check migration files are correct

---

## Quick Reference Commands

### Get Supabase Connection String
```bash
# Visit: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
# Copy from "Connection string" → "URI" → "Session mode"
```

### Normalize Emails
```bash
DATABASE_URL="your-supabase-url" npx tsx scripts/normalize-emails-production.ts
```

### Verify System
```bash
DATABASE_URL="your-supabase-url" npx tsx scripts/comprehensive-system-verification.ts
```

### Set Vercel Environment Variables
```bash
echo 'value' | vercel env add VARIABLE_NAME production
```

### Deploy to Vercel
```bash
vercel --prod
```

### Run Migrations
```bash
DATABASE_URL="your-supabase-url" npx prisma migrate deploy
```

### Check Health
```bash
curl https://your-domain.vercel.app/api/health | jq
```

---

## Complete Deployment Checklist

- [ ] Get Supabase connection string from dashboard
- [ ] Run email normalization (if needed)
- [ ] Verify system locally with Supabase
- [ ] Set `DATABASE_URL` in Vercel
- [ ] Set `NEXTAUTH_SECRET` in Vercel (generate if needed)
- [ ] Set `NEXTAUTH_URL` in Vercel
- [ ] Set optional environment variables (Redis, Kafka, OpenAI)
- [ ] Deploy to Vercel (automatic or manual)
- [ ] Run database migrations
- [ ] Verify health endpoint
- [ ] Test login flow
- [ ] Run comprehensive verification
- [ ] Monitor deployment logs
- [ ] Test all critical features

---

## Support Resources

- **Supabase Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Health Endpoint**: `https://your-domain.vercel.app/api/health`
- **Documentation**: See `COMPREHENSIVE_SYSTEM_VERIFICATION_JAN_23_2026.md`

---

**Last Updated**: January 23, 2026  
**Status**: ✅ **READY FOR PRODUCTION DEPLOYMENT**
