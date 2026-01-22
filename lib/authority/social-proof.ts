/**
 * Social Proof Aggregator
 * 
 * Aggregates and displays social proof from public sources
 * to build authority and trust.
 */

export interface SocialProof {
  type: "review" | "testimonial" | "case_study" | "media_mention" | "user_count";
  source: string;
  content: string;
  rating?: number; // 1-5
  author?: string;
  date?: string;
  url?: string;
}

export interface SocialProofAggregation {
  brandName: string;
  proofs: SocialProof[];
  averageRating?: number;
  totalReviews?: number;
  trustScore: number; // 0-1
}

export class SocialProof {
  private proofs: Map<string, SocialProof[]> = new Map(); // brand -> proofs

  /**
   * Add social proof
   */
  addProof(brandName: string, proof: SocialProof): void {
    if (!this.proofs.has(brandName)) {
      this.proofs.set(brandName, []);
    }

    this.proofs.get(brandName)!.push(proof);
  }

  /**
   * Aggregate social proof for brand
   */
  aggregate(brandName: string): SocialProofAggregation {
    const brandProofs = this.proofs.get(brandName) || [];

    // Calculate average rating
    const ratings = brandProofs
      .filter(p => p.rating !== undefined)
      .map(p => p.rating!);
    
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : undefined;

    // Count reviews
    const totalReviews = brandProofs.filter(p => p.type === "review").length;

    // Calculate trust score
    const trustScore = this.calculateTrustScore(brandProofs);

    return {
      brandName,
      proofs: brandProofs,
      averageRating,
      totalReviews,
      trustScore,
    };
  }

  /**
   * Calculate trust score from social proof
   */
  private calculateTrustScore(proofs: SocialProof[]): number {
    if (proofs.length === 0) {
      return 0.5;
    }

    let score = 0.5;

    // Reviews boost
    const reviews = proofs.filter(p => p.type === "review");
    score += Math.min(0.2, reviews.length * 0.02);

    // Testimonials boost
    const testimonials = proofs.filter(p => p.type === "testimonial");
    score += Math.min(0.15, testimonials.length * 0.015);

    // Media mentions boost
    const mediaMentions = proofs.filter(p => p.type === "media_mention");
    score += Math.min(0.15, mediaMentions.length * 0.015);

    // Rating boost
    const ratings = proofs.filter(p => p.rating !== undefined).map(p => p.rating!);
    if (ratings.length > 0) {
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      score += (avgRating / 5) * 0.2;
    }

    return Math.min(1.0, score);
  }

  /**
   * Format social proof for display
   */
  formatForDisplay(aggregation: SocialProofAggregation): string {
    let formatted = "";

    if (aggregation.averageRating) {
      formatted += `Rating: ${aggregation.averageRating.toFixed(1)}/5.0`;
      if (aggregation.totalReviews) {
        formatted += ` (${aggregation.totalReviews} reviews)`;
      }
      formatted += "\n\n";
    }

    // Add top proofs
    const topProofs = aggregation.proofs
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);

    for (const proof of topProofs) {
      formatted += `- ${proof.content}`;
      if (proof.author) {
        formatted += ` — ${proof.author}`;
      }
      if (proof.source) {
        formatted += ` (${proof.source})`;
      }
      formatted += "\n";
    }

    return formatted;
  }

  /**
   * Get proofs for brand
   */
  getProofs(brandName: string): SocialProof[] {
    return this.proofs.get(brandName) || [];
  }
}
