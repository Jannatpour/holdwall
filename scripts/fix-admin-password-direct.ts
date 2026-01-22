/**
 * Fix Admin Password - Direct SQL Update
 * Uses raw SQL to ensure password hash is properly set
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function fixAdminPasswordDirect() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://holdwall:holdwall@localhost:5432/holdwall",
  });

  try {
    console.log("Step 1: Generating password hash...");
    const passwordHash = await bcrypt.hash("admin123", 10);
    console.log("Hash generated (60 chars):", passwordHash);
    console.log("Hash length:", passwordHash.length);

    // First, ensure tenant exists
    console.log("\nStep 2: Ensuring default tenant exists...");
    const tenantResult = await pool.query(
      'INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (slug) DO NOTHING RETURNING id',
      ["default-tenant", "Default Tenant", "default"]
    );
    
    let tenantId = tenantResult.rows[0]?.id;
    if (!tenantId) {
      const existingTenant = await pool.query('SELECT id FROM "Tenant" WHERE slug = $1', ["default"]);
      tenantId = existingTenant.rows[0]?.id || "default-tenant";
    }
    console.log("Tenant ID:", tenantId);

    // Delete existing user to start fresh
    console.log("\nStep 3: Removing existing admin user...");
    await pool.query('DELETE FROM "User" WHERE email = $1', ["admin@holdwall.com"]);

    // Insert new user with password hash
    console.log("\nStep 4: Creating admin user with password hash...");
    const insertResult = await pool.query(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, "tenantId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, email, LENGTH("passwordHash") as hash_length`,
      [
        `user-${Date.now()}`,
        "admin@holdwall.com",
        "Admin User",
        passwordHash,
        "ADMIN",
        tenantId,
      ]
    );

    console.log("User created:", insertResult.rows[0]);

    // Verify
    console.log("\nStep 5: Verifying password hash...");
    const verifyResult = await pool.query(
      'SELECT email, "passwordHash", LENGTH("passwordHash") as hash_length FROM "User" WHERE email = $1',
      ["admin@holdwall.com"]
    );

    if (verifyResult.rows.length > 0) {
      const user = verifyResult.rows[0];
      console.log("User found:", user.email);
      console.log("Hash length in DB:", user.hash_length);
      console.log("Hash preview:", user.passwordHash?.substring(0, 20) || "null");

      if (user.passwordHash && user.passwordHash.length === 60) {
        const isValid = await bcrypt.compare("admin123", user.passwordHash);
        console.log("Password verification:", isValid ? "✅ Valid" : "❌ Invalid");
        
        if (isValid) {
          console.log("\n✅ SUCCESS! Admin password is now set correctly.");
        } else {
          console.error("\n❌ Password hash exists but doesn't match!");
        }
      } else {
        console.error("\n❌ Password hash is missing or wrong length!");
      }
    } else {
      console.error("\n❌ User not found after creation!");
    }

    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
    process.exit(1);
  }
}

fixAdminPasswordDirect()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
