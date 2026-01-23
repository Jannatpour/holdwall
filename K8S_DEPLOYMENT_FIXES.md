# Kubernetes Deployment Fixes - January 22, 2026

## Summary

This document outlines all fixes applied to resolve critical Kubernetes deployment issues identified during the deployment verification process.

## Issues Identified and Fixed

### 1. ✅ Prisma Schema Path in Init Container

**Problem**: The `db-migrate` init container was failing with:
```
Error: Could not find Prisma Schema that is required for this command.
```

**Root Cause**: The init container was not specifying the working directory or explicit schema path, causing Prisma to look in the wrong location.

**Fix Applied**:
- Added `workingDir: /app` to the `db-migrate` init container in `k8s/app-deployment.yaml`
- Added explicit schema path: `--schema /app/prisma/schema.prisma` to the Prisma command

**Files Modified**:
- `k8s/app-deployment.yaml` (lines 32-34)

### 2. ✅ CronJob Resource Constraints

**Problem**: CronJob pods (`holdwall-pos-cycle`, `holdwall-reindex`) were stuck in `Pending` state with:
```
0/2 nodes are available: 2 Insufficient cpu, 2 Insufficient memory.
```

**Root Cause**: Resource requests were too high (1Gi memory, 500m CPU) for the available cluster capacity.

**Fix Applied**:
- Reduced `holdwall-pos-cycle` resource requests: 1Gi → 512Mi memory, 500m → 250m CPU
- Reduced `holdwall-reindex` resource requests: 1Gi → 512Mi memory, 500m → 250m CPU
- Reduced `holdwall-backup` resource requests: 512Mi → 256Mi memory, 250m → 100m CPU
- Added `workingDir: /app` to all cronjob containers for consistency

**Files Modified**:
- `k8s/cronjobs.yaml` (all three cronjobs)

### 3. ✅ Container Working Directory Consistency

**Problem**: Containers may not have consistent working directories, potentially causing module resolution issues.

**Fix Applied**:
- Added `workingDir: /app` to all containers:
  - `k8s/app-deployment.yaml` (main app container)
  - `k8s/worker-deployment.yaml` (pipeline-worker)
  - `k8s/outbox-worker-deployment.yaml` (outbox-worker)
  - `k8s/cronjobs.yaml` (all cronjob containers)

**Files Modified**:
- `k8s/app-deployment.yaml`
- `k8s/worker-deployment.yaml`
- `k8s/outbox-worker-deployment.yaml`
- `k8s/cronjobs.yaml`

## Remaining Issues Requiring Manual Intervention

### 1. ⚠️ ExternalSecret Sync Status

**Issue**: The ExternalSecret `holdwall-secrets` may not be syncing properly, causing missing secret keys (`REDIS_URL`, `KAFKA_BROKERS`).

**Configuration**: The ExternalSecret is configured to sync from AWS Parameter Store:
- `REDIS_URL`: `/holdwall/prod/app/REDIS_URL`
- `KAFKA_BROKERS`: `/holdwall/prod/workers/KAFKA_BROKERS`

**Verification Steps**:
```bash
# Check ExternalSecret status
kubectl describe externalsecret holdwall-secrets -n holdwall

# Check if secrets are synced
kubectl get secret holdwall-secrets -n holdwall -o jsonpath='{.data}' | jq -r 'keys[]'

# Check AWS Parameter Store values exist
aws ssm get-parameter --name /holdwall/prod/app/REDIS_URL --region us-east-1
aws ssm get-parameter --name /holdwall/prod/workers/KAFKA_BROKERS --region us-east-1
```

**Resolution**:
1. Ensure AWS Parameter Store has the required values
2. Verify ExternalSecrets Operator is installed and running
3. Check SecretStore IAM permissions
4. Manually trigger sync: `kubectl annotate externalsecret holdwall-secrets -n holdwall force-sync=$(date +%s)`

### 2. ⚠️ Image Pull Failures

**Issue**: Some pods are in `ImagePullBackOff` state due to:
- Missing image tags: `20260122-093639`, `20260122-094204`
- Platform mismatch: "no match for platform in manifest"

