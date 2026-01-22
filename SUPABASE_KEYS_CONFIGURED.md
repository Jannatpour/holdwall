# ✅ Supabase API Keys Configured

**Date**: January 22, 2026  
**Project**: holdwall-production

---

## 🔑 Supabase Credentials

### API Keys

- **Publishable Key**: `sb_publishable_MVN2gi8t1HGggRon9K-3RA_iFQjPY-X.`
- **Secret Key**: `sb_secret_y3sP0cCWnwVvvJ16jtxZdQ_fKkA1P8-`
- **REST URL**: `https://hrzxbonjpffluuiwpzwe.supabase.co`

### Database Credentials

- **Project Ref**: `hrzxbonjpffluuiwpzwe`
- **Password**: `@HoldWall2026.`
- **Database**: `postgres`

---

## 🗄️ PostgreSQL Connection String

**⚠️ IMPORTANT**: The API keys above are for Supabase REST API.  
For database connections (Prisma), you need the **PostgreSQL connection string**.

### Get Connection String

1. **Visit**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database
2. **Scroll** to "Connection string" section
3. **Click** "URI" tab
4. **Select** "Session mode" (recommended for Vercel)
5. **Copy** the connection string

The connection string format will be:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

---

## 🚀 Deploy with Connection String

Once you have the PostgreSQL connection string from Supabase dashboard:

```bash
npm run deploy:complete 'postgresql://postgres.hrzxbonjpffluuiwpzwe:password@aws-0-region.pooler.supabase.com:5432/postgres'
```

---

## 📋 Optional: Configure Supabase API Keys

If you want to use Supabase REST API in your application:

```bash
# Add to Vercel environment variables
echo 'sb_publishable_MVN2gi8t1HGggRon9K-3RA_iFQjPY-X.' | vc env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo 'sb_secret_y3sP0cCWnwVvvJ16jtxZdQ_fKkA1P8-' | vc env add SUPABASE_SERVICE_ROLE_KEY production
echo 'https://hrzxbonjpffluuiwpzwe.supabase.co' | vc env add NEXT_PUBLIC_SUPABASE_URL production
```

---

## 🎯 Next Steps

1. **Get PostgreSQL connection string** from Supabase dashboard
2. **Run**: `npm run deploy:complete 'your-postgresql-connection-string'`
3. **Deployment will complete automatically**

---

**Dashboard**: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe
