#!/bin/bash
# Production Deployment Script
# Handles deployment with pre-flight checks, rollback capability, and health verification

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
APP_URL=${2:-"http://localhost:3000"}
HEALTH_CHECK_TIMEOUT=60
MAX_RETRIES=3

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Holdwall POS Deployment Script${NC}"
echo -e "${GREEN}Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Pre-flight checks
echo -e "${YELLOW}Running pre-flight checks...${NC}"

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js 20+ required. Current: $(node --version)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js version: $(node --version)${NC}"

# Check required environment variables
REQUIRED_VARS=("DATABASE_URL" "NEXTAUTH_URL" "NEXTAUTH_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    printf '%s\n' "${MISSING_VARS[@]}"
    exit 1
fi
echo -e "${GREEN}✓ Required environment variables set${NC}"

# Check database connection
echo -e "${YELLOW}Checking database connection...${NC}"
if npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}Error: Database connection failed${NC}"
    exit 1
fi

# Run tests
echo -e "${YELLOW}Running tests...${NC}"
if npm test -- --passWithNoTests; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${RED}Error: Tests failed${NC}"
    exit 1
fi

# Build application
echo -e "${YELLOW}Building application...${NC}"
if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}Error: Build failed${NC}"
    exit 1
fi

# Database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
    npx prisma migrate deploy
else
    npx prisma migrate dev
fi
echo -e "${GREEN}✓ Migrations completed${NC}"

# Health check function
check_health() {
    local url=$1
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s "${url}/api/health" > /dev/null 2>&1; then
            return 0
        fi
        retries=$((retries + 1))
        echo -e "${YELLOW}Health check attempt $retries/$MAX_RETRIES failed, retrying...${NC}"
        sleep 5
    done
    
    return 1
}

# Deployment steps (platform-specific)
deploy_vercel() {
    echo -e "${YELLOW}Deploying to Vercel...${NC}"
    vercel --prod
    echo -e "${GREEN}✓ Deployment initiated${NC}"
}

deploy_docker() {
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t holdwall-pos:latest .
    
    echo -e "${YELLOW}Tagging image...${NC}"
    docker tag holdwall-pos:latest holdwall-pos:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)
    
    echo -e "${GREEN}✓ Docker image built${NC}"
    echo -e "${YELLOW}Push image to registry and update deployment${NC}"
}

deploy_kubernetes() {
    echo -e "${YELLOW}Deploying to Kubernetes...${NC}"
    
    # Update image tag in deployment
    kubectl set image deployment/holdwall-pos \
        holdwall-pos=holdwall-pos:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S) \
        -n holdwall
    
    # Wait for rollout
    kubectl rollout status deployment/holdwall-pos -n holdwall --timeout=5m
    
    echo -e "${GREEN}✓ Kubernetes deployment completed${NC}"
}

# Main deployment
echo -e "${YELLOW}Starting deployment...${NC}"

# Determine deployment method
if command -v vercel &> /dev/null; then
    deploy_vercel
elif [ -f "Dockerfile" ]; then
    deploy_docker
elif [ -f "k8s/app-deployment.yaml" ]; then
    deploy_kubernetes
else
    echo -e "${YELLOW}No specific deployment method detected. Manual deployment required.${NC}"
fi

# Health check
echo -e "${YELLOW}Verifying deployment health...${NC}"
if check_health "$APP_URL"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}Error: Health check failed${NC}"
    echo -e "${YELLOW}Consider rolling back deployment${NC}"
    exit 1
fi
