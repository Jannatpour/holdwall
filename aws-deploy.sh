#!/bin/bash
# AWS Deployment Script for Holdwall POS
# Supports ECS, EKS, and Elastic Beanstalk deployments

set -e

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
DEPLOYMENT_TYPE=${3:-ecs}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Holdwall POS to AWS${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Deployment Type: ${YELLOW}$DEPLOYMENT_TYPE${NC}"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    echo "Install: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"
echo ""

case $DEPLOYMENT_TYPE in
    ecs)
        echo -e "${YELLOW}📦 Deploying to ECS...${NC}"
        echo ""
        
        # Check Docker
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
            exit 1
        fi
        
        # Build Docker image
        echo -e "${YELLOW}Building Docker image...${NC}"
        docker build -t holdwall-pos:latest .
        echo -e "${GREEN}✓ Docker image built${NC}"
        
        ECR_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/holdwall-pos"
        
        # Create ECR repository if it doesn't exist
        if ! aws ecr describe-repositories --repository-names holdwall-pos --region $REGION &> /dev/null; then
            echo -e "${YELLOW}Creating ECR repository...${NC}"
            aws ecr create-repository --repository-name holdwall-pos --region $REGION
            echo -e "${GREEN}✓ ECR repository created${NC}"
        else
            echo -e "${GREEN}✓ ECR repository exists${NC}"
        fi
        
        # Login to ECR
        echo -e "${YELLOW}Logging into ECR...${NC}"
        aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO
        echo -e "${GREEN}✓ Logged into ECR${NC}"
        
        # Tag and push image
        IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
        echo -e "${YELLOW}Tagging and pushing image...${NC}"
        docker tag holdwall-pos:latest $ECR_REPO:latest
        docker tag holdwall-pos:latest $ECR_REPO:$IMAGE_TAG
        docker push $ECR_REPO:latest
        docker push $ECR_REPO:$IMAGE_TAG
        echo -e "${GREEN}✓ Image pushed to ECR${NC}"
        
        # Update task definition
        echo -e "${YELLOW}Updating ECS task definition...${NC}"
        TASK_DEF_FILE="aws-task-definition.json"
        if [ -f "$TASK_DEF_FILE" ]; then
            # Replace placeholders in task definition
            sed -i.bak "s/ACCOUNT_ID/$ACCOUNT_ID/g" $TASK_DEF_FILE
            sed -i.bak "s/REGION/$REGION/g" $TASK_DEF_FILE
            sed -i.bak "s|:latest|:$IMAGE_TAG|g" $TASK_DEF_FILE
            
            # Register task definition
            aws ecs register-task-definition \
                --cli-input-json file://$TASK_DEF_FILE \
                --region $REGION > /dev/null
            
            # Restore original file
            mv $TASK_DEF_FILE.bak $TASK_DEF_FILE
            
            echo -e "${GREEN}✓ Task definition registered${NC}"
        else
            echo -e "${YELLOW}⚠️  Task definition file not found. Create it manually.${NC}"
        fi
        
        echo ""
        echo -e "${GREEN}✅ ECS deployment prepared!${NC}"
        echo ""
        echo "📝 Next steps:"
        echo "1. Create/update ECS service:"
        echo "   aws ecs create-service \\"
        echo "     --cluster your-cluster-name \\"
        echo "     --service-name holdwall-pos \\"
        echo "     --task-definition holdwall-pos \\"
        echo "     --desired-count 2 \\"
        echo "     --launch-type FARGATE \\"
        echo "     --network-configuration \"awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}\" \\"
        echo "     --region $REGION"
        echo ""
        echo "2. Or use AWS Console to create the service"
        echo "3. Ensure secrets are configured in AWS Secrets Manager"
        ;;
        
    eks)
        echo -e "${YELLOW}☸️  Deploying to EKS...${NC}"
        echo ""
        
        # Check kubectl
        if ! command -v kubectl &> /dev/null; then
            echo -e "${RED}❌ kubectl not found. Please install it first.${NC}"
            exit 1
        fi
        
        # Check if kubectl is configured
        if ! kubectl cluster-info &> /dev/null; then
            echo -e "${RED}❌ kubectl not configured. Configure it first.${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ kubectl configured${NC}"
        
        # Create namespace if it doesn't exist
        if ! kubectl get namespace holdwall &> /dev/null; then
            echo -e "${YELLOW}Creating namespace...${NC}"
            kubectl create namespace holdwall
            echo -e "${GREEN}✓ Namespace created${NC}"
        fi
        
        # Apply Kubernetes manifests
        echo -e "${YELLOW}Applying Kubernetes manifests...${NC}"
        kubectl apply -k k8s/
        echo -e "${GREEN}✓ Manifests applied${NC}"
        
        # Wait for deployment
        echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
        kubectl rollout status deployment/holdwall-app -n holdwall --timeout=5m
        
        echo ""
        echo -e "${GREEN}✅ EKS deployment complete!${NC}"
        echo ""
        echo "📝 Get service URL:"
        echo "   kubectl get ingress -n holdwall"
        ;;
        
    beanstalk)
        echo -e "${YELLOW}🌱 Deploying to Elastic Beanstalk...${NC}"
        echo ""
        
        # Check EB CLI
        if ! command -v eb &> /dev/null; then
            echo -e "${RED}❌ Elastic Beanstalk CLI not found.${NC}"
            echo "Install with: pip install awsebcli"
            exit 1
        fi
        
        # Initialize if needed
        if [ ! -f .elasticbeanstalk/config.yml ]; then
            echo -e "${YELLOW}Initializing Elastic Beanstalk...${NC}"
            eb init holdwall-pos --platform node.js --region $REGION
            echo -e "${GREEN}✓ Elastic Beanstalk initialized${NC}"
        fi
        
        # Create environment if it doesn't exist
        if ! eb list | grep -q "$ENVIRONMENT"; then
            echo -e "${YELLOW}Creating Elastic Beanstalk environment...${NC}"
            eb create $ENVIRONMENT
            echo -e "${GREEN}✓ Environment created${NC}"
        fi
        
        # Deploy
        echo -e "${YELLOW}Deploying application...${NC}"
        eb deploy $ENVIRONMENT
        
        echo ""
        echo -e "${GREEN}✅ Elastic Beanstalk deployment complete!${NC}"
        echo ""
        echo "📝 Get application URL:"
        echo "   eb status"
        ;;
        
    *)
        echo -e "${RED}❌ Unknown deployment type: $DEPLOYMENT_TYPE${NC}"
        echo "Supported types: ecs, eks, beanstalk"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ AWS deployment initiated!${NC}"
echo "📚 See DEPLOYMENT_COMPLETE.md for post-deployment steps"
