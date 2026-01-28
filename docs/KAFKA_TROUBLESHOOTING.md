# Kafka Troubleshooting Guide

This guide helps diagnose and resolve common Kafka connection issues in the Holdwall application.

## Common Error Types

### 1. DNS Resolution Errors (`ENOTFOUND`, `getaddrinfo`)

**Symptoms:**
```
KafkaJSNonRetriableError
  Caused by: KafkaJSConnectionError: Connection error: getaddrinfo ENOTFOUND b-1.aivaonkafkaproduction.lyykoe.c6.kafka.us-east-1.amazonaws.com
```

**Causes:**
- DNS server cannot resolve the broker hostname
- Network connectivity issues
- Incorrect broker hostname configuration
- VPC/DNS configuration problems (for AWS MSK)

**Solutions:**

1. **Verify DNS Resolution:**
   ```bash
   nslookup b-1.aivaonkafkaproduction.lyykoe.c6.kafka.us-east-1.amazonaws.com
   # or
   dig b-1.aivaonkafkaproduction.lyykoe.c6.kafka.us-east-1.amazonaws.com
   ```

2. **Check Network Connectivity:**
   ```bash
   # Test if you can reach the broker
   telnet <broker-hostname> <port>
   # or
   nc -zv <broker-hostname> <port>
   ```

3. **Verify Environment Variables:**
   ```bash
   echo $KAFKA_BROKERS
   # Should contain comma-separated list: broker1:9092,broker2:9092,broker3:9092
   ```

4. **For AWS MSK:**
   - Ensure VPC DNS resolution is enabled
   - Check security groups allow outbound connections
   - Verify route tables and network ACLs
   - Ensure the application is in the same VPC or has VPN/peering configured

### 2. Connection Refused (`ECONNREFUSED`)

**Symptoms:**
```
Connection error: connect ECONNREFUSED
```

**Causes:**
- Broker is not running
- Wrong port number
- Firewall blocking connections
- Security group rules (AWS)

**Solutions:**

1. **Verify Broker is Running:**
   - Check broker logs
   - Verify broker process is active
   - Check broker health endpoints

2. **Verify Port Configuration:**
   - Standard ports: 9092 (plain), 9093 (SSL), 9094 (SASL/SSL)
   - Check `KAFKA_BROKERS` includes correct ports

3. **Check Firewall Rules:**
   ```bash
   # Test connectivity
   telnet <broker-hostname> <port>
   ```

4. **For AWS MSK:**
   - Verify security group inbound rules allow connections from your application
   - Check network ACLs
   - Ensure broker is in a public subnet or has proper NAT configuration

### 3. Connection Timeout (`ETIMEDOUT`)

**Symptoms:**
```
Connection error: connect ETIMEDOUT
```

**Causes:**
- Network latency too high
- Firewall blocking connections
- Broker overloaded
- Timeout too short

**Solutions:**

1. **Increase Connection Timeout:**
   ```bash
   export KAFKA_CONNECTION_TIMEOUT=30000  # 30 seconds
   export KAFKA_REQUEST_TIMEOUT=60000     # 60 seconds
   ```

2. **Check Network Latency:**
   ```bash
   ping <broker-hostname>
   ```

3. **Verify Firewall Rules:**
   - Ensure connections are not being blocked
   - Check for rate limiting

### 4. Authentication Errors

**Symptoms:**
```
SASL authentication failed
SSL/TLS handshake failed
```

**Causes:**
- Incorrect credentials
- Wrong SASL mechanism
- Certificate issues
- Missing TLS configuration

**Solutions:**

1. **Verify SASL Configuration:**
   ```bash
   echo $KAFKA_SASL_MECHANISM  # Should be: plain, scram-sha-256, or scram-sha-512
   echo $KAFKA_SASL_USERNAME
   echo $KAFKA_SASL_PASSWORD
   ```

2. **Verify TLS/SSL Configuration:**
   ```bash
   echo $KAFKA_SSL  # Should be: true
   # or
   echo $KAFKA_TLS  # Should be: true
   ```

3. **Check Certificate Configuration:**
   - Verify certificates are valid
   - Check certificate paths if using custom certificates
   - Ensure `rejectUnauthorized` is set appropriately

## Diagnostic Tools

### 1. Validate Broker Configuration

The application includes broker validation. Check logs for:
```
Invalid Kafka broker configuration
Kafka broker configuration warnings
```

### 2. Health Check Endpoint

Enable Kafka health checks:
```bash
export HEALTH_INCLUDE_KAFKA=true
```

Then check:
```bash
curl http://localhost:3000/api/health
```

### 3. Startup Validation

Enable connection testing at startup:
```bash
export KAFKA_VALIDATE_ON_STARTUP=true
```

