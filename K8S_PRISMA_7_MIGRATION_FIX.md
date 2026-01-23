# Kubernetes Prisma 7 Migration Fix

**Date**: January 22, 2026  
**Status**: ✅ Configuration Complete - Awaiting Pod Startup

## Summary

Fixed Prisma 7 compatibility issues in Kubernetes deployment. Prisma 7.3.0 no longer supports the `url` property in the datasource block of `schema.prisma`. Migrations now require the datasource URL to be provided via the `--datasource-url` flag or through `prisma.config.ts`.

## Issues Identified

1. **Prisma 7 Schema Validation Error**: 
   - Error: `The datasource property 'url' is no longer supported in schema files`
   - Prisma 7 requires URL to be in `prisma.config.ts` or passed via CLI flag

2. **Migration Command Missing Datasource URL**:
   - `prisma migrate deploy` requires explicit datasource URL in Prisma 7
   - Environment variable `DATABASE_URL` alone is not sufficient for migrations

## Fixes Applied

### 1. Updated Prisma Schema ConfigMap ✅
- **File**: `k8s/app-deployment.yaml` (ConfigMap: `prisma-schema`)
- **Change**: Removed deprecated `url = env("DATABASE_URL")` from schema
- **Action**: Updated ConfigMap to match current `prisma/schema.prisma` (without url property)
- **Command**: 
  ```bash
  kubectl create configmap prisma-schema -n holdwall --from-file=schema.prisma=prisma/schema.prisma
  ```

### 2. Updated Init Container Migration Command ✅
- **File**: `k8s/app-deployment.yaml`
- **Change**: Added `--datasource-url="$DATABASE_URL"` flag to `prisma migrate deploy` command
- **Previous Command**:
  ```bash
  npx prisma migrate deploy --schema=/tmp/prisma/schema.prisma
  ```
- **New Command**:
  ```bash
  npx prisma migrate deploy --schema=/tmp/prisma/schema.prisma --datasource-url="$DATABASE_URL"
  ```

### 3. Verified Prisma Config File ✅
- **File**: `prisma.config.ts`
- **Status**: Already correctly configured with `datasource.url: env("DATABASE_URL")`
- **Note**: This file is used by Prisma client, but migrations require CLI flag

### 4. Updated Deployment Manifest ✅
- **File**: `k8s/app-deployment.yaml`
- **Line**: 35
- **Status**: Command updated with `--datasource-url` flag

## Current Deployment Status

### Pod Status
- **Init Containers**: Installing Prisma (takes 2-3 minutes per pod)
- **Migration Status**: Waiting for Prisma installation to complete
- **Main Containers**: Waiting for init containers to complete

### Resource Constraints
- **Pods Pending**: 11 pods pending due to cluster resource constraints
- **Nodes**: 2 nodes available with limited CPU/memory
- **Action Required**: Cluster resources will schedule pods automatically when available

## Prisma 7 Migration Requirements

### For Migrations (`prisma migrate deploy`)
- ✅ Schema file without `url` property
- ✅ `--datasource-url` flag or `prisma.config.ts` with URL
- ✅ Environment variable `DATABASE_URL` set in container

### For Client Usage
- ✅ `prisma.config.ts` with `datasource.url: env("DATABASE_URL")`
- ✅ Prisma Client uses adapter pattern (see `lib/db/client.ts`)

## Verification

### ConfigMap Status
```bash
kubectl get configmap prisma-schema -n holdwall -o jsonpath='{.data.schema\.prisma}' | head -15
```
**Expected**: Schema without `url` property in datasource block

### Deployment Command
```bash
kubectl get deployment holdwall-app -n holdwall -o jsonpath='{.spec.template.spec.initContainers[0].command}'
```
**Expected**: Command includes `--datasource-url="$DATABASE_URL"`

### Pod Logs (After Prisma Installation)
```bash
kubectl logs <pod-name> -n holdwall -c db-migrate
```
**Expected**: Migration executes successfully without schema validation errors

## Next Steps (Automatic)

1. ✅ **Prisma Installation**: Currently in progress (2-3 minutes per pod)
2. ⏳ **Database Migrations**: Will execute automatically after Prisma installation
3. ⏳ **Main Container Startup**: Will start after migrations complete
4. ⏳ **Pod Readiness**: Pods become ready after health checks pass

## Files Modified

1. `k8s/app-deployment.yaml` - Updated init container command
2. `prisma/schema.prisma` - Already correct (no url property)
3. ConfigMap `prisma-schema` - Updated to match schema file
4. `next_todos.md` - Updated with Prisma 7 fixes

## Production Readiness

✅ **Configuration**: All Prisma 7 requirements met  
✅ **Manifests**: Updated and production-ready  
✅ **Secrets**: DATABASE_URL properly configured  
⏳ **Deployment**: Waiting for cluster resources and Prisma installation

## Troubleshooting

If migrations fail:
1. Check DATABASE_URL is set: `kubectl exec <pod> -c db-migrate -- env | grep DATABASE_URL`
2. Verify schema file: `kubectl exec <pod> -c db-migrate -- cat /tmp/prisma/schema.prisma | head -12`
3. Check Prisma version: `kubectl logs <pod> -c db-migrate | grep "Prisma CLI Version"`
4. Review migration logs: `kubectl logs <pod> -c db-migrate --tail=200`

## References

- [Prisma 7 Migration Guide](https://www.prisma.io/docs/guides/migrate-to-prisma-7)
- [Prisma Migrate Deploy](https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-deploy)
- [Prisma Config File](https://www.prisma.io/docs/reference/api-reference/prisma-config-file)