**Current Working Image**: `597743362576.dkr.ecr.us-east-1.amazonaws.com/holdwall-pos:20260122-141807`

**Resolution**:
1. All deployments now use the working image tag: `20260122-141807`
2. Old replicasets with wrong image tags should be cleaned up:
   ```bash
   kubectl delete replicaset -n holdwall -l app=holdwall --field-selector status.replicas=0
   ```
3. Ensure Docker images are built for the correct platform (linux/amd64):
   ```bash
   docker buildx build --platform linux/amd64 -t holdwall-pos:latest .
   ```

### 3. ⚠️ Cluster Resource Capacity

**Issue**: Cluster nodes may not have sufficient CPU/memory for all workloads.

**Current Resource Requests** (after fixes):
- App pods: 250m CPU, 512Mi memory (3 replicas)
- Worker pods: 250m CPU, 512Mi memory (2 replicas)
- Outbox worker: 100m CPU, 256Mi memory (1 replica)
- Cronjobs: 100-250m CPU, 256-512Mi memory

**Total Minimum Requirements**:
- CPU: ~2.5 cores
- Memory: ~4.5 GiB

**Resolution Options**:
1. Scale up cluster nodes
2. Reduce replica counts temporarily
3. Use node autoscaling
4. Optimize resource requests further

## Deployment Verification

### Automated Verification Script

A comprehensive verification script has been created:

```bash
./scripts/verify-k8s-deployment.sh
```

This script checks:
- ✅ Namespace existence
- ✅ ExternalSecrets Operator and sync status
- ✅ Kubernetes Secret keys
- ✅ ConfigMap
- ✅ Deployment status and replica counts
- ✅ Pod statuses and health
- ✅ Init container statuses
- ✅ CronJob statuses
- ✅ Services and Ingress
- ✅ HPA status
- ✅ Node resources

### Manual Verification Commands

```bash
# Check all pods
kubectl get pods -n holdwall -o wide

# Check init container logs
kubectl logs -n holdwall <pod-name> -c db-migrate

# Check deployment status
kubectl rollout status deployment/holdwall-app -n holdwall

# Check events
kubectl get events -n holdwall --sort-by=.lastTimestamp

# Check ExternalSecret sync
kubectl describe externalsecret holdwall-secrets -n holdwall

# Check secret keys
kubectl get secret holdwall-secrets -n holdwall -o jsonpath='{.data}' | jq -r 'keys[]'
```

## Applying Fixes

To apply all fixes:

```bash
# Apply updated manifests
kubectl apply -k k8s/

# Wait for rollouts
kubectl rollout status deployment/holdwall-app -n holdwall
kubectl rollout status deployment/holdwall-worker -n holdwall
kubectl rollout status deployment/holdwall-outbox-worker -n holdwall

# Verify deployment
./scripts/verify-k8s-deployment.sh
```

## Next Steps

1. **Verify ExternalSecret Sync**: Ensure AWS Parameter Store values exist and ExternalSecret is syncing
2. **Clean Up Old Replicasets**: Remove old replicasets with wrong image tags
3. **Monitor Pod Startup**: Watch for init container completion and main container startup
4. **Check Resource Usage**: Monitor cluster resource utilization
5. **Verify Application Health**: Test application endpoints once pods are ready

## Files Modified

- `k8s/app-deployment.yaml` - Fixed init container Prisma path, added workingDir
- `k8s/worker-deployment.yaml` - Added workingDir
- `k8s/outbox-worker-deployment.yaml` - Added workingDir
- `k8s/cronjobs.yaml` - Reduced resource requests, added workingDir
- `scripts/verify-k8s-deployment.sh` - New comprehensive verification script

## Testing Checklist

- [ ] ExternalSecret syncs successfully
- [ ] All pods start without ImagePullBackOff
- [ ] Init containers complete successfully
- [ ] Main containers start and become ready
- [ ] CronJobs can schedule (no Pending state)
- [ ] Application health endpoint responds
- [ ] No missing secret key errors in logs
