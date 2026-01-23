# 🚀 AWS Cloud Deployment Guide

**Date**: January 22, 2026  
**Status**: Ready for AWS Deployment

---

## 📋 Overview

This guide covers deploying Holdwall POS to AWS using three deployment options:
1. **ECS** (Elastic Container Service) - Recommended for containerized deployments
2. **EKS** (Elastic Kubernetes Service) - For Kubernetes orchestration
3. **Elastic Beanstalk** - Simplest option for Node.js applications

---

## ✅ Prerequisites

### Required Tools

1. **AWS CLI**
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Or on macOS
   brew install awscli
   ```

2. **AWS Credentials**
   ```bash
   aws configure
   # Enter:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region (e.g., us-east-1)
   # - Default output format (json)
   ```

3. **Docker** (for ECS)
   ```bash
   # Install Docker Desktop
   # https://www.docker.com/products/docker-desktop
   ```

4. **kubectl** (for EKS)
   ```bash
   # Install kubectl
   brew install kubectl  # macOS
   # Or: https://kubernetes.io/docs/tasks/tools/
   ```

5. **EB CLI** (for Elastic Beanstalk)
   ```bash
   pip install awsebcli
   ```

### Verify Installation

```bash
# Check AWS CLI
aws --version

# Check AWS credentials
aws sts get-caller-identity

# Check Docker
docker --version

# Check kubectl
kubectl version --client

# Check EB CLI
eb --version
```

---

## 🚀 Quick Deployment

### Option 1: ECS (Elastic Container Service)

**Recommended for production containerized deployments**

```bash
./aws-deploy.sh production us-east-1 ecs
```

**What it does:**
1. ✅ Builds Docker image
2. ✅ Creates ECR repository (if needed)
3. ✅ Pushes image to ECR
4. ✅ Registers ECS task definition
5. ✅ Provides instructions for creating ECS service

**After running the script:**

1. **Create ECS Service:**
   ```bash
   aws ecs create-service \
     --cluster your-cluster-name \
     --service-name holdwall-pos \
     --task-definition holdwall-pos \
     --desired-count 2 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
     --region us-east-1
   ```

2. **Or use AWS Console:**
   - Go to ECS → Clusters → Create Service
   - Select Fargate launch type
   - Choose task definition: `holdwall-pos`
   - Configure networking and security groups

### Option 2: EKS (Elastic Kubernetes Service)

**For Kubernetes orchestration**

```bash
./aws-deploy.sh production us-east-1 eks
```

**Prerequisites:**
- EKS cluster already created
- kubectl configured for the cluster

**What it does:**
1. ✅ Creates namespace (if needed)
2. ✅ Applies Kubernetes manifests from `k8s/` directory
3. ✅ Waits for deployment to be ready

**Before running:**

1. **Create EKS Cluster** (if not exists):
   ```bash
   eksctl create cluster \
     --name holdwall-cluster \
     --region us-east-1 \
     --nodegroup-name standard-workers \
     --node-type t3.medium \
     --nodes 2 \
     --nodes-min 1 \
     --nodes-max 3
   ```

2. **Configure kubectl:**
   ```bash
   aws eks update-kubeconfig --name holdwall-cluster --region us-east-1
   ```

3. **Create Kubernetes Secrets:**
   ```bash
   kubectl create secret generic holdwall-secrets \
     --from-literal=DATABASE_URL="postgresql://..." \
     --from-literal=NEXTAUTH_SECRET="..." \
     --from-literal=NEXTAUTH_URL="https://your-domain.com" \
     --from-literal=VAPID_PUBLIC_KEY="..." \
     --from-literal=VAPID_PRIVATE_KEY="..." \
     -n holdwall
   ```

### Option 3: Elastic Beanstalk

**Simplest option for Node.js applications**

```bash
./aws-deploy.sh production us-east-1 beanstalk
```

**What it does:**
1. ✅ Initializes Elastic Beanstalk (if needed)
2. ✅ Creates environment (if needed)
3. ✅ Deploys application

**Set Environment Variables:**

```bash
eb setenv \
  DATABASE_URL="postgresql://..." \
  NEXTAUTH_URL="https://your-domain.elasticbeanstalk.com" \
  NEXTAUTH_SECRET="..." \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  NEXT_PUBLIC_BASE_URL="https://your-domain.elasticbeanstalk.com"
```

---

## 🔐 AWS Secrets Management

### Option 1: AWS Secrets Manager

**Store secrets securely:**

```bash
# Database URL
aws secretsmanager create-secret \
  --name holdwall/prod/database-url \
  --secret-string "postgresql://user:pass@host:port/dbname" \
  --region us-east-1

# NextAuth Secret
aws secretsmanager create-secret \
  --name holdwall/prod/nextauth-secret \
  --secret-string "your-nextauth-secret" \
  --region us-east-1

# VAPID Keys
aws secretsmanager create-secret \
  --name holdwall/prod/vapid-public-key \
  --secret-string "your-vapid-public-key" \
  --region us-east-1

aws secretsmanager create-secret \
  --name holdwall/prod/vapid-private-key \
  --secret-string "your-vapid-private-key" \
  --region us-east-1
```

**Retrieve secrets in application:**
- ECS: Configure in task definition
- EKS: Use External Secrets Operator or init containers
- Beanstalk: Use environment variables or Parameter Store

### Option 2: Systems Manager Parameter Store

```bash
# Store parameters
aws ssm put-parameter \
  --name "/holdwall/prod/database-url" \
  --value "postgresql://..." \
  --type "SecureString" \
  --region us-east-1

