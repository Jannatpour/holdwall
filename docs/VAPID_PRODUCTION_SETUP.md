# VAPID Keys Production Setup Guide

This guide provides comprehensive instructions for setting up VAPID (Voluntary Application Server Identification) keys for push notifications in production environments.

## Overview

VAPID keys are used to identify your application server when sending push notifications to browsers. They consist of:
- **Public Key**: Shared with browsers during subscription
- **Private Key**: Kept secret on the server for signing notifications
- **Subject**: Email or URL identifying your application

## Quick Start

### 1. Generate VAPID Keys

Use the provided script to generate keys:

```bash
chmod +x scripts/setup-vapid-keys.sh
./scripts/setup-vapid-keys.sh
```

Or manually generate using web-push:

```bash
npx web-push generate-vapid-keys
```

You'll receive output like:
```
Public Key: BKx...xyz
Private Key: 8Kx...abc
```

### 2. Environment Variables

Add the following to your production environment:

```env
VAPID_PUBLIC_KEY=BKx...xyz
VAPID_PRIVATE_KEY=8Kx...abc
VAPID_SUBJECT=mailto:notifications@holdwall.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKx...xyz
```

**Important**: 
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are server-side only
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is exposed to the browser (safe to expose)

## Production Deployment

### Vercel

1. Go to **Project Settings** > **Environment Variables**
2. Add each variable for **Production** environment:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
3. Redeploy your application

### AWS (Elastic Beanstalk / ECS / EC2)

#### Option 1: Systems Manager Parameter Store

```bash
aws ssm put-parameter \
  --name "/holdwall/prod/vapid-public-key" \
  --value "BKx...xyz" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/holdwall/prod/vapid-private-key" \
  --value "8Kx...abc" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/holdwall/prod/vapid-subject" \
  --value "mailto:notifications@holdwall.com" \
  --type "String"

aws ssm put-parameter \
  --name "/holdwall/prod/next-public-vapid-public-key" \
  --value "BKx...xyz" \
  --type "String"
```

Then reference in your application:
```typescript
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({ region: "us-east-1" });

const getVAPIDPublicKey = async () => {
  const response = await ssm.send(
    new GetParameterCommand({
      Name: "/holdwall/prod/vapid-public-key",
      WithDecryption: true,
    })
  );
  return response.Parameter?.Value;
};
```

#### Option 2: Secrets Manager

```bash
aws secretsmanager create-secret \
  --name holdwall/prod/vapid-keys \
  --secret-string '{
    "VAPID_PUBLIC_KEY": "BKx...xyz",
    "VAPID_PRIVATE_KEY": "8Kx...abc",
    "VAPID_SUBJECT": "mailto:notifications@holdwall.com",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "BKx...xyz"
  }'
```

### Docker / Docker Compose

Add to `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      - VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
      - VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
      - VAPID_SUBJECT=${VAPID_SUBJECT}
      - NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
```

