#!/bin/bash

# Holdwall POS - Complete Verification Script
# This script verifies that everything is working correctly

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Holdwall POS - Complete Verification"
echo "=========================================="
echo ""

# Function to print success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print info
info() {
    echo -e "ℹ️  $1"
}

# Check if server is running
echo "Step 1: Checking if server is running..."
if curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
    success "Server is running at ${BASE_URL}"
else
    error "Server is not running at ${BASE_URL}"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo ""

# Step 2: Health Check
echo "Step 2: Running health check..."
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/api/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

if [ "$HEALTH_STATUS" = "healthy" ]; then
    success "Health check passed - System is healthy"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    warning "Health check returned: $HEALTH_STATUS"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
fi
echo ""

# Step 3: End-to-End Verification
echo "Step 3: Running end-to-end flow verification..."
VERIFICATION_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/verification/run" \
    -H "Content-Type: application/json" \
    -d '{"flow": "all"}')

# Check if verification was successful
if echo "$VERIFICATION_RESPONSE" | grep -q '"status":"pass"'; then
    success "End-to-end verification passed"
elif echo "$VERIFICATION_RESPONSE" | grep -q '"status":"fail"'; then
    error "End-to-end verification failed"
    echo "$VERIFICATION_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFICATION_RESPONSE"
else
    warning "Could not determine verification status"
    echo "$VERIFICATION_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFICATION_RESPONSE"
fi
echo ""

# Step 4: Run tests
echo "Step 4: Running test suite..."
if command -v npm > /dev/null 2>&1; then
    if npm run test 2>&1 | tee /tmp/test-output.log; then
        success "All tests passed"
    else
        error "Some tests failed"
        echo "Check test output above for details"
    fi
else
    warning "npm not found, skipping tests"
fi
echo ""

# Step 5: Check API routes structure
echo "Step 5: Verifying API route structure..."
if [ -f "lib/verification/api-route-verifier.ts" ]; then
    info "API route verifier exists"
    # Note: This would need to be run via Node.js/TypeScript
    warning "API route verification requires Node.js execution"
else
    warning "API route verifier not found"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""
info "To view detailed verification results:"
echo "  - Health: curl ${BASE_URL}/api/health | jq"
echo "  - Verification: curl -X POST ${BASE_URL}/api/verification/run -H 'Content-Type: application/json' -d '{\"flow\":\"all\"}' | jq"
echo ""
info "For complete verification guide, see: HOW_TO_BE_100_PERCENT_SURE.md"
echo ""
