# Quick Production Deployment Guide

**Date**: January 23, 2026  
**For**: Supabase + Vercel Deployment

---

## 🚀 Quick Start (5 Steps)

### Step 1: Get Supabase Connection String

1. Visit: **https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database**
2. Scroll to **"Connection string"** section
3. Click **"URI"** tab → Select **"Session mode"**
4. Click **"Copy"** button

**Format**: `postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

---

### Step 2: Run Email Normalization (If Needed)

**If you have existing users**, normalize their emails first:

```bash
cd /Users/amir/holdwall/holdwall

# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres.hrzxbonjpffluuiwpzwe:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Run normalization
npx tsx scripts/normalize-emails-production.ts
```

**Expected**: Shows how many emails were updated. If all are already lowercase, it will skip them.

---

### Step 3: Verify System Locally

**Before deploying**, verify everything works:

```bash
# Set environment variables
export DATABASE_URL="your-supabase-connection-string"
export NEXTAUTH_SECRET="your-secret"  # Generate with: openssl rand -base64 32
export NEXTAUTH_URL="https://your-domain.vercel.app"

# Run verification
npx tsx scripts/comprehensive-system-verification.ts
```

**Expected**: All checks should pass (✅). If any fail (❌), fix them first.

---

### Step 4: Set Environment Variables in Vercel

**Option A: Via Vercel CLI** (Recommended)

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login
vercel login

# Link project (if not already linked)
cd /Users/amir/holdwall/holdwall
vercel link

# Set required variables
echo 'your-supabase-connection-string' | vercel env add DATABASE_URL production

# Generate and set NEXTAUTH_SECRET
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "$NEXTAUTH_SECRET" | vercel env add NEXTAUTH_SECRET production

# Set NEXTAUTH_URL (use your Vercel domain or custom domain)
echo 'https://your-domain.vercel.app' | vercel env add NEXTAUTH_URL production
```

**Option B: Via Vercel Dashboard**

1. Go to: https://vercel.com/dashboard
2. Select project: `holdwall`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - `DATABASE_URL` = Your Supabase connection string
   - `NEXTAUTH_SECRET` = Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` = Your production URL
5. Select **Production** environment
6. Click **Save**

---

### Step 5: Deploy to Vercel

**Option A: Automatic** (If repo is connected)

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

Vercel will automatically build and deploy.

**Option B: Manual via CLI**

```bash
cd /Users/amir/holdwall/holdwall
vercel --prod
```

**Option C: Use Complete Setup Script**

```bash
cd /Users/amir/holdwall/holdwall
npm run deploy:complete 'your-supabase-connection-string'
```

This script will:
1. ✅ Update DATABASE_URL in Vercel
2. ✅ Test database connection
3. ✅ Run Prisma migrations
4. ✅ Verify schema
5. ✅ Deploy to production

---

## 📋 Post-Deployment Steps

### 1. Run Database Migrations

```bash
# Pull environment variables
vercel env pull .env.production --environment production
source .env.production

# Run migrations
npx prisma migrate deploy
```

**Or directly**:
```bash
DATABASE_URL="your-supabase-connection-string" npx prisma migrate deploy
```

---

### 2. Verify Health Endpoint

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
  "services": {
    "database": true,
    "cache": false,
    "metrics": true
  }
}
```

---

### 3. Test Login

1. Visit: `https://your-domain.vercel.app/auth/signin`
2. Create account or login with existing credentials
3. Should redirect to `/overview` after successful login

---

### 4. Normalize Emails (If Needed After Deployment)

**Via API**:
```bash
export PROD_URL="https://your-domain.vercel.app"
export ADMIN_SECRET="your-nextauth-secret"

curl -X POST "${PROD_URL}/api/admin/normalize-emails" \
  -H "Authorization: Bearer ${ADMIN_SECRET}" \
  -H "Content-Type: application/json"
```

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Health endpoint returns `"status": "healthy"`
- [ ] Database connection works (`"database": true` in health check)
- [ ] Can access sign-in page: `/auth/signin`
- [ ] Can create new account: `/auth/signup`
- [ ] Can login with credentials
- [ ] Session is created (check cookies in browser)
- [ ] Can access protected pages (e.g., `/overview`)

---

## 🛠️ Troubleshooting

### Database Connection Failed

**Check**:
1. `DATABASE_URL` is set correctly in Vercel
2. Supabase connection string format is correct
3. Supabase project is active
4. Network restrictions allow connections

**Fix**:
```bash
# Re-verify connection string from Supabase dashboard
# Update in Vercel:
echo 'correct-connection-string' | vercel env rm DATABASE_URL production
echo 'correct-connection-string' | vercel env add DATABASE_URL production
```

### Authentication Not Working

**Check**:
1. `NEXTAUTH_SECRET` is set
2. `NEXTAUTH_URL` matches your production URL
3. Browser console for errors
4. Run email normalization if users can't login

**Fix**:
```bash
# Generate new secret
openssl rand -base64 32

# Update in Vercel
echo 'new-secret' | vercel env add NEXTAUTH_SECRET production

# Normalize emails
curl -X POST "${PROD_URL}/api/admin/normalize-emails" \
  -H "Authorization: Bearer ${ADMIN_SECRET}"
```

### Build Fails

**Check**:
1. Build logs in Vercel dashboard
2. TypeScript errors: `npm run type-check`
3. Test build locally: `npm run build`

---

## 📚 Additional Resources

- **Full Deployment Guide**: `PRODUCTION_DEPLOYMENT_STEPS_JAN_23_2026.md`
- **System Verification**: `COMPREHENSIVE_SYSTEM_VERIFICATION_JAN_23_2026.md`
- **Login Fix**: `LOGIN_FIX_JAN_23_2026.md`
- **Supabase Setup**: `SUPABASE_DATABASE_SETUP.md`

---

## 🎯 Quick Command Reference

```bash
# Get Supabase connection string
# Visit: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database

# Normalize emails
DATABASE_URL="your-supabase-url" npx tsx scripts/normalize-emails-production.ts

# Verify system
DATABASE_URL="your-supabase-url" npx tsx scripts/comprehensive-system-verification.ts

# Set Vercel env vars
echo 'value' | vercel env add VARIABLE_NAME production

# Deploy
vercel --prod

# Run migrations
DATABASE_URL="your-supabase-url" npx prisma migrate deploy

# Check health
curl https://your-domain.vercel.app/api/health | jq
```

---

**Status**: ✅ **READY FOR PRODUCTION**  
**Last Updated**: January 23, 2026
