# Production Deployment Guide

This guide covers deploying Holdwall POS to production, including setting up VAPID keys, running tests, and configuring CI/CD.

## Deployment paths

- **Vercel**: app hosting (Next.js), edge/CDN, preview deployments.
- **AWS**: durable workloads (ECS/EKS), private networking, RDS/ElastiCache, higher control.

This repo supports both. The standard pattern is: **Vercel for the web app** + **AWS for data/workers** when you outgrow managed storage or need dedicated compute.

## Automated deployment scripts (optional)

If you prefer a guided workflow, the repo includes deployment scripts (see `package.json` scripts and `scripts/`).
Typical flow:

```bash
# Validate environment + run migrations + build + deploy
npm run deploy:complete
```

The `deploy:complete` script is intended to:
- validate prerequisites (tooling + env)
- ensure `DATABASE_URL` is set in your hosting platform
- run `prisma migrate deploy`
- run a production build
- deploy (for Vercel workflows)

## 📋 Pre-Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] VAPID keys generated and set
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met

## 1. Setting Up VAPID Keys

**📚 For comprehensive VAPID setup instructions, see [`docs/VAPID_PRODUCTION_SETUP.md`](./docs/VAPID_PRODUCTION_SETUP.md)**

### Quick Start

```bash
# Run the setup script
./scripts/setup-vapid-keys.sh
```

The script will:
- Generate VAPID keys
- Display the keys for manual setup
- Optionally create `.env.local` with the keys

### Manual Setup

```bash
# Generate keys
npx web-push generate-vapid-keys

# Add to your environment variables:
VAPID_PUBLIC_KEY=<public_key>
VAPID_PRIVATE_KEY=<private_key>
VAPID_SUBJECT=mailto:notifications@holdwall.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public_key>
```

**Note**: The comprehensive guide includes platform-specific instructions for Vercel, AWS, Docker, Kubernetes, GCP, and Azure deployments.

## 2. Environment Variables

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/holdwall

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# VAPID Keys (for push notifications)
VAPID_PUBLIC_KEY=<your_public_key>
VAPID_PRIVATE_KEY=<your_private_key>
VAPID_SUBJECT=mailto:notifications@holdwall.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_public_key>
```

### Optional but Recommended

```env
# Redis
REDIS_URL=redis://host:6379

# Error Tracking
SENTRY_DSN=<your-sentry-dsn>

# Backups (S3 recommended for production)
# Used by /api/backup/* endpoints via lib/backup/disaster-recovery.ts
S3_BACKUP_BUCKET=<your-backup-bucket>
AWS_REGION=<aws-region>
# Provide AWS credentials via your hosting platform's secret manager / IAM role.

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

## 3. Platform-Specific Setup

### Vercel

1. Go to Project Settings > Environment Variables
2. Add all required environment variables
3. Deploy:
   ```bash
   vercel --prod
   ```

### AWS (ECS/EKS)

1. **Using AWS Systems Manager Parameter Store**:
   ```bash
   aws ssm put-parameter \
     --name "/holdwall/vapid-public-key" \
     --value "<your-public-key>" \
     --type "SecureString"
   
   aws ssm put-parameter \
     --name "/holdwall/vapid-private-key" \
     --value "<your-private-key>" \
     --type "SecureString"
   ```

2. **Using AWS Secrets Manager**:
   ```bash
   aws secretsmanager create-secret \
     --name holdwall/vapid-keys \
     --secret-string '{"VAPID_PUBLIC_KEY":"<public>","VAPID_PRIVATE_KEY":"<private>"}'
   ```

### Docker

1. **Using .env file**:
   ```bash
   # Create .env file with all variables
   docker-compose up -d
   ```

2. **Using environment variables**:
   ```bash
   docker run -e VAPID_PUBLIC_KEY=<key> \
              -e VAPID_PRIVATE_KEY=<key> \
              -e DATABASE_URL=<url> \
              holdwall-pos
   ```

### Kubernetes

