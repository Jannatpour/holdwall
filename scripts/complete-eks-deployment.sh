#!/bin/bash
# Complete EKS Deployment - Full Automation
# This script handles the entire deployment process

set -e

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
CLUSTER_NAME=${3:-holdwall-cluster}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Add local bin to PATH
export PATH="$HOME/.local/bin:$PATH"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Complete EKS Deployment - Full Automation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Install eksctl if needed
if ! command -v eksctl &> /dev/null; then
    echo -e "${YELLOW}Installing eksctl...${NC}"
    mkdir -p ~/.local/bin
    curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Darwin_amd64.tar.gz" | tar xz -C /tmp
    mv /tmp/eksctl ~/.local/bin/eksctl
    chmod +x ~/.local/bin/eksctl
    echo -e "${GREEN}✓ eksctl installed${NC}"
fi

# Step 2: Check/create cluster
echo -e "${YELLOW}Checking for EKS cluster...${NC}"
if aws eks describe-cluster --name $CLUSTER_NAME --region $REGION &> /dev/null; then
    CLUSTER_STATUS=$(aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --query 'cluster.status' --output text)
    echo -e "${GREEN}✓ Cluster exists (Status: $CLUSTER_STATUS)${NC}"
    
    if [ "$CLUSTER_STATUS" != "ACTIVE" ]; then
        echo -e "${YELLOW}⏳ Waiting for cluster to be ACTIVE...${NC}"
        aws eks wait cluster-active --name $CLUSTER_NAME --region $REGION
        echo -e "${GREEN}✓ Cluster is ACTIVE${NC}"
    fi
else
    echo -e "${YELLOW}Creating EKS cluster (this takes 15-20 minutes)...${NC}"
    eksctl create cluster \
        --name $CLUSTER_NAME \
        --region $REGION \
        --nodegroup-name standard-workers \
        --node-type t3.medium \
        --nodes 2 \
        --nodes-min 1 \
        --nodes-max 4 \
        --managed \
        --with-oidc
    
    echo -e "${GREEN}✓ Cluster created${NC}"
fi

# Step 3: Configure kubectl
echo -e "${YELLOW}Configuring kubectl...${NC}"
aws eks update-kubeconfig --name $CLUSTER_NAME --region $REGION
kubectl get nodes
echo -e "${GREEN}✓ kubectl configured${NC}"

# Step 4: Create namespace
echo -e "${YELLOW}Creating namespace...${NC}"
kubectl create namespace holdwall --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Namespace ready${NC}"

# Step 5: Get secrets from Vercel
echo -e "${YELLOW}Getting secrets from Vercel...${NC}"
if command -v vc &> /dev/null; then
    vc env pull .env.production --environment production 2>/dev/null || true
    if [ -f .env.production ]; then
        source .env.production
        echo -e "${GREEN}✓ Environment variables loaded${NC}"
    fi
fi

# Step 6: Create Kubernetes secrets
echo -e "${YELLOW}Creating Kubernetes secrets...${NC}"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not found${NC}"
    echo "Please set DATABASE_URL environment variable or pull from Vercel"
    exit 1
fi

# Check if secret exists
if kubectl get secret holdwall-secrets -n holdwall &> /dev/null; then
    echo -e "${GREEN}✓ Secrets already exist${NC}"
else
    kubectl create secret generic holdwall-secrets \
        --from-literal=DATABASE_URL="${DATABASE_URL}" \
        --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}" \
        --from-literal=NEXTAUTH_URL="${NEXTAUTH_URL:-https://holdwall.com}" \
        --from-literal=VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-}" \
        --from-literal=VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY:-}" \
        -n holdwall --dry-run=client -o yaml | kubectl apply -f -
    echo -e "${GREEN}✓ Secrets created${NC}"
fi

# Step 7: Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
export DOCKER_BUILD=true
docker build -t holdwall-app:latest . || {
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Docker image built${NC}"

# Step 8: Push to ECR
echo -e "${YELLOW}Pushing to ECR...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/holdwall-pos"

# Create ECR repository
aws ecr create-repository --repository-name holdwall-pos --region $REGION 2>/dev/null || echo "Repository exists"

# Login
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

# Tag and push
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
docker tag holdwall-app:latest $ECR_REPO:latest
docker tag holdwall-app:latest $ECR_REPO:$IMAGE_TAG
docker push $ECR_REPO:latest
docker push $ECR_REPO:$IMAGE_TAG
echo -e "${GREEN}✓ Image pushed to ECR${NC}"

# Step 9: Update Kubernetes manifests
echo -e "${YELLOW}Updating Kubernetes manifests...${NC}"
if [ -d k8s ]; then
    find k8s -name "*.yaml" -type f -exec sed -i.bak "s|holdwall-app:latest|$ECR_REPO:$IMAGE_TAG|g" {} \; 2>/dev/null || true
    find k8s -name "*.bak" -delete 2>/dev/null || true
    echo -e "${GREEN}✓ Manifests updated${NC}"
else
    echo -e "${RED}❌ k8s directory not found${NC}"
    exit 1
fi

# Step 10: Deploy to Kubernetes
echo -e "${YELLOW}Deploying to Kubernetes...${NC}"
kubectl apply -k k8s/
echo -e "${GREEN}✓ Manifests applied${NC}"

# Step 11: Wait for deployment
echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/holdwall-app -n holdwall --timeout=10m || echo "Deployment in progress..."

# Step 12: Show status
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📊 Deployment Status:"
kubectl get pods -n holdwall
echo ""
echo "🌐 Services:"
kubectl get svc -n holdwall
echo ""
echo "🔗 Ingress:"
kubectl get ingress -n holdwall
echo ""
echo "📝 Next Steps:"
echo "1. Get Load Balancer URL: kubectl get ingress -n holdwall"
echo "2. Configure DNS to point to Load Balancer"
echo "3. Monitor: kubectl logs -n holdwall -l app=holdwall -f"
echo ""
