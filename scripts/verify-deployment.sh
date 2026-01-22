#!/bin/bash
# Deployment Verification Script
# Verifies all aspects of the production deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Holdwall POS - Deployment Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Vercel CLI
if ! command -v vc &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Vercel CLI detected${NC}"

# Check environment variables
echo ""
echo -e "${YELLOW}Checking environment variables...${NC}"
ENV_VARS=$(vc env ls 2>/dev/null)

REQUIRED_VARS=("DATABASE_URL" "NEXTAUTH_URL" "NEXTAUTH_SECRET" "VAPID_PUBLIC_KEY" "VAPID_PRIVATE_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if echo "$ENV_VARS" | grep -q "$var"; then
        echo -e "${GREEN}✓ $var${NC}"
    else
        echo -e "${RED}❌ $var missing${NC}"
        MISSING_VARS+=("$var")
    fi
done

# Check DATABASE_URL specifically
DB_URL=$(echo "$ENV_VARS" | grep "DATABASE_URL" || echo "")
if [ ! -z "$DB_URL" ]; then
    if echo "$DB_URL" | grep -q "localhost\|127.0.0.1"; then
        echo -e "${YELLOW}⚠️  DATABASE_URL is set to localhost (needs production database)${NC}"
    else
        echo -e "${GREEN}✓ DATABASE_URL appears to be production${NC}"
    fi
fi

# Check build
echo ""
echo -e "${YELLOW}Verifying build...${NC}"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Check deployment status
echo ""
echo -e "${YELLOW}Checking deployment status...${NC}"
DEPLOYMENTS=$(vc ls 2>/dev/null | head -5 || echo "")
if [ ! -z "$DEPLOYMENTS" ]; then
    echo -e "${GREEN}✓ Deployments found${NC}"
    echo "$DEPLOYMENTS"
else
    echo -e "${YELLOW}⚠️  No deployments found${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All required environment variables are set${NC}"
else
    echo -e "${YELLOW}⚠️  Missing environment variables: ${MISSING_VARS[*]}${NC}"
fi
echo -e "${BLUE}========================================${NC}"
