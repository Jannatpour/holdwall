#!/bin/bash
# Test Login API Directly

echo "🧪 Testing Login API"
echo "===================="
echo ""

TEST_EMAIL="test-login@example.com"
TEST_PASSWORD="test12345"

echo "1. Testing credentials authentication..."
echo "   Email: $TEST_EMAIL"
echo "   Password: $TEST_PASSWORD"
echo ""

# Note: NextAuth doesn't have a direct API endpoint for credentials login
# Login happens client-side via signIn() function
echo "⚠️  Note: NextAuth credentials login is client-side only"
echo "   The login flow requires:"
echo "   1. User visits /auth/signin page"
echo "   2. Enters credentials"
echo "   3. Client calls signIn('credentials', {...})"
echo "   4. NextAuth processes via authorize() callback"
echo "   5. Session is created"
echo ""

echo "✅ To test login:"
echo "   1. Open http://localhost:3000/auth/signin in browser"
echo "   2. Enter email: $TEST_EMAIL"
echo "   3. Enter password: $TEST_PASSWORD"
echo "   4. Click 'Sign in'"
echo "   5. Should redirect to /overview"
echo ""

echo "📋 Available test users:"
psql -U holdwall -d holdwall -c "SELECT email, role FROM \"User\" WHERE \"passwordHash\" IS NOT NULL ORDER BY email LIMIT 5;" 2>&1 | grep -v "total_users\|email\|----" | grep -v "^$" | while read line; do
  if [ ! -z "$line" ]; then
    echo "   - $line"
  fi
done
