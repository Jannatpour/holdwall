/**
 * Normalize User Emails Script
 * 
 * Normalizes all user emails in the database to lowercase for consistent authentication.
 * This fixes the login issue where users with mixed-case emails couldn't login.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/normalize-user-emails.ts
 */

import { db } from "../lib/db/client";

async function normalizeUserEmails() {
  console.log("🔄 Normalizing user emails to lowercase...\n");

  try {
    // Get all users
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
      },
    });

    console.log(`Found ${users.length} users to check\n`);

    let updated = 0;
    let skipped = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const user of users) {
      const normalizedEmail = user.email.trim().toLowerCase();
      
      // Skip if already normalized
      if (user.email === normalizedEmail) {
        skipped++;
        continue;
      }

      try {
        // Check if normalized email already exists (would cause unique constraint violation)
        const existingUser = await db.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (existingUser && existingUser.id !== user.id) {
          console.warn(`⚠️  Skipping ${user.email}: normalized email ${normalizedEmail} already exists for another user`);
          errors.push({
            email: user.email,
            error: `Normalized email ${normalizedEmail} already exists`,
          });
          skipped++;
          continue;
        }

        // Update email to normalized version
        await db.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        });

        console.log(`✅ Updated: ${user.email} → ${normalizedEmail}`);
        updated++;
      } catch (error) {
        console.error(`❌ Error updating ${user.email}:`, error instanceof Error ? error.message : String(error));
        errors.push({
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Summary:");
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("\n⚠️  Errors encountered:");
      errors.forEach(({ email, error }) => {
        console.log(`   - ${email}: ${error}`);
      });
    }

    console.log("\n✅ Email normalization complete!");
    console.log("\n💡 All emails are now lowercase. Users should be able to login with any case variation.");
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

normalizeUserEmails()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
