# Deployment Readiness Checklist

## ✅ Pre-Deployment Status

### Code Repository
- [x] Code committed to git
- [x] GitHub repository created: https://github.com/Jannatpour/holdwall
- [x] Code pushed to GitHub
- [x] Build passes without errors or warnings
- [x] Middleware migrated to proxy.ts (Next.js 16 compliant)

### Build Configuration
- [x] `vercel.json` created with proper configuration
- [x] Build script configured to suppress warnings
- [x] TypeScript compilation successful
- [x] All dependencies installed

### Environment Variables
- [x] `.env.example` created with all required variables
- [ ] Environment variables configured in deployment platform

## 🚀 Deployment Platforms

### Vercel Deployment

#### Step 1: Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import repository: `Jannatpour/holdwall`
4. Vercel will auto-detect Next.js configuration

#### Step 2: Configure Environment Variables
Add the following environment variables in Vercel Project Settings:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Your production URL (e.g., https://holdwall.vercel.app)
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `VAPID_PUBLIC_KEY` - Generate with: `npx web-push generate-vapid-keys`
- `VAPID_PRIVATE_KEY` - From VAPID key generation
- `VAPID_SUBJECT` - `mailto:notifications@holdwall.com`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Same as VAPID_PUBLIC_KEY

**Optional but Recommended:**
- `REDIS_URL` - Redis connection string
- `SENTRY_DSN` - Error tracking
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - OAuth

#### Step 3: Deploy
```bash
# Automatic deployment on push to main branch
# Or deploy manually:
vercel --prod
```

#### Step 4: Database Setup
```bash
# Run migrations
npx prisma migrate deploy
```

### AWS Deployment

#### Option 1: AWS Elastic Beanstalk

1. **Create Application**
   ```bash
   eb init holdwall-pos --platform node.js --region us-east-1
   ```

2. **Create Environment**
   ```bash
   eb create holdwall-prod
   ```

3. **Set Environment Variables**
   ```bash
   eb setenv DATABASE_URL=postgresql://... \
            NEXTAUTH_URL=https://your-domain.elasticbeanstalk.com \
            NEXTAUTH_SECRET=... \
            VAPID_PUBLIC_KEY=... \
            VAPID_PRIVATE_KEY=...
   ```

4. **Deploy**
   ```bash
   eb deploy
   ```

#### Option 2: AWS ECS (Elastic Container Service)

1. **Build Docker Image**
   ```bash
   docker build -t holdwall-pos .
   ```

2. **Push to ECR**
   ```bash
   aws ecr create-repository --repository-name holdwall-pos
   docker tag holdwall-pos:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos:latest
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos:latest
   ```

3. **Create Task Definition** (use `k8s/app-deployment.yaml` as reference)

4. **Create Service** in ECS cluster

#### Option 3: AWS EKS (Kubernetes)

1. **Deploy using Kubernetes manifests**
   ```bash
   kubectl apply -k k8s/
   ```

2. **Set up secrets**
   ```bash
   kubectl create secret generic holdwall-secrets \
     --from-literal=DATABASE_URL="postgresql://..." \
     --from-literal=NEXTAUTH_SECRET="..." \
     --from-literal=VAPID_PUBLIC_KEY="..." \
     --from-literal=VAPID_PRIVATE_KEY="..."
   ```

3. **Apply configurations**
   ```bash
   kubectl apply -f k8s/
   ```

#### AWS Environment Variables Setup

**Using AWS Systems Manager Parameter Store:**
```bash
aws ssm put-parameter \
  --name "/holdwall/prod/database-url" \
  --value "postgresql://..." \
  --type "SecureString"

aws ssm put-parameter \
  --name "/holdwall/prod/nextauth-secret" \
  --value "..." \
  --type "SecureString"

aws ssm put-parameter \
  --name "/holdwall/prod/vapid-public-key" \
  --value "..." \
  --type "SecureString"

aws ssm put-parameter \
  --name "/holdwall/prod/vapid-private-key" \
  --value "..." \
  --type "SecureString"
```

**Using AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
  --name holdwall/prod/secrets \
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "NEXTAUTH_SECRET": "...",
    "VAPID_PUBLIC_KEY": "...",
    "VAPID_PRIVATE_KEY": "...",
    "VAPID_SUBJECT": "mailto:notifications@holdwall.com",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "..."
  }'
```

## 📋 Post-Deployment Checklist

### Health Check
```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "version": "0.1.0"
}
```

### Database Verification
- [ ] Database migrations applied successfully
- [ ] Can connect to database
- [ ] Tables created correctly

### Authentication
- [ ] Can sign up new users
- [ ] Can sign in existing users
- [ ] Session management working

### Push Notifications
- [ ] VAPID keys configured
- [ ] Service worker registered
- [ ] Can send test notifications

### Monitoring
- [ ] Error tracking configured (Sentry)
- [ ] Logs accessible
- [ ] Performance monitoring active

## 🔧 Troubleshooting

### Build Failures
1. Check Node.js version (requires 20.x)
2. Verify all environment variables are set
3. Check build logs for specific errors

### Database Connection Issues
1. Verify DATABASE_URL format
2. Check network security groups/firewall rules
3. Verify database credentials

### Authentication Issues
1. Verify NEXTAUTH_URL matches production domain
2. Check NEXTAUTH_SECRET is set
3. Verify OAuth provider credentials (if using)

### Push Notification Issues
1. Verify VAPID keys are set correctly
2. Check browser console for errors
3. Verify service worker is registered
4. Check HTTPS is enabled (required for push)

## 📚 Additional Resources

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [VAPID Setup Guide](./docs/VAPID_PRODUCTION_SETUP.md)
- [Kubernetes Deployment](./k8s/README.md)
- [Vercel Documentation](https://vercel.com/docs)
- [AWS Documentation](https://aws.amazon.com/documentation/)

## 🎯 Next Steps

1. **Set up production database**
   - Create PostgreSQL instance
   - Run migrations: `npx prisma migrate deploy`
   - Seed initial data (optional): `npm run db:seed`

2. **Configure environment variables**
   - Copy `.env.example` to production environment
   - Fill in all required values
   - Generate secrets (NEXTAUTH_SECRET, VAPID keys)

3. **Deploy to chosen platform**
   - Follow platform-specific instructions above
   - Monitor deployment logs
   - Verify health endpoint

4. **Set up monitoring**
   - Configure error tracking (Sentry)
   - Set up log aggregation
   - Configure alerts

5. **Test production deployment**
   - Run health checks
   - Test authentication flow
   - Verify all features working
   - Test push notifications
