/**
 * Test Authentication Flow End-to-End
 * Verifies the complete authentication system is working
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";

async function testAuthFlow() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://holdwall:holdwall@localhost:5432/holdwall",
  });

  console.log("🧪 Testing Authentication Flow\n");
  console.log("=" .repeat(60));

  try {
    // Test 1: Verify password hash exists and is correct
    console.log("\n✅ Test 1: Password Hash Verification");
    const hashResult = await pool.query(
      'SELECT email, "passwordHash", LENGTH("passwordHash") as hash_length FROM "User" WHERE email = $1',
      ["admin@holdwall.com"]
    );

    if (hashResult.rows.length === 0) {
      console.error("❌ Admin user not found!");
      process.exit(1);
    }

    const user = hashResult.rows[0];
    console.log(`   User: ${user.email}`);
    console.log(`   Hash length: ${user.hash_length || 0}`);

    if (!user.passwordHash || user.hash_length !== 60) {
      console.error("❌ Password hash is missing or incorrect length!");
      process.exit(1);
    }

    const passwordMatch = await bcrypt.compare("admin123", user.passwordHash);
    if (!passwordMatch) {
      console.error("❌ Password hash doesn't match 'admin123'!");
      process.exit(1);
    }
    console.log("   ✅ Password hash is valid");

    // Test 2: Test Prisma database query
    console.log("\n✅ Test 2: Prisma Database Query");
    const prismaUser = await db.user.findUnique({
      where: { email: "admin@holdwall.com" },
    });

    if (!prismaUser) {
      console.error("❌ Prisma cannot find admin user!");
      process.exit(1);
    }

    console.log(`   User found: ${prismaUser.email}`);
    console.log(`   Has password hash: ${!!prismaUser.passwordHash}`);
    console.log(`   Hash length: ${prismaUser.passwordHash?.length || 0}`);

    if (!prismaUser.passwordHash || prismaUser.passwordHash.length !== 60) {
      console.error("❌ Prisma user has invalid password hash!");
      process.exit(1);
    }

    const prismaPasswordMatch = await bcrypt.compare("admin123", prismaUser.passwordHash);
    if (!prismaPasswordMatch) {
      console.error("❌ Prisma password hash doesn't match!");
      process.exit(1);
    }
    console.log("   ✅ Prisma can read and verify password hash");

    // Test 3: Test session endpoint
    console.log("\n✅ Test 3: Session Endpoint");
    const sessionResponse = await fetch("http://localhost:3000/api/auth/session");
    if (!sessionResponse.ok) {
      console.error(`❌ Session endpoint returned ${sessionResponse.status}`);
      process.exit(1);
    }

    const sessionData = await sessionResponse.json();
    console.log(`   Status: ${sessionResponse.status}`);
    console.log(`   Response: ${JSON.stringify(sessionData)}`);
    console.log("   ✅ Session endpoint is accessible");

    // Test 4: Test sign-in page
    console.log("\n✅ Test 4: Sign-In Page");
    const signInResponse = await fetch("http://localhost:3000/auth/signin");
    if (!signInResponse.ok) {
      console.error(`❌ Sign-in page returned ${signInResponse.status}`);
      process.exit(1);
    }
    console.log(`   Status: ${signInResponse.status}`);
    console.log("   ✅ Sign-in page is accessible");

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ All authentication tests passed!");
    console.log("\n📝 Next Steps:");
    console.log("   1. Visit http://localhost:3000/auth/signin");
    console.log("   2. Login with: admin@holdwall.com / admin123");
    console.log("   3. You should be redirected to /overview");

    await pool.end();
    await db.$disconnect();
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    await pool.end();
    await db.$disconnect();
    process.exit(1);
  }
}

testAuthFlow()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