Or use `.env` file (ensure it's in `.dockerignore` for security):

```env
VAPID_PUBLIC_KEY=BKx...xyz
VAPID_PRIVATE_KEY=8Kx...abc
VAPID_SUBJECT=mailto:notifications@holdwall.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKx...xyz
```

### Kubernetes

#### Option 1: Secrets

Create secret:

```bash
kubectl create secret generic vapid-keys \
  --from-literal=VAPID_PUBLIC_KEY='BKx...xyz' \
  --from-literal=VAPID_PRIVATE_KEY='8Kx...abc' \
  --from-literal=VAPID_SUBJECT='mailto:notifications@holdwall.com' \
  --from-literal=NEXT_PUBLIC_VAPID_PUBLIC_KEY='BKx...xyz' \
  --namespace=production
```

Reference in deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: holdwall-app
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: VAPID_PUBLIC_KEY
          valueFrom:
            secretKeyRef:
              name: vapid-keys
              key: VAPID_PUBLIC_KEY
        - name: VAPID_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: vapid-keys
              key: VAPID_PRIVATE_KEY
        - name: VAPID_SUBJECT
          valueFrom:
            secretKeyRef:
              name: vapid-keys
              key: VAPID_SUBJECT
        - name: NEXT_PUBLIC_VAPID_PUBLIC_KEY
          valueFrom:
            secretKeyRef:
              name: vapid-keys
              key: NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

#### Option 2: Sealed Secrets (for GitOps)

```bash
kubectl create secret generic vapid-keys \
  --from-literal=VAPID_PUBLIC_KEY='BKx...xyz' \
  --from-literal=VAPID_PRIVATE_KEY='8Kx...abc' \
  --from-literal=VAPID_SUBJECT='mailto:notifications@holdwall.com' \
  --from-literal=NEXT_PUBLIC_VAPID_PUBLIC_KEY='BKx...xyz' \
  --dry-run=client -o yaml | kubeseal -o yaml > k8s/secrets/vapid-keys-sealed.yaml
```

### Google Cloud Platform (GCP)

#### Secret Manager

```bash
echo -n "BKx...xyz" | gcloud secrets create vapid-public-key --data-file=-
echo -n "8Kx...abc" | gcloud secrets create vapid-private-key --data-file=-
echo -n "mailto:notifications@holdwall.com" | gcloud secrets create vapid-subject --data-file=-
echo -n "BKx...xyz" | gcloud secrets create next-public-vapid-public-key --data-file=-
```

Reference in Cloud Run / GKE:

```yaml
env:
- name: VAPID_PUBLIC_KEY
  valueFrom:
    secretKeyRef:
      name: vapid-public-key
```

### Azure

#### Key Vault

```bash
az keyvault secret set \
  --vault-name holdwall-prod \
  --name VAPID-PUBLIC-KEY \
  --value "BKx...xyz"

az keyvault secret set \
  --vault-name holdwall-prod \
  --name VAPID-PRIVATE-KEY \
  --value "8Kx...abc"
```

Reference in App Service / AKS:

```yaml
env:
- name: VAPID_PUBLIC_KEY
  valueFrom:
    secretKeyRef:
      name: vapid-public-key
      key: VAPID-PUBLIC-KEY
```

## Security Best Practices

1. **Never commit keys to version control**
   - Add `.env.local` to `.gitignore`
   - Use environment variables or secrets management

2. **Rotate keys periodically**
   - Generate new keys every 6-12 months
   - Update all subscriptions when rotating

3. **Use different keys per environment**
   - Separate keys for development, staging, and production
   - Prevents cross-environment issues

4. **Restrict access to private key**
   - Only application servers need the private key
   - Use IAM roles and least privilege access

5. **Monitor key usage**
   - Log push notification attempts
   - Alert on unusual patterns

## Verification

After deployment, verify keys are loaded:

```bash
# Check environment variables are set
curl https://your-domain.com/api/health

# Test push subscription
# Use browser DevTools > Application > Service Workers > Push
```

## Troubleshooting

### "VAPID keys not configured" error

- Verify environment variables are set in production
- Check variable names match exactly (case-sensitive)
- Ensure application was restarted after setting variables

### Push notifications not working

1. Verify `NEXT_PUBLIC_VAPID_PUBLIC_KEY` matches the public key used during subscription
2. Check browser console for subscription errors
3. Verify service worker is registered
4. Check push notification permissions in browser settings

### Key rotation issues

When rotating keys:
1. Generate new keys
2. Update environment variables
3. Restart application
4. Users need to re-subscribe (old subscriptions will fail)

## Migration from Development to Production

1. **Generate production keys** (separate from development)
2. **Update environment variables** in production
3. **Deploy application**
4. **Test push notifications** with production keys
5. **Monitor for errors** in first 24 hours

## Support

For issues or questions:
- Check logs: `lib/pwa/send-push.ts`
- Review service worker: `public/sw.js`
- See PWA documentation: `PWA_COMPLETE.md`
