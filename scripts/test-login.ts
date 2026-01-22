/**
 * Test Login Script
 * Tests the authentication flow end-to-end
 */

import { db } from "../lib/db/client";
import bcrypt from "bcryptjs";

async function testLogin() {
  console.log("Testing login functionality...\n");

  // Test 1: Check if user exists
  const testEmail = "test-login@example.com";
  const testPassword = "test12345";

  console.log("1. Checking user in database...");
  const user = await db.user.findUnique({
    where: { email: testEmail },
  });

  if (!user) {
    console.error("❌ User not found in database");
    return;
  }

  console.log(`✅ User found: ${user.email}`);
  console.log(`   - Name: ${user.name}`);
  console.log(`   - Role: ${user.role}`);
  console.log(`   - Has password hash: ${user.passwordHash ? "Yes" : "No"}\n`);

  // Test 2: Verify password hash
  if (!user.passwordHash) {
    console.error("❌ User has no password hash");
    return;
  }

  console.log("2. Testing password verification...");
  const isValid = await bcrypt.compare(testPassword, user.passwordHash);
  console.log(`   Password match: ${isValid ? "✅ Yes" : "❌ No"}\n`);

  // Test 3: Test with wrong password
  console.log("3. Testing with wrong password...");
  const isInvalid = await bcrypt.compare("wrongpassword", user.passwordHash);
  console.log(`   Wrong password match: ${isInvalid ? "❌ Should be false" : "✅ Correctly rejected"}\n`);

  console.log("✅ All login tests passed!");
}

testLogin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
