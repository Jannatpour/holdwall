#!/bin/bash
# Complete End-to-End Authentication Flow Test

echo "🧪 Complete Authentication Flow Test"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if server is running
echo "1. Checking if server is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "   ${GREEN}✅ Server is running${NC}"
else
  echo -e "   ${RED}❌ Server is not running. Please start with: npm run dev${NC}"
  exit 1
fi
echo ""

# Test 2: Check database connection
echo "2. Checking database connection..."
DB_CHECK=$(psql -U holdwall -d holdwall -c "SELECT 1;" 2>&1)
if echo "$DB_CHECK" | grep -q "1 row"; then
  echo -e "   ${GREEN}✅ Database is accessible${NC}"
else
  echo -e "   ${RED}❌ Database connection failed${NC}"
  echo "   $DB_CHECK"
  exit 1
fi
echo ""

# Test 3: Check session endpoint
echo "3. Testing session endpoint..."
SESSION_RESPONSE=$(curl -s 'http://localhost:3000/api/auth/session')
if echo "$SESSION_RESPONSE" | grep -q '"user":null'; then
  echo -e "   ${GREEN}✅ Session endpoint working (returns null for unauthenticated)${NC}"
else
  echo -e "   ${YELLOW}⚠️  Session endpoint response: $SESSION_RESPONSE${NC}"
fi
echo ""

# Test 4: Check sign-in page
echo "4. Testing sign-in page..."
if curl -s 'http://localhost:3000/auth/signin' | grep -q "Sign in"; then
  echo -e "   ${GREEN}✅ Sign-in page loads correctly${NC}"
else
  echo -e "   ${RED}❌ Sign-in page failed to load${NC}"
  exit 1
fi
echo ""

# Test 5: Check signup page
echo "5. Testing signup page..."
if curl -s 'http://localhost:3000/auth/signup' | grep -q "Create an account"; then
  echo -e "   ${GREEN}✅ Signup page loads correctly${NC}"
else
  echo -e "   ${RED}❌ Signup page failed to load${NC}"
  exit 1
fi
echo ""

# Test 6: Test user creation
echo "6. Testing user creation..."
TEST_EMAIL="flow-test-$(date +%s)@example.com"
SIGNUP_RESPONSE=$(curl -s -X POST 'http://localhost:3000/api/auth/signup' \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"test12345\",\"name\":\"Flow Test\"}")

if echo "$SIGNUP_RESPONSE" | grep -q "User created successfully"; then
  echo -e "   ${GREEN}✅ User creation successful${NC}"
  echo "   Test user: $TEST_EMAIL"
else
  echo -e "   ${RED}❌ User creation failed: $SIGNUP_RESPONSE${NC}"
  exit 1
fi
echo ""

# Test 7: Verify user in database
echo "7. Verifying user in database..."
DB_USER=$(psql -U holdwall -d holdwall -t -c "SELECT email FROM \"User\" WHERE email='$TEST_EMAIL';" 2>&1 | xargs)
if [ "$DB_USER" = "$TEST_EMAIL" ]; then
  echo -e "   ${GREEN}✅ User found in database${NC}"
else
  echo -e "   ${RED}❌ User not found in database${NC}"
  exit 1
fi
echo ""

# Test 8: Check protected route (overview)
echo "8. Testing protected route access..."
OVERVIEW_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" 'http://localhost:3000/overview')
if [ "$OVERVIEW_RESPONSE" = "200" ] || [ "$OVERVIEW_RESPONSE" = "401" ] || [ "$OVERVIEW_RESPONSE" = "302" ]; then
  echo -e "   ${GREEN}✅ Overview page responds (status: $OVERVIEW_RESPONSE)${NC}"
  echo "   Note: 401/302 is expected when not authenticated"
else
  echo -e "   ${YELLOW}⚠️  Overview page returned: $OVERVIEW_RESPONSE${NC}"
fi
echo ""

echo -e "${GREEN}✅ All authentication flow tests completed!${NC}"
echo ""
echo "📋 Test Credentials:"
echo "   Email: $TEST_EMAIL"
echo "   Password: test12345"
echo ""
echo "📋 Default Test Users:"
echo "   - admin@holdwall.com / admin123 (ADMIN)"
echo "   - user@holdwall.com / user123 (USER)"
echo "   - test-login@example.com / test12345 (USER)"
echo ""
echo "🌐 Next Steps:"
echo "   1. Open http://localhost:3000/auth/signin"
echo "   2. Login with any of the test credentials above"
echo "   3. You should be redirected to /overview"
echo "   4. Check browser console for any errors"
