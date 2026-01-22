/**
 * Schema-Constrained KAG
 * 
 * Represents domain expert knowledge ensuring outputs align
 * with specific principles and constraints.
 */

import { KAGPipeline, KAGContext } from "./kag";

export interface SchemaConstraint {
  type: "must_include" | "must_not_include" | "format" | "structure";
  rule: string;
  description: string;
}

export interface SchemaConstrainedResult {
  query: string;
  answer: string;
  constraints: SchemaConstraint[];
  violations: Array<{
    constraint: string;
    reason: string;
  }>;
  confidence: number;
}

export class SchemaConstrainedKAG {
  private kagPipeline: KAGPipeline;
  private constraints: SchemaConstraint[] = [];

  constructor() {
    this.kagPipeline = new KAGPipeline();
  }

  /**
   * Register schema constraint
   */
  registerConstraint(constraint: SchemaConstraint): void {
    this.constraints.push(constraint);
  }

  /**
   * Execute query with schema constraints
   */
  async execute(
    query: string,
    tenantId: string,
    constraints?: SchemaConstraint[]
  ): Promise<SchemaConstrainedResult> {
    const activeConstraints = constraints || this.constraints;

    // Retrieve knowledge graph context
    const context = await this.kagPipeline.retrieve(query, tenantId);

    // Generate answer
    let answer = await this.generateAnswer(query, context);

    // Apply constraints
    const violations: SchemaConstrainedResult["violations"] = [];

    for (const constraint of activeConstraints) {
      const violation = this.checkConstraint(answer, constraint);
      if (violation) {
        violations.push(violation);
        // Fix violation
        answer = this.fixViolation(answer, constraint);
      }
    }

    return {
      query,
      answer,
      constraints: activeConstraints,
      violations,
      confidence: violations.length === 0 ? 0.9 : 0.7,
    };
  }

  /**
   * Generate answer
   */
  private async generateAnswer(
    query: string,
    context: KAGContext
  ): Promise<string> {
    // Build answer from knowledge graph
    const answerParts: string[] = [];

    for (const node of context.nodes) {
      if (this.isRelevant(node.content, query)) {
        answerParts.push(node.content);
      }
    }

    return answerParts.length > 0
      ? answerParts.join(". ")
      : "Unable to generate answer.";
  }

  /**
   * Check constraint
   */
  private checkConstraint(
    answer: string,
    constraint: SchemaConstraint
  ): { constraint: string; reason: string } | null {
    switch (constraint.type) {
      case "must_include":
        if (!answer.toLowerCase().includes(constraint.rule.toLowerCase())) {
          return {
            constraint: constraint.description,
            reason: `Answer must include: ${constraint.rule}`,
          };
        }
        break;

      case "must_not_include":
        if (answer.toLowerCase().includes(constraint.rule.toLowerCase())) {
          return {
            constraint: constraint.description,
            reason: `Answer must not include: ${constraint.rule}`,
          };
        }
        break;

      case "format":
        // Check format (simplified)
        if (!new RegExp(constraint.rule).test(answer)) {
          return {
            constraint: constraint.description,
            reason: `Answer does not match required format`,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Fix constraint violation
   */
  private fixViolation(
    answer: string,
    constraint: SchemaConstraint
  ): string {
    switch (constraint.type) {
      case "must_include":
        if (!answer.includes(constraint.rule)) {
          return `${answer} ${constraint.rule}`;
        }
        break;

      case "must_not_include":
        return answer.replace(new RegExp(constraint.rule, "gi"), "");
    }

    return answer;
  }

  /**
   * Check relevance
   */
  private isRelevant(content: string, query: string): boolean {
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const intersection = new Set([...queryWords].filter(w => contentWords.has(w)));
    return intersection.size >= 2;
  }
}
