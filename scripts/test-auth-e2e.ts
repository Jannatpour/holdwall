/**
 * End-to-End Authentication Flow Test
 * Tests signup and signin flows with real API calls
 */

import { logger } from "@/lib/logging/logger";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.holdwall.com";

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  url: string,
  options?: RequestInit
): Promise<TestResult> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    let data: any = null;
    if (isJson) {
      try {
        data = await response.json();
      } catch (e) {
        // Response might be empty
      }
    } else {
      const text = await response.text();
      return {
        test: name,
        passed: false,
        error: `Expected JSON response, got ${contentType}`,
        details: { status: response.status, preview: text.substring(0, 200) },
      };
    }

    return {
      test: name,
      passed: response.ok || response.status === 200,
      error: response.ok ? undefined : `Status ${response.status}: ${data?.error || data?.message || "Unknown error"}`,
      details: { status: response.status, data },
    };
  } catch (error) {
    return {
      test: name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runTests() {
  console.log("🧪 Starting End-to-End Authentication Flow Tests\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  // Test 1: Health Check
  console.log("1. Testing health endpoint...");
  const healthResult = await testEndpoint(
    "Health Check",
    `${BASE_URL}/api/health`
  );
  results.push(healthResult);
  console.log(healthResult.passed ? "✅ PASSED" : "❌ FAILED");
  if (healthResult.error) console.log(`   Error: ${healthResult.error}`);

  // Test 2: Auth Providers
  console.log("\n2. Testing auth providers endpoint...");
  const providersResult = await testEndpoint(
    "Auth Providers",
    `${BASE_URL}/api/auth/providers`
  );
  results.push(providersResult);
  console.log(providersResult.passed ? "✅ PASSED" : "❌ FAILED");
  if (providersResult.details?.data) {
    console.log(`   Providers: ${JSON.stringify(providersResult.details.data)}`);
  }

  // Test 3: Auth Session (should return null for unauthenticated)
  console.log("\n3. Testing auth session endpoint (unauthenticated)...");
  const sessionResult = await testEndpoint(
    "Auth Session (Unauthenticated)",
    `${BASE_URL}/api/auth/session`
  );
  results.push(sessionResult);
  console.log(sessionResult.passed ? "✅ PASSED" : "❌ FAILED");
  if (sessionResult.details?.data) {
    const hasUser = sessionResult.details.data.user !== null;
    console.log(`   Session: ${hasUser ? "Authenticated" : "Unauthenticated"}`);
  }

  // Test 4: Signup with new user
  console.log("\n4. Testing signup endpoint...");
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123";
  const signupResult = await testEndpoint(
    "User Signup",
    `${BASE_URL}/api/auth/signup`,
    {
      method: "POST",
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: "Test User",
      }),
    }
  );
  results.push(signupResult);
  console.log(signupResult.passed ? "✅ PASSED" : "❌ FAILED");
  if (signupResult.error) {
    console.log(`   Error: ${signupResult.error}`);
  } else {
    console.log(`   User created: ${testEmail}`);
  }

  // Test 5: Signup with duplicate email (should fail)
  if (signupResult.passed) {
    console.log("\n5. Testing signup with duplicate email...");
    const duplicateResult = await testEndpoint(
      "Duplicate Signup",
      `${BASE_URL}/api/auth/signup`,
      {
        method: "POST",
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: "Test User",
        }),
      }
    );
    results.push(duplicateResult);
    // This should fail with 409
    const expectedFailure = duplicateResult.details?.status === 409;
    console.log(expectedFailure ? "✅ PASSED (correctly rejected)" : "❌ FAILED");
    if (!expectedFailure) {
      console.log(`   Expected 409, got ${duplicateResult.details?.status}`);
    }
  }

  // Test 6: Signin with invalid credentials (should fail)
  console.log("\n6. Testing signin with invalid credentials...");
  const invalidSigninResult = await testEndpoint(
    "Invalid Signin",
    `${BASE_URL}/api/auth/signin`,
    {
      method: "POST",
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "WrongPassword123",
      }),
    }
  );
  results.push(invalidSigninResult);
  // NextAuth signin endpoint might redirect, so we check for non-200
  const invalidExpected = !invalidSigninResult.passed || invalidSigninResult.details?.status !== 200;
  console.log(invalidExpected ? "✅ PASSED (correctly rejected)" : "⚠️  WARNING (unexpected success)");

  // Test 7: Signup validation (missing fields)
  console.log("\n7. Testing signup validation (missing email)...");
  const validationResult = await testEndpoint(
    "Signup Validation",
    `${BASE_URL}/api/auth/signup`,
    {
      method: "POST",
      body: JSON.stringify({
        password: "TestPassword123",
      }),
    }
  );
  results.push(validationResult);
  const validationExpected = validationResult.details?.status === 400;
  console.log(validationExpected ? "✅ PASSED (correctly rejected)" : "❌ FAILED");
  if (!validationExpected) {
    console.log(`   Expected 400, got ${validationResult.details?.status}`);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.test}: ${r.error || "Unknown error"}`);
      });
  }

  return { passed, failed, total: results.length };
}

// Run tests if executed directly
if (require.main === module) {
  runTests()
    .then((summary) => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Test execution failed:", error);
      process.exit(1);
    });
}

export { runTests, testEndpoint };
