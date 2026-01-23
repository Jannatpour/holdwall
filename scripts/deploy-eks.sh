#!/bin/bash
# EKS Deployment Script for Holdwall POS
# Automated EKS cluster creation and deployment

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

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Holdwall POS - EKS Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Cluster: ${YELLOW}$CLUSTER_NAME${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI installed${NC}"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS credentials configured (Account: $ACCOUNT_ID)${NC}"

# Check eksctl
if ! command -v eksctl &> /dev/null; then
    echo -e "${YELLOW}⚠️  eksctl not found. Installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew tap weaveworks/tap
        brew install weaveworks/tap/eksctl
    else
        echo "Please install eksctl: https://eksctl.io/"
        exit 1
    fi
fi
echo -e "${GREEN}✓ eksctl installed${NC}"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}⚠️  kubectl not found. Installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install kubectl
    else
        echo "Please install kubectl: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
fi
echo -e "${GREEN}✓ kubectl installed${NC}"

echo ""

# Step 2: Check if cluster exists
echo -e "${YELLOW}Step 2: Checking for existing cluster...${NC}"
if aws eks describe-cluster --name $CLUSTER_NAME --region $REGION &> /dev/null; then
    echo -e "${GREEN}✓ Cluster '$CLUSTER_NAME' exists${NC}"
    CLUSTER_EXISTS=true
else
    echo -e "${YELLOW}⚠️  Cluster '$CLUSTER_NAME' does not exist${NC}"
    CLUSTER_EXISTS=false
fi
echo ""

# Step 3: Create cluster if needed
if [ "$CLUSTER_EXISTS" = false ]; then
    echo -e "${YELLOW}Step 3: Creating EKS cluster...${NC}"
    echo -e "${YELLOW}This will take 15-20 minutes...${NC}"
    echo ""
    
    eksctl create cluster \
        --name $CLUSTER_NAME \
        --region $REGION \
        --nodegroup-name standard-workers \
        --node-type t3.medium \
        --nodes 2 \
        --nodes-min 1 \
        --nodes-max 4 \
        --managed \
        --with-oidc \
        --ssh-access
    
    echo -e "${GREEN}✓ Cluster created${NC}"
else
    echo -e "${YELLOW}Step 3: Using existing cluster${NC}"
fi
echo ""

# Step 4: Configure kubectl
echo -e "${YELLOW}Step 4: Configuring kubectl...${NC}"
aws eks update-kubeconfig --name $CLUSTER_NAME --region $REGION
echo -e "${GREEN}✓ kubectl configured${NC}"
echo ""

# Step 5: Verify cluster access
echo -e "${YELLOW}Step 5: Verifying cluster access...${NC}"
if kubectl cluster-info &> /dev/null; then
    echo -e "${GREEN}✓ Cluster access verified${NC}"
    kubectl get nodes
else
    echo -e "${RED}❌ Cannot access cluster${NC}"
    exit 1
fi
echo ""

# Step 6: Create namespace
echo -e "${YELLOW}Step 6: Creating namespace...${NC}"
if ! kubectl get namespace holdwall &> /dev/null; then
    kubectl create namespace holdwall
    echo -e "${GREEN}✓ Namespace created${NC}"
else
    echo -e "${GREEN}✓ Namespace exists${NC}"
fi
echo ""

# Step 7: Check for secrets
echo -e "${YELLOW}Step 7: Checking secrets...${NC}"
if kubectl get secret holdwall-secrets -n holdwall &> /dev/null; then
    echo -e "${GREEN}✓ Secrets exist${NC}"
