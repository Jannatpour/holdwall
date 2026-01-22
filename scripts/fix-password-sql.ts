/**
 * Fix Admin Password via Direct SQL
 * Updates the admin user password hash using raw SQL
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function fixPasswordSQL() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://holdwall:holdwall@localhost:5432/holdwall",
  });

  try {
    console.log("Generating password hash...");
    const passwordHash = await bcrypt.hash("admin123", 10);
    console.log("Hash generated:", passwordHash.substring(0, 20) + "...");

    console.log("Updating password in database...");
    const result = await pool.query(
      'UPDATE "User" SET "passwordHash" = $1 WHERE email = $2',
      [passwordHash, "admin@holdwall.com"]
    );

    console.log(`✅ Updated ${result.rowCount} row(s)`);

    // Verify
    const verifyResult = await pool.query(
      'SELECT "passwordHash" FROM "User" WHERE email = $1',
      ["admin@holdwall.com"]
    );

    if (verifyResult.rows.length > 0) {
      const storedHash = verifyResult.rows[0].passwordHash;
      console.log("Stored hash length:", storedHash?.length || 0);
      console.log("Stored hash preview:", storedHash?.substring(0, 20) || "null");

      if (storedHash) {
        const isValid = await bcrypt.compare("admin123", storedHash);
        console.log("Password verification:", isValid ? "✅ Valid" : "❌ Invalid");
      } else {
        console.error("❌ Password hash is still null!");
      }
    }

    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
    process.exit(1);
  }
}

fixPasswordSQL()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
