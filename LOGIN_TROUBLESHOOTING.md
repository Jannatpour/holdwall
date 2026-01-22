# Login Troubleshooting Guide

## Issue: Can Create Account But Cannot Login

If you can create an account but cannot login, follow these steps:

### Step 1: Verify User Exists in Database

```bash
psql -U holdwall -d holdwall -c "SELECT email, name, role, \"passwordHash\" IS NOT NULL as has_password FROM \"User\" WHERE email='your@email.com';"
```

**Expected**: Should show your user with `has_password = true`

### Step 2: Verify Password Hash

```bash
psql -U holdwall -d holdwall -c "SELECT email, LEFT(\"passwordHash\", 30) as hash_preview FROM \"User\" WHERE email='your@email.com';"
```

**Expected**: Should show a bcrypt hash starting with `$2b$10$`

### Step 3: Test Password Verification

```bash
DATABASE_URL="postgresql://holdwall:holdwall@localhost:5432/holdwall" npx tsx scripts/test-login-direct.ts
```

**Expected**: Should show "✅ Password verification successful"

### Step 4: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to login
4. Look for:
   - "Authorize: Attempting login for..." messages
   - Any error messages
   - Network tab for failed requests

### Step 5: Check Server Logs

Look for these messages in your terminal where `npm run dev` is running:
- `Authorize: Attempting login for [email]`
- `Authorize: Successfully authenticated [email]`
- OR error messages

### Step 6: Verify NextAuth Configuration

1. Check `.env.local` has:
   ```env
   DATABASE_URL="postgresql://holdwall:holdwall@localhost:5432/holdwall"
   NEXTAUTH_SECRET="your-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

2. Restart dev server after changing env vars

### Step 7: Clear Browser Data

1. Clear cookies for `localhost:3000`
2. Clear localStorage
3. Try login again

### Step 8: Test with Known Good Credentials

Use the seeded test users:
- `admin@holdwall.com` / `admin123`
- `user@holdwall.com` / `user123`
- `test-login@example.com` / `test12345`

If these work but your account doesn't, the issue is with your specific account.

## Common Issues and Solutions

### Issue: "Invalid email or password"

**Causes:**
1. Wrong password
2. User doesn't exist
3. User has no password hash (OAuth-only account)
4. Database connection issue

**Solutions:**
1. Verify password is correct
2. Check user exists: `SELECT email FROM "User" WHERE email='your@email.com';`
3. Check password hash exists: `SELECT "passwordHash" IS NOT NULL FROM "User" WHERE email='your@email.com';`
4. Reset password by updating in database (see below)

### Issue: Login succeeds but redirects to sign-in

**Causes:**
1. Session not being created
2. Cookie issues
3. NEXTAUTH_SECRET mismatch

**Solutions:**
1. Check `NEXTAUTH_SECRET` is set and consistent
2. Clear browser cookies
3. Check browser console for session errors

### Issue: Page loads but login form doesn't work

**Causes:**
1. JavaScript errors
2. NextAuth client not initialized
3. SessionProvider missing

**Solutions:**
1. Check browser console for errors
2. Verify `SessionProvider` wraps app in `app/layout.tsx`
3. Restart dev server

## Reset Password (Development Only)

If you need to reset a password in development:

```bash
# Generate new password hash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('newpassword123', 10).then(h => console.log(h));"

# Update in database
psql -U holdwall -d holdwall -c "UPDATE \"User\" SET \"passwordHash\" = '\$2b\$10\$YOUR_HASH_HERE' WHERE email='your@email.com';"
```

## Test Login Flow Manually

1. **Open browser**: `http://localhost:3000/auth/signin`
2. **Enter credentials**: Use one of the test users
3. **Click "Sign in"**
4. **Check redirect**: Should go to `/overview`
5. **Check session**: Open DevTools → Application → Cookies → Look for `next-auth.session-token`
6. **Verify API access**: Should be able to access `/api/overview` without 401

## Still Having Issues?

1. **Check server logs** for detailed error messages
2. **Check browser console** for client-side errors
3. **Verify database** is running and accessible
4. **Restart dev server** to clear any cached issues
5. **Check environment variables** are set correctly

## Quick Diagnostic Commands

```bash
# Check if user exists and has password
psql -U holdwall -d holdwall -c "SELECT email, \"passwordHash\" IS NOT NULL FROM \"User\" WHERE email='your@email.com';"

# Test password verification
DATABASE_URL="postgresql://holdwall:holdwall@localhost:5432/holdwall" npx tsx scripts/test-login-direct.ts

# Check session endpoint
curl http://localhost:3000/api/auth/session

# Check if sign-in page loads
curl -s http://localhost:3000/auth/signin | grep -i "sign in"
```
