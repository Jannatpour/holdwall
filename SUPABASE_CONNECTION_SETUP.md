# 🔗 Supabase Connection String Setup

**Project**: holdwall-production  
**Project Ref**: hrzxbonjpffluuiwpzwe  
**Password**: @HoldWall2026.

---

## 📋 Get Connection String from Supabase Dashboard

### Step 1: Access Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select project: **holdwall-production**
3. Go to **Settings** → **Database**

### Step 2: Copy Connection String

1. Scroll to **Connection string** section
2. Select **URI** tab
3. Choose **Session mode** (recommended for Vercel)
4. Copy the **entire connection string**

The format should look like:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Important**: 
- Use the **exact** connection string from Supabase dashboard
- It includes the correct region and formatting
- Password may need URL encoding (Supabase dashboard handles this)

### Step 3: Use Connection String

Once you have the connection string from Supabase dashboard:

```bash
npm run deploy:complete 'postgresql://postgres.hrzxbonjpffluuiwpzwe:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres'
```

Or if you want to set it manually:

```bash
# Get connection string from Supabase dashboard, then:
echo 'y' | vc env rm DATABASE_URL production
echo 'your-connection-string-from-supabase' | vc env add DATABASE_URL production
npm run db:migrate:production
npm run deploy:vercel
```

---

## 🔧 Alternative: Manual Construction

If you know the region, you can construct it:

**Session Mode (Port 5432):**
```
postgresql://postgres.hrzxbonjpffluuiwpzwe:%40HoldWall2026%2E@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Transaction Mode (Port 6543):**
```
postgresql://postgres.hrzxbonjpffluuiwpzwe:%40HoldWall2026%2E@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Common Regions:**
- `us-east-1` (US East)
- `us-west-1` (US West)
- `eu-west-1` (Europe)
- `ap-southeast-1` (Asia Pacific)

---

## 🎯 Quick Steps

1. **Get connection string**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
2. **Copy the URI** (Session mode)
3. **Run**: `npm run deploy:complete 'your-connection-string'`

---

## ✅ Current Status

- ✅ DATABASE_URL updated in Vercel (with encoded password)
- ⚠️ Connection test failed (need exact connection string from dashboard)
- ✅ Ready to deploy once connection string is verified

---

**Next Step**: Get the exact connection string from Supabase dashboard and run:

```bash
npm run deploy:complete 'your-exact-connection-string-from-supabase'
```
