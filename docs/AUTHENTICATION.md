# Authentication System Documentation

## Overview

The Holdwall POS authentication system is built on **NextAuth.js v5** with comprehensive support for:
- **Credentials-based authentication** (email/password)
- **OAuth providers** (Google, GitHub) - when configured
- **OIDC/SSO** (Enterprise) - when configured
- **JWT-based sessions** with 30-day expiration
- **Role-based access control** (USER, ADMIN, APPROVER, VIEWER)
- **Multi-tenant support** with automatic tenant assignment

## Architecture

### Components

1. **NextAuth Configuration** (`app/api/auth/[...nextauth]/route.ts`)
   - Central authentication configuration
   - Provider setup (Credentials, Google, GitHub, OIDC)
   - JWT and session callbacks
   - OAuth account linking

2. **Database Integration**
   - Prisma ORM with PostgreSQL
   - User, Account, Session, Tenant models
   - Password hashing with bcrypt (10 rounds)

3. **Client Components**
   - `SessionProvider` - Wraps app for session access
   - `AuthGuard` - Protects routes client-side
   - Sign-in/Sign-up pages with OAuth support

4. **API Routes**
   - `/api/auth/signup` - User registration
   - `/api/auth/session` - Session status
   - `/api/auth/providers` - Available OAuth providers
   - `/api/auth/[...nextauth]` - NextAuth handlers

## Authentication Flow

### 1. User Registration

```typescript
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "User Name" // optional
}
```

**Process:**
1. Validates email and password (min 8 characters)
2. Checks for existing user
3. Creates/retrieves default tenant
4. Hashes password with bcrypt
5. Creates user with USER role
6. Returns user data (without password)

### 2. User Login

```typescript
// Client-side
signIn("credentials", {
  email: "user@example.com",
  password: "securepassword123",
  redirect: false
})
```

**Process:**
1. Client calls NextAuth `signIn()` with credentials
2. NextAuth calls `authorize()` function
3. Database lookup by email
4. Password verification with bcrypt
5. JWT token generation with user data
6. Session creation
7. Redirect to callback URL (default: `/overview`)

### 3. Session Management

**Session Endpoint:**
```typescript
GET /api/auth/session
// Returns: { user: {...}, expires: "..." } or { user: null, expires: null }
```

**Session Data:**
```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    role: "USER" | "ADMIN" | "APPROVER" | "VIEWER";
    tenantId: string;
  },
  expires: string; // ISO date
}
```

### 4. Protected Routes

**Server-side:**
```typescript
import { requireAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const user = await requireAuth(); // Throws if not authenticated
  // ... protected logic
}
```

**Client-side:**
```typescript
import { AuthGuard } from "@/components/auth-guard";

export default function ProtectedPage() {
  return (
    <AuthGuard>
      <YourContent />
    </AuthGuard>
  );
}
```

## Configuration

### Environment Variables

**Required:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/holdwall"
NEXTAUTH_SECRET="your-secret-here" # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
```

**Optional (OAuth):**
```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

**Optional (OIDC/SSO):**
```env
OIDC_ISSUER="https://your-oidc-provider.com"
OIDC_CLIENT_ID="your-oidc-client-id"
OIDC_CLIENT_SECRET="your-oidc-client-secret"
OIDC_PROVIDER_NAME="Your SSO Provider"
OIDC_SCOPE="openid profile email"
```

## Test Users

After running database seed:
- **Admin**: `admin@holdwall.com` / `admin123` (ADMIN role)
- **User**: `user@holdwall.com` / `user123` (USER role)

## Security Features

1. **Password Security**
   - Bcrypt hashing (10 rounds)
   - Minimum 8 characters
   - Never stored in plain text

2. **Session Security**
   - JWT tokens with expiration (30 days)
   - HttpOnly cookies (handled by NextAuth)
   - CSRF protection (built into NextAuth)

3. **Database Security**
   - Connection pooling
   - Parameterized queries (Prisma)
   - Tenant isolation

4. **Error Handling**
   - No credential leakage in error messages
   - Consistent error responses
   - Comprehensive logging

## Troubleshooting

### Login Not Working

1. **Check database connection:**
   ```bash
   psql -U holdwall -d holdwall -c "SELECT email FROM \"User\" LIMIT 1;"
   ```

2. **Verify password hash:**
   ```bash
   psql -U holdwall -d holdwall -c "SELECT email, \"passwordHash\" IS NOT NULL FROM \"User\" WHERE email='your@email.com';"
   ```

3. **Check server logs:**
   - Look for "Authorize:" messages in console
   - Check for database errors

4. **Test credentials directly:**
   ```bash
   npm run db:seed  # Creates test users
   ```

### Session Issues

1. **Clear browser cookies**
2. **Check NEXTAUTH_SECRET is set**
3. **Verify NEXTAUTH_URL matches your domain**
4. **Check server logs for session errors**

### OAuth Not Working

1. **Verify environment variables are set**
2. **Check OAuth provider configuration**
3. **Verify callback URLs match provider settings**
4. **Check `/api/auth/providers` endpoint**

## API Reference

### POST /api/auth/signup

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

**Errors:**
- `400` - Missing email or password
- `409` - User already exists
- `500` - Database error

### GET /api/auth/session

Get current session status.

**Response (200):**
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "User Name",
    "role": "USER",
    "tenantId": "..."
  },
  "expires": "2026-02-20T12:00:00.000Z"
}
```

Or when not authenticated:
```json
{
  "user": null,
  "expires": null
}
```

### GET /api/auth/providers

Get available OAuth providers.

**Response (200):**
```json
{
  "google": true,
  "github": false
}
```

## Best Practices

1. **Always use `requireAuth()` in API routes** that need authentication
2. **Wrap protected pages with `AuthGuard`** for client-side protection
3. **Never log passwords** or sensitive credentials
4. **Use environment variables** for all secrets
5. **Test authentication flows** after any changes
6. **Monitor session expiration** and handle gracefully
7. **Implement rate limiting** on auth endpoints (already done in middleware)

## Future Enhancements

- [ ] Password reset flow
- [ ] Email verification
- [ ] Two-factor authentication (2FA)
- [ ] Account management API
- [ ] Session management UI
- [ ] OAuth account linking UI
- [ ] Advanced role-based permissions
- [ ] Audit logging for auth events
