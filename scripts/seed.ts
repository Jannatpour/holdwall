/**
 * Seed Script
 * Run with: npx tsx scripts/seed.ts
 */

import { seedDatabase } from "@/lib/db/seed";

seedDatabase()
  .then(() => {
    console.log("Seeding completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
