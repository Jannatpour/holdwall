#!/bin/bash
# End-to-end authentication flow test

echo "🧪 Testing Authentication Flow"
echo "================================"
echo ""

# Test 1: Check session endpoint (should return null)
echo "1. Testing session endpoint (unauthenticated)..."
SESSION_RESPONSE=$(curl -s 'http://localhost:3000/api/auth/session')
if echo "$SESSION_RESPONSE" | grep -q '"user":null'; then
  echo "   ✅ Session endpoint returns null for unauthenticated user"
else
  echo "   ❌ Session endpoint unexpected response: $SESSION_RESPONSE"
fi
echo ""

# Test 2: Create a test user
echo "2. Creating test user..."
SIGNUP_RESPONSE=$(curl -s -X POST 'http://localhost:3000/api/auth/signup' \
  -H "Content-Type: application/json" \
  -d '{"email":"auth-test-'$(date +%s)'@example.com","password":"test12345","name":"Auth Test"}')

if echo "$SIGNUP_RESPONSE" | grep -q "User created successfully"; then
  echo "   ✅ User created successfully"
  TEST_EMAIL=$(echo "$SIGNUP_RESPONSE" | grep -o '"email":"[^"]*"' | cut -d'"' -f4)
  echo "   Test email: $TEST_EMAIL"
else
  echo "   ❌ User creation failed: $SIGNUP_RESPONSE"
  exit 1
fi
echo ""

# Test 3: Verify sign-in page loads
echo "3. Testing sign-in page..."
if curl -s 'http://localhost:3000/auth/signin' | grep -q "Sign in"; then
  echo "   ✅ Sign-in page loads correctly"
else
  echo "   ❌ Sign-in page failed to load"
fi
echo ""

echo "✅ Basic authentication flow tests completed"
echo ""
echo "Next: Test login in browser at http://localhost:3000/auth/signin"
echo "Use email: $TEST_EMAIL"
echo "Use password: test12345"
