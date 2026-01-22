# Kubernetes Manifests for Holdwall POS

Production-ready Kubernetes manifests for self-hosted deployment.

## Prerequisites

- Kubernetes cluster (1.24+)
- Ingress controller (nginx recommended)
- cert-manager (for TLS certificates)
- PostgreSQL, Redis, Kafka, ChromaDB deployed in cluster

## Deployment

### 1. Update Secrets

Edit `secrets.yaml` or use sealed-secrets/external-secrets operator:

```bash
# Using kubectl (not recommended for production)
kubectl create secret generic holdwall-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=NEXTAUTH_SECRET="..." \
  # ... other secrets
```

### 2. Deploy

```bash
# Using kubectl
kubectl apply -k k8s/

# Or using kustomize
kubectl apply -k k8s/
```

### 3. Verify

```bash
kubectl get pods -n holdwall
kubectl get svc -n holdwall
kubectl get ingress -n holdwall
```

## Components

- **App Deployment**: Main Next.js application (3+ replicas, HPA enabled)
- **Worker Deployment**: Kafka pipeline workers (2 replicas)
- **Outbox Worker**: Event outbox publisher (1 replica)
- **CronJobs**: Backup and reindex jobs
- **HPA**: Auto-scaling based on CPU/memory
- **PDB**: Pod disruption budget for safe rollouts
- **Network Policy**: Restricts pod-to-pod communication
- **Ingress**: External access with TLS

## Scaling

HPA automatically scales app pods based on CPU (70%) and memory (80%) utilization.

Manual scaling:
```bash
kubectl scale deployment holdwall-app -n holdwall --replicas=5
```

## Monitoring

Health checks are available at `/api/health` endpoint.

## Secrets Management

For production, use:
- Sealed Secrets: `kubeseal`
- External Secrets Operator
- Vault integration

Never commit real secrets to git.
