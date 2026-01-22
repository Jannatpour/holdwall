# Scenario Playbooks

This document provides operational playbooks for handling failures, abuse, and edge cases across security, reliability, data integrity, AI quality, and client/PWA scenarios.

## Table of Contents

1. [Security Scenarios](#security-scenarios)
2. [Reliability/SRE Scenarios](#reliabilitysre-scenarios)
3. [Data Integrity Scenarios](#data-integrity-scenarios)
4. [AI Quality Scenarios](#ai-quality-scenarios)
5. [Client/PWA Scenarios](#clientpwa-scenarios)

---

## Security Scenarios

### SC-SEC-001: Tenant Isolation Failure

**Scenario**: User from Tenant A can access data from Tenant B.

**Detection**:
- Audit logs show cross-tenant data access
- User reports seeing incorrect data
- Monitoring alerts on unusual query patterns

**Response**:
1. **Immediate**: Revoke affected user sessions
2. **Investigation**:
   - Review audit logs for affected tenant
   - Check database queries for missing `tenantId` filters
   - Review API route handlers for tenant validation
3. **Fix**:
   - Add `tenantId` filter to affected queries
   - Add tenant validation middleware
   - Update tests to verify tenant isolation
4. **Prevention**:
   - Add automated tests for tenant isolation
   - Add query audit logging
   - Regular security audits

**Files to Check**:
- `lib/db/client.ts` - Database query helpers
- `app/api/**/route.ts` - API route handlers
- `lib/graphql/resolvers.ts` - GraphQL resolvers

**Verification**:
```bash
# Test cross-tenant access
curl -H "Authorization: Bearer $TOKEN_TENANT_A" \
  https://api.holdwall.com/api/evidence?tenantId=tenant-b
# Should return 403 Forbidden
```

---

### SC-SEC-002: Authentication Misconfiguration

**Scenario**: JWT tokens not expiring, sessions persisting indefinitely.

**Detection**:
- Users report staying logged in after logout
- Security audit reveals expired tokens still valid
- Session table shows old sessions

**Response**:
1. **Immediate**: Force token rotation for all users
2. **Investigation**:
   - Check NextAuth configuration (`app/api/auth/[...nextauth]/route.ts`)
   - Review JWT expiration settings
   - Check session cleanup jobs
3. **Fix**:
   - Update JWT expiration to reasonable value (e.g., 24 hours)
   - Add session cleanup cron job
   - Implement token refresh mechanism
4. **Prevention**:
   - Add session expiration monitoring
   - Regular security audits
   - Automated token rotation

**Files to Check**:
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth/` - Authentication utilities
- `k8s/cronjobs.yaml` - Session cleanup job

---

### SC-SEC-003: SSRF in Signal Ingestion

**Scenario**: Attacker submits malicious URL in signal ingestion that accesses internal services.

**Detection**:
- Unusual network requests from application server
- Internal service logs show requests from app server
- Security monitoring alerts

**Response**:
1. **Immediate**: Block affected signal source
2. **Investigation**:
   - Review signal ingestion logs
   - Check URL validation in `lib/signals/ingestion.ts`
   - Review network access patterns
3. **Fix**:
   - Enhance URL validation (block private IPs, localhost)
   - Add URL allowlist for trusted domains
   - Implement request timeouts
4. **Prevention**:
   - Add SSRF detection in security tests
   - Network segmentation
   - Regular security audits

**Files to Check**:
- `lib/signals/ingestion.ts`
- `app/api/signals/route.ts`
- `lib/utils/sanitize.ts`

**Verification**:
```bash
# Test SSRF protection
curl -X POST https://api.holdwall.com/api/signals \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'
# Should be rejected
```

---

### SC-SEC-004: Prompt Injection Attack

**Scenario**: Attacker injects malicious prompts in AI orchestration that bypass safety checks.

**Detection**:
- AI responses contain unexpected content
- Evaluation framework flags unsafe outputs
- User reports inappropriate AI behavior

**Response**:
1. **Immediate**: Disable affected AI endpoints
2. **Investigation**:
   - Review prompt injection logs
   - Check input sanitization in `lib/ai/orchestrator.ts`
   - Review prompt registry enforcement
3. **Fix**:
   - Enhance input sanitization
   - Add prompt injection detection
   - Enforce prompt registry usage
4. **Prevention**:
   - Add prompt injection tests
   - Regular AI safety audits
   - Monitor evaluation framework alerts

**Files to Check**:
- `lib/ai/orchestrator.ts`
- `lib/ai/prompt-registry.ts`
- `lib/utils/sanitize.ts`

---

### SC-SEC-005: Data Exfiltration via MCP Tools

**Scenario**: MCP tool execution allows unauthorized data access or exfiltration.

**Detection**:
- Unusual tool execution patterns
- Audit logs show unauthorized tool access
- Data access outside expected patterns

**Response**:
1. **Immediate**: Revoke affected tool permissions
2. **Investigation**:
   - Review MCP gateway audit logs
   - Check RBAC/ABAC enforcement
   - Review tool allowlists
3. **Fix**:
   - Tighten tool permissions
   - Add data access logging
   - Implement tool execution boundaries
4. **Prevention**:
   - Regular tool permission audits
   - Automated tool access monitoring
   - Principle of least privilege

**Files to Check**:
- `lib/mcp/gateway.ts`
- `lib/mcp/stateless-executor.ts`
- `lib/audit/` - Audit logging

---

### SC-SEC-006: Supply Chain Attack

**Scenario**: Compromised npm package introduces malicious code.

**Detection**:
- Security scanning alerts
- Unusual application behavior
- Dependency vulnerability reports

**Response**:
1. **Immediate**: Freeze deployments
2. **Investigation**:
   - Review dependency changes
   - Check security advisories
   - Analyze application behavior
3. **Fix**:
   - Remove compromised package
   - Update to secure version
   - Review code changes
4. **Prevention**:
   - Automated dependency scanning in CI
   - Regular security audits
   - Dependency pinning
   - Supply chain security monitoring

**Verification**:
```bash
# Run security audit
npm audit
# Check for known vulnerabilities
```

---

## Reliability/SRE Scenarios

### SC-REL-001: Database Outage

**Scenario**: PostgreSQL becomes unavailable or connection pool exhausted.

**Detection**:
- Health check endpoint returns database failure
- Application errors show connection timeouts
- Monitoring alerts on database latency

**Response**:
1. **Immediate**: Enable degraded mode
2. **Investigation**:
   - Check database server status
   - Review connection pool metrics
   - Check for connection leaks
3. **Fix**:
   - Restart database if needed
   - Scale connection pool
   - Fix connection leaks
4. **Recovery**:
   - Verify database connectivity
   - Disable degraded mode
   - Monitor for stability

**Files to Check**:
- `lib/db/client.ts` - Connection handling
- `app/api/health/route.ts` - Health checks
- `lib/integration/startup.ts` - Startup checks

**Degraded Mode**:
- Read-only operations from cache
- Queue writes for later processing
- Display maintenance message to users

---

### SC-REL-002: Redis Cache Outage

**Scenario**: Redis becomes unavailable, causing cache misses and performance degradation.

**Detection**:
- Cache health check fails
- Increased database load
- Slower API response times

**Response**:
1. **Immediate**: Enable in-memory cache fallback
2. **Investigation**:
   - Check Redis server status
   - Review cache connection metrics
   - Check network connectivity
3. **Fix**:
   - Restart Redis if needed
   - Check Redis configuration
   - Verify network connectivity
4. **Recovery**:
   - Verify Redis connectivity
   - Warm cache with critical data
   - Monitor cache hit rates

**Files to Check**:
- `lib/cache/redis.ts` - Cache client
- `lib/cache/` - Cache strategies with fallback

**Fallback Behavior**:
- In-memory cache for critical data
- Direct database queries for non-cached data
- Graceful performance degradation

---

### SC-REL-003: Partial Kafka Failure

**Scenario**: Kafka broker fails, causing event processing delays.

**Detection**:
- Kafka consumer lag increases
- Events not being processed
- Outbox table growing

**Response**:
1. **Immediate**: Monitor outbox table size
2. **Investigation**:
   - Check Kafka broker status
   - Review consumer group lag
   - Check network connectivity
3. **Fix**:
   - Restart Kafka broker if needed
   - Scale consumer instances
   - Check partition assignments
4. **Recovery**:
   - Verify event processing resumes
   - Monitor consumer lag
   - Process backlogged events

**Files to Check**:
- `lib/events/kafka-consumer.ts`
- `lib/workers/pipeline-worker.ts`
- `lib/events/outbox-publisher.ts`

---

### SC-REL-004: Backpressure from High Load

**Scenario**: System receives more requests than it can process.

**Detection**:
- Response times increasing
- Queue depths growing
- Error rates rising

**Response**:
1. **Immediate**: Enable rate limiting
2. **Investigation**:
   - Review request patterns
   - Check system resource usage
   - Identify bottlenecks
3. **Fix**:
   - Scale horizontally (add instances)
   - Optimize slow queries
   - Increase rate limits if appropriate
4. **Prevention**:
   - Auto-scaling based on metrics
   - Load testing before releases
   - Circuit breakers for external services

**Files to Check**:
- `lib/middleware/rate-limit.ts`
- `k8s/app-hpa.yaml` - Horizontal Pod Autoscaler

---

### SC-REL-005: Stuck Background Jobs

**Scenario**: Background job hangs or fails to complete.

**Detection**:
- Job execution time exceeds threshold
- Job status shows "RUNNING" for extended period
- Related data not updating

**Response**:
1. **Immediate**: Check job status
2. **Investigation**:
   - Review job logs
   - Check for deadlocks
   - Verify job timeout settings
3. **Fix**:
   - Kill stuck job if safe
   - Fix underlying issue
   - Retry job if appropriate
4. **Prevention**:
   - Add job timeouts
   - Implement job health checks
   - Monitor job execution times

**Files to Check**:
- `lib/workers/outbox-worker.ts`
- `lib/workers/pipeline-worker.ts`
- `k8s/cronjobs.yaml`

---

### SC-REL-006: DLQ Growth

**Scenario**: Dead letter queue grows due to repeated failures.

**Detection**:
- DLQ size exceeds threshold
- Failed event count increasing
- Related features not working

**Response**:
1. **Immediate**: Review DLQ contents
2. **Investigation**:
   - Analyze failed events
   - Identify failure patterns
   - Check downstream service health
3. **Fix**:
   - Fix underlying issue
   - Retry failed events if safe
   - Update event handlers
4. **Prevention**:
   - Monitor DLQ size
   - Alert on DLQ growth
   - Regular DLQ cleanup

**Files to Check**:
- `lib/events/kafka-dlq.ts`
- `lib/events/kafka-consumer.ts`

---

### SC-REL-007: Cache Stampede

**Scenario**: Cache expiration causes thundering herd of requests.

**Detection**:
- Sudden spike in database load
- Multiple requests for same data
- Cache hit rate drops

**Response**:
1. **Immediate**: Warm cache with critical data
2. **Investigation**:
   - Review cache TTLs
   - Check cache invalidation patterns
   - Identify hot keys
3. **Fix**:
   - Implement cache locking
   - Add request deduplication
   - Stagger cache expiration
4. **Prevention**:
   - Cache locking for hot keys
   - Request deduplication
   - Gradual cache warming

**Files to Check**:
- `lib/cache/` - Cache strategies
- `lib/middleware/cache.ts`

---

### SC-REL-008: Rate Limit Failures

**Scenario**: Rate limiting not working, allowing excessive requests.

**Detection**:
- Unusual request patterns
- System overload
- Rate limit metrics show no limits applied

**Response**:
1. **Immediate**: Manually block abusive IPs
2. **Investigation**:
   - Check rate limit middleware
   - Verify Redis connectivity
   - Review rate limit configuration
3. **Fix**:
   - Fix rate limit middleware
   - Restore Redis connectivity
   - Update rate limit rules
4. **Prevention**:
   - Monitor rate limit effectiveness
   - Regular rate limit testing
   - Fallback rate limiting

**Files to Check**:
- `lib/middleware/rate-limit.ts`
- `lib/rate-limit/redis.ts`

---

## Data Integrity Scenarios

### SC-DATA-001: Schema Migration Failure

**Scenario**: Database migration fails in production, leaving schema inconsistent.

**Detection**:
- Migration error logs
- Application errors on startup
- Schema version mismatch

**Response**:
1. **Immediate**: Stop application deployment
2. **Investigation**:
   - Review migration logs
   - Check schema state
   - Identify failed migration
3. **Fix**:
   - Rollback migration if possible
   - Fix migration script
   - Re-run migration in staging
4. **Recovery**:
   - Verify schema consistency
   - Test application functionality
   - Resume deployment

**Files to Check**:
- `prisma/migrations/` - Migration files
- `lib/db/migrations.ts`

**Prevention**:
- Test migrations in staging
- Backup before migrations
- Rollback procedures

---

### SC-DATA-002: PII Leakage in Logs

**Scenario**: Personal identifiable information appears in application logs.

**Detection**:
- Log analysis reveals PII
- Security audit findings
- User reports

**Response**:
1. **Immediate**: Remove PII from logs
2. **Investigation**:
   - Review all log statements
   - Check log aggregation
   - Identify PII sources
3. **Fix**:
   - Redact PII from logs
   - Update logging utilities
   - Add PII detection
4. **Prevention**:
   - PII detection in CI
   - Log sanitization utilities
   - Regular log audits

**Files to Check**:
- `lib/logging/logger.ts`
- All files with `logger.*` calls

---

### SC-DATA-003: GDPR Deletion Incomplete

**Scenario**: GDPR deletion request doesn't remove all user data.

**Detection**:
- User reports data still present
- Audit shows incomplete deletion
- Compliance violation

**Response**:
1. **Immediate**: Complete deletion manually
2. **Investigation**:
   - Review deletion process
   - Check cascading deletes
   - Verify all data sources
3. **Fix**:
   - Fix deletion logic
   - Add missing cascades
   - Update deletion tests
4. **Prevention**:
   - Comprehensive deletion tests
   - Regular deletion audits
   - Automated deletion verification

**Files to Check**:
- `app/api/compliance/gdpr/delete/route.ts`
- Prisma schema (cascade deletes)

---

### SC-DATA-004: Evidence Tampering

**Scenario**: Evidence integrity compromised, signatures invalid.

**Detection**:
- Evidence verification fails
- Signature mismatch
- Audit reveals tampering

**Response**:
1. **Immediate**: Disable affected evidence
2. **Investigation**:
   - Review evidence access logs
   - Check signature verification
   - Identify tampering source
3. **Fix**:
   - Restore from backup if available
   - Re-sign evidence
   - Fix security vulnerabilities
4. **Prevention**:
   - Regular integrity checks
   - Access control enforcement
   - Audit logging

**Files to Check**:
- `lib/evidence/vault-db.ts` - Evidence storage
- Evidence signing/verification logic

---

### SC-DATA-005: Retention Policy Not Enforced

**Scenario**: Data retention policies not deleting old data as configured.

**Detection**:
- Database size growing beyond expected
- Old data still present
- Retention job failures

**Response**:
1. **Immediate**: Run retention job manually
2. **Investigation**:
   - Review retention job logs
   - Check retention policies
   - Verify job scheduling
3. **Fix**:
   - Fix retention job
   - Update retention policies
   - Verify job execution
4. **Prevention**:
   - Monitor retention job execution
   - Regular retention audits
   - Automated retention verification

**Files to Check**:
- `k8s/cronjobs.yaml` - Retention jobs
- `app/api/backup/cleanup/route.ts`

---

## AI Quality Scenarios

### SC-AI-001: Hallucinations with Citations

**Scenario**: AI generates content with false citations or unsupported claims.

**Detection**:
- Evaluation framework flags low citation faithfulness
- User reports incorrect citations
- DeepTRACE audit reveals issues

**Response**:
1. **Immediate**: Disable affected AI endpoint if severe
2. **Investigation**:
   - Review evaluation results
   - Check citation generation logic
   - Analyze prompt templates
3. **Fix**:
   - Improve citation generation
   - Update prompt templates
   - Enhance evaluation thresholds
4. **Prevention**:
   - Continuous evaluation in CI
   - Citation faithfulness monitoring
   - Regular prompt audits

**Files to Check**:
- `lib/ai/deeptrace.ts` - Citation audit
- `lib/ai/citeguard.ts` - Citation validation
- `lib/ai/orchestrator.ts` - Citation generation

---

### SC-AI-002: Model Provider Outage

**Scenario**: AI model provider (OpenAI, Anthropic, etc.) becomes unavailable.

**Detection**:
- Provider API errors
- AI endpoints failing
- Monitoring alerts

**Response**:
1. **Immediate**: Enable fallback provider
2. **Investigation**:
   - Check provider status
   - Review error logs
   - Verify API keys
3. **Fix**:
   - Switch to fallback provider
   - Update provider configuration
   - Implement circuit breakers
4. **Prevention**:
   - Multi-provider support
   - Circuit breakers
   - Provider health monitoring

**Files to Check**:
- `lib/ai/orchestrator.ts` - Provider selection
- `lib/llm/providers.ts` - Provider abstraction
- `lib/resilience/circuit-breaker.ts`

---

### SC-AI-003: Cost Runaway

**Scenario**: AI API costs exceed budget due to unbounded usage.

**Detection**:
- Cost monitoring alerts
- Unusual API usage patterns
- Budget exceeded

**Response**:
1. **Immediate**: Enable cost limits
2. **Investigation**:
   - Review API usage logs
   - Identify cost drivers
   - Check for loops or retries
3. **Fix**:
   - Add cost limits
   - Fix cost drivers
   - Optimize API usage
4. **Prevention**:
   - Cost monitoring and alerting
   - Usage limits per tenant
   - Regular cost reviews

**Files to Check**:
- `lib/metering/service.ts` - Usage tracking
- `lib/ai/orchestrator.ts` - API calls

---

### SC-AI-004: Prompt Jailbreak

**Scenario**: User input bypasses safety checks via prompt injection.

**Detection**:
- Unsafe AI outputs
- Evaluation framework alerts
- User reports

**Response**:
1. **Immediate**: Disable affected endpoint
2. **Investigation**:
   - Review prompt injection logs
   - Check input sanitization
   - Analyze jailbreak technique
3. **Fix**:
   - Enhance input sanitization
   - Update safety checks
   - Improve prompt templates
4. **Prevention**:
   - Prompt injection testing
   - Regular safety audits
   - Prompt registry enforcement

**Files to Check**:
- `lib/ai/prompt-registry.ts`
- `lib/utils/sanitize.ts`
- `lib/ai/orchestrator.ts`

---

### SC-AI-005: Unsafe Tool Calls

**Scenario**: MCP tool execution performs unsafe operations.

**Detection**:
- Tool execution errors
- Security alerts
- Unauthorized operations

**Response**:
1. **Immediate**: Revoke tool permissions
2. **Investigation**:
   - Review tool execution logs
   - Check RBAC/ABAC enforcement
   - Analyze tool behavior
3. **Fix**:
   - Update tool permissions
   - Fix access control
   - Remove unsafe tools
4. **Prevention**:
   - Tool allowlists
   - Regular tool audits
   - Principle of least privilege

**Files to Check**:
- `lib/mcp/gateway.ts` - Tool execution
- `lib/mcp/stateless-executor.ts`
- `lib/security/` - Access control

---

### SC-AI-006: Eval Drift

**Scenario**: AI evaluation metrics degrade over time without detection.

**Detection**:
- Evaluation scores trending down
- User reports quality issues
- Comparison with baseline

**Response**:
1. **Immediate**: Review recent model changes
2. **Investigation**:
   - Compare current vs baseline metrics
   - Review model updates
   - Check prompt changes
3. **Fix**:
   - Revert problematic changes
   - Update evaluation thresholds
   - Improve model configuration
4. **Prevention**:
   - Continuous evaluation
   - Regression budgets
   - Automated alerts on drift

**Files to Check**:
- `lib/ai/judge-framework.ts` - Evaluation
- `lib/evaluation/harness.ts`

---

## Client/PWA Scenarios

### SC-PWA-001: Offline Conflict Resolution

**Scenario**: User makes changes offline that conflict with server state.

**Detection**:
- Sync conflicts on reconnection
- User reports data loss
- Conflict resolution failures

**Response**:
1. **Immediate**: Preserve user changes
2. **Investigation**:
   - Review conflict resolution logic
   - Check offline storage
   - Analyze conflict patterns
3. **Fix**:
   - Improve conflict resolution
   - Add user choice for conflicts
   - Better conflict detection
4. **Prevention**:
   - Test offline scenarios
   - Clear conflict resolution UI
   - Regular offline testing

**Files to Check**:
- `lib/pwa/offline-storage.ts` - Offline sync
- `lib/hooks/use-offline.ts` - Offline hooks

---

### SC-PWA-002: Background Sync Failures

**Scenario**: Background sync fails to upload offline changes.

**Detection**:
- Sync queue not processing
- User reports changes not saving
- Background sync errors

**Response**:
1. **Immediate**: Trigger manual sync
2. **Investigation**:
   - Review sync logs
   - Check network connectivity
   - Verify sync service worker
3. **Fix**:
   - Fix sync logic
   - Improve error handling
   - Add retry mechanism
4. **Prevention**:
   - Monitor sync success rates
   - Regular sync testing
   - Better error reporting

**Files to Check**:
- `lib/pwa/offline-storage.ts`
- `lib/pwa/service-worker.tsx` - Background sync

---

### SC-PWA-003: Push Delivery Failures

**Scenario**: Push notifications not being delivered to users.

**Detection**:
- Low push delivery rates
- User reports missing notifications
- Push service errors

**Response**:
1. **Immediate**: Check push service status
2. **Investigation**:
   - Review push delivery logs
   - Check VAPID keys
   - Verify subscription status
3. **Fix**:
   - Fix push service configuration
   - Update VAPID keys if needed
   - Improve error handling
4. **Prevention**:
   - Monitor push delivery rates
   - Regular push testing
   - Fallback notification methods

**Files to Check**:
- `lib/pwa/push-manager.ts`
- `lib/pwa/send-push.ts`
- `app/api/push/subscribe/route.ts`

---

## General Response Procedures

### Incident Severity Levels

- **P0 (Critical)**: System down, data loss, security breach
- **P1 (High)**: Major feature broken, significant performance degradation
- **P2 (Medium)**: Minor feature broken, moderate performance issues
- **P3 (Low)**: Cosmetic issues, minor bugs

### Response Workflow

1. **Acknowledge** the incident
2. **Assess** severity and impact
3. **Communicate** to stakeholders
4. **Investigate** root cause
5. **Resolve** the issue
6. **Document** the incident
7. **Post-mortem** review

### Monitoring & Alerting

- **Metrics**: Prometheus-compatible metrics
- **Logs**: Structured logging with correlation IDs
- **Traces**: Distributed tracing via OpenTelemetry
- **Alerts**: SLO-based alerting with escalation

### Escalation

1. **Level 1**: On-call engineer
2. **Level 2**: Team lead
3. **Level 3**: Engineering manager
4. **Level 4**: CTO

---

## Additional Resources

- [Operational Runbooks](./OPERATIONAL_RUNBOOKS.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Verification Status](./VERIFICATION_STATUS.md)
