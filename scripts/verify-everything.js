#!/usr/bin/env node

/**
 * Holdwall POS - Complete Verification Script (Node.js)
 * This script verifies that everything is working correctly
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
};

function log(message, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

function success(message) {
  log(`✅ ${message}`, COLORS.GREEN);
}

function error(message) {
  log(`❌ ${message}`, COLORS.RED);
}

function warning(message) {
  log(`⚠️  ${message}`, COLORS.YELLOW);
}

function info(message) {
  log(`ℹ️  ${message}`, COLORS.BLUE);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.VERIFY_TOKEN ? { 'x-verify-token': process.env.VERIFY_TOKEN } : {}),
        ...options.headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function checkServer() {
  log('\n==========================================');
  log('Holdwall POS - Complete Verification');
  log('==========================================\n');
  
  info(`Base URL: ${BASE_URL}\n`);
  
  // Step 1: Check if server is running
  log('Step 1: Checking if server is running...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    if (response.status === 200) {
      success(`Server is running at ${BASE_URL}`);
    } else {
      error(`Server returned status ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`Server is not running at ${BASE_URL}`);
    error(`Error: ${err.message}`);
    log('\nPlease start the server with: npm run dev\n');
    return false;
  }
  log('');

  // Step 2: Health Check
  log('Step 2: Running health check...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    if (response.status === 200) {
      const health = response.data;
      if (health.status === 'healthy') {
        success('Health check passed - System is healthy');
        log('\nHealth Details:');
        log(JSON.stringify(health, null, 2));
      } else {
        warning(`Health check returned: ${health.status}`);
        log(JSON.stringify(health, null, 2));
      }
    } else {
      error(`Health check failed with status ${response.status}`);
    }
  } catch (err) {
    error(`Health check failed: ${err.message}`);
  }
  log('');

  // Step 3: End-to-End Verification
  log('Step 3: Running end-to-end flow verification...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/verification/run`, {
      method: 'POST',
      body: { flow: 'all', tenantId: process.env.VERIFY_TENANT_ID },
    });
    
    if (response.status === 200) {
      const verification = response.data;
      
      // Check overall status
      const failed = verification.summary?.failed ?? null;
      const passed = verification.summary?.passed ?? null;
      if (failed === 0) {
        success(`End-to-end verification passed (${passed ?? "?"} flows)`);
      } else if (typeof failed === "number" && failed > 0) {
        error(`End-to-end verification failed (${failed} failing flow(s))`);
      } else {
        warning("Could not determine verification status");
      }
      
      log('\nVerification Details:');
      log(JSON.stringify(verification, null, 2));
    } else {
      error(`Verification request failed with status ${response.status}`);
      log(`Response: ${response.raw}`);
    }
  } catch (err) {
    error(`Verification failed: ${err.message}`);
    warning('Make sure you are authenticated (session cookie required)');
  }
  log('');

  // Step 4: Run tests
  log('Step 4: Running test suite...');
  try {
    info('Executing: npm run test');
    execSync('npm run test', { stdio: 'inherit' });
    success('All tests passed');
  } catch (err) {
    error('Some tests failed');
    log('Check test output above for details');
  }
  log('');

  // Step 5: Summary
  log('==========================================');
  log('Verification Summary');
  log('==========================================\n');
  
  info('To view detailed verification results:');
  log(`  - Health: curl ${BASE_URL}/api/health | jq`);
  log(`  - Verification: curl -X POST ${BASE_URL}/api/verification/run \\`);
  log(`      -H 'Content-Type: application/json' \\`);
  log(`      -d '{"flow":"all"}' | jq`);
  log('');
  info('For complete verification guide, see: VERIFY_EVERYTHING.md');
  log('');
}

// Run verification
checkServer().catch((err) => {
  error(`Verification script failed: ${err.message}`);
  process.exit(1);
});
