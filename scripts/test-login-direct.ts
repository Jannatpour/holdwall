/**
 * Direct Login Test
 * Tests the NextAuth credentials provider directly
 */

import { db } from "../lib/db/client";
import bcrypt from "bcryptjs";

async function testDirectLogin() {
  console.log("🧪 Testing Direct Login Flow\n");

  const testEmail = "test-login@example.com";
  const testPassword = "test12345";

  // Test 1: Find user
  console.log("1. Finding user in database...");
  const user = await db.user.findUnique({
    where: { email: testEmail },
  });

  if (!user) {
    console.error("❌ User not found");
    return;
  }

  console.log(`✅ User found: ${user.email}`);
  console.log(`   - ID: ${user.id}`);
  console.log(`   - Name: ${user.name}`);
  console.log(`   - Role: ${user.role}`);
  console.log(`   - Tenant ID: ${user.tenantId}\n`);

  // Test 2: Check password hash
  if (!user.passwordHash) {
    console.error("❌ User has no password hash");
    return;
  }

  console.log("2. Testing password verification...");
  const isValid = await bcrypt.compare(testPassword, user.passwordHash);
  
  if (isValid) {
    console.log("✅ Password verification successful\n");
    console.log("✅ All login tests passed!");
    console.log("\nYou should be able to login with:");
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
  } else {
    console.error("❌ Password verification failed");
    console.log("   The password hash may be incorrect or the password doesn't match");
  }
}

testDirectLogin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