This will test connectivity during application startup and log detailed errors.

### 4. Connection State Monitoring

Check application logs for:
- `Kafka producer connected` - Successful connection
- `Kafka connection error` - Connection failure with details
- `Circuit breaker is open` - Too many failures, circuit breaker activated

## Environment Variables

### Required (if Kafka enabled)
```bash
KAFKA_ENABLED=true
KAFKA_BROKERS=broker1:9092,broker2:9092,broker3:9092
```

### Optional Configuration
```bash
# Connection timeouts
KAFKA_CONNECTION_TIMEOUT=10000      # 10 seconds (default)
KAFKA_REQUEST_TIMEOUT=30000         # 30 seconds (default)

# TLS/SSL
KAFKA_SSL=true                      # Enable TLS
KAFKA_TLS=true                      # Alternative to KAFKA_SSL

# SASL Authentication
KAFKA_SASL_MECHANISM=plain          # plain, scram-sha-256, scram-sha-512
KAFKA_SASL_USERNAME=your-username
KAFKA_SASL_PASSWORD=your-password

# Topics
KAFKA_EVENTS_TOPIC=holdwall-events
KAFKA_DLQ_TOPIC=holdwall-dlq

# Client IDs
KAFKA_CLIENT_ID=holdwall-app

# Validation
KAFKA_VALIDATE_ON_STARTUP=false     # Test connection at startup
HEALTH_INCLUDE_KAFKA=false          # Include in health checks
```

## AWS MSK Specific Issues

### 1. VPC Configuration

Ensure:
- Application and MSK cluster are in the same VPC or connected via VPC peering/VPN
- VPC DNS resolution is enabled
- Route tables are configured correctly

### 2. Security Groups

- Outbound rules: Allow traffic to MSK broker ports (9092, 9093, 9094)
- Inbound rules: MSK security group should allow traffic from application security group

### 3. DNS Resolution

MSK broker hostnames are private DNS names. Ensure:
- VPC has DNS resolution enabled
- DNS hostnames enabled
- Private hosted zones configured if using custom DNS

### 4. Getting Broker Endpoints

```bash
aws kafka describe-cluster --cluster-arn <cluster-arn> --query 'ClusterInfo.BrokerNodeGroupInfo.ClientSubnets'
aws kafka get-bootstrap-brokers --cluster-arn <cluster-arn>
```

## Testing Connectivity

### 1. Using kafkajs directly

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'test-client',
  brokers: ['broker1:9092', 'broker2:9092'],
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

const producer = kafka.producer();
await producer.connect();
console.log('Connected successfully!');
await producer.disconnect();
```

### 2. Using Application Scripts

```bash
# Verify Kafka runtime
npm run verify:kafka

# With environment variables
KAFKA_ENABLED=true KAFKA_BROKERS='broker:9092' npm run verify:kafka
```

## Circuit Breaker Behavior

The application uses a circuit breaker pattern to prevent repeated connection attempts when Kafka is unavailable:

- **Closed**: Normal operation, connections allowed
- **Open**: Too many failures, connections blocked (uses fallback)
- **Half-Open**: Testing if service recovered

Circuit breaker automatically transitions:
- Opens after 5 consecutive failures (configurable)
- Closes after 2 successful connections in half-open state
- Resets after 5 minutes (configurable)

## Graceful Degradation

When Kafka is unavailable:
- Events are still stored in the database (source of truth)
- Outbox pattern ensures events will be published when Kafka recovers
- Application continues to function normally
- Health checks may show Kafka as "error" but application remains healthy

## Getting Help

1. **Check Application Logs:**
   - Look for `Kafka connection error` entries
   - Check error details and hints provided

2. **Enable Debug Logging:**
   ```bash
   export LOG_LEVEL=debug
   ```

3. **Review Metrics:**
   - `kafka_connection_errors` - Count of connection failures
   - `kafka_connections` - Successful connections

4. **Collect Diagnostic Information:**
   - Environment variables (sanitize passwords)
   - Network connectivity test results
   - DNS resolution test results
   - Broker configuration
   - Application logs with full stack traces

## Prevention

1. **Monitor Connection Health:**
   - Set up alerts for `kafka_connection_errors` metric
   - Monitor circuit breaker state
   - Track connection success/failure rates

2. **Validate Configuration:**
   - Use `KAFKA_VALIDATE_ON_STARTUP=true` in staging/production
   - Run `npm run verify:kafka` before deployments

3. **Network Redundancy:**
   - Use multiple brokers for high availability
   - Configure proper retry and timeout values
   - Implement connection pooling where applicable

4. **Documentation:**
   - Keep broker endpoints documented
   - Maintain runbook for common issues
   - Document network topology and security groups