1. **Create secret**:
   ```bash
   kubectl create secret generic vapid-keys \
     --from-literal=VAPID_PUBLIC_KEY='<public-key>' \
     --from-literal=VAPID_PRIVATE_KEY='<private-key>' \
     --from-literal=VAPID_SUBJECT='mailto:notifications@holdwall.com' \
     --from-literal=NEXT_PUBLIC_VAPID_PUBLIC_KEY='<public-key>'
   ```

2. **Update deployment** to reference the secret:
   ```yaml
   env:
     - name: VAPID_PUBLIC_KEY
       valueFrom:
         secretKeyRef:
           name: vapid-keys
           key: VAPID_PUBLIC_KEY
   ```

## 4. Running Tests Before Deployment

### Local Testing

```bash
# Run unit tests
npm test

# Run E2E tests (requires running server)
npm run dev &  # Start server in background
npm run test:e2e

# Run load tests
npm run test:load
```

### CI/CD Testing

Tests run automatically in GitHub Actions on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

The CI pipeline includes:
- Linting
- Type checking
- Unit tests with coverage
- E2E tests
- Security scanning
- Build validation

## 5. Database Setup

### Apply Migrations

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### Seed Database (Optional)

```bash
npm run db:seed
```

## 6. Deployment Steps

### Step 1: Verify Environment

```bash
# Check environment variables are set
echo $VAPID_PUBLIC_KEY
echo $DATABASE_URL
echo $NEXTAUTH_SECRET
```

### Step 2: Run Tests

```bash
# Run all tests
npm test
npm run test:e2e
```

### Step 3: Build

```bash
npm run build
```

### Step 4: Deploy

**Vercel**:
```bash
vercel --prod
```

**Docker**:
```bash
docker build -t holdwall-pos .
docker push <registry>/holdwall-pos:latest
```

**Kubernetes**:
```bash
kubectl apply -f k8s/
```

## 7. Post-Deployment Verification

### Health Check

```bash
curl https://yourdomain.com/api/health
```

### Verify Push Notifications

1. Open the application in a browser
2. Allow push notification permissions
3. Test sending a notification from the admin panel

### Monitor Logs

```bash
# Vercel
vercel logs

# Docker
docker logs <container-id>

# Kubernetes
kubectl logs -f deployment/holdwall-pos
```

## 8. CI/CD Integration

The CI/CD pipeline (`.github/workflows/ci.yml`) automatically:

1. **Lints** code on every push
2. **Runs tests** (unit + E2E)
3. **Scans for security** vulnerabilities
4. **Builds** the application
5. **Deploys** to staging (develop branch) or production (main branch)

### Required GitHub Secrets

- `DATABASE_URL` - Database connection string (for E2E tests)
- `SNYK_TOKEN` - Snyk security scanning token (optional)
- `CODECOV_TOKEN` - Codecov coverage token (optional)

### Setting Up Secrets

1. Go to GitHub repository > Settings > Secrets and variables > Actions
2. Add required secrets
3. Secrets are automatically used in CI/CD pipeline

## 9. Troubleshooting

### Push Notifications Not Working

1. Verify VAPID keys are set correctly
2. Check browser console for errors
3. Verify service worker is registered
4. Check server logs for push notification errors

### Tests Failing in CI

1. Check database connection (DATABASE_URL)
2. Verify all dependencies are installed
3. Check Playwright browser installation
4. Review test logs in GitHub Actions

### Build Failures

1. Check Node.js version (requires 20.x)
2. Verify all environment variables
3. Check for TypeScript errors: `npm run type-check`
4. Review build logs

## 10. Rollback Procedure

### Vercel

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
```

### Kubernetes

```bash
# Rollback deployment
kubectl rollout undo deployment/holdwall-pos
```

### Docker

```bash
# Use previous image tag
docker run <previous-image-tag>
```

## 📚 Additional Resources

- [VAPID Keys Documentation](https://web-push-codelab.glitch.me/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Playwright CI/CD](https://playwright.dev/docs/ci)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)

## ✅ Production Readiness Checklist

- [ ] All environment variables configured
- [ ] VAPID keys generated and set
- [ ] Database migrations applied
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Monitoring and logging configured
- [ ] Backup strategy in place
- [ ] Rollback procedure documented
- [ ] Team trained on deployment process
