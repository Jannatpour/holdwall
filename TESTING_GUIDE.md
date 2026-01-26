# Testing Guide - Authentication Flow

## ✅ Current Status

### Working Components
- ✅ **Sign-in Page**: Accessible at http://localhost:3000/auth/signin
- ✅ **Error Handling**: Improved with JSON error responses
- ✅ **Service Worker**: Fixed syntax errors
- ✅ **No Duplication**: All duplicate files removed

### Requirements
- ⚠️ **Docker**: Must be running for database access
- ⚠️ **PostgreSQL**: Required for user authentication
- ⚠️ **Redis**: Optional but recommended for caching

## 🚀 Step-by-Step Testing

### 1. Start Docker Services

**Prerequisites**: Docker Desktop must be running

```bash
cd /Users/amir/holdwall/holdwall
docker-compose up postgres redis -d
```

**Verify services are running**:
```bash
docker-compose ps
```

Expected output:
```
NAME                  STATUS
holdwall-postgres-1   Up (healthy)
holdwall-redis-1      Up (healthy)
```

### 2. Verify Database Connection

```bash
# Test database connection
docker-compose exec postgres psql -U holdwall -d holdwall -c "SELECT version();"

# Verify tables exist
docker-compose exec postgres psql -U holdwall -d holdwall -c "\dt"
```

**Note on ports**: This repo maps Postgres to `localhost:15432` and Redis to `localhost:16379` to avoid conflicts with local installs.

### 3. Test Sign-In Page

**Open in browser**:
```
http://localhost:3000/auth/signin
```

**Or verify with curl**:
```bash
curl http://localhost:3000/auth/signin | grep -q "Sign in" && echo "✅ Page loads"
```

**Expected**: Sign-in form with:
- Email input field
- Password input field
- "Sign in" button
- Google OAuth button
- GitHub OAuth button

### 4. Test Authentication

**Test Credentials**:
- Email: `admin@holdwall.com`
- Password: `admin123`

**Manual Test**:
1. Navigate to http://localhost:3000/auth/signin
2. Enter credentials
3. Click "Sign in"
4. Should redirect to `/overview` on success

**API Test** (if database is available):
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@holdwall.com","password":"admin123"}'
```

### 5. Verify Session Endpoint

**Without authentication** (should return null or empty):
```bash
curl http://localhost:3000/api/auth/session
```

**Expected response** (when not logged in):
```json
{
  "user": null
}
```

**After authentication** (should return user data):
```bash
curl http://localhost:3000/api/auth/session \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

**Expected response** (when logged in):
```json
{
  "user": {
    "id": "...",
    "email": "admin@holdwall.com",
    "name": "Admin User",
    "role": "ADMIN",
    "tenantId": "..."
  }
}
```

### 6. Test Protected Routes

**Try accessing protected route without auth**:
```bash
curl http://localhost:3000/overview
```

**Expected**: Redirect to `/auth/signin` or 401 Unauthorized

**After authentication**:
- Should be able to access `/overview`
- Should see dashboard data
- Should have user session available

## 🔧 Troubleshooting

### Issue: Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**:
1. Start Docker Desktop
2. Wait for Docker to fully start
3. Run `docker-compose up postgres redis -d` again

### Issue: Database Connection Failed

**Error**: `User was denied access on the database`

**Solution**:
```bash
# Verify database exists
docker-compose exec postgres psql -U holdwall -d postgres -c "\l"

# Grant permissions if needed
docker-compose exec postgres psql -U holdwall -d holdwall -c "GRANT ALL ON SCHEMA public TO holdwall;"
```

### Issue: Session Endpoint Returns 500

**Possible Causes**:
1. Database not accessible
2. NEXTAUTH_SECRET not set
3. PrismaAdapter initialization failed

**Solution**:
1. Check Docker is running: `docker ps`
2. Verify DATABASE_URL in `.env.local`
3. Check server logs for specific error
4. The improved error handling should now return JSON errors instead of HTML

### Issue: Sign-In Page Shows 404

**Solution**:
1. Restart dev server: `npm run dev`
2. Clear Next.js cache: `rm -rf .next`
3. Verify file exists: `ls -la app/auth/signin/page.tsx`

## 📝 Environment Variables

**Required** (in `.env.local`):
```env
DATABASE_URL="postgresql://holdwall:holdwall@localhost:5432/holdwall"
NEXTAUTH_SECRET="your-secret-here"  # Or uses fallback
NEXTAUTH_URL="http://localhost:3000"
```

**Optional**:
```env
REDIS_URL="redis://localhost:6379"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
```

## ✅ Success Criteria

All tests pass when:
1. ✅ Docker services are running
2. ✅ Sign-in page loads without errors
3. ✅ Can submit login form
4. ✅ Session endpoint returns JSON (not HTML error)
5. ✅ After login, can access `/overview`
6. ✅ Session contains user data
7. ✅ Protected routes require authentication

## 🎯 Next Steps After Testing

Once authentication is working:
1. Test OAuth providers (if configured)
2. Test protected API endpoints
3. Test session persistence
4. Test logout functionality
5. Test role-based access control

---

**Note**: The improved error handling in the NextAuth route now returns proper JSON error responses, making debugging easier.
