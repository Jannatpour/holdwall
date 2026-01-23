/**
 * Test Login Fix Script
 * 
 * Tests the login fix for email case sensitivity issues.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/test-login-fix.ts [email] [password]
 */

import { db } from "../lib/db/client";
import bcrypt from "bcryptjs";

async function testLoginFix(email?: string, password?: string) {
  console.log("🧪 Testing Login Fix for Email Case Sensitivity\n");
  console.log("=".repeat(60));

  const testEmail = email || "test@example.com";
  const testPassword = password || "test12345";

  console.log(`\n📧 Test Email: ${testEmail}`);
  console.log(`🔑 Test Password: ${testPassword ? "***" : "Not provided"}\n`);

  // Test 1: Find user with exact email
  console.log("1️⃣  Testing exact email lookup...");
  const exactUser = await db.user.findUnique({
    where: { email: testEmail },
  });

  if (exactUser) {
    console.log(`   ✅ Found user with exact email: ${exactUser.email}`);
  } else {
    console.log(`   ⚠️  User not found with exact email`);
  }

  // Test 2: Find user with normalized (lowercase) email
  console.log("\n2️⃣  Testing normalized (lowercase) email lookup...");
  const normalizedEmail = testEmail.trim().toLowerCase();
  const normalizedUser = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (normalizedUser) {
    console.log(`   ✅ Found user with normalized email: ${normalizedUser.email}`);
    console.log(`   📝 Original email in DB: ${normalizedUser.email}`);
    console.log(`   📝 Normalized lookup: ${normalizedEmail}`);
  } else {
    console.log(`   ⚠️  User not found with normalized email`);
  }

  // Test 3: Case-insensitive search using raw query
  console.log("\n3️⃣  Testing case-insensitive email lookup (raw query)...");
  try {
    const users = await db.$queryRaw<Array<{ id: string; email: string; name: string | null; passwordHash: string | null }>>`
      SELECT id, email, name, "passwordHash"
      FROM "User"
      WHERE LOWER(email) = LOWER(${normalizedEmail})
      LIMIT 1
    `;

    if (users.length > 0) {
      const foundUser = users[0];
      console.log(`   ✅ Found user with case-insensitive search: ${foundUser.email}`);
      console.log(`   📝 Original email in DB: ${foundUser.email}`);
      console.log(`   📝 Search email: ${normalizedEmail}`);
      
      if (foundUser.email !== normalizedEmail) {
        console.log(`   ⚠️  Email case mismatch! Consider running normalize-user-emails.ts`);
      }
    } else {
      console.log(`   ⚠️  User not found with case-insensitive search`);
    }
  } catch (error) {
    console.log(`   ❌ Error in case-insensitive search:`, error instanceof Error ? error.message : String(error));
  }

  // Test 4: Password verification (if password provided)
  if (password && normalizedUser?.passwordHash) {
    console.log("\n4️⃣  Testing password verification...");
    const isValid = await bcrypt.compare(testPassword, normalizedUser.passwordHash);
    
    if (isValid) {
      console.log(`   ✅ Password verification successful`);
      console.log(`   ✅ Login should work with email: ${normalizedEmail}`);
    } else {
      console.log(`   ❌ Password verification failed`);
      console.log(`   ⚠️  Login will fail - password doesn't match`);
    }
  } else if (password && !normalizedUser) {
    console.log("\n4️⃣  Password verification skipped (user not found)");
  } else if (!password) {
    console.log("\n4️⃣  Password verification skipped (no password provided)");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  
  if (exactUser || normalizedUser) {
    console.log("   ✅ User exists in database");
    if (exactUser && exactUser.email !== normalizedEmail) {
      console.log("   ⚠️  Email case mismatch detected");
      console.log(`   💡 Run: npx tsx scripts/normalize-user-emails.ts`);
    }
    if (normalizedUser && password) {
      const isValid = await bcrypt.compare(testPassword, normalizedUser.passwordHash);
      if (isValid) {
        console.log("   ✅ Login should work now");
      } else {
        console.log("   ❌ Password doesn't match - login will fail");
      }
    }
  } else {
    console.log("   ❌ User not found in database");
    console.log("   💡 Make sure the email is correct or create the user first");
  }

  console.log("\n✅ Test complete!\n");
}

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0];
const password = args[1];

testLoginFix(email, password)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect().catch(() => {});
  });
