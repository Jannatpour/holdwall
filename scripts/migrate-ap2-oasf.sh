#!/bin/bash
# Database Migration Script for AP2 and OASF
# Run this script to apply database migrations for AP2 payment protocol and OASF agent profiles

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AP2 & OASF Database Migration${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    echo "Please set DATABASE_URL environment variable"
    exit 1
fi

# Check if Prisma is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Generating Prisma Client...${NC}"
npx prisma generate

echo -e "${YELLOW}Step 2: Creating migration...${NC}"
npx prisma migrate dev --name add_ap2_models_and_oasf --create-only

echo -e "${YELLOW}Step 3: Applying migration...${NC}"
npx prisma migrate deploy

echo -e "${YELLOW}Step 4: Verifying migration...${NC}"
npx prisma db pull --force

echo ""
echo -e "${GREEN}✓ Migration completed successfully!${NC}"
echo ""
echo "New models added:"
echo "  - PaymentMandate"
echo "  - PaymentSignature"
echo "  - WalletLedgerEntry"
echo "  - WalletLimit"
echo "  - PaymentAuditLog"
echo ""
echo "Updated models:"
echo "  - AgentRegistry (OASF profile support in metadata)"
