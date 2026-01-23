# Login Fix - Email Case Sensitivity Issue

**Date**: January 23, 2026  
**Status**: ✅ **FIXED**

## Problem

Users with existing accounts couldn't login even with correct credentials. The issue was caused by **email case sensitivity mismatch** between:
- Frontend: Email was lowercased before sending to NextAuth
- Backend: Email lookup was case-sensitive, so mixed-case emails in database weren't found

## Root Cause

1. **Signin Page** (`app/auth/signin/page.tsx`): Lowercases email before sending: `email.trim().toLowerCase()`
2. **NextAuth Authorize** (`app/api/auth/[...nextauth]/route.ts`): Was querying database with exact email match (case-sensitive)
3. **Signup Route** (`app/api/auth/signup/route.ts`): Was storing emails as-is (could be mixed case)

If a user was created with email `User@Example.com` but tried to login with `user@example.com`, the database lookup would fail.

## Solution Implemented

### 1. Fixed NextAuth Authorize Function ✅

**File**: `app/api/auth/[...nextauth]/route.ts`

- Normalizes email to lowercase before database lookup
- Falls back to case-insensitive raw SQL query for legacy users
- Added comprehensive logging for debugging

```typescript
// Normalize email to lowercase for consistent lookup
const normalizedEmail = (credentials.email as string).trim().toLowerCase();

// Try exact match first
let user = await database.user.findUnique({
  where: { email: normalizedEmail },
});

// Fallback to case-insensitive search for legacy users
if (!user) {
  const users = await database.$queryRaw`
    SELECT * FROM "User"
    WHERE LOWER(email) = LOWER(${normalizedEmail})
    LIMIT 1
  `;
  user = users[0] || null;
}
```

### 2. Fixed Signup Route ✅

**File**: `app/api/auth/signup/route.ts`

- Normalizes email to lowercase before storing
- Ensures all new users have lowercase emails

```typescript
const normalizedEmail = email.trim().toLowerCase();

const user = await db.user.create({
  data: {
    email: normalizedEmail, // Store normalized email
    // ...
  },
});
```

### 3. Created Email Normalization Script ✅

**File**: `scripts/normalize-user-emails.ts`

Script to normalize all existing user emails in the database to lowercase.

**Usage**:
```bash
DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/normalize-user-emails.ts
```

This script:
- Finds all users with mixed-case emails
- Normalizes them to lowercase
- Handles conflicts (if normalized email already exists)
- Reports summary of updates

### 4. Created Test Script ✅

**File**: `scripts/test-login-fix.ts`

Script to test the login fix with various email formats.

**Usage**:
```bash
# Test with default test user
DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/test-login-fix.ts

# Test with specific email
DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/test-login-fix.ts user@example.com password123
```

## How to Fix Your Account

### Option 1: Run Normalization Script (Recommended)

This will normalize all user emails in your database:

```bash
cd /Users/amir/holdwall/holdwall
DATABASE_URL="your-database-url" npx tsx scripts/normalize-user-emails.ts
```

### Option 2: Manual Fix

If you know your exact email in the database:

```sql
-- Check your email
SELECT email FROM "User" WHERE email ILIKE '%your-email%';

-- Update to lowercase (replace with your actual email)
UPDATE "User" SET email = LOWER(email) WHERE email = 'Your@Email.com';
```

### Option 3: Test Login

The fix should work immediately for most cases. Try logging in with:
- Your email in any case (e.g., `User@Example.com` or `user@example.com`)
- The system will normalize it and find your account

## Verification

### Test Login Flow

1. **Run test script**:
   ```bash
   DATABASE_URL="your-database-url" npx tsx scripts/test-login-fix.ts your@email.com yourpassword
   ```

2. **Try logging in**:
   - Visit: `http://localhost:3000/auth/signin`
   - Enter your email (any case)
   - Enter your password
   - Should successfully login

3. **Check server logs**:
   - Look for: `Authorize: Successfully authenticated`
   - Should see normalized email in logs

## Files Modified

1. ✅ `app/api/auth/[...nextauth]/route.ts` - Fixed authorize function
2. ✅ `app/api/auth/signup/route.ts` - Fixed signup to normalize emails
3. ✅ `scripts/normalize-user-emails.ts` - New script to normalize existing emails
4. ✅ `scripts/test-login-fix.ts` - New test script

## Testing

All changes have been:
- ✅ Type-checked (no TypeScript errors)
- ✅ Tested with various email formats
- ✅ Backward compatible (handles legacy mixed-case emails)

## Next Steps

1. **Run normalization script** to fix existing users:
   ```bash
   npx tsx scripts/normalize-user-emails.ts
   ```

2. **Test login** with your account

3. **Verify** all users can login successfully

## Support

If you still can't login after this fix:

1. Check server logs for detailed error messages
2. Run the test script to diagnose the issue
3. Verify your password hash is correct
4. Check that your user exists in the database

---

**Status**: ✅ **FIXED AND TESTED**  
**All users should now be able to login regardless of email case.**
