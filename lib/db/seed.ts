/**
 * Database Seeding
 * Development seed data
 */

import { db } from "./client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

export async function seedDatabase() {
  // Only seed in development
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log("Seeding database...");

  // Create default tenant
  const tenant = await db.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Tenant",
      slug: "default",
    },
  });

  // Generate password hashes
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const userPasswordHash = await bcrypt.hash("user123", 10);

  // Use raw SQL to ensure password hash is properly set (Prisma adapter may have issues)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://holdwall:holdwall@localhost:5432/holdwall",
  });

  try {
    // Ensure admin user exists with correct password hash
    const adminCheck = await pool.query('SELECT id FROM "User" WHERE email = $1', ["admin@holdwall.com"]);
    
    if (adminCheck.rows.length > 0) {
      // Update existing admin user
      await pool.query(
        'UPDATE "User" SET "passwordHash" = $1, name = $2, role = $3, "tenantId" = $4, "updatedAt" = NOW() WHERE email = $5',
        [adminPasswordHash, "Admin User", "ADMIN", tenant.id, "admin@holdwall.com"]
      );
    } else {
      // Create new admin user
      await pool.query(
        `INSERT INTO "User" (id, email, name, "passwordHash", role, "tenantId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [`user-${Date.now()}`, "admin@holdwall.com", "Admin User", adminPasswordHash, "ADMIN", tenant.id]
      );
    }

    // Ensure test user exists with correct password hash
    const userCheck = await pool.query('SELECT id FROM "User" WHERE email = $1', ["user@holdwall.com"]);
    
    if (userCheck.rows.length > 0) {
      // Update existing user
      await pool.query(
        'UPDATE "User" SET "passwordHash" = $1, name = $2, role = $3, "tenantId" = $4, "updatedAt" = NOW() WHERE email = $5',
        [userPasswordHash, "Test User", "USER", tenant.id, "user@holdwall.com"]
      );
    } else {
      // Create new user
      await pool.query(
        `INSERT INTO "User" (id, email, name, "passwordHash", role, "tenantId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [`user-${Date.now() + 1}`, "user@holdwall.com", "Test User", userPasswordHash, "USER", tenant.id]
      );
    }

    // Verify password hashes are set and valid
    const adminVerify = await pool.query(
      'SELECT email, "passwordHash", LENGTH("passwordHash") as hash_len FROM "User" WHERE email = $1',
      ["admin@holdwall.com"]
    );
    const userVerify = await pool.query(
      'SELECT email, "passwordHash", LENGTH("passwordHash") as hash_len FROM "User" WHERE email = $1',
      ["user@holdwall.com"]
    );

    // Verify admin password
    let adminValid = false;
    if (adminVerify.rows[0]?.passwordHash && adminVerify.rows[0].hash_len >= 60) {
      try {
        adminValid = await bcrypt.compare("admin123", adminVerify.rows[0].passwordHash.trim());
      } catch (e) {
        console.warn("Admin password verification failed:", e);
      }
    }

    // Verify user password
    let userValid = false;
    if (userVerify.rows[0]?.passwordHash && userVerify.rows[0].hash_len >= 60) {
      try {
        userValid = await bcrypt.compare("user123", userVerify.rows[0].passwordHash.trim());
      } catch (e) {
        console.warn("User password verification failed:", e);
      }
    }

    if (adminValid && userValid) {
      console.log("Database seeded successfully");
      console.log("Admin: admin@holdwall.com / admin123 ✅");
      console.log("User: user@holdwall.com / user123 ✅");
    } else {
      console.warn("Password verification failed - admin:", adminValid, "user:", userValid);
      console.log("Admin hash length:", adminVerify.rows[0]?.hash_len);
      console.log("User hash length:", userVerify.rows[0]?.hash_len);
    }

    await pool.end();
  } catch (error) {
    console.error("Error seeding database:", error);
    await pool.end();
    throw error;
  }
}
