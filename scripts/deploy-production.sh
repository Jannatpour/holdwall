#!/bin/bash
# Complete Production Deployment Automation Script
# Handles database setup, migrations, and redeployment end-to-end

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Holdwall POS - Production Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check Vercel CLI
if ! command -v vc &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found${NC}"
    echo "Install: npm i -g vercel"
    exit 1
fi
echo -e "${GREEN}✓ Vercel CLI detected${NC}"

# Step 2: Check current DATABASE_URL in Vercel
echo ""
echo -e "${YELLOW}Checking current DATABASE_URL in Vercel...${NC}"
CURRENT_DB=$(vc env ls 2>/dev/null | grep "DATABASE_URL" | head -1 || echo "")

if [ ! -z "$CURRENT_DB" ]; then
    # Check if it's localhost (needs update)
    if echo "$CURRENT_DB" | grep -q "localhost\|127.0.0.1"; then
        echo -e "${YELLOW}⚠️  DATABASE_URL is set to localhost (development)${NC}"
        echo -e "${YELLOW}   This needs to be updated to a production database${NC}"
        NEEDS_DB=true
    else
        echo -e "${GREEN}✓ DATABASE_URL appears to be a production URL${NC}"
        NEEDS_DB=false
    fi
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not found in Vercel environment variables${NC}"
    NEEDS_DB=true
fi

# Step 3: Handle database setup if needed
if [ "$NEEDS_DB" = true ]; then
    echo ""
    echo -e "${YELLOW}📦 Production Database Setup Required${NC}"
    echo ""
    echo "To set up a production database:"
    echo ""
    echo "Option 1: Vercel Postgres (Recommended)"
    echo "  1. Visit: https://vercel.com/dashboard"
    echo "  2. Select project: holdwall"
    echo "  3. Go to Storage tab"
    echo "  4. Click 'Create Database' > 'Postgres'"
    echo "  5. Copy the DATABASE_URL"
    echo ""
    echo "Option 2: External PostgreSQL"
    echo "  - Supabase: https://supabase.com"
    echo "  - Neon: https://neon.tech"
    echo "  - AWS RDS, Railway, Render, etc."
    echo ""
    
    read -p "Do you have a DATABASE_URL ready? (y/n): " HAS_DB
    if [ "$HAS_DB" = "y" ] || [ "$HAS_DB" = "Y" ]; then
        read -p "Enter DATABASE_URL: " NEW_DATABASE_URL
        
        if [ ! -z "$NEW_DATABASE_URL" ]; then
            echo ""
            echo -e "${YELLOW}Updating DATABASE_URL in Vercel...${NC}"
            echo 'y' | vc env rm DATABASE_URL production 2>/dev/null || true
            echo "$NEW_DATABASE_URL" | vc env add DATABASE_URL production
            echo -e "${GREEN}✓ DATABASE_URL updated${NC}"
            
            # Test connection
            echo ""
            echo -e "${YELLOW}Testing database connection...${NC}"
            export DATABASE_URL="$NEW_DATABASE_URL"
            
            if npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Database connection successful${NC}"
                
                # Run migrations
                echo ""
                echo -e "${YELLOW}Running database migrations...${NC}"
                npx prisma migrate deploy
                echo -e "${GREEN}✓ Migrations completed${NC}"
            else
                echo -e "${RED}❌ Database connection failed${NC}"
                echo "Please verify the DATABASE_URL and try again"
                exit 1
            fi
        fi
    else
        echo ""
        echo -e "${YELLOW}⚠️  Skipping database setup${NC}"
        echo "You can set it up later using: ./scripts/setup-production-database.sh"
        SKIP_DEPLOY=true
    fi
else
    # DATABASE_URL exists and looks like production
    echo ""
    echo -e "${YELLOW}Pulling DATABASE_URL from Vercel...${NC}"
    
    # Try to pull environment variables
    if vc env pull .env.production.local 2>/dev/null; then
        source .env.production.local
        if [ ! -z "$DATABASE_URL" ]; then
            echo -e "${GREEN}✓ DATABASE_URL retrieved${NC}"
            
            # Test connection
            echo ""
            echo -e "${YELLOW}Testing database connection...${NC}"
            if npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Database connection successful${NC}"
                
                # Check if migrations are needed
                echo ""
                echo -e "${YELLOW}Checking migration status...${NC}"
                MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || echo "unknown")
                
                if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
                    echo -e "${GREEN}✓ Database migrations are up to date${NC}"
                else
                    echo -e "${YELLOW}Running database migrations...${NC}"
                    npx prisma migrate deploy
                    echo -e "${GREEN}✓ Migrations completed${NC}"
                fi
            else
                echo -e "${RED}❌ Database connection failed${NC}"
                echo "Please verify DATABASE_URL in Vercel dashboard"
                SKIP_DEPLOY=true
            fi
        else
            echo -e "${YELLOW}⚠️  Could not retrieve DATABASE_URL${NC}"
            SKIP_DEPLOY=true
        fi
    else
        echo -e "${YELLOW}⚠️  Could not pull environment variables${NC}"
        echo "Continuing with deployment (database will be checked at runtime)"
    fi
fi

# Step 4: Verify build
echo ""
echo -e "${YELLOW}Verifying build...${NC}"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    echo "Please fix build errors before deploying"
    exit 1
fi

# Step 5: Deploy to Vercel
if [ "$SKIP_DEPLOY" != true ]; then
    echo ""
    echo -e "${YELLOW}Deploying to Vercel production...${NC}"
    vc --prod
    
    echo ""
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify deployment:"
    echo "   curl https://holdwall-jannatpours-projects.vercel.app/api/health"
    echo ""
    echo "2. Test authentication:"
    echo "   https://holdwall-jannatpours-projects.vercel.app/auth/signin"
    echo ""
    echo "3. View logs:"
    echo "   vc logs"
else
    echo ""
    echo -e "${YELLOW}⚠️  Deployment skipped (database setup incomplete)${NC}"
    echo ""
    echo "To complete deployment:"
    echo "1. Set up production database: ./scripts/setup-production-database.sh"
    echo "2. Run migrations: ./scripts/run-production-migrations.sh"
    echo "3. Deploy: vc --prod"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
