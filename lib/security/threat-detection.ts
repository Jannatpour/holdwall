/**
 * Advanced Threat Detection and Anomaly Monitoring
 * 
 * Implements real-time threat detection, anomaly monitoring, and
 * security event correlation for OWASP Top 10 compliance
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { getRedisClient } from "@/lib/cache/redis";

export interface ThreatEvent {
  id: string;
  type: ThreatType;
  severity: "low" | "medium" | "high" | "critical";
  source: string; // IP, user ID, etc.
  timestamp: Date;
  details: Record<string, unknown>;
  blocked: boolean;
  actionTaken: string[];
}

export type ThreatType =
  | "sql_injection"
  | "xss_attack"
  | "csrf_attack"
  | "brute_force"
  | "ddos"
  | "suspicious_activity"
  | "unauthorized_access"
  | "data_exfiltration"
  | "malicious_payload"
  | "rate_limit_abuse";

export interface ThreatDetectionConfig {
  enabled: boolean;
  anomalyThreshold: number; // 0-1, threshold for anomaly detection
  blockOnCritical: boolean;
  alertOnHigh: boolean;
  rateLimitWindow: number; // ms
  rateLimitThreshold: number; // requests per window
  ipWhitelist: string[];
  ipBlacklist: string[];
}

export class ThreatDetectionService {
  private config: ThreatDetectionConfig;
  private redis?: ReturnType<typeof getRedisClient>;
  private threatHistory: Map<string, ThreatEvent[]> = new Map();
  private anomalyBaseline: Map<string, number> = new Map();

  constructor(config: ThreatDetectionConfig) {
    this.config = config;
    if (config.enabled) {
      try {
        this.redis = getRedisClient();
      } catch (error) {
        logger.warn("Redis not available for threat detection", { error });
      }
    }
  }

  /**
   * Analyze request for threats
   */
  async analyzeRequest(
    request: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body?: unknown;
      ip: string;
      userAgent?: string;
      userId?: string;
    }
  ): Promise<{ threat: boolean; events: ThreatEvent[] }> {
    if (!this.config.enabled) {
      return { threat: false, events: [] };
    }

    const events: ThreatEvent[] = [];

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
  private detectSQLInjection(request: {
    path: string;
    body?: unknown;
    headers: Record<string, string>;
  }): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /('|(\\')|(;)|(\\;)|(--)|(\\--)|(\/\*)|(\\\/\*)|(\*\/)|(\\\*\/))/,
      /(\bOR\b.*=.*)/i,
      /(\bAND\b.*=.*)/i,
    ];

    const checkString = (str: string): boolean => {
      return sqlPatterns.some(pattern => pattern.test(str));
    };

    // Check path
    if (checkString(request.path)) return true;

    // Check body
    if (request.body) {
      const bodyStr = JSON.stringify(request.body);
      if (checkString(bodyStr)) return true;
    }

    // Check headers
    for (const value of Object.values(request.headers)) {
      if (checkString(value)) return true;
    }

    return false;
  }

  /**
   * Detect XSS patterns
   */
  private detectXSS(request: {
    path: string;
    body?: unknown;
    headers: Record<string, string>;
  }): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<img[^>]*onerror/gi,
    ];

    const checkString = (str: string): boolean => {
      return xssPatterns.some(pattern => pattern.test(str));
    };

    if (checkString(request.path)) return true;

    if (request.body) {
      const bodyStr = JSON.stringify(request.body);
      if (checkString(bodyStr)) return true;
    }

    for (const value of Object.values(request.headers)) {
      if (checkString(value)) return true;
    }

    return false;
  }

  /**
   * Detect CSRF attacks
   */
  private detectCSRF(request: {
    method: string;
    headers: Record<string, string>;
  }): boolean {
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
  private async detectBruteForce(ip: string, userId?: string): Promise<boolean> {
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
    const recent = history.filter(
      event => now - event.timestamp.getTime() < window
    );

    return recent.length >= threshold;
  }

  /**
   * Detect DDoS attacks
   */
  private async detectDDoS(ip: string): Promise<boolean> {
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
  private async detectAnomaly(request: {
    path: string;
    method: string;
    ip: string;
  }): Promise<boolean> {
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
  private async detectRateLimitAbuse(ip: string): Promise<boolean> {
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
  private createThreatEvent(
    type: ThreatType,
    severity: ThreatEvent["severity"],
    source: string,
    details: Record<string, unknown>
  ): ThreatEvent {
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
  private async processThreatEvent(event: ThreatEvent): Promise<void> {
    // Log threat
    logger.warn("Threat detected", {
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
    metrics.increment("threat_detection_events", {
      type: event.type,
      severity: event.severity,
    });

    if (event.blocked) {
      metrics.increment("threat_detection_blocked", { type: event.type });
    }
  }

  /**
   * Block source
   */
  private async blockSource(source: string): Promise<void> {
    // Add to blacklist
    if (!this.config.ipBlacklist.includes(source)) {
      this.config.ipBlacklist.push(source);
    }

    // Store in Redis if available
    if (this.redis) {
      await this.redis.setex(`blocked:${source}`, 3600, "1"); // Block for 1 hour
    }

    logger.warn("Source blocked", { source });
  }

  /**
   * Send alert
   */
  private async sendAlert(event: ThreatEvent): Promise<void> {
    // In production, would send to alerting system (PagerDuty, Slack, etc.)
    logger.error("Security alert", {
      type: event.type,
      severity: event.severity,
      source: event.source,
      details: event.details,
    });
  }

  /**
   * Get threat statistics
   */
  getStatistics(): {
    totalThreats: number;
    threatsByType: Record<ThreatType, number>;
    threatsBySeverity: Record<string, number>;
    blockedSources: number;
  } {
    const allEvents = Array.from(this.threatHistory.values()).flat();
    const threatsByType: Record<string, number> = {};
    const threatsBySeverity: Record<string, number> = {};

    for (const event of allEvents) {
      threatsByType[event.type] = (threatsByType[event.type] || 0) + 1;
      threatsBySeverity[event.severity] = (threatsBySeverity[event.severity] || 0) + 1;
    }

    return {
      totalThreats: allEvents.length,
      threatsByType: threatsByType as Record<ThreatType, number>,
      threatsBySeverity,
      blockedSources: this.config.ipBlacklist.length,
    };
  }
}
