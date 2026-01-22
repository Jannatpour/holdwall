#!/bin/bash
# Complete Production Setup - Database, Migrations, and Deployment
# End-to-end automation for production deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Holdwall POS - Complete Production Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v vc &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Vercel CLI detected${NC}"

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Node.js/npx not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js detected${NC}"

# Step 2: Check current DATABASE_URL
echo ""
echo -e "${YELLOW}Checking current DATABASE_URL...${NC}"
vc env pull .env.production.check --environment production 2>/dev/null || true

if [ -f .env.production.check ]; then
    source .env.production.check
    if [ ! -z "$DATABASE_URL" ] && ! echo "$DATABASE_URL" | grep -q "localhost\|127.0.0.1"; then
        echo -e "${GREEN}✓ Production DATABASE_URL detected${NC}"
        USE_EXISTING=true
    else
        echo -e "${YELLOW}⚠️  DATABASE_URL is localhost or not set${NC}"
        USE_EXISTING=false
    fi
    rm -f .env.production.check
else
    USE_EXISTING=false
fi

# Step 3: Database setup
# Check if DATABASE_URL is provided as environment variable or argument
if [ ! -z "$1" ]; then
    NEW_DATABASE_URL="$1"
    echo ""
    echo -e "${GREEN}✓ DATABASE_URL provided as argument${NC}"
elif [ ! -z "$DATABASE_URL" ] && ! echo "$DATABASE_URL" | grep -q "localhost\|127.0.0.1"; then
    NEW_DATABASE_URL="$DATABASE_URL"
    echo ""
    echo -e "${GREEN}✓ DATABASE_URL found in environment${NC}"
elif [ "$USE_EXISTING" = false ]; then
    echo ""
    echo -e "${YELLOW}📦 Production Database Setup Required${NC}"
    echo ""
    echo "You need a production PostgreSQL database. Options:"
    echo ""
    echo "1. Vercel Postgres (Recommended)"
    echo "   - Go to: https://vercel.com/dashboard"
    echo "   - Select project: holdwall"
    echo "   - Storage tab > Create Database > Postgres"
    echo "   - Copy the DATABASE_URL"
    echo ""
    echo "2. External Providers:"
    echo "   - Supabase: https://supabase.com (Free tier available)"
    echo "   - Neon: https://neon.tech (Serverless, free tier)"
    echo "   - Railway: https://railway.app"
    echo "   - Render: https://render.com"
    echo "   - AWS RDS, etc."
    echo ""
    echo "Or provide DATABASE_URL as:"
    echo "  export DATABASE_URL='postgresql://...' && npm run deploy:complete"
    echo "  OR"
    echo "  npm run deploy:complete 'postgresql://...'"
    echo ""
    
    read -p "Do you have a production DATABASE_URL ready? (y/n): " HAS_DB
    
    if [ "$HAS_DB" != "y" ] && [ "$HAS_DB" != "Y" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Database setup skipped${NC}"
        echo ""
        echo "To complete setup later:"
        echo "1. Create a production database"
        echo "2. Run: npm run db:setup:production"
        echo "3. Run: npm run db:migrate:production"
        echo "4. Run: npm run deploy:vercel"
        exit 0
    fi
    
    read -p "Enter production DATABASE_URL: " NEW_DATABASE_URL
    
    if [ -z "$NEW_DATABASE_URL" ]; then
        echo -e "${RED}❌ DATABASE_URL is required${NC}"
        exit 1
    fi
else
    NEW_DATABASE_URL=""
fi

# Update DATABASE_URL if provided
if [ ! -z "$NEW_DATABASE_URL" ]; then
    
    # Update DATABASE_URL in Vercel
    echo ""
    echo -e "${YELLOW}Updating DATABASE_URL in Vercel...${NC}"
    echo 'y' | vc env rm DATABASE_URL production 2>/dev/null || true
    echo "$NEW_DATABASE_URL" | vc env add DATABASE_URL production
    echo -e "${GREEN}✓ DATABASE_URL updated in Vercel${NC}"
    
    export DATABASE_URL="$NEW_DATABASE_URL"
elif [ "$USE_EXISTING" = true ]; then
    echo ""
    echo -e "${YELLOW}Pulling DATABASE_URL from Vercel...${NC}"
    vc env pull .env.production.temp --environment production 2>/dev/null || true
    if [ -f .env.production.temp ]; then
        source .env.production.temp
        rm -f .env.production.temp
    fi
else
    echo -e "${RED}❌ DATABASE_URL not available${NC}"
    exit 1
fi

# Step 4: Test database connection
if [ ! -z "$DATABASE_URL" ]; then
    echo ""
    echo -e "${YELLOW}Testing database connection...${NC}"
    
    if npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        echo ""
        echo "Please verify:"
        echo "1. DATABASE_URL is correct"
        echo "2. Database server is accessible from your network"
        echo "3. Firewall/security groups allow connections"
        exit 1
    fi
else
    echo -e "${RED}❌ DATABASE_URL not set${NC}"
    exit 1
fi

# Step 5: Run migrations
echo ""
echo -e "${YELLOW}Running database migrations...${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✓ Migrations completed${NC}"

# Step 6: Verify schema
echo ""
echo -e "${YELLOW}Verifying database schema...${NC}"
TABLE_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "0")
if [ ! -z "$TABLE_COUNT" ] && [ "$TABLE_COUNT" != "0" ]; then
    echo -e "${GREEN}✓ Database schema verified ($TABLE_COUNT tables)${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify table count, but migrations completed${NC}"
fi

# Step 7: Verify build
echo ""
echo -e "${YELLOW}Verifying build...${NC}"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Step 8: Deploy to Vercel
echo ""
echo -e "${YELLOW}Deploying to Vercel production...${NC}"
vc --prod

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Production Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your application is now live at:"
echo "  - https://holdwall.com (after domain configuration)"
echo "  - https://holdwall-jannatpours-projects.vercel.app"
echo ""
echo "Next steps:"
echo "1. Configure domain in Vercel Dashboard:"
echo "   https://vercel.com/dashboard → holdwall → Settings → Domains"
echo ""
echo "2. Test your application:"
echo "   curl https://holdwall.com/api/health"
echo "   Visit: https://holdwall.com/auth/signin"
echo ""
echo "3. Optional - Seed initial data:"
echo "   npm run db:seed"
echo ""
