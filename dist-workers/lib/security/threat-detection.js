"use strict";
/**
 * Advanced Threat Detection and Anomaly Monitoring
 *
 * Implements real-time threat detection, anomaly monitoring, and
 * security event correlation for OWASP Top 10 compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreatDetectionService = void 0;
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const redis_1 = require("@/lib/cache/redis");
class ThreatDetectionService {
    constructor(config) {
        this.threatHistory = new Map();
        this.anomalyBaseline = new Map();
        this.config = config;
        if (config.enabled) {
            try {
                this.redis = (0, redis_1.getRedisClient)();
            }
            catch (error) {
                logger_1.logger.warn("Redis not available for threat detection", { error });
            }
        }
    }
    /**
     * Analyze request for threats
     */
    async analyzeRequest(request) {
        if (!this.config.enabled) {
            return { threat: false, events: [] };
        }
        const events = [];
        // Check IP blacklist
        if (this.config.ipBlacklist.includes(request.ip)) {
            events.push(this.createThreatEvent("unauthorized_access", "high", request.ip, {
                reason: "IP blacklisted",
                ip: request.ip,
            }));
        }
        // Check IP whitelist (bypass if whitelisted)
        if (this.config.ipWhitelist.includes(request.ip)) {
            return { threat: false, events: [] };
        }
        // SQL Injection detection
        if (this.detectSQLInjection(request)) {
            events.push(this.createThreatEvent("sql_injection", "critical", request.ip, {
                path: request.path,
                method: request.method,
            }));
        }
        // XSS detection
        if (this.detectXSS(request)) {
            events.push(this.createThreatEvent("xss_attack", "high", request.ip, {
                path: request.path,
                method: request.method,
            }));
        }
        // CSRF detection
        if (this.detectCSRF(request)) {
            events.push(this.createThreatEvent("csrf_attack", "high", request.ip, {
                path: request.path,
                method: request.method,
            }));
        }
        // Brute force detection
        if (await this.detectBruteForce(request.ip, request.userId)) {
            events.push(this.createThreatEvent("brute_force", "high", request.ip, {
                userId: request.userId,
            }));
        }
        // DDoS detection
        if (await this.detectDDoS(request.ip)) {
            events.push(this.createThreatEvent("ddos", "critical", request.ip, {
                path: request.path,
            }));
        }
        // Anomaly detection
        const anomaly = await this.detectAnomaly(request);
        if (anomaly) {
            events.push(this.createThreatEvent("suspicious_activity", "medium", request.ip, {
                anomaly,
                path: request.path,
            }));
        }
        // Rate limit abuse
        if (await this.detectRateLimitAbuse(request.ip)) {
            events.push(this.createThreatEvent("rate_limit_abuse", "medium", request.ip, {
                path: request.path,
            }));
        }
        // Process events
        const hasThreat = events.length > 0;
        if (hasThreat) {
            for (const event of events) {
                await this.processThreatEvent(event);
            }
        }
        return { threat: hasThreat, events };
    }
    /**
     * Detect SQL injection patterns
     */
    detectSQLInjection(request) {
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
            /('|(\\')|(;)|(\\;)|(--)|(\\--)|(\/\*)|(\\\/\*)|(\*\/)|(\\\*\/))/,
            /(\bOR\b.*=.*)/i,
            /(\bAND\b.*=.*)/i,
        ];
        const checkString = (str) => {
            return sqlPatterns.some(pattern => pattern.test(str));
        };
        // Check path
        if (checkString(request.path))
            return true;
        // Check body
        if (request.body) {
            const bodyStr = JSON.stringify(request.body);
            if (checkString(bodyStr))
                return true;
        }
        // Check headers
        for (const value of Object.values(request.headers)) {
            if (checkString(value))
                return true;
        }
        return false;
    }
    /**
     * Detect XSS patterns
     */
    detectXSS(request) {
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe[^>]*>/gi,
            /<object[^>]*>/gi,
            /<embed[^>]*>/gi,
            /<img[^>]*onerror/gi,
        ];
        const checkString = (str) => {
            return xssPatterns.some(pattern => pattern.test(str));
        };
        if (checkString(request.path))
            return true;
        if (request.body) {
            const bodyStr = JSON.stringify(request.body);
            if (checkString(bodyStr))
                return true;
        }
        for (const value of Object.values(request.headers)) {
            if (checkString(value))
                return true;
        }
        return false;
    }
    /**
     * Detect CSRF attacks
     */
    detectCSRF(request) {
        // Check for CSRF token in POST/PUT/DELETE requests
        if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
            const origin = request.headers["origin"];
            const referer = request.headers["referer"];
            const csrfToken = request.headers["x-csrf-token"] || request.headers["csrf-token"];
            // Missing CSRF token
            if (!csrfToken) {
                return true;
            }
            // Origin/referer mismatch (simplified check)
            if (origin && referer && !referer.includes(new URL(origin).hostname)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Detect brute force attacks
     */
    async detectBruteForce(ip, userId) {
        const key = `brute_force:${ip}:${userId || "anonymous"}`;
        const window = 60000; // 1 minute
        const threshold = 5; // 5 failed attempts
        if (this.redis) {
            const count = await this.redis.incr(key);
            if (count === 1) {
                await this.redis.expire(key, Math.floor(window / 1000));
            }
            return count > threshold;
        }
        // In-memory fallback
        const now = Date.now();
        const history = this.threatHistory.get(key) || [];
        const recent = history.filter(event => now - event.timestamp.getTime() < window);
        return recent.length >= threshold;
    }
    /**
     * Detect DDoS attacks
     */
    async detectDDoS(ip) {
        const key = `ddos:${ip}`;
        const window = 1000; // 1 second
        const threshold = 100; // 100 requests per second
        if (this.redis) {
            const count = await this.redis.incr(key);
            if (count === 1) {
                await this.redis.expire(key, 1);
            }
            return count > threshold;
        }
        return false;
    }
    /**
     * Detect anomalies using baseline comparison
     */
    async detectAnomaly(request) {
        const key = `${request.method}:${request.path}`;
        const now = Date.now();
        const window = 300000; // 5 minutes
        // Get baseline
        const baseline = this.anomalyBaseline.get(key) || 0;
        // Get current rate
        const rateKey = `anomaly:${key}`;
        let currentRate = 0;
        if (this.redis) {
            currentRate = parseInt((await this.redis.get(rateKey)) || "0", 10);
            await this.redis.incr(rateKey);
            await this.redis.expire(rateKey, Math.floor(window / 1000));
        }
        // Update baseline (exponential moving average)
        const alpha = 0.1;
        const newBaseline = alpha * currentRate + (1 - alpha) * baseline;
        this.anomalyBaseline.set(key, newBaseline);
        // Detect anomaly if current rate significantly exceeds baseline
        const threshold = baseline * (1 + this.config.anomalyThreshold);
        return currentRate > threshold && baseline > 0;
    }
    /**
     * Detect rate limit abuse
     */
    async detectRateLimitAbuse(ip) {
        const key = `rate_abuse:${ip}`;
        const window = this.config.rateLimitWindow;
        const threshold = this.config.rateLimitThreshold;
        if (this.redis) {
            const count = await this.redis.incr(key);
            if (count === 1) {
                await this.redis.expire(key, Math.floor(window / 1000));
            }
            return count > threshold;
        }
        return false;
    }
    /**
     * Create threat event
     */
    createThreatEvent(type, severity, source, details) {
        return {
            id: crypto.randomUUID(),
            type,
            severity,
            source,
            timestamp: new Date(),
            details,
            blocked: false,
            actionTaken: [],
        };
    }
    /**
     * Process threat event
     */
    async processThreatEvent(event) {
        // Log threat
        logger_1.logger.warn("Threat detected", {
            type: event.type,
            severity: event.severity,
            source: event.source,
            details: event.details,
        });
        // Block if critical and configured
        if (event.severity === "critical" && this.config.blockOnCritical) {
            event.blocked = true;
            event.actionTaken.push("blocked");
            await this.blockSource(event.source);
        }
        // Alert if high severity
        if (event.severity === "high" && this.config.alertOnHigh) {
            event.actionTaken.push("alerted");
            await this.sendAlert(event);
        }
        // Store in history
        const history = this.threatHistory.get(event.source) || [];
        history.push(event);
        this.threatHistory.set(event.source, history.slice(-100)); // Keep last 100
        // Metrics
        metrics_1.metrics.increment("threat_detection_events", {
            type: event.type,
            severity: event.severity,
        });
        if (event.blocked) {
            metrics_1.metrics.increment("threat_detection_blocked", { type: event.type });
        }
    }
    /**
     * Block source
     */
    async blockSource(source) {
        // Add to blacklist
        if (!this.config.ipBlacklist.includes(source)) {
            this.config.ipBlacklist.push(source);
        }
        // Store in Redis if available
        if (this.redis) {
            await this.redis.setex(`blocked:${source}`, 3600, "1"); // Block for 1 hour
        }
        logger_1.logger.warn("Source blocked", { source });
    }
    /**
     * Send alert
     */
    async sendAlert(event) {
        // In production, would send to alerting system (PagerDuty, Slack, etc.)
        logger_1.logger.error("Security alert", {
            type: event.type,
            severity: event.severity,
            source: event.source,
            details: event.details,
        });
    }
    /**
     * Get threat statistics
     */
    getStatistics() {
        const allEvents = Array.from(this.threatHistory.values()).flat();
        const threatsByType = {};
        const threatsBySeverity = {};
        for (const event of allEvents) {
            threatsByType[event.type] = (threatsByType[event.type] || 0) + 1;
            threatsBySeverity[event.severity] = (threatsBySeverity[event.severity] || 0) + 1;
        }
        return {
            totalThreats: allEvents.length,
            threatsByType: threatsByType,
            threatsBySeverity,
            blockedSources: this.config.ipBlacklist.length,
        };
    }
}
exports.ThreatDetectionService = ThreatDetectionService;
