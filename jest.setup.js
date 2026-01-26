// Jest setup (CommonJS to ensure `require` works)
require("@testing-library/jest-dom");

// Ensure Prisma can be constructed in tests (no DB required unless tests hit it)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://holdwall:holdwall@localhost:5432/holdwall";
}

// Secrets encryption key (required for secrets service in tests that touch it)
if (!process.env.SECRETS_ENCRYPTION_KEY) {
  process.env.SECRETS_ENCRYPTION_KEY = "jest-dev-secrets-key";
}

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "jest-nextauth-secret";
}

// Polyfills for Next.js route handlers + Prisma in Jest (jsdom)
const { TextDecoder, TextEncoder } = require("util");
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// Ensure fetch exists in Jest (Node fetch may be unavailable in jsdom env)
try {
  if (!globalThis.fetch) {
    const undici = require("undici");
    globalThis.fetch = undici.fetch;
    global.fetch = undici.fetch;
    globalThis.Headers = undici.Headers;
    globalThis.Request = undici.Request;
    globalThis.Response = undici.Response;
    global.Headers = undici.Headers;
    global.Request = undici.Request;
    global.Response = undici.Response;
  }
} catch (e) {
  // ignore
}

// Web Streams (Playwright + some Next internals expect TransformStream)
try {
  const web = require("stream/web");
  if (!globalThis.TransformStream && web.TransformStream) {
    globalThis.TransformStream = web.TransformStream;
  }
} catch (e) {
  // ignore
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
  }),
}))

// Best-effort cleanup to prevent open handles from DB pools.
afterAll(async () => {
  try {
    const { db } = require("@/lib/db/client");
    if (db && typeof db.$disconnect === "function") {
      await db.$disconnect();
    }
  } catch (e) {
    // ignore
  }
});
