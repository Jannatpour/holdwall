/**
 * Trust Signals
 * 
 * Integrates trust signals (certifications, awards, partnerships)
 * into content to increase authority and citation likelihood.
 */

export interface TrustSignal {
  type: "certification" | "award" | "partnership" | "endorsement" | "verification";
  name: string;
  issuer: string;
  date?: string;
  url?: string;
  badge?: string; // Image URL
}

export interface TrustSignalIntegration {
  content: string;
  signals: TrustSignal[];
  integrated: string;
  trustScore: number; // 0-1
}

export class TrustSignals {
  private signals: Map<string, TrustSignal[]> = new Map(); // brand -> signals

  /**
   * Register trust signals for brand
   */
  registerSignals(brandName: string, signals: TrustSignal[]): void {
    this.signals.set(brandName, signals);
  }

  /**
   * Integrate trust signals into content
   */
  integrate(
    content: string,
    brandName: string
  ): TrustSignalIntegration {
    const brandSignals = this.signals.get(brandName) || [];
    
    let integrated = content;
    let trustScore = 0.5; // Base score

    if (brandSignals.length > 0) {
      // Add trust signals section
      let signalsSection = "\n\n## Trust & Verification\n\n";

      for (const signal of brandSignals) {
        signalsSection += `- **${signal.name}** (${signal.issuer})`;
        if (signal.date) {
          signalsSection += ` - ${signal.date}`;
        }
        if (signal.url) {
          signalsSection += ` - [Verify](${signal.url})`;
        }
        signalsSection += "\n";

        // Increase trust score
        trustScore += 0.1;
      }

      integrated += signalsSection;
      trustScore = Math.min(1.0, trustScore);
    }

    return {
      content,
      signals: brandSignals,
      integrated,
      trustScore,
    };
  }

  /**
   * Get trust signals for brand
   */
  getSignals(brandName: string): TrustSignal[] {
    return this.signals.get(brandName) || [];
  }

  /**
   * Calculate trust score
   */
  calculateTrustScore(brandName: string): number {
    const signals = this.getSignals(brandName);
    
    if (signals.length === 0) {
      return 0.5;
    }

    let score = 0.5;

    // Each signal adds to trust
    for (const signal of signals) {
      switch (signal.type) {
        case "certification":
          score += 0.15;
          break;
        case "award":
          score += 0.1;
          break;
        case "partnership":
          score += 0.08;
          break;
        case "endorsement":
          score += 0.12;
          break;
        case "verification":
          score += 0.1;
          break;
      }
    }

    return Math.min(1.0, score);
  }
}
