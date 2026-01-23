/**
 * Normalize User Emails - Production Script
 * 
 * Normalizes all user emails in Supabase database to lowercase.
 * Safe to run in production - handles conflicts and reports results.
 * 
 * Usage (Local):
 *   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" npx tsx scripts/normalize-emails-production.ts
 * 
 * Usage (Vercel):
 *   This script can be run via API endpoint: POST /api/admin/normalize-emails
 *   Or via Vercel CLI: vc env pull .env.production && npx tsx scripts/normalize-emails-production.ts
 */

import { db } from "../lib/db/client";
import { logger } from "../lib/logging/logger";

interface NormalizationResult {
  total: number;
  updated: number;
  skipped: number;
  errors: Array<{ email: string; error: string }>;
  conflicts: Array<{ originalEmail: string; normalizedEmail: string }>;
}

async function normalizeUserEmails(): Promise<NormalizationResult> {
  const result: NormalizationResult = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    conflicts: [],
  };

  try {
    logger.info("Starting email normalization", {
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL ? "configured" : "missing",
    });

    // Get all users
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
      },
      orderBy: {
        email: "asc",
      },
    });

    result.total = users.length;
    logger.info(`Found ${users.length} users to check`);

    for (const user of users) {
      const normalizedEmail = user.email.trim().toLowerCase();
      
      // Skip if already normalized
      if (user.email === normalizedEmail) {
        result.skipped++;
        continue;
      }

      try {
        // Check if normalized email already exists (would cause unique constraint violation)
        const existingUser = await db.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (existingUser && existingUser.id !== user.id) {
          logger.warn("Email normalization conflict", {
            originalEmail: user.email,
            normalizedEmail,
            existingUserId: existingUser.id,
          });
          
          result.conflicts.push({
            originalEmail: user.email,
            normalizedEmail,
          });
          result.skipped++;
          continue;
        }

        // Update email to normalized version
        await db.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        });

        logger.info("Email normalized", {
          userId: user.id,
          originalEmail: user.email,
          normalizedEmail,
        });

        result.updated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Error normalizing email", {
          email: user.email,
          error: errorMessage,
        });
        
        result.errors.push({
          email: user.email,
          error: errorMessage,
        });
      }
    }

    logger.info("Email normalization complete", result);
    return result;
  } catch (error) {
    logger.error("Fatal error during email normalization", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  normalizeUserEmails()
    .then((result) => {
      console.log("\n" + "=".repeat(60));
      console.log("📊 Email Normalization Results:");
      console.log("=".repeat(60));
      console.log(`   Total users: ${result.total}`);
      console.log(`   ✅ Updated: ${result.updated}`);
      console.log(`   ⏭️  Skipped: ${result.skipped}`);
      console.log(`   ⚠️  Conflicts: ${result.conflicts.length}`);
      console.log(`   ❌ Errors: ${result.errors.length}`);

      if (result.conflicts.length > 0) {
        console.log("\n⚠️  Conflicts (normalized email already exists):");
        result.conflicts.forEach(({ originalEmail, normalizedEmail }) => {
          console.log(`   - ${originalEmail} → ${normalizedEmail} (already exists)`);
        });
      }

      if (result.errors.length > 0) {
        console.log("\n❌ Errors:");
        result.errors.forEach(({ email, error }) => {
          console.log(`   - ${email}: ${error}`);
        });
      }

      if (result.updated > 0) {
        console.log("\n✅ Success! All emails normalized.");
        console.log("💡 Users can now login with any email case variation.");
      }

      console.log("\n");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });
}

export { normalizeUserEmails };
