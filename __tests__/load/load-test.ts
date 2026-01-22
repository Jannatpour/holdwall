/**
 * Load Testing Script
 * Simple load testing using Node.js and fetch
 * For more advanced load testing, consider using k6, artillery, or Apache Bench
 */

import { performance } from "perf_hooks";

interface LoadTestConfig {
  baseUrl: string;
  endpoints: Array<{
    path: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }>;
  concurrentUsers: number;
  requestsPerUser: number;
  rampUpTime?: number; // milliseconds
}

interface TestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  errors: Array<{ status: number; message: string }>;
}

async function makeRequest(
  baseUrl: string,
  endpoint: { path: string; method?: string; headers?: Record<string, string>; body?: unknown }
): Promise<{ status: number; responseTime: number; error?: string }> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      method: endpoint.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...endpoint.headers,
      },
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    });

    const responseTime = performance.now() - startTime;
    return {
      status: response.status,
      responseTime,
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      status: 0,
      responseTime,
      error: (error as Error).message,
    };
  }
}

async function runUser(
  baseUrl: string,
  endpoints: LoadTestConfig["endpoints"],
  requestsPerUser: number
): Promise<Array<{ endpoint: string; status: number; responseTime: number; error?: string }>> {
  const results: Array<{ endpoint: string; status: number; responseTime: number; error?: string }> = [];

  for (let i = 0; i < requestsPerUser; i++) {
    for (const endpoint of endpoints) {
      const result = await makeRequest(baseUrl, endpoint);
      results.push({
        endpoint: endpoint.path,
        ...result,
      });
    }
  }

  return results;
}

function calculatePercentile(sortedArray: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

function analyzeResults(results: Array<{ endpoint: string; status: number; responseTime: number }>): Map<string, TestResult> {
  const byEndpoint = new Map<string, TestResult>();

  // Group by endpoint
  const grouped = new Map<string, typeof results>();
  for (const result of results) {
    if (!grouped.has(result.endpoint)) {
      grouped.set(result.endpoint, []);
    }
    grouped.get(result.endpoint)!.push(result);
  }

  // Calculate statistics for each endpoint
  for (const [endpoint, endpointResults] of grouped) {
    const responseTimes = endpointResults.map((r) => r.responseTime).sort((a, b) => a - b);
    const successful = endpointResults.filter((r) => r.status >= 200 && r.status < 300);
    const failed = endpointResults.filter((r) => r.status < 200 || r.status >= 300);

    const errors = new Map<number, number>();
    for (const result of failed) {
      errors.set(result.status, (errors.get(result.status) || 0) + 1);
    }

    const sum = responseTimes.reduce((a, b) => a + b, 0);
    const avg = sum / responseTimes.length;

    byEndpoint.set(endpoint, {
      endpoint,
      totalRequests: endpointResults.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageResponseTime: avg,
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      p50: calculatePercentile(responseTimes, 50),
      p95: calculatePercentile(responseTimes, 95),
      p99: calculatePercentile(responseTimes, 99),
      errors: Array.from(errors.entries()).map(([status, count]) => ({
        status,
        message: `${count} requests returned status ${status}`,
      })),
    });
  }

  return byEndpoint;
}

export async function runLoadTest(config: LoadTestConfig): Promise<Map<string, TestResult>> {
  console.log(`Starting load test with ${config.concurrentUsers} concurrent users`);
  console.log(`Each user will make ${config.requestsPerUser} requests per endpoint`);
  console.log(`Total endpoints: ${config.endpoints.length}`);
  console.log(`Total requests: ${config.concurrentUsers * config.requestsPerUser * config.endpoints.length}\n`);

  const allResults: Array<{ endpoint: string; status: number; responseTime: number }> = [];

  // Ramp up users gradually if specified
  const rampUpDelay = config.rampUpTime
    ? config.rampUpTime / config.concurrentUsers
    : 0;

  const userPromises: Promise<void>[] = [];

  for (let i = 0; i < config.concurrentUsers; i++) {
    if (rampUpDelay > 0 && i > 0) {
      await new Promise((resolve) => setTimeout(resolve, rampUpDelay));
    }

    const userPromise = runUser(config.baseUrl, config.endpoints, config.requestsPerUser).then(
      (results) => {
        allResults.push(...results);
      }
    );

    userPromises.push(userPromise);
  }

  await Promise.all(userPromises);

  return analyzeResults(allResults);
}

// CLI execution
if (require.main === module) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const config: LoadTestConfig = {
    baseUrl,
    endpoints: [
      { path: "/api/health" },
      { path: "/api/overview" },
      { path: "/api/signals" },
      { path: "/api/claims" },
      { path: "/api/graph/snapshot" },
    ],
    concurrentUsers: parseInt(process.env.LOAD_TEST_USERS || "10", 10),
    requestsPerUser: parseInt(process.env.LOAD_TEST_REQUESTS || "5", 10),
    rampUpTime: parseInt(process.env.LOAD_TEST_RAMP_UP || "5000", 10),
  };

  runLoadTest(config)
    .then((results) => {
      console.log("\n=== Load Test Results ===\n");

      for (const [endpoint, result] of results) {
        console.log(`Endpoint: ${endpoint}`);
        console.log(`  Total Requests: ${result.totalRequests}`);
        console.log(`  Successful: ${result.successfulRequests}`);
        console.log(`  Failed: ${result.failedRequests}`);
        console.log(`  Average Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
        console.log(`  Min: ${result.minResponseTime.toFixed(2)}ms`);
        console.log(`  Max: ${result.maxResponseTime.toFixed(2)}ms`);
        console.log(`  P50: ${result.p50.toFixed(2)}ms`);
        console.log(`  P95: ${result.p95.toFixed(2)}ms`);
        console.log(`  P99: ${result.p99.toFixed(2)}ms`);

        if (result.errors.length > 0) {
          console.log(`  Errors:`);
          for (const error of result.errors) {
            console.log(`    - ${error.message}`);
          }
        }
        console.log();
      }
    })
    .catch((error) => {
      console.error("Load test failed:", error);
      process.exit(1);
    });
}
