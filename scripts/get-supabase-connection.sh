#!/bin/bash
# Get Supabase Connection String
# Constructs connection string from provided credentials
#
# SECURITY: Never hardcode passwords. Use environment variables or secure storage.
# Set SUPABASE_DB_PASSWORD environment variable before running this script.

set -e

PROJECT_REF="hrzxbonjpffluuiwpzwe"

# Get password from environment variable or prompt
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo "⚠️  SUPABASE_DB_PASSWORD environment variable not set."
    echo "Please set it before running this script:"
    echo "  export SUPABASE_DB_PASSWORD='your-password'"
    exit 1
fi

# URL encode the password
PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SUPABASE_DB_PASSWORD'))" 2>/dev/null || \
    node -e "console.log(encodeURIComponent('$SUPABASE_DB_PASSWORD'))" 2>/dev/null || \
    echo "$SUPABASE_DB_PASSWORD" | sed 's/@/%40/g; s/\./%2E/g')

echo "🔗 Supabase Connection String Generator"
echo "========================================"
echo ""
echo "Project: holdwall-production"
echo "Project Ref: $PROJECT_REF"
echo ""

# Try to determine region from Supabase URL
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
echo "Supabase URL: $SUPABASE_URL"
echo ""

# Common connection string formats
echo "Connection String Options:"
echo ""

# Option 1: Direct connection (if accessible)
echo "1. Direct Connection:"
DIRECT_URL="postgresql://postgres:${PASSWORD_ENCODED}@db.${PROJECT_REF}.supabase.co:5432/postgres"
echo "   $DIRECT_URL"
echo ""

# Option 2: Pooler (need region - trying common ones)
echo "2. Pooler Connection (Session Mode) - Try these regions:"
REGIONS=("us-east-1" "us-west-1" "eu-west-1" "ap-southeast-1" "eu-central-1" "ap-northeast-1")

for REGION in "${REGIONS[@]}"; do
    POOLER_URL="postgresql://postgres.${PROJECT_REF}:${PASSWORD_ENCODED}@aws-0-${REGION}.pooler.supabase.com:5432/postgres"
    echo "   Region $REGION:"
    echo "   $POOLER_URL"
    echo ""
done

echo "📋 To get the EXACT connection string:"
echo "1. Visit: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo "2. Scroll to 'Connection string'"
echo "3. Select 'URI' tab"
echo "4. Choose 'Session mode'"
echo "5. Copy the connection string"
echo ""
echo "Then run:"
echo "   npm run deploy:complete 'your-connection-string'"
