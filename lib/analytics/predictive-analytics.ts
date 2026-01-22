/**
 * Predictive Analytics
 * 
 * Predicts future trends and outcomes using historical data
 * to enable proactive decision-making.
 */

export interface Prediction {
  metric: string;
  current: number;
  predicted: number;
  confidence: number; // 0-1
  timeframe: string; // e.g., "7 days"
  trend: "increasing" | "decreasing" | "stable";
}

export interface Forecast {
  metric: string;
  predictions: Array<{
    date: string;
    value: number;
    confidence: number;
  }>;
  trend: "increasing" | "decreasing" | "stable";
}

export class PredictiveAnalytics {
  /**
   * Predict future value
   */
  predict(
    metric: string,
    historicalData: Array<{ date: string; value: number }>,
    timeframe: string = "7 days"
  ): Prediction {
    if (historicalData.length < 2) {
      throw new Error("Insufficient historical data for prediction");
    }

    // Sort by date
    const sorted = historicalData.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const current = sorted[sorted.length - 1].value;

    // Simple linear regression for prediction
    const recent = sorted.slice(-Math.min(10, sorted.length));
    const trend = this.calculateTrend(recent);

    // Predict future value
    const days = this.parseTimeframe(timeframe);
    const predicted = current + (trend.slope * days);

    // Calculate confidence (decreases with time)
    const confidence = Math.max(0.3, 0.9 - (days / 30));

    // Determine trend direction
    let trendDirection: "increasing" | "decreasing" | "stable";
    if (trend.slope > 0.1) {
      trendDirection = "increasing";
    } else if (trend.slope < -0.1) {
      trendDirection = "decreasing";
    } else {
      trendDirection = "stable";
    }

    return {
      metric,
      current,
      predicted: Math.max(0, predicted),
      confidence,
      timeframe,
      trend: trendDirection,
    };
  }

  /**
   * Calculate trend using linear regression
   */
  private calculateTrend(data: Array<{ date: string; value: number }>): {
    slope: number;
    intercept: number;
  } {
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Parse timeframe string to days
   */
  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/(\d+)\s*(day|week|month)/i);
    if (!match) {
      return 7; // Default
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case "day":
        return amount;
      case "week":
        return amount * 7;
      case "month":
        return amount * 30;
      default:
        return 7;
    }
  }

  /**
   * Generate forecast
   */
  forecast(
    metric: string,
    historicalData: Array<{ date: string; value: number }>,
    days: number = 30
  ): Forecast {
    const sorted = historicalData.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const trend = this.calculateTrend(sorted.slice(-10));

    const predictions: Forecast["predictions"] = [];
    const lastDate = new Date(sorted[sorted.length - 1].date);

    for (let i = 1; i <= days; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);

      const predictedValue = sorted[sorted.length - 1].value + (trend.slope * i);
      const confidence = Math.max(0.3, 0.9 - (i / 30));

      predictions.push({
        date: date.toISOString().split("T")[0],
        value: Math.max(0, predictedValue),
        confidence,
      });
    }

    // Determine overall trend
    const firstPredicted = predictions[0].value;
    const lastPredicted = predictions[predictions.length - 1].value;

    let forecastTrend: "increasing" | "decreasing" | "stable";
    if (lastPredicted > firstPredicted * 1.1) {
      forecastTrend = "increasing";
    } else if (lastPredicted < firstPredicted * 0.9) {
      forecastTrend = "decreasing";
    } else {
      forecastTrend = "stable";
    }

    return {
      metric,
      predictions,
      trend: forecastTrend,
    };
  }
}