else
    echo -e "${YELLOW}⚠️  Secrets not found${NC}"
    echo ""
    echo "Please create secrets:"
    echo ""
    echo "kubectl create secret generic holdwall-secrets \\"
    echo "  --from-literal=DATABASE_URL=\"postgresql://...\" \\"
    echo "  --from-literal=NEXTAUTH_SECRET=\"...\" \\"
    echo "  --from-literal=NEXTAUTH_URL=\"https://holdwall.com\" \\"
    echo "  --from-literal=VAPID_PUBLIC_KEY=\"...\" \\"
    echo "  --from-literal=VAPID_PRIVATE_KEY=\"...\" \\"
    echo "  -n holdwall"
    echo ""
    read -p "Do you want to create secrets now? (y/n): " CREATE_SECRETS
    if [ "$CREATE_SECRETS" = "y" ] || [ "$CREATE_SECRETS" = "Y" ]; then
        echo "Enter DATABASE_URL:"
        read DATABASE_URL
        echo "Enter NEXTAUTH_SECRET:"
        read NEXTAUTH_SECRET
        echo "Enter VAPID_PUBLIC_KEY:"
        read VAPID_PUBLIC_KEY
        echo "Enter VAPID_PRIVATE_KEY:"
        read VAPID_PRIVATE_KEY
        
        kubectl create secret generic holdwall-secrets \
            --from-literal=DATABASE_URL="$DATABASE_URL" \
            --from-literal=NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
            --from-literal=NEXTAUTH_URL="https://holdwall.com" \
            --from-literal=VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY" \
            --from-literal=VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY" \
            -n holdwall
        
        echo -e "${GREEN}✓ Secrets created${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipping secrets creation. Please create them manually before deploying.${NC}"
    fi
fi
echo ""

# Step 8: Build and push Docker image
echo -e "${YELLOW}Step 8: Building Docker image...${NC}"
if [ ! -f Dockerfile ]; then
    echo -e "${RED}❌ Dockerfile not found${NC}"
    exit 1
fi

# Set Docker build flag
export DOCKER_BUILD=true

# Build image
docker build -t holdwall-app:latest .
echo -e "${GREEN}✓ Docker image built${NC}"

# Get ECR repository
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/holdwall-pos"

# Create ECR repository if needed
if ! aws ecr describe-repositories --repository-names holdwall-pos --region $REGION &> /dev/null; then
    echo -e "${YELLOW}Creating ECR repository...${NC}"
    aws ecr create-repository --repository-name holdwall-pos --region $REGION
    echo -e "${GREEN}✓ ECR repository created${NC}"
fi

# Login to ECR
echo -e "${YELLOW}Logging into ECR...${NC}"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

# Tag and push
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker tag holdwall-app:latest $ECR_REPO:latest
docker tag holdwall-app:latest $ECR_REPO:$IMAGE_TAG
docker push $ECR_REPO:latest
docker push $ECR_REPO:$IMAGE_TAG
echo -e "${GREEN}✓ Image pushed to ECR${NC}"
echo ""

# Step 9: Update Kubernetes manifests with image
echo -e "${YELLOW}Step 9: Updating Kubernetes manifests...${NC}"
if [ -d k8s ]; then
    # Update image references in manifests
    find k8s -name "*.yaml" -type f -exec sed -i.bak "s|holdwall-app:latest|$ECR_REPO:$IMAGE_TAG|g" {} \;
    find k8s -name "*.bak" -delete
    echo -e "${GREEN}✓ Manifests updated${NC}"
else
    echo -e "${RED}❌ k8s directory not found${NC}"
    exit 1
fi
echo ""

# Step 10: Deploy to Kubernetes
echo -e "${YELLOW}Step 10: Deploying to Kubernetes...${NC}"
kubectl apply -k k8s/
echo -e "${GREEN}✓ Manifests applied${NC}"
echo ""

# Step 11: Wait for deployment
echo -e "${YELLOW}Step 11: Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/holdwall-app -n holdwall --timeout=10m
echo -e "${GREEN}✓ Deployment ready${NC}"
echo ""

# Step 12: Get service information
echo -e "${YELLOW}Step 12: Getting service information...${NC}"
echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "📊 Deployment Status:"
kubectl get pods -n holdwall
echo ""
echo "🌐 Service Information:"
kubectl get svc -n holdwall
echo ""
echo "🔗 Ingress Information:"
kubectl get ingress -n holdwall
echo ""
echo "📝 Next Steps:"
echo "1. Configure DNS to point to the Load Balancer"
echo "2. Verify application: kubectl port-forward -n holdwall svc/holdwall-app 3000:3000"
echo "3. Check logs: kubectl logs -n holdwall -l app=holdwall"
echo ""
