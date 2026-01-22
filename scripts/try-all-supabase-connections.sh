#!/bin/bash
# Try All Supabase Connection String Formats
# Tests multiple connection string formats to find working one

set -e

PROJECT_REF="hrzxbonjpffluuiwpzwe"
PASSWORD="@HoldWall2026."
PASSWORD_ENCODED="%40HoldWall2026%2E"

echo "🔍 Testing All Supabase Connection Formats"
echo "=========================================="
echo ""

# Test direct connection
echo "Test 1: Direct connection"
DATABASE_URL="postgresql://postgres:${PASSWORD_ENCODED}@db.${PROJECT_REF}.supabase.co:5432/postgres"
export DATABASE_URL
if timeout 10 npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Direct connection works!"
    echo "$DATABASE_URL" > /tmp/holdwall_working_db.txt
    exit 0
fi
echo "❌ Direct connection failed"

# Test pooler session mode (port 5432)
echo ""
echo "Test 2: Pooler Session Mode (port 5432)"
REGIONS=("us-east-1" "us-west-1" "eu-west-1" "ap-southeast-1" "eu-central-1" "ap-northeast-1")

for REGION in "${REGIONS[@]}"; do
    echo "  Trying region: $REGION"
    DATABASE_URL="postgresql://postgres.${PROJECT_REF}:${PASSWORD_ENCODED}@aws-0-${REGION}.pooler.supabase.com:5432/postgres"
    export DATABASE_URL
    if timeout 10 npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
        echo "  ✅ Works with region: $REGION"
        echo "$DATABASE_URL" > /tmp/holdwall_working_db.txt
        exit 0
    fi
done

# Test pooler transaction mode (port 6543)
echo ""
echo "Test 3: Pooler Transaction Mode (port 6543)"
for REGION in "${REGIONS[@]}"; do
    echo "  Trying region: $REGION"
    DATABASE_URL="postgresql://postgres.${PROJECT_REF}:${PASSWORD_ENCODED}@aws-0-${REGION}.pooler.supabase.com:6543/postgres"
    export DATABASE_URL
    if timeout 10 npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
        echo "  ✅ Works with region: $REGION (transaction mode)"
        echo "$DATABASE_URL" > /tmp/holdwall_working_db.txt
        exit 0
    fi
done

echo ""
echo "❌ All connection attempts failed"
echo ""
echo "Please get the exact connection string from Supabase dashboard:"
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo ""
echo "Then run: npm run deploy:complete 'your-connection-string'"
