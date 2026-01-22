# Operational Runbooks

This document contains operational procedures for running and maintaining Holdwall POS in production.

## Table of Contents

1. [System Entry Points & Call Graph](#system-entry-points--call-graph)
2. [Deployment Procedures](#deployment-procedures)
3. [Database Operations](#database-operations)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Troubleshooting](#troubleshooting)
6. [Incident Response](#incident-response)
7. [Performance Optimization](#performance-optimization)
8. [Security Operations](#security-operations)
9. [Disaster Recovery](#disaster-recovery)

## System Entry Points & Call Graph

### Application Startup Sequence

1. **Next.js Server** (`app/layout.tsx`)
   - Loads root layout and providers
   - Initializes global state

2. **Service Initialization** (`lib/integration/startup.ts::initializeServices()`)
   - Database connection check (`lib/db/client.ts`)
   - Redis cache connection (`lib/cache/redis.ts`)
   - Health monitoring start (`lib/integration/health-monitor.ts`)
   - Entity broadcaster initialization (`lib/events/broadcast-helper.ts`)
   - Metrics recording (`lib/observability/metrics.ts`)

3. **Background Workers** (separate processes):
   - **Outbox Worker** (`lib/workers/outbox-worker.ts`): Starts polling outbox table
   - **Pipeline Worker** (`lib/workers/pipeline-worker.ts`): Connects to Kafka and starts consuming

### API Request Flow

**Standard API Route**:
```
HTTP Request
  → Next.js Middleware (rate-limit, tracing, CORS)
  → API Route Handler (`app/api/**/route.ts`)
  → Authentication Check (`lib/auth/`)
  → Domain Service (`lib/**/service.ts`)
  → Database/External API
  → Event Publishing (`lib/events/outbox-publisher.ts`)
  → Response
```

**Key API Entry Points**:
- **Authentication**: `app/api/auth/[...nextauth]/route.ts` → NextAuth → `lib/auth/`
- **Evidence**: `app/api/evidence/route.ts` → `lib/evidence/vault-db.ts`
- **Signals**: `app/api/signals/route.ts` → `lib/signals/ingestion.ts`
- **Claims**: `app/api/claims/route.ts` → `lib/claims/extraction.ts`
- **AI**: `app/api/ai/orchestrate/route.ts` → `lib/ai/integration.ts`
- **GraphQL**: `app/api/graphql/route.ts` → `lib/graphql/resolvers.ts`

### Background Process Flow

**Outbox Pattern**:
```
API Action
  → OutboxPublisher.publish() → OutboxEvent (DB)
  → OutboxWorker.processOnce() (every 5s)
  → Kafka Producer → Kafka Topic
  → PipelineWorker consumes
  → Domain Handler executes
  → EntityBroadcaster.notify() → SSE/WebSocket
```

**Pipeline Worker Event Handlers**:
- `signal.ingested` → `lib/claims/extraction.ts` → Claim extraction
- `claim.extracted` → `lib/graph/engine.ts` → Graph update
- `graph.updated` → `lib/forecasts/service.ts` → Forecast generation

### AI Orchestration Call Graph

**AI Integration Entry** (`lib/ai/integration.ts`):
```
AdvancedAIIntegration
  ├─ RAG Pipeline: lib/ai/rag.ts → lib/evidence/vault-db.ts
  ├─ KAG Pipeline: lib/ai/kag.ts → lib/graph/engine.ts
  ├─ GNN Models: lib/graph/*.ts (CODEN, TIP-GNN, RGP, etc.)
  ├─ MCP Gateway: lib/mcp/gateway.ts → lib/mcp/stateless-executor.ts
  └─ Evaluation: lib/ai/deeptrace.ts, citeguard.ts, etc.
```

**MCP Tool Execution**:
```
MCP Gateway (lib/mcp/gateway.ts)
  → RBAC Check (lib/security/)
  → Tool Registry (lib/mcp/registry.ts)
  → Stateless Executor (lib/mcp/stateless-executor.ts)
  → Tool Implementation (lib/mcp/tool-builder.ts)
  → Audit Log (lib/audit/)
```

### Database Access Patterns

**Primary Access**:
- Prisma Client (`lib/db/client.ts`) → PostgreSQL
- Connection pooling via Prisma
- Transaction support for multi-step operations

**Caching Layer**:
- Redis (`lib/cache/redis.ts`) for:
  - API response caching
  - Rate limit counters
  - Session data
  - GraphQL query caching

**Vector Database**:
- ChromaDB/Pinecone/Qdrant for embeddings
- Accessed via `lib/vector/embeddings.ts` and `lib/search/`

### Operational Entry Points

**Health Checks**: `app/api/health/route.ts`
- Database connectivity
- Redis connectivity
- Memory usage
- Service status

**Metrics**: `lib/observability/metrics.ts`
- Prometheus-compatible metrics
- Custom business metrics
- SLO tracking (`lib/observability/slos.ts`)

**Logging**: `lib/logging/logger.ts`
- Winston-based structured logging
- OpenTelemetry integration (`lib/observability/opentelemetry.ts`)

**Tracing**: `lib/observability/tracing.ts`
- Distributed tracing via OpenTelemetry
- Request correlation IDs

## Deployment Procedures

### Standard Deployment

```bash
# 1. Pre-deployment checks
./scripts/deploy.sh staging

# 2. Verify health
curl https://staging.holdwall.com/api/health

# 3. Run smoke tests
npm run test:e2e

# 4. Deploy to production
./scripts/deploy.sh production https://holdwall.com
```

### Rollback Procedure

**Vercel:**
```bash
vercel rollback <deployment-url>
```

**Kubernetes:**
```bash
kubectl rollout undo deployment/holdwall-pos -n holdwall
```

**Docker:**
```bash
docker stop holdwall-pos
docker run -d --name holdwall-pos <previous-image-tag>
```

### Blue-Green Deployment

1. Deploy new version to green environment
2. Run smoke tests on green
3. Switch traffic from blue to green
4. Monitor green for issues
5. Keep blue running for quick rollback

## Database Operations

### Backup

```bash
# Manual backup
./scripts/backup-database.sh

# Automated backup (cron)
0 2 * * * /path/to/scripts/backup-database.sh
```

### Restore

```bash
# List available backups
ls -lh backups/

# Restore from backup
./scripts/restore-database.sh backups/holdwall-backup-20260121-120000.sql.gz
```

### Migration

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### Database Maintenance

```bash
# Analyze tables
psql $DATABASE_URL -c "ANALYZE;"

# Vacuum database
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

## Monitoring and Alerting

### Health Checks

```bash
# Basic health check
curl https://holdwall.com/api/health

# Detailed health check
curl https://holdwall.com/api/health | jq
```

### Metrics

- **Application Metrics**: `/api/metrics`
- **System Metrics**: Prometheus endpoint (if configured)
- **Custom Metrics**: Available via metrics service

### Log Monitoring

**Vercel:**
```bash
vercel logs --follow
```

**Kubernetes:**
```bash
kubectl logs -f deployment/holdwall-pos -n holdwall
```

**Docker:**
```bash
docker logs -f holdwall-pos
```

### Alert Thresholds

- **Response Time**: > 2 seconds (warning), > 5 seconds (critical)
- **Error Rate**: > 1% (warning), > 5% (critical)
- **Database Latency**: > 500ms (warning), > 1s (critical)
- **Memory Usage**: > 80% (warning), > 90% (critical)
- **CPU Usage**: > 70% (warning), > 85% (critical)

## Troubleshooting

### Application Not Starting

1. Check logs for errors
2. Verify environment variables
3. Check database connectivity
4. Verify port availability
5. Check disk space

```bash
# Check logs
docker logs holdwall-pos
# or
kubectl logs deployment/holdwall-pos

# Verify environment
env | grep -E "DATABASE_URL|NEXTAUTH"
```

### Database Connection Issues

1. Verify DATABASE_URL format
2. Check network connectivity
3. Verify database credentials
4. Check firewall rules
5. Verify database is running

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### High Memory Usage

1. Check for memory leaks
2. Review recent deployments
3. Check for large queries
4. Review caching strategy
5. Consider scaling up

```bash
# Check memory usage
docker stats holdwall-pos
# or
kubectl top pod -n holdwall

# Check Node.js memory
curl https://holdwall.com/api/health | jq '.checks.memory'
```

### Slow Response Times

1. Check database query performance
2. Review API endpoint performance
3. Check external service latency
4. Review caching effectiveness
5. Check for rate limiting

```bash
# Check slow queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check API performance
curl -w "@curl-format.txt" https://holdwall.com/api/overview
```

### Push Notifications Not Working

1. Verify VAPID keys are set
2. Check service worker registration
3. Verify browser permissions
4. Check server logs for errors
5. Test push subscription endpoint

```bash
# Check VAPID keys
echo $VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY

# Test push endpoint
curl -X POST https://holdwall.com/api/push/subscribe \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"test","keys":{"p256dh":"test","auth":"test"}}'
```

## Incident Response

### Severity Levels

- **P0 (Critical)**: System down, data loss, security breach
- **P1 (High)**: Major feature broken, significant performance degradation
- **P2 (Medium)**: Minor feature broken, moderate performance issues
- **P3 (Low)**: Cosmetic issues, minor bugs

### Response Procedures

1. **Acknowledge** the incident
2. **Assess** severity and impact
3. **Communicate** to stakeholders
4. **Investigate** root cause
5. **Resolve** the issue
6. **Document** the incident
7. **Post-mortem** review

### Common Incidents

#### Database Outage

1. Check database server status
2. Verify network connectivity
3. Check connection pool limits
4. Review recent migrations
5. Consider failover to replica

#### API Rate Limiting

1. Check rate limit configuration
2. Review traffic patterns
3. Adjust rate limits if needed
4. Implement request queuing
5. Scale horizontally if needed

#### Security Incident

1. Isolate affected systems
2. Preserve logs and evidence
3. Assess data exposure
4. Notify security team
5. Implement fixes
6. Monitor for further issues

## Performance Optimization

### Database Optimization

```bash
# Analyze query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT ..."

# Create indexes
npx prisma migrate dev --create-only
# Edit migration to add indexes
npx prisma migrate dev

# Vacuum and analyze
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

### Caching Strategy

1. Enable Redis caching
2. Configure cache TTLs
3. Implement cache invalidation
4. Monitor cache hit rates
5. Adjust cache size as needed

### API Optimization

1. Implement response compression
2. Enable HTTP/2
3. Optimize database queries
4. Implement pagination
5. Use CDN for static assets

## Security Operations

### Security Scanning

```bash
# Run security audit
npm audit

# Run Snyk scan
npx snyk test

# Check for secrets
npx trufflehog filesystem . --json
```

### Access Control

1. Review user permissions
2. Audit API access logs
3. Check for unauthorized access
4. Rotate credentials regularly
5. Implement MFA where possible

### Vulnerability Management

1. Monitor security advisories
2. Update dependencies regularly
3. Patch vulnerabilities promptly
4. Test patches in staging
5. Deploy patches to production

## Disaster Recovery

### Recovery Procedures

1. **Assess** the disaster
2. **Activate** disaster recovery plan
3. **Restore** from backups
4. **Verify** system integrity
5. **Resume** operations
6. **Document** recovery process

### Backup Verification

```bash
# List backups
ls -lh backups/

# Verify backup integrity
gunzip -t backups/holdwall-backup-*.sql.gz

# Test restore in staging
./scripts/restore-database.sh backups/holdwall-backup-*.sql.gz
```

### RTO/RPO Targets

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour (daily backups)

### Contact Information

- **On-Call Engineer**: Check PagerDuty
- **Database Team**: db-team@holdwall.com
- **Security Team**: security@holdwall.com
- **Infrastructure Team**: infra@holdwall.com

## Maintenance Windows

### Scheduled Maintenance

- **Frequency**: Monthly
- **Duration**: 2 hours
- **Notification**: 1 week in advance
- **Activities**:
  - Database maintenance
  - Security updates
  - Performance optimization
  - Backup verification

### Emergency Maintenance

- **Notification**: As soon as possible
- **Communication**: Status page + email
- **Rollback Plan**: Always available

## Escalation Procedures

1. **Level 1**: On-call engineer
2. **Level 2**: Team lead
3. **Level 3**: Engineering manager
4. **Level 4**: CTO

## Additional Resources

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [API Documentation](./docs/API.md)
- [Architecture Documentation](./docs/ARCHITECTURE.md)
