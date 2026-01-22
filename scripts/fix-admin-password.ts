/**
 * Fix Admin Password - Direct SQL Update
 * Ensures admin password hash is properly set using raw SQL
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function fixAdminPassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://holdwall:holdwall@localhost:5432/holdwall",
  });

  try {
    console.log("Generating password hash...");
    const passwordHash = await bcrypt.hash("admin123", 10);
    console.log("Hash generated:", passwordHash.substring(0, 20) + "...");

    // Get tenant ID
    const tenantResult = await pool.query('SELECT id FROM "Tenant" WHERE slug = $1', ["default"]);
    const tenantId = tenantResult.rows[0]?.id || "default-tenant";

    // Update admin user with raw SQL
    const updateResult = await pool.query(
      'UPDATE "User" SET "passwordHash" = $1, "tenantId" = $2, role = $3, name = $4 WHERE email = $5 RETURNING email, role',
      [passwordHash, tenantId, "ADMIN", "Admin User", "admin@holdwall.com"]
    );

    if (updateResult.rows.length === 0) {
      // User doesn't exist, create it
      await pool.query(
        `INSERT INTO "User" (id, email, name, "passwordHash", role, "tenantId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [`user-${Date.now()}`, "admin@holdwall.com", "Admin User", passwordHash, "ADMIN", tenantId]
      );
      console.log("Admin user created");
    } else {
      console.log("Admin user updated:", updateResult.rows[0]);
    }

      // Verify
      const verifyResult = await pool.query(
        'SELECT email, role, "passwordHash", LENGTH("passwordHash") as hash_length FROM "User" WHERE email = $1',
        ["admin@holdwall.com"]
      );

      if (verifyResult.rows.length > 0) {
        const user = verifyResult.rows[0];
        console.log("Verification:");
        console.log("  Email:", user.email);
        console.log("  Role:", user.role);
        console.log("  Hash length:", user.hash_length);

        if (user.hash_length && user.hash_length > 0 && user.passwordHash) {
          const isValid = await bcrypt.compare("admin123", user.passwordHash);
          console.log("  Password verification:", isValid ? "✅ Valid" : "❌ Invalid");
        } else {
          console.log("  Password hash is missing or empty");
        }
      }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
    process.exit(1);
  }
}

fixAdminPassword();
