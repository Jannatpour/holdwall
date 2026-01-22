/**
 * ROI Calculator
 * 
 * Calculates return on investment for content and campaigns
 * to measure business impact.
 */

export interface ROIInputs {
  investment: number; // Cost
  revenue?: number; // Revenue generated
  value?: number; // Non-monetary value
  timePeriod: string; // e.g., "30 days"
}

export interface ROICalculation {
  investment: number;
  return: number;
  roi: number; // Percentage
  paybackPeriod?: string;
  valuePerDollar: number;
}

export class ROICalculator {
  /**
   * Calculate ROI
   */
  calculate(inputs: ROIInputs): ROICalculation {
    const { investment, revenue = 0, value = 0, timePeriod } = inputs;

    // Total return (revenue + value)
    const totalReturn = revenue + value;

    // ROI percentage
    const roi = investment > 0 ? ((totalReturn - investment) / investment) * 100 : 0;

    // Value per dollar
    const valuePerDollar = investment > 0 ? totalReturn / investment : 0;

    // Payback period (simplified)
    let paybackPeriod: string | undefined;
    if (roi > 0 && revenue > 0) {
      const months = investment / (revenue / 30); // Assuming monthly revenue
      paybackPeriod = `${Math.ceil(months)} days`;
    }

    return {
      investment,
      return: totalReturn,
      roi,
      paybackPeriod,
      valuePerDollar,
    };
  }

  /**
   * Calculate ROI for content campaign
   */
  calculateContentROI(
    contentCost: number,
    metrics: {
      citations?: number;
      engagements?: number;
      conversions?: number;
      averageValue?: number;
    }
  ): ROICalculation {
    // Estimate value from metrics
    const citationValue = (metrics.citations || 0) * 10; // $10 per citation
    const engagementValue = (metrics.engagements || 0) * 0.5; // $0.50 per engagement
    const conversionValue = (metrics.conversions || 0) * (metrics.averageValue || 0);

    const totalValue = citationValue + engagementValue + conversionValue;

    return this.calculate({
      investment: contentCost,
      value: totalValue,
      timePeriod: "30 days",
    });
  }
}
