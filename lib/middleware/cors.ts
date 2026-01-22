/**
 * CORS Configuration
 * Proper CORS setup for API
 */

export interface CORSOptions {
  origin: string | string[];
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export const defaultCORS: CORSOptions = {
  origin: process.env.ALLOWED_ORIGIN?.split(",") || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export function getCORSHeaders(options: CORSOptions = defaultCORS): Record<string, string> {
  const origin = Array.isArray(options.origin)
    ? options.origin.join(", ")
    : options.origin;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": options.methods?.join(", ") || "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": options.allowedHeaders?.join(", ") || "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": options.credentials ? "true" : "false",
    "Access-Control-Max-Age": String(options.maxAge || 86400),
  };
}
