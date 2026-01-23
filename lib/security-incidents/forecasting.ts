/**
 * Security Incident Narrative Forecasting
 * 
 * Enhanced forecasting models specifically for security incident narratives
 */

import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { HawkesProcess } from "@/lib/forecasts/hawkes";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { SecurityIncidentType, SecurityIncidentSeverity } from "@prisma/client";

export interface SecurityIncidentForecast {
  incidentId: string;
  narrativeRiskScore: number;
  outbreakProbability: number;
  timeToOutbreak: number | null; // Hours until outbreak (if forecasted)
  confidence: number; // 0-1
  factors: {
    incidentType: number; // Type multiplier
    severity: number; // Severity multiplier
    historicalSimilar: number; // Historical similar incidents
    currentNarrativeVelocity: number; // Current narrative spread
  };
  recommendedActions: string[];
}

export class SecurityIncidentForecasting {
  private forecastService: ForecastService;
  private hawkesProcess: HawkesProcess;

  constructor() {
    const eventStore = new DatabaseEventStore();
    const beliefGraph = new DatabaseBeliefGraphService();
    this.forecastService = new ForecastService(eventStore, beliefGraph as any);
    this.hawkesProcess = new HawkesProcess();
  }

  /**
   * Forecast narrative outbreak for security incident
   */
  async forecastNarrativeOutbreak(
    tenantId: string,
    incidentId: string,
    incidentType: SecurityIncidentType,
    severity: SecurityIncidentSeverity
  ): Promise<SecurityIncidentForecast> {
    // Get historical similar incidents
    const historicalSimilar = await this.getHistoricalSimilarIncidents(
      tenantId,
      incidentType,
      severity
    );

    // Calculate base narrative risk
    const narrativeRiskScore = this.calculateNarrativeRisk(incidentType, severity);

    // Use Hawkes process to forecast outbreak
    const hawkesEvents = historicalSimilar.map((inc) => ({
      timestamp: inc.detectedAt.getTime(),
      type: "security_incident",
      magnitude: inc.narrativeRiskScore || 0.5,
      metadata: {},
    }));

    this.hawkesProcess.fit(hawkesEvents);
    const now = Date.now();
    const horizonHours = 7 * 24;
    const hawkesForecast = this.hawkesProcess.forecast(now, horizonHours, {
      confidence_level: 0.7,
      include_simulation: true,
    });

    // Get max intensity from forecast
    const maxForecast = hawkesForecast.reduce((max, f) =>
      f.intensity > max.intensity ? f : max
    );

    // Calculate outbreak probability
    const outbreakProbability = Math.min(1, narrativeRiskScore * maxForecast.outbreak_probability);

    // Estimate time to outbreak (if probability > 0.5)
    let timeToOutbreak: number | null = null;
    if (outbreakProbability > 0.5) {
      // Estimate based on historical data
      const avgTimeToOutbreak = this.calculateAverageTimeToOutbreak(historicalSimilar);
      timeToOutbreak = avgTimeToOutbreak;
    }

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(historicalSimilar.length, narrativeRiskScore);

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(
      narrativeRiskScore,
      outbreakProbability,
      incidentType
    );

    const forecast: SecurityIncidentForecast = {
      incidentId,
      narrativeRiskScore,
      outbreakProbability,
      timeToOutbreak,
      confidence,
      factors: {
        incidentType: this.getTypeMultiplier(incidentType),
        severity: this.getSeverityMultiplier(severity),
        historicalSimilar: historicalSimilar.length,
        currentNarrativeVelocity: maxForecast.intensity || 0,
      },
      recommendedActions,
    };

    logger.info("Security incident narrative forecast generated", {
      tenant_id: tenantId,
      incident_id: incidentId,
      narrative_risk_score: narrativeRiskScore,
      outbreak_probability: outbreakProbability,
      confidence,
    });

    metrics.gauge("security_incident_outbreak_probability", outbreakProbability, {
      tenant_id: tenantId,
      incident_id: incidentId,
      type: incidentType,
      severity,
    });

    return forecast;
  }

  /**
   * Calculate narrative risk score
   */
  private calculateNarrativeRisk(
    type: SecurityIncidentType,
    severity: SecurityIncidentSeverity
  ): number {
    let risk = 0.3; // Base risk

    // Type multiplier
    const typeMultiplier = this.getTypeMultiplier(type);
    risk += typeMultiplier * 0.4;

    // Severity multiplier
    const severityMultiplier = this.getSeverityMultiplier(severity);
    risk += severityMultiplier * 0.3;

    return Math.min(1, Math.max(0, risk));
  }