aws ssm put-parameter \
  --name "/holdwall/prod/nextauth-secret" \
  --value "..." \
  --type "SecureString" \
  --region us-east-1
```

---

## 🗄️ Database Setup

### Option 1: AWS RDS PostgreSQL

**Create RDS Instance:**

```bash
aws rds create-db-instance \
  --db-instance-identifier holdwall-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password YourPassword123! \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --region us-east-1
```

**Get Connection String:**
```bash
aws rds describe-db-instances \
  --db-instance-identifier holdwall-prod \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

**Connection String Format:**
```
postgresql://postgres:YourPassword123!@holdwall-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/postgres
```

### Option 2: Use Existing Supabase

**Already configured!** Your Supabase database is ready:
- Connection string: Already in Vercel
- Migrations: Already applied
- Status: Operational

**For AWS deployment, use the same connection string:**
```bash
# Get from Vercel
vc env pull .env.production --environment production
grep DATABASE_URL .env.production
```

---

## 📦 Docker Configuration

### Dockerfile

Ensure `Dockerfile` exists in project root:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

**Note:** For Next.js standalone output, ensure `next.config.ts` has:
```typescript
output: 'standalone'
```

---

## ☸️ Kubernetes Configuration

### Required Files in `k8s/` directory:

1. **deployment.yaml** - Application deployment
2. **service.yaml** - Service definition
3. **ingress.yaml** - Ingress for external access
4. **secrets.yaml** - Secrets (or use kubectl create secret)
5. **configmap.yaml** - Configuration

**Apply manifests:**
```bash
kubectl apply -k k8s/
```

---

## 🌐 Domain Configuration

### Option 1: AWS Route 53

1. **Create hosted zone** for your domain
2. **Create A record** pointing to:
   - ECS: Application Load Balancer
   - EKS: Ingress controller
   - Beanstalk: Environment URL

### Option 2: Use Existing Domain

If using `holdwall.com`:
- Point DNS to AWS resources
- Update `NEXTAUTH_URL` and `NEXT_PUBLIC_BASE_URL`

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] AWS CLI installed and configured
- [ ] AWS credentials configured (`aws configure`)
- [ ] Required tools installed (Docker, kubectl, EB CLI)
- [ ] Database ready (RDS or Supabase)
- [ ] Environment variables prepared
- [ ] Secrets stored in AWS Secrets Manager

### ECS Deployment
- [ ] Docker image builds successfully
- [ ] ECR repository created
- [ ] Image pushed to ECR
- [ ] Task definition registered
- [ ] ECS service created
- [ ] Security groups configured
- [ ] Load balancer configured (if needed)

### EKS Deployment
- [ ] EKS cluster created
- [ ] kubectl configured
- [ ] Kubernetes secrets created
- [ ] Manifests applied
- [ ] Ingress configured
- [ ] DNS configured

### Elastic Beanstalk
- [ ] EB CLI initialized
- [ ] Environment created
- [ ] Environment variables set
- [ ] Application deployed
- [ ] Health checks passing

---

## 🔍 Verification

### Check Deployment Status

**ECS:**
```bash
aws ecs describe-services \
  --cluster your-cluster-name \
  --services holdwall-pos \
  --region us-east-1
```

**EKS:**
```bash
kubectl get pods -n holdwall
kubectl get services -n holdwall
kubectl get ingress -n holdwall
```

**Elastic Beanstalk:**
```bash
eb status
eb health
```

### Test Application

```bash
# Get application URL
# ECS: From Load Balancer DNS
# EKS: From Ingress
# Beanstalk: eb status

curl https://your-aws-url/api/health
```

---

## 📊 Current Status

### Vercel Deployment
- ✅ **Status**: Live at https://holdwall.com
- ✅ **Database**: Supabase (configured)
- ✅ **Migrations**: Applied

### AWS Deployment
- ⚠️ **Status**: Ready to deploy
- ✅ **Scripts**: Available (`aws-deploy.sh`)
- ✅ **Documentation**: Complete
- ⚠️ **Infrastructure**: Needs to be created

---

## 🚀 Quick Start

**Choose your deployment method:**

1. **ECS (Recommended):**
   ```bash
   ./aws-deploy.sh production us-east-1 ecs
   ```

2. **EKS:**
   ```bash
   ./aws-deploy.sh production us-east-1 eks
   ```

3. **Elastic Beanstalk:**
   ```bash
   ./aws-deploy.sh production us-east-1 beanstalk
   ```

---

## 📚 Additional Resources

- **AWS ECS Documentation**: https://docs.aws.amazon.com/ecs/
- **AWS EKS Documentation**: https://docs.aws.amazon.com/eks/
- **Elastic Beanstalk Documentation**: https://docs.aws.amazon.com/elasticbeanstalk/
- **AWS Secrets Manager**: https://docs.aws.amazon.com/secretsmanager/
- **AWS RDS**: https://docs.aws.amazon.com/rds/

---

## 🎯 Next Steps

1. **Choose deployment method** (ECS, EKS, or Beanstalk)
2. **Install required tools** (if not already installed)
3. **Configure AWS credentials** (`aws configure`)
4. **Set up database** (RDS or use existing Supabase)
5. **Store secrets** in AWS Secrets Manager
6. **Run deployment script**
7. **Verify deployment**
8. **Configure DNS** (if using custom domain)

---

**Ready to deploy to AWS!** 🚀
