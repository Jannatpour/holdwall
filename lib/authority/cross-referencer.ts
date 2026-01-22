/**
 * Cross-Referencer
 * 
 * Strategic cross-referencing between published content to build
 * authority networks and increase citation potential.
 */

export interface PublishedContent {
  id: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string;
  topics: string[];
}

export interface CrossReference {
  from: string; // Content ID
  to: string; // Content ID
  type: "related" | "supports" | "explains" | "builds_on";
  relevance: number; // 0-1
  anchorText?: string;
}

export class CrossReferencer {
  private content: Map<string, PublishedContent> = new Map();
  private references: CrossReference[] = [];

  /**
   * Register published content
   */
  registerContent(content: PublishedContent): void {
    this.content.set(content.id, content);
  }

  /**
   * Find cross-reference opportunities
   */
  findOpportunities(contentId: string): CrossReference[] {
    const content = this.content.get(contentId);
    if (!content) {
      return [];
    }

    const opportunities: CrossReference[] = [];

    for (const [otherId, otherContent] of this.content.entries()) {
      if (otherId === contentId) continue;

      // Calculate relevance
      const relevance = this.calculateRelevance(content, otherContent);

      if (relevance > 0.3) {
        // Determine reference type
        const type = this.determineReferenceType(content, otherContent);

        opportunities.push({
          from: contentId,
          to: otherId,
          type,
          relevance,
          anchorText: this.generateAnchorText(otherContent),
        });
      }
    }

    return opportunities.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Calculate relevance between content
   */
  private calculateRelevance(
    content1: PublishedContent,
    content2: PublishedContent
  ): number {
    let relevance = 0;

    // Topic overlap
    const topics1 = new Set(content1.topics);
    const topics2 = new Set(content2.topics);
    const intersection = new Set([...topics1].filter(t => topics2.has(t)));
    const union = new Set([...topics1, ...topics2]);

    if (union.size > 0) {
      relevance += (intersection.size / union.size) * 0.5;
    }

    // Content similarity (simplified)
    const words1 = new Set(content1.content.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.content.toLowerCase().split(/\s+/));
    const wordIntersection = new Set([...words1].filter(w => words2.has(w)));
    const wordUnion = new Set([...words1, ...words2]);

    if (wordUnion.size > 0) {
      relevance += (wordIntersection.size / wordUnion.size) * 0.3;
    }

    // Temporal proximity (recent content is more relevant)
    const timeDiff = Math.abs(
      new Date(content1.publishedAt).getTime() - 
      new Date(content2.publishedAt).getTime()
    );
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    const temporalRelevance = Math.max(0, 1 - daysDiff / 30); // Decay over 30 days
    relevance += temporalRelevance * 0.2;

    return Math.min(1.0, relevance);
  }

  /**
   * Determine reference type
   */
  private determineReferenceType(
    from: PublishedContent,
    to: PublishedContent
  ): CrossReference["type"] {
    // Check if 'to' explains 'from'
    if (to.title.toLowerCase().includes("what is") || to.title.toLowerCase().includes("guide")) {
      return "explains";
    }

    // Check if 'to' supports 'from'
    if (to.content.toLowerCase().includes("evidence") || to.content.toLowerCase().includes("research")) {
      return "supports";
    }

    // Check if 'to' builds on 'from'
    if (new Date(to.publishedAt) > new Date(from.publishedAt)) {
      return "builds_on";
    }

    return "related";
  }

  /**
   * Generate anchor text
   */
  private generateAnchorText(content: PublishedContent): string {
    // Use title as anchor text
    return content.title;
  }

  /**
   * Add cross-references to content
   */
  addCrossReferences(
    contentId: string,
    maxReferences: number = 3
  ): string {
    const content = this.content.get(contentId);
    if (!content) {
      return "";
    }

    const opportunities = this.findOpportunities(contentId)
      .slice(0, maxReferences);

    if (opportunities.length === 0) {
      return content.content;
    }

    let enhanced = content.content;

    // Add references section
    let referencesSection = "\n\n## Related Content\n\n";
    
    for (const ref of opportunities) {
      const targetContent = this.content.get(ref.to);
      if (targetContent) {
        referencesSection += `- [${ref.anchorText}](${targetContent.url})\n`;
      }
    }

    enhanced += referencesSection;

    // Store references
    this.references.push(...opportunities);

    return enhanced;
  }

  /**
   * Get all references
   */
  getReferences(): CrossReference[] {
    return this.references;
  }

  /**
   * Get references for content
   */
  getReferencesFor(contentId: string): CrossReference[] {
    return this.references.filter(r => r.from === contentId || r.to === contentId);
  }
}
