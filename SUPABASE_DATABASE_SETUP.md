# 🗄️ Supabase Database Setup - holdwall-production

**Project**: holdwall-production  
**Project Ref**: hrzxbonjpffluuiwpzwe  
**Password**: @HoldWall2026.  
**Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe

---

## 🎯 Get Connection String (Required)

### Step 1: Access Supabase Dashboard

Visit: **https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database**

### Step 2: Copy Connection String

1. Scroll to **Connection string** section
2. Click **URI** tab
3. Select **Session mode** (recommended for serverless/Vercel)
4. Click **Copy** button
5. The connection string will look like:
   ```
   postgresql://postgres.hrzxbonjpffluuiwpzwe:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```

**Important**: Use the **exact** connection string from Supabase dashboard - it includes:
- Correct region
- Proper formatting
- URL-encoded password (if needed)

---

## 🚀 Deploy with Connection String

Once you have the connection string from Supabase dashboard:

```bash
npm run deploy:complete 'postgresql://postgres.hrzxbonjpffluuiwpzwe:password@aws-0-region.pooler.supabase.com:5432/postgres'
```

This will automatically:
1. ✅ Update DATABASE_URL in Vercel
2. ✅ Test database connection
3. ✅ Run Prisma migrations
4. ✅ Verify schema
5. ✅ Deploy to production

---

## 📝 Manual Steps (Alternative)

If you prefer step-by-step:

### 1. Update DATABASE_URL in Vercel

```bash
# Get connection string from Supabase dashboard first, then:
echo 'y' | vc env rm DATABASE_URL production
echo 'your-connection-string-from-supabase' | vc env add DATABASE_URL production
```

### 2. Run Migrations

```bash
# Pull environment variables
vc env pull .env.production --environment production
source .env.production
npm run db:migrate:production
```

### 3. Deploy

```bash
npm run deploy:vercel
```

---

## 🔍 Current Status

- ✅ Supabase project: holdwall-production
- ✅ Project ref: hrzxbonjpffluuiwpzwe
- ✅ Password: @HoldWall2026.
- ⚠️ Connection string: Need exact format from Supabase dashboard
- ✅ DATABASE_URL placeholder: Updated in Vercel (needs correct connection string)

---

## 🎯 Next Step

**Get the exact connection string from Supabase dashboard:**

1. Visit: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
2. Copy the **URI** connection string (Session mode)
3. Run: `npm run deploy:complete 'your-connection-string'`

---

**The connection string from Supabase dashboard will have the correct region and format!**
