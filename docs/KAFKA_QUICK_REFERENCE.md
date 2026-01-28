# Kafka Quick Reference

## Quick Diagnostics

### Check if Kafka is the problem
```bash
# 1. Check environment variables
env | grep KAFKA

# 2. Test DNS resolution
nslookup <broker-hostname>

# 3. Test connectivity
telnet <broker-hostname> <port>

# 4. Check application logs
grep -i "kafka" /var/log/app.log | tail -20
```

## Common Issues & Quick Fixes

### DNS Error (`ENOTFOUND`)
```bash
# Verify DNS
nslookup b-1.aivaonkafkaproduction.lyykoe.c6.kafka.us-east-1.amazonaws.com

# For AWS MSK: Check VPC DNS settings
aws ec2 describe-vpcs --vpc-ids <vpc-id> --query 'Vpcs[0].EnableDnsHostnames'
```

### Connection Refused
```bash
# Check if broker is running
# Check security groups (AWS)
aws ec2 describe-security-groups --group-ids <sg-id>

# Verify port
echo $KAFKA_BROKERS  # Should include :9092, :9093, or :9094
```

### Timeout
```bash
# Increase timeouts
export KAFKA_CONNECTION_TIMEOUT=30000
export KAFKA_REQUEST_TIMEOUT=60000
```

## Environment Variables Checklist

```bash
# Required (if Kafka enabled)
KAFKA_ENABLED=true
KAFKA_BROKERS=broker1:9092,broker2:9092

# Optional but recommended
KAFKA_CONNECTION_TIMEOUT=10000
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_VALIDATE_ON_STARTUP=false
HEALTH_INCLUDE_KAFKA=false

# TLS/SSL
KAFKA_SSL=true
# or
KAFKA_TLS=true

# SASL
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=username
KAFKA_SASL_PASSWORD=password
```

## Testing Commands

```bash
# Verify Kafka runtime
npm run verify:kafka

# With custom brokers
KAFKA_BROKERS='broker:9092' npm run verify:kafka

# Health check (if enabled)
curl http://localhost:3000/api/health | jq '.checks.kafka'
```

## Error Message Guide

| Error | Type | Quick Fix |
|-------|------|-----------|
| `ENOTFOUND` | DNS | Check DNS resolution, VPC settings |
| `ECONNREFUSED` | Network | Check firewall, security groups, broker status |
| `ETIMEDOUT` | Timeout | Increase `KAFKA_CONNECTION_TIMEOUT` |
| `SASL authentication failed` | Auth | Check `KAFKA_SASL_*` variables |
| `SSL handshake failed` | TLS | Check `KAFKA_SSL` and certificates |

## Log Patterns to Look For

```bash
# Success
"Kafka producer connected"
"Kafka consumer connected"

# Errors
"Kafka connection error"
"DNS/network error"
"Circuit breaker is open"

# Warnings
"Kafka not available, event streaming will use database only"
```

## AWS MSK Quick Checks

```bash
# Get broker endpoints
aws kafka get-bootstrap-brokers --cluster-arn <arn>

# Check security groups
aws ec2 describe-security-groups --filters "Name=group-name,Values=*kafka*"

# Check VPC DNS
aws ec2 describe-vpcs --vpc-ids <vpc-id> --query 'Vpcs[0].{DNS:EnableDnsHostnames,Resolution:EnableDnsSupport}'
```

## Application Behavior

- ✅ **Kafka unavailable**: Events still stored in DB, will publish when Kafka recovers
- ✅ **Circuit breaker open**: Automatic fallback, retries after timeout
- ✅ **Health check**: Shows Kafka status (if `HEALTH_INCLUDE_KAFKA=true`)

## Getting Help

1. Check `docs/KAFKA_TROUBLESHOOTING.md` for detailed guide
2. Review application logs with full stack traces
3. Verify all environment variables
4. Test connectivity manually
5. Check AWS MSK cluster status (if applicable)
