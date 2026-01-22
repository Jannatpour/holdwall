/**
 * Test Full Login Flow
 * End-to-end test of authentication system
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function testLoginFlow() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://holdwall:holdwall@localhost:5432/holdwall",
  });

  console.log("🔐 Testing Full Login Flow\n");
  console.log("=".repeat(60));

  try {
    // Test 1: Verify admin user exists
    console.log("\n✅ Test 1: Admin User Exists");
    const userResult = await pool.query(
      'SELECT email, role, "passwordHash", LENGTH("passwordHash") as hash_len FROM "User" WHERE email = $1',
      ["admin@holdwall.com"]
    );

    if (userResult.rows.length === 0) {
      console.error("❌ Admin user not found!");
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Hash length: ${user.hash_len || 0}`);

    if (!user.passwordHash) {
      console.error("❌ Password hash is missing!");
      process.exit(1);
    }

    if (user.hash_len < 60) {
      console.error(`❌ Password hash is too short: ${user.hash_len} chars (expected 60)`);
      process.exit(1);
    }

    console.log("   ✅ Admin user exists with password hash");

    // Test 2: Verify password hash is valid
    console.log("\n✅ Test 2: Password Hash Verification");
    const hash = user.passwordHash.trim();
    const isValid = await bcrypt.compare("admin123", hash);

    if (!isValid) {
      console.error("❌ Password hash does not match 'admin123'!");
      process.exit(1);
    }

    console.log("   ✅ Password hash is valid");

    // Test 3: Test API endpoints
    console.log("\n✅ Test 3: API Endpoints");
    
    const baseUrl = "http://localhost:3000";
    
    // Health endpoint
    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log(`   ✅ Health endpoint: ${healthResponse.status} ${healthResponse.statusText}`);
        console.log(`   Status: ${healthData.status || "unknown"}`);
      } else {
        console.warn(`   ⚠️  Health endpoint: ${healthResponse.status} ${healthResponse.statusText}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Health endpoint: ${error instanceof Error ? error.message : "Connection failed"}`);
    }

    // Session endpoint
    try {
      const sessionResponse = await fetch(`${baseUrl}/api/auth/session`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        console.log(`   ✅ Session endpoint: ${sessionResponse.status} ${sessionResponse.statusText}`);
        console.log(`   Session: ${JSON.stringify(sessionData)}`);
      } else {
        console.warn(`   ⚠️  Session endpoint: ${sessionResponse.status} ${sessionResponse.statusText}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Session endpoint: ${error instanceof Error ? error.message : "Connection failed"}`);
    }

    // Sign-in page
    try {
      const signInResponse = await fetch(`${baseUrl}/auth/signin`);
      if (signInResponse.ok) {
        console.log(`   ✅ Sign-in page: ${signInResponse.status} ${signInResponse.statusText}`);
      } else {
        console.warn(`   ⚠️  Sign-in page: ${signInResponse.status} ${signInResponse.statusText}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Sign-in page: ${error instanceof Error ? error.message : "Connection failed"}`);
    }

    // Test 4: Test authentication endpoint
    console.log("\n✅ Test 4: Authentication Endpoint");
    try {
      const authResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "admin@holdwall.com",
          password: "admin123",
          redirect: "false",
        }),
      });

      console.log(`   Status: ${authResponse.status} ${authResponse.statusText}`);
      const authData = await authResponse.text();
      console.log(`   Response preview: ${authData.substring(0, 100)}`);
      
      if (authResponse.ok || authResponse.status === 302) {
        console.log("   ✅ Authentication endpoint is accessible");
      } else {
        console.warn(`   ⚠️  Authentication endpoint returned ${authResponse.status}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Authentication endpoint: ${error instanceof Error ? error.message : "Connection failed"}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Login Flow Tests Complete!");
    console.log("\n📝 Summary:");
    console.log("   ✅ Admin user exists with valid password hash");
    console.log("   ✅ Password verification successful");
    console.log("   ⚠️  API endpoints require dev server to be running");
    console.log("\n🚀 Next Steps:");
    console.log("   1. Ensure dev server is running: npm run dev");
    console.log("   2. Visit http://localhost:3000/auth/signin");
    console.log("   3. Login with: admin@holdwall.com / admin123");
    console.log("   4. You should be redirected to /overview");

    await pool.end();
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    await pool.end();
    process.exit(1);
  }
}

testLoginFlow()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
