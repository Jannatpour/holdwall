# 🚀 Starting EKS Deployment - Quick Start Guide

**Date**: January 22, 2026  
**Status**: Ready to Deploy

---

## ⚠️ Prerequisites Check

### Current Status
- ✅ **AWS CLI**: Installed and configured
- ✅ **AWS Account**: 597743362576
- ✅ **kubectl**: Installed (v1.32.2)
- ⚠️ **eksctl**: Needs installation (Xcode issue)

---

## 📦 Install eksctl (Alternative Methods)

### Option 1: Direct Download (Recommended)

```bash
# For macOS
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Darwin_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
eksctl version
```

### Option 2: Using AWS CloudFormation (No eksctl needed)

You can create the cluster using AWS Console or CloudFormation templates.

### Option 3: Fix Xcode (if preferred)

Update Xcode from App Store, then:
```bash
brew install weaveworks/tap/eksctl
```

---

## 🚀 Quick Start Deployment

### Step 1: Install eksctl

```bash
# Download and install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Darwin_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
eksctl version
```

### Step 2: Create EKS Cluster

```bash
eksctl create cluster \
  --name holdwall-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed \
  --with-oidc \
  --ssh-access
```

**Time**: 15-20 minutes

### Step 3: Configure kubectl

```bash
aws eks update-kubeconfig --name holdwall-cluster --region us-east-1
kubectl get nodes
```

### Step 4: Create Namespace

```bash
kubectl create namespace holdwall
```

### Step 5: Create Secrets

```bash
# Get DATABASE_URL from Vercel
vc env pull .env.production --environment production
source .env.production

# Create Kubernetes secret
kubectl create secret generic holdwall-secrets \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=NEXTAUTH_SECRET="your-nextauth-secret" \
  --from-literal=NEXTAUTH_URL="https://holdwall.com" \
  --from-literal=VAPID_PUBLIC_KEY="your-vapid-public-key" \
  --from-literal=VAPID_PRIVATE_KEY="your-vapid-private-key" \
  -n holdwall
```

### Step 6: Build and Push Docker Image

```bash
# Set Docker build flag
export DOCKER_BUILD=true

# Build image
docker build -t holdwall-app:latest .

# Get ECR repository
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos"

# Create ECR repository
aws ecr create-repository --repository-name holdwall-pos --region us-east-1 || true

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO

# Tag and push
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
docker tag holdwall-app:latest $ECR_REPO:latest
docker tag holdwall-app:latest $ECR_REPO:$IMAGE_TAG
docker push $ECR_REPO:latest
docker push $ECR_REPO:$IMAGE_TAG
```

### Step 7: Update Kubernetes Manifests

```bash
# Update image references
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos"
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

find k8s -name "*.yaml" -type f -exec sed -i.bak "s|holdwall-app:latest|$ECR_REPO:$IMAGE_TAG|g" {} \;
find k8s -name "*.bak" -delete
```

### Step 8: Deploy to Kubernetes

```bash
kubectl apply -k k8s/
```

### Step 9: Wait for Deployment

```bash
kubectl rollout status deployment/holdwall-app -n holdwall --timeout=10m
```

### Step 10: Verify Deployment

```bash
# Check pods
kubectl get pods -n holdwall

# Check services
kubectl get svc -n holdwall

# Check ingress
kubectl get ingress -n holdwall
```

---

## 🎯 One-Command Alternative

Once eksctl is installed, you can use:

```bash
./scripts/deploy-eks.sh production us-east-1 holdwall-cluster
```

---

## 📋 What Gets Created

### EKS Cluster
- **Name**: holdwall-cluster
- **Region**: us-east-1
- **Node Group**: standard-workers
- **Node Type**: t3.medium
- **Nodes**: 2 (scales 1-4)

### Kubernetes Resources
- **Namespace**: holdwall
- **Deployments**: 
  - holdwall-app (main application)
  - holdwall-worker (pipeline workers)
  - holdwall-outbox-worker (outbox worker)
- **Services**: Load balancer services
- **CronJobs**: Backup, reindex, POS cycle
- **HPA**: Auto-scaling configuration
- **Ingress**: External access

---

## 💰 Cost Estimate

- **EKS Control Plane**: ~$72/month
- **Worker Nodes (2x t3.medium)**: ~$60/month
- **Load Balancer**: ~$20/month
- **Total**: ~$152/month

---

## ✅ Next Steps After Deployment

1. **Get Load Balancer URL**:
   ```bash
   kubectl get ingress -n holdwall
   ```

2. **Configure DNS**:
   - Point your domain to the Load Balancer
   - Update NEXTAUTH_URL if needed

3. **Monitor Deployment**:
   ```bash
   kubectl logs -n holdwall -l app=holdwall -f
   ```

4. **Scale if needed**:
   ```bash
   kubectl scale deployment holdwall-app -n holdwall --replicas=5
   ```

---

## 🆘 Troubleshooting

### eksctl Installation Issues
- Use direct download method (Option 1 above)
- Or use AWS Console to create cluster

### Cluster Creation Fails
- Check AWS IAM permissions
- Verify VPC/subnet availability
- Check service quotas

### Deployment Issues
- Check pod logs: `kubectl logs -n holdwall <pod-name>`
- Verify secrets: `kubectl get secret holdwall-secrets -n holdwall`
- Check events: `kubectl get events -n holdwall`

---

**Ready to start! Install eksctl first, then proceed with cluster creation.** 🚀