  /**
   * Get type multiplier for narrative risk
   */
  private getTypeMultiplier(type: SecurityIncidentType): number {
    const multipliers: Record<SecurityIncidentType, number> = {
      DATA_BREACH: 0.9,
      RANSOMWARE: 0.8,
      ACCOUNT_COMPROMISE: 0.7,
      SYSTEM_COMPROMISE: 0.7,
      UNAUTHORIZED_ACCESS: 0.6,
      PHISHING: 0.5,
      MALWARE: 0.4,
      DDOS: 0.3,
      INSIDER_THREAT: 0.6,
      VULNERABILITY_EXPLOIT: 0.4,
      OTHER: 0.3,
    };
    return multipliers[type] || 0.3;
  }

  /**
   * Get severity multiplier
   */
  private getSeverityMultiplier(severity: SecurityIncidentSeverity): number {
    const multipliers: Record<SecurityIncidentSeverity, number> = {
      LOW: 0.2,
      MEDIUM: 0.4,
      HIGH: 0.7,
      CRITICAL: 0.9,
    };
    return multipliers[severity] || 0.4;
  }

  /**
   * Get historical similar incidents
   */
  private async getHistoricalSimilarIncidents(
    tenantId: string,
    type: SecurityIncidentType,
    severity: SecurityIncidentSeverity
  ): Promise<Array<{ detectedAt: Date; narrativeRiskScore: number | null }>> {
    const { db } = await import("@/lib/db/client");
    
    // Query database for similar incidents
    const incidents = await db.securityIncident.findMany({
      where: {
        tenantId,
        type,
        severity,
        detectedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      select: {
        detectedAt: true,
        narrativeRiskScore: true,
      },
      orderBy: {
        detectedAt: "desc",
      },
      take: 50,
    });

    return incidents.map((inc) => ({
      detectedAt: inc.detectedAt,
      narrativeRiskScore: inc.narrativeRiskScore,
    }));
  }

  /**
   * Calculate average time to outbreak from historical data
   */
  private calculateAverageTimeToOutbreak(
    historical: Array<{ detectedAt: Date; narrativeRiskScore: number | null }>
  ): number {
    // Default: 24-48 hours for high-risk incidents
    if (historical.length === 0) {
      return 36; // 36 hours default
    }

    // Would calculate from actual historical data
    // For now, return default
    return 36;
  }

  /**
   * Calculate forecast confidence
   */
  private calculateConfidence(historicalCount: number, riskScore: number): number {
    // More historical data = higher confidence
    let confidence = 0.5; // Base confidence

    if (historicalCount > 10) {
      confidence = 0.9;
    } else if (historicalCount > 5) {
      confidence = 0.7;
    } else if (historicalCount > 0) {
      confidence = 0.6;
    }

    // Higher risk scores have lower confidence (more uncertainty)
    if (riskScore > 0.8) {
      confidence *= 0.9; // Slightly reduce confidence for very high risk
    }

    return Math.min(1, Math.max(0.3, confidence));
  }

  /**
   * Generate recommended actions based on forecast
   */
  private generateRecommendedActions(
    riskScore: number,
    outbreakProbability: number,
    type: SecurityIncidentType
  ): string[] {
    const actions: string[] = [];

    if (outbreakProbability >= 0.8) {
      actions.push("Generate incident explanation immediately");
      actions.push("Route to Legal and Comms for urgent approval");
      actions.push("Prepare evidence bundle");
      actions.push("Monitor narrative signals in real-time");
    } else if (outbreakProbability >= 0.6) {
      actions.push("Generate incident explanation draft");
      actions.push("Route to approvals within 4 hours");
      actions.push("Prepare evidence bundle");
    } else if (outbreakProbability >= 0.4) {
      actions.push("Monitor narrative signals closely");
      actions.push("Prepare incident explanation template");
    } else {
      actions.push("Continue monitoring");
      actions.push("Prepare explanation if narrative signals increase");
    }

    // Type-specific actions
    if (type === "DATA_BREACH") {
      actions.push("Ensure GDPR/regulatory compliance narrative");
      actions.push("Prepare customer notification template");
    } else if (type === "RANSOMWARE") {
      actions.push("Focus on containment and recovery narrative");
      actions.push("Prepare transparency statement");
    }

    return actions;
  }
}
