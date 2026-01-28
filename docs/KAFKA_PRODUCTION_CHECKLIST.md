# Kafka Production Deployment Checklist

## Pre-Deployment

### ✅ Configuration

- [ ] `KAFKA_ENABLED=true` set in production environment
- [ ] `KAFKA_BROKERS` configured with all broker endpoints (comma-separated)
- [ ] `KAFKA_CONNECTION_TIMEOUT` set (default: 10000ms, increase if needed)
- [ ] `KAFKA_REQUEST_TIMEOUT` set (default: 30000ms, increase if needed)
- [ ] `KAFKA_SSL=true` or `KAFKA_TLS=true` if using TLS
- [ ] `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD` configured if using SASL
- [ ] `KAFKA_EVENTS_TOPIC` configured (default: `holdwall-events`)
- [ ] `KAFKA_DLQ_TOPIC` configured (default: `holdwall-dlq`)
- [ ] `KAFKA_GROUP_ID` configured for consumers
- [ ] `KAFKA_PARTITIONS` set appropriately (default: 3)

### ✅ Network & Security

- [ ] DNS resolution verified for all broker hostnames
- [ ] Network connectivity tested (telnet/nc to broker:port)
- [ ] Security groups/firewall rules allow outbound connections
- [ ] TLS certificates validated (if using SSL)
- [ ] SASL credentials tested (if using SASL)
- [ ] VPC configuration verified (for AWS MSK)

### ✅ Validation

- [ ] `KAFKA_VALIDATE_ON_STARTUP=true` enabled in staging/production
- [ ] Startup validation passes without errors
- [ ] Health check endpoint tested: `curl /api/health | jq '.checks.kafka'`
- [ ] `npm run verify:kafka` passes with production brokers

## Deployment

### ✅ Application Deployment

- [ ] Application deployed with Kafka environment variables
- [ ] Outbox worker deployed and running
- [ ] Pipeline worker deployed and running (if using consumers)
- [ ] All pods/containers healthy
- [ ] No connection errors in logs

### ✅ Monitoring

- [ ] Metrics endpoint accessible: `/api/metrics`
- [ ] Kafka metrics visible: `kafka_connections`, `kafka_connection_errors`
- [ ] Outbox metrics visible: `kafka_outbox_published`, `kafka_outbox_publish_errors`
- [ ] Health checks configured in monitoring system
- [ ] Alerts configured for:
  - Connection errors (`kafka_connection_errors`)
  - Circuit breaker state changes
  - Outbox processing failures
  - Consumer lag (if applicable)

### ✅ Verification

- [ ] Events are being published to Kafka (check outbox table: `published=true`)
- [ ] Events are being consumed (check consumer lag if applicable)
- [ ] No connection errors in application logs
- [ ] Circuit breaker in "closed" state (healthy)
- [ ] Outbox processing rate is acceptable
- [ ] No DLQ messages accumulating (unless expected)

## Post-Deployment

### ✅ Operational Readiness

- [ ] Runbook documented for common issues
- [ ] Team trained on Kafka troubleshooting
- [ ] Escalation path defined for Kafka issues
- [ ] Backup/recovery procedures documented
- [ ] Performance baselines established

### ✅ Documentation

- [ ] Kafka configuration documented
- [ ] Broker endpoints documented
- [ ] Troubleshooting guide accessible
- [ ] Runbook available for operations team
- [ ] Architecture diagrams updated

## Troubleshooting Quick Reference

### Connection Issues

1. **DNS Resolution Error**:
   ```bash
   nslookup <broker-hostname>
   # Check VPC DNS settings for AWS MSK
   ```

2. **Connection Refused**:
   ```bash
   telnet <broker-hostname> <port>
   # Check security groups and firewall rules
   ```

3. **Timeout**:
   ```bash
   # Increase timeouts
   export KAFKA_CONNECTION_TIMEOUT=30000
   export KAFKA_REQUEST_TIMEOUT=60000
   ```

### Monitoring Commands

```bash
# Check health
curl http://localhost:3000/api/health | jq '.checks.kafka'

# Check metrics
curl http://localhost:3000/api/metrics?format=json | jq '.kafka'

# Verify runtime
npm run verify:kafka
```

### Log Analysis

```bash
# Check for connection errors
grep -i "kafka.*connection.*error" /var/log/app.log

# Check for DNS errors
grep -i "ENOTFOUND\|getaddrinfo" /var/log/app.log

# Check circuit breaker state
grep -i "circuit breaker" /var/log/app.log
```

## Rollback Plan

If Kafka issues occur:

1. **Immediate**: Set `KAFKA_ENABLED=false` to disable Kafka
   - Events will still be stored in database
   - Outbox will accumulate but not publish
   - Application continues to function

2. **Short-term**: Fix connection issues
   - Review error logs
   - Check network connectivity
   - Verify broker configuration

3. **Long-term**: Re-enable Kafka
   - Set `KAFKA_ENABLED=true`
   - Outbox worker will process accumulated events
   - Normal operation resumes

## Success Criteria

✅ **Healthy State**:
- No connection errors in logs
- Circuit breaker in "closed" state
- Outbox processing rate > 0
- Metrics show successful connections
- Health check returns "ok"

✅ **Degraded State** (acceptable):
- Circuit breaker in "half-open" state
- Some connection errors but retries succeed
- Outbox processing slower than normal
- Health check returns "error" but application functional

❌ **Unhealthy State** (action required):
- Circuit breaker in "open" state
- Continuous connection failures
- Outbox not processing
- Application errors related to Kafka

## Support Resources

- **Troubleshooting Guide**: `docs/KAFKA_TROUBLESHOOTING.md`
- **Quick Reference**: `docs/KAFKA_QUICK_REFERENCE.md`
- **System Documentation**: `docs/KAFKA_SYSTEM_COMPLETE.md`
- **Improvements Summary**: `docs/KAFKA_IMPROVEMENTS_SUMMARY.md`
