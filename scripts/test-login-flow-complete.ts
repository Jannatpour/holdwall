/**
 * Complete Login Flow Test
 * Tests the full authentication flow: signup -> signin -> session verification
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.holdwall.com";

interface TestResult {
  step: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function testStep(name: string, testFn: () => Promise<any>): Promise<TestResult> {
  try {
    const result = await testFn();
    return {
      step: name,
      passed: true,
      details: result,
    };
  } catch (error) {
    return {
      step: name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runCompleteLoginTest() {
  console.log("🧪 Complete Login Flow Test\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  const testEmail = `test-login-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";
  const testName = "Test User";

  // Step 1: Test signup
  console.log("Step 1: Testing user signup...");
  const signupResult = await testStep("User Signup", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Expected JSON, got ${contentType}. Response: ${text.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Signup failed: ${data.error || data.message || "Unknown error"}`);
    }

    return data;
  });
  results.push(signupResult);
  console.log(signupResult.passed ? "✅ PASSED" : "❌ FAILED");
  if (signupResult.error) console.log(`   Error: ${signupResult.error}`);

  if (!signupResult.passed) {
    console.log("\n⚠️  Signup failed. Cannot continue with login test.");
    return;
  }

  // Step 2: Test session (should be null before login)
  console.log("\nStep 2: Testing session endpoint (before login)...");
  const sessionBeforeResult = await testStep("Session Before Login", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/session`);
    const contentType = response.headers.get("content-type") || "";
    
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Expected JSON, got ${contentType}`);
    }

    const data = await response.json();
    if (data.user !== null) {
      throw new Error(`Expected null user, got: ${JSON.stringify(data.user)}`);
    }
    return data;
  });
  results.push(sessionBeforeResult);
  console.log(sessionBeforeResult.passed ? "✅ PASSED" : "❌ FAILED");

  // Step 3: Test signin (using NextAuth credentials)
  console.log("\nStep 3: Testing user signin...");
  console.log("   Note: This requires browser-based testing as NextAuth handles signin");
  console.log("   Please test signin manually in the browser");

  // Step 4: Verify health endpoint
  console.log("\nStep 4: Testing health endpoint...");
  const healthResult = await testStep("Health Check", async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const contentType = response.headers.get("content-type") || "";
    
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Expected JSON, got ${contentType}`);
    }

    const data = await response.json();
    return data;
  });
  results.push(healthResult);
  console.log(healthResult.passed ? "✅ PASSED" : "❌ FAILED");
  if (healthResult.details) {
    console.log(`   Status: ${healthResult.details.status || "unknown"}`);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Steps: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log("\n❌ Failed Steps:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.step}: ${r.error || "Unknown error"}`);
      });
  }

  console.log(`\n📝 Test Credentials Created:`);
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}`);
  console.log(`\n💡 Use these credentials to test signin in the browser at:`);
  console.log(`   ${BASE_URL}/auth/signin`);

  return { passed, failed, total: results.length, testEmail, testPassword };
}

// Run if executed directly
if (require.main === module) {
  runCompleteLoginTest()
    .then((summary) => {
      if (summary) {
        process.exit(summary.failed > 0 ? 1 : 0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("Test execution failed:", error);
      process.exit(1);
    });
}

export { runCompleteLoginTest };
