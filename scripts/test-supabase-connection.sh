#!/bin/bash
# Test Supabase Connection String
# Helps find the correct connection string format

set -e

PROJECT_REF="hrzxbonjpffluuiwpzwe"
PASSWORD="@HoldWall2026."
PASSWORD_ENCODED="%40HoldWall2026%2E"

echo "🔍 Testing Supabase Connection Strings"
echo "======================================"
echo ""

# Test 1: Direct connection
echo "Test 1: Direct connection"
DATABASE_URL="postgresql://postgres:${PASSWORD_ENCODED}@db.${PROJECT_REF}.supabase.co:5432/postgres"
export DATABASE_URL
if timeout 10 npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Direct connection works!"
    echo "$DATABASE_URL" > /tmp/holdwall_working_db_url.txt
    exit 0
else
    echo "❌ Direct connection failed"
fi

# Test 2: Pooler (Session Mode) - different regions
echo ""
echo "Test 2: Pooler connection (Session Mode)"
REGIONS=("us-east-1" "us-west-1" "eu-west-1" "ap-southeast-1" "eu-central-1")

for REGION in "${REGIONS[@]}"; do
    echo "  Trying region: $REGION"
    DATABASE_URL="postgresql://postgres.${PROJECT_REF}:${PASSWORD_ENCODED}@aws-0-${REGION}.pooler.supabase.com:5432/postgres"
    export DATABASE_URL
    if timeout 10 npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
        echo "  ✅ Pooler connection works with region: $REGION"
        echo "$DATABASE_URL" > /tmp/holdwall_working_db_url.txt
        exit 0
    fi
done

echo ""
echo "❌ All connection attempts failed"
echo ""
echo "Please check:"
echo "1. Database password is correct: @HoldWall2026."
echo "2. Database is accessible from your network"
echo "3. Get connection string from Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo ""
echo "Copy the connection string from Supabase and run:"
echo "   npm run deploy:complete 'your-connection-string'"
