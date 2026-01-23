# Kubernetes Deployment Status - January 22, 2026

## Current Status

### ✅ Fixes Applied

1. **Prisma Schema Path Fixed**
   - Updated init container command to: `cd /app && npx prisma migrate deploy`
   - This ensures Prisma runs from the correct working directory
   - File: `k8s/app-deployment.yaml`

2. **CronJob Resource Requests Reduced**
   - All cronjobs now have lower resource requests to allow scheduling
   - File: `k8s/cronjobs.yaml`

3. **Working Directory Added to All Containers**
   - All containers now have `workingDir: /app` for consistency
   - Files: All deployment and cronjob YAMLs

4. **Deployment Verification Script Created**
   - Comprehensive script: `scripts/verify-k8s-deployment.sh`
   - Checks all aspects of the deployment

### ⚠️ Current Issues

1. **Resource Constraints**
   - Cluster nodes have limited CPU/memory (1.9 cores, 3.3GB per node)
   - New pods are pending due to insufficient resources
   - Old failing pods are consuming resources

2. **Missing Secrets**
   - `REDIS_URL` and `KAFKA_BROKERS` are missing from Kubernetes Secret
   - ExternalSecrets Operator is not installed
   - Manual secret creation required

3. **Image Pull Failures**
   - Some old replicasets reference non-existent image tags
   - Old image tags: `20260122-093639`, `20260122-094204`
   - Current working tag: `20260122-141807`

4. **Init Container Status**
   - New pod `holdwall-app-588f879784-br9q7` has updated Prisma command but is pending
   - Old pod `holdwall-app-86db7d7ff6-ccbhf` still running old command

## Immediate Actions Required

### 1. Clean Up Old Replicasets

```bash
# Delete old replicasets with 0 replicas
kubectl delete replicaset -n holdwall \
  holdwall-app-5cd7458d7b \
  holdwall-app-8687965c56 \
  holdwall-app-8c6465c7d \
  holdwall-app-cb89b5fd5 \
  holdwall-outbox-worker-56f966c698 \
  holdwall-outbox-worker-67445cdf6c \
  holdwall-outbox-worker-84746dc6d7 \
  holdwall-worker-57f56bcd9c \
  holdwall-worker-67489bd55b
```

### 2. Add Missing Secrets

```bash
# Option A: If ExternalSecrets Operator is installed
# Ensure AWS Parameter Store has:
# - /holdwall/prod/app/REDIS_URL
# - /holdwall/prod/workers/KAFKA_BROKERS
# Then force sync:
kubectl annotate externalsecret holdwall-secrets -n holdwall force-sync=$(date +%s)

# Option B: Manual secret creation
kubectl create secret generic holdwall-secrets \
  --from-literal=REDIS_URL="redis://your-redis-host:6379" \
  --from-literal=KAFKA_BROKERS="your-kafka-brokers:9092" \
  -n holdwall --dry-run=client -o yaml | kubectl apply -f -
```

### 3. Scale Down Temporarily (if needed)

```bash
# Reduce replicas to free resources
kubectl scale deployment holdwall-app -n holdwall --replicas=1
kubectl scale deployment holdwall-worker -n holdwall --replicas=1
```

### 4. Monitor New Pod Startup

```bash
# Watch for new pods with fixed configuration
kubectl get pods -n holdwall -w

# Check init container logs once pod starts
kubectl logs -n holdwall <new-pod-name> -c db-migrate
```

## Verification Commands

```bash
# Run comprehensive verification
./scripts/verify-k8s-deployment.sh

# Check pod status
kubectl get pods -n holdwall -o wide

# Check deployment status
kubectl rollout status deployment/holdwall-app -n holdwall

# Check events
kubectl get events -n holdwall --sort-by=.lastTimestamp | tail -20

# Check resource usage
kubectl top nodes
kubectl top pods -n holdwall
```

## Expected Outcomes

Once resources are freed and secrets are added:

1. ✅ New pods should schedule successfully
2. ✅ Init containers should complete Prisma migrations
3. ✅ Main containers should start and become ready
4. ✅ CronJobs should be able to schedule
5. ✅ All deployments should reach desired replica counts

## Next Steps After Pods Start

1. **Verify Application Health**
   ```bash
   kubectl port-forward -n holdwall svc/holdwall-app 3000:3000
   curl http://localhost:3000/api/health
   ```

2. **Monitor Logs**
   ```bash
   kubectl logs -n holdwall -l app=holdwall,component=app -f
   ```

3. **Check Metrics**
   ```bash
   kubectl get hpa -n holdwall
   kubectl top pods -n holdwall
   ```

## Files Modified

- ✅ `k8s/app-deployment.yaml` - Fixed Prisma command, added workingDir
- ✅ `k8s/worker-deployment.yaml` - Added workingDir
- ✅ `k8s/outbox-worker-deployment.yaml` - Added workingDir
- ✅ `k8s/cronjobs.yaml` - Reduced resources, added workingDir
- ✅ `scripts/verify-k8s-deployment.sh` - New verification script
- ✅ `K8S_DEPLOYMENT_FIXES.md` - Detailed fixes documentation

## Notes

- The Prisma command fix uses `cd /app && npx prisma migrate deploy` which ensures Prisma runs from the correct directory
- All containers now have explicit `workingDir: /app` for consistency
- Resource requests have been optimized to allow scheduling on smaller clusters
- ExternalSecrets configuration is correct but requires the operator to be installed
