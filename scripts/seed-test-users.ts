/**
 * Seed Test Users
 * Creates test users for authentication testing
 */

import { db } from "../lib/db/client";
import bcrypt from "bcryptjs";

async function seedTestUsers() {
  console.log("🌱 Seeding test users...\n");

  // Get or create default tenant
  let tenant = await db.tenant.findFirst({
    where: { slug: "default" },
  });

  if (!tenant) {
    tenant = await db.tenant.create({
      data: {
        name: "Default Tenant",
        slug: "default",
      },
    });
    console.log("✅ Created default tenant");
  } else {
    console.log("✅ Using existing default tenant");
  }

  // Seed baseline source policies so validation and verifiers can run end-to-end in E2E.
  // Empty `allowedSources` means "allow all sources of this type".
  const sourceTypes = ["api", "reddit", "twitter", "zendesk", "github", "rss", "webhook", "s3"];
  for (const sourceType of sourceTypes) {
    await db.sourcePolicy.upsert({
      where: {
        tenantId_sourceType: {
          tenantId: tenant.id,
          sourceType,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        sourceType,
        allowedSources: [],
        collectionMethod: "API",
        retentionDays: 365,
        autoDelete: false,
        complianceFlags: [],
      },
    });
  }

  // Test users to create
  const testUsers = [
    {
      email: "admin@holdwall.com",
      password: "admin123",
      name: "Admin User",
      role: "ADMIN" as const,
    },
    {
      email: "user@holdwall.com",
      password: "user123",
      name: "Test User",
      role: "USER" as const,
    },
    {
      email: "test-login@example.com",
      password: "test12345",
      name: "Test Login",
      role: "USER" as const,
    },
  ];

  for (const testUser of testUsers) {
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    
    const user = await db.user.upsert({
      where: { email: testUser.email },
      update: {
        passwordHash, // Update password hash in case it changed
        name: testUser.name,
        role: testUser.role,
      },
      create: {
        email: testUser.email,
        name: testUser.name,
        passwordHash,
        tenantId: tenant.id,
        role: testUser.role,
      },
    });

    console.log(`✅ ${testUser.role}: ${user.email} / ${testUser.password}`);
  }

  console.log("\n✅ Test users seeded successfully!");
  console.log("\nYou can now login with:");
  console.log("  - admin@holdwall.com / admin123 (ADMIN)");
  console.log("  - user@holdwall.com / user123 (USER)");
  console.log("  - test-login@example.com / test12345 (USER)");
}

seedTestUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
