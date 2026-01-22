/**
 * Validation Schemas
 * Centralized Zod schemas for API validation
 */

import { z } from "zod";

// Tenant validation
export const tenantIdSchema = z.string().regex(/^[a-z0-9-]+$/, {
  message: "Tenant ID must be lowercase alphanumeric with hyphens",
});

// Evidence validation
export const evidenceIdSchema = z.string().regex(/^ev-[a-z0-9-]+$/, {
  message: "Invalid evidence ID format",
});

// Claim validation
export const claimIdSchema = z.string().regex(/^claim-[a-z0-9-]+$/, {
  message: "Invalid claim ID format",
});

// Artifact validation
export const artifactIdSchema = z.string().regex(/^aaal-[a-z0-9-]+$/, {
  message: "Invalid artifact ID format",
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Sorting
export const sortSchema = z.object({
  field: z.string(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// Date range
export const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});
