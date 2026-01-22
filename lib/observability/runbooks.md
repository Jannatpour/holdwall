# Operational Runbooks

This document contains runbooks for common operational scenarios in Holdwall POS.

## Table of Contents

1. [Database Connection Issues](#database-connection-issues)
2. [Redis Cache Failures](#redis-cache-failures)
3. [Kafka Consumer Lag](#kafka-consumer-lag)
4. [High Error Rates](#high-error-rates)
5. [Slow API Responses](#slow-api-responses)
6. [Memory Leaks](#memory-leaks)
7. [Disk Space Issues](#disk-space-issues)
8. [Authentication Failures](#authentication-failures)
9. [AI Model Timeouts](#ai-model-timeouts)
10. [Vector Database Issues](#vector-database-issues)

---

## Database Connection Issues

### Symptoms
- API requests timing out
- Database connection pool exhausted errors
- "Connection refused" errors in logs

### Diagnosis
1. Check database health endpoint: `GET /api/health/database`
2. Review connection pool metrics: `GET /api/metrics?filter=db_connections`
3. Check database logs for connection errors

### Resolution
1. **Immediate**: Restart application pods to reset connection pool
   ```bash
   kubectl rollout restart deployment/holdwall-app -n holdwall
   ```

2. **Short-term**: Increase connection pool size
   - Update `DATABASE_POOL_SIZE` environment variable
   - Default: 10, increase to 20-50 based on load

3. **Long-term**: 
   - Review connection pool configuration
   - Check for connection leaks (unclosed connections)
   - Consider read replicas for read-heavy workloads
   - Implement connection retry logic with exponential backoff

### Prevention
- Monitor connection pool usage
- Set up alerts for connection pool exhaustion
- Regular database maintenance (VACUUM, ANALYZE)

---

## Redis Cache Failures

### Symptoms
- Cache misses increasing
- Redis connection errors
- Slow response times (fallback to database)

### Diagnosis
1. Check Redis health: `GET /api/health/cache`
2. Review cache hit rate: `GET /api/metrics?filter=cache_hit_rate`
3. Check Redis logs and memory usage

### Resolution
1. **Immediate**: Restart Redis if unresponsive
   ```bash
   kubectl rollout restart statefulset/redis -n holdwall
   ```

2. **Short-term**: 
   - Increase Redis memory limit
   - Enable Redis persistence (AOF/RDB)
   - Check for memory leaks

3. **Long-term**:
   - Implement Redis cluster for high availability
   - Add Redis monitoring (RedisInsight, Prometheus)
   - Review cache TTLs and eviction policies

### Prevention
- Monitor Redis memory usage
- Set up alerts for cache hit rate drops
- Regular Redis health checks

---

## Kafka Consumer Lag

### Symptoms
- Events processing slowly
- Consumer lag increasing in metrics
- Delayed updates in UI

### Diagnosis
1. Check consumer lag: `GET /api/metrics?filter=kafka_consumer_lag`
2. Review Kafka consumer group status
3. Check worker pod logs for errors

### Resolution
1. **Immediate**: Scale up worker pods
   ```bash
   kubectl scale deployment/holdwall-worker --replicas=5 -n holdwall
   ```

2. **Short-term**:
   - Increase consumer parallelism
   - Review batch sizes and processing logic
   - Check for blocking operations in consumers

3. **Long-term**:
   - Optimize event processing logic
   - Consider partitioning strategy
   - Implement dead letter queue (DLQ) for failed messages

### Prevention
- Monitor consumer lag metrics
- Set up alerts for lag thresholds
- Regular performance testing

---

## High Error Rates

### Symptoms
- Error rate > 1%
- 5xx status codes increasing
- User complaints about failures

### Diagnosis
1. Check error metrics: `GET /api/metrics?filter=error_rate`
2. Review error logs: `kubectl logs -f deployment/holdwall-app -n holdwall | grep ERROR`
3. Check Sentry/error tracking dashboard

### Resolution
1. **Immediate**: 
   - Identify error pattern (check logs)
   - Rollback recent deployments if needed
   - Enable circuit breakers for external services

2. **Short-term**:
   - Fix root cause
   - Add retry logic for transient errors
   - Improve error handling

3. **Long-term**:
   - Implement comprehensive error tracking
   - Add automated error recovery
   - Improve monitoring and alerting

### Prevention
- Comprehensive error handling
- Regular error log reviews
- Automated error rate alerts

---

## Slow API Responses

### Symptoms
- P95 latency > 500ms
- User complaints about slow performance
- Timeout errors increasing

### Diagnosis
1. Check latency metrics: `GET /api/metrics?filter=p95_latency`
2. Review slow query logs
3. Check database query performance
4. Review distributed traces

### Resolution
1. **Immediate**:
   - Identify slow endpoints (check metrics)
   - Review database query performance
   - Check for N+1 queries

2. **Short-term**:
   - Add database indexes
   - Optimize slow queries
   - Increase caching

3. **Long-term**:
   - Implement query optimization
   - Add CDN for static assets
   - Consider database read replicas
   - Implement GraphQL query complexity limits

### Prevention
- Regular performance testing
- Database query optimization
- Monitor slow query logs

---

## Memory Leaks

### Symptoms
- Memory usage continuously increasing
- Pods being OOMKilled
- Application slowdowns

### Diagnosis
1. Check memory metrics: `GET /api/metrics?filter=memory_usage`
2. Review heap dumps
3. Check for unclosed connections/resources

### Resolution
1. **Immediate**: Restart pods to free memory
   ```bash
   kubectl rollout restart deployment/holdwall-app -n holdwall
   ```

2. **Short-term**:
   - Increase memory limits
   - Review code for memory leaks
   - Check for unclosed streams/connections

3. **Long-term**:
   - Implement memory profiling
   - Fix memory leaks in code
   - Optimize data structures

### Prevention
- Regular memory profiling
- Monitor memory usage trends
- Set up OOM alerts

---

## Disk Space Issues

### Symptoms
- Pods failing to start
- "No space left on device" errors
- Slow disk I/O

### Diagnosis
1. Check disk usage: `df -h` in pods
2. Review log file sizes
3. Check database disk usage

### Resolution
1. **Immediate**: Clean up old logs/files
   ```bash
   kubectl exec -it <pod-name> -n holdwall -- find /var/log -type f -mtime +7 -delete
   ```

2. **Short-term**:
   - Implement log rotation
   - Clean up old database backups
   - Increase disk size

3. **Long-term**:
   - Implement automated cleanup jobs
   - Use external log aggregation
   - Optimize database storage

### Prevention
- Regular disk usage monitoring
- Automated log rotation
- Set up disk space alerts

---

## Authentication Failures

### Symptoms
- Users unable to log in
- OAuth callbacks failing
- Session errors

### Diagnosis
1. Check auth endpoint: `GET /api/auth/session`
2. Review authentication logs
3. Check OAuth provider status

### Resolution
1. **Immediate**: 
   - Check OAuth provider status
   - Verify environment variables (OAuth secrets)
   - Restart auth service if needed

2. **Short-term**:
   - Fix OAuth configuration
   - Clear invalid sessions
   - Review authentication flow

3. **Long-term**:
   - Implement SSO fallback
   - Add authentication monitoring
   - Improve error messages

### Prevention
- Monitor authentication success rate
- Regular OAuth provider health checks
- Set up auth failure alerts

---

## AI Model Timeouts

### Symptoms
- AI API calls timing out
- Slow AI responses
- Model provider errors

### Diagnosis
1. Check AI metrics: `GET /api/metrics?filter=ai_model_timeout`
2. Review model provider status
3. Check API rate limits

### Resolution
1. **Immediate**:
   - Check model provider status page
   - Verify API keys and quotas
   - Implement timeout fallbacks

2. **Short-term**:
   - Increase timeout values
   - Implement retry logic
   - Use fallback models

3. **Long-term**:
   - Implement model load balancing
   - Add model health checks
   - Optimize prompt sizes

### Prevention
- Monitor model response times
- Set up timeout alerts
- Regular model provider health checks

---

## Vector Database Issues

### Symptoms
- Vector search failing
- Slow similarity searches
- ChromaDB/vector DB connection errors

### Diagnosis
1. Check vector DB health: `GET /api/health/vectordb`
2. Review vector search metrics
3. Check ChromaDB logs

### Resolution
1. **Immediate**: Restart vector DB service
   ```bash
   kubectl rollout restart deployment/chromadb -n holdwall
   ```

2. **Short-term**:
   - Check vector DB memory usage
   - Review index configuration
   - Optimize embedding dimensions

3. **Long-term**:
   - Implement vector DB clustering
   - Add vector DB monitoring
   - Optimize similarity search algorithms

### Prevention
- Monitor vector DB health
- Regular index maintenance
- Set up vector DB alerts

---

## General Troubleshooting Steps

1. **Check Health Endpoints**: Always start with health checks
   - `/api/health` - Overall health
   - `/api/health/database` - Database health
   - `/api/health/cache` - Cache health

2. **Review Metrics**: Check Prometheus metrics
   - Error rates
   - Latency percentiles
   - Resource usage

3. **Check Logs**: Review application logs
   - Recent errors
   - Warning patterns
   - Performance issues

4. **Review Recent Changes**: Check deployment history
   - Recent code changes
   - Configuration updates
   - Dependency updates

5. **Escalate**: If issue persists, escalate to on-call engineer

---

## Emergency Contacts

- **On-Call Engineer**: Check PagerDuty/OpsGenie
- **Database Team**: For database-specific issues
- **Infrastructure Team**: For Kubernetes/infrastructure issues
- **AI Team**: For AI model issues

---

## Additional Resources

- [Monitoring Dashboard](https://monitoring.holdwall.com)
- [Error Tracking](https://sentry.holdwall.com)
- [Documentation](https://docs.holdwall.com)
- [Incident Response Playbook](./incident-response.md)
