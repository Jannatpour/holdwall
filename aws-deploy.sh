#!/bin/bash
# AWS Deployment Script for Holdwall POS
# Supports ECS, EKS, and Elastic Beanstalk deployments

set -e

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
DEPLOYMENT_TYPE=${3:-ecs}

echo "🚀 Deploying Holdwall POS to AWS"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Deployment Type: $DEPLOYMENT_TYPE"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

case $DEPLOYMENT_TYPE in
    ecs)
        echo "📦 Deploying to ECS..."
        
        # Build Docker image
        echo "Building Docker image..."
        docker build -t holdwall-pos:latest .
        
        # Get AWS account ID
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        ECR_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/holdwall-pos"
        
        # Create ECR repository if it doesn't exist
        if ! aws ecr describe-repositories --repository-names holdwall-pos --region $REGION &> /dev/null; then
            echo "Creating ECR repository..."
            aws ecr create-repository --repository-name holdwall-pos --region $REGION
        fi
        
        # Login to ECR
        aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO
        
        # Tag and push image
        docker tag holdwall-pos:latest $ECR_REPO:latest
        docker tag holdwall-pos:latest $ECR_REPO:$(date +%Y%m%d-%H%M%S)
        docker push $ECR_REPO:latest
        docker push $ECR_REPO:$(date +%Y%m%d-%H%M%S)
        
        echo "✅ Image pushed to ECR: $ECR_REPO"
        echo "📝 Next steps:"
        echo "1. Create ECS task definition using the image: $ECR_REPO:latest"
        echo "2. Create ECS service with the task definition"
        echo "3. Configure environment variables in task definition"
        ;;
        
    eks)
        echo "☸️  Deploying to EKS..."
        
        # Check kubectl
        if ! command -v kubectl &> /dev/null; then
            echo "❌ kubectl not found. Please install it first."
            exit 1
        fi
        
        # Apply Kubernetes manifests
        echo "Applying Kubernetes manifests..."
        kubectl apply -k k8s/
        
        # Wait for deployment
        echo "Waiting for deployment to be ready..."
        kubectl rollout status deployment/holdwall-app -n holdwall --timeout=5m
        
        echo "✅ Deployment complete!"
        ;;
        
    beanstalk)
        echo "🌱 Deploying to Elastic Beanstalk..."
        
        # Check EB CLI
        if ! command -v eb &> /dev/null; then
            echo "❌ Elastic Beanstalk CLI not found. Install with: pip install awsebcli"
            exit 1
        fi
        
        # Initialize if needed
        if [ ! -f .elasticbeanstalk/config.yml ]; then
            echo "Initializing Elastic Beanstalk..."
            eb init holdwall-pos --platform node.js --region $REGION
        fi
        
        # Create environment if it doesn't exist
        if ! eb list | grep -q "$ENVIRONMENT"; then
            echo "Creating Elastic Beanstalk environment..."
            eb create $ENVIRONMENT
        fi
        
        # Deploy
        echo "Deploying application..."
        eb deploy $ENVIRONMENT
        
        echo "✅ Deployment complete!"
        ;;
        
    *)
        echo "❌ Unknown deployment type: $DEPLOYMENT_TYPE"
        echo "Supported types: ecs, eks, beanstalk"
        exit 1
        ;;
esac

echo ""
echo "✅ AWS deployment initiated!"
echo "📚 See DEPLOYMENT_READY.md for post-deployment steps"
