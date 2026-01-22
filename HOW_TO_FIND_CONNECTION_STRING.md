# 🔗 How to Find Supabase Connection String

**Current Page**: Database Settings  
**What You're Looking For**: Connection string section (at the top of the page)

---

## 📍 Location on Database Settings Page

The **Connection string** section is typically at the **very top** of the Database Settings page, before:
- Database password
- Connection pooling configuration
- SSL Configuration
- Network Restrictions

---

## 🎯 Steps to Find It

1. **You're already on the right page**: Database Settings
   - URL: https://supabase.com/dashboard/project/hrzxbonjpffluuiwpzwe/settings/database

2. **Scroll to the TOP** of the page
   - Look for a section labeled **"Connection string"** or **"Connection info"**

3. **In the Connection string section**, you'll see tabs:
   - **URI** ← **Use this one!**
   - JDBC
   - Golang
   - Python
   - etc.

4. **Click the "URI" tab**

5. **Select "Session mode"** (recommended for Vercel)
   - There may be two options: "Session mode" and "Transaction mode"
   - Use **Session mode** (port 5432)

6. **Copy the connection string**
   - It will look like:
     ```
     postgresql://postgres.hrzxbonjpffluuiwpzwe:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
     ```

---

## 🚀 Once You Have It

Paste the connection string here, or run:

```bash
npm run deploy:complete 'postgresql://postgres.hrzxbonjpffluuiwpzwe:password@aws-0-region.pooler.supabase.com:5432/postgres'
```

---

## 📸 Visual Guide

The page structure should look like:

```
┌─────────────────────────────────────┐
│  Connection string                  │ ← LOOK HERE (TOP)
│  [URI] [JDBC] [Golang] [Python]     │
│  Session mode: [connection string]  │
│  [Copy] button                      │
├─────────────────────────────────────┤
│  Database password                  │ ← You saw this
│  Connection pooling                 │ ← You saw this
│  SSL Configuration                  │ ← You saw this
│  Network Restrictions               │ ← You saw this
└─────────────────────────────────────┘
```

---

**Scroll up to the top of the Database Settings page to find the Connection string section!**
