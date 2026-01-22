// Jest setup (CommonJS to ensure `require` works)
require("@testing-library/jest-dom");

// Ensure Prisma can be constructed in tests (no DB required unless tests hit it)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://holdwall:holdwall@localhost:5432/holdwall";
}

// Polyfills for Next.js route handlers + Prisma in Jest (jsdom)
const { TextDecoder, TextEncoder } = require("util");
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

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

// Protocol security: allow tests to exercise protocol flows without provisioning keys/RBAC/DB.
jest.mock('@/lib/security/protocol-security', () => ({
  getProtocolSecurity: () => ({
    verifyAgentIdentity: async (agentId) => ({
      agentId,
      permissions: ['*:*'],
      identityVerified: true,
      mTLSVerified: false,
      oidcVerified: false,
    }),
    checkProtocolPermission: async () => true,
  }),
}))

// Minimal fetch stub for protocol tests (A2A connect, etc.)
if (!global.fetch) {
  global.fetch = async (input) => {
    const url = typeof input === "string" ? input : input?.url;
    if (typeof url === "string" && url.includes("/a2a/connect")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "connected" }),
        text: async () => "connected",
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "ok",
    };
  };
}
