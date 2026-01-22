/**
 * Entity Resolver
 * 
 * Resolves brand entities across different representations (LLC, Inc, Ltd, etc.)
 * and handles entity normalization and canonicalization.
 */

export interface EntityVariant {
  canonical: string;
  variant: string;
  type: "legal" | "abbreviation" | "alias" | "translation";
  confidence: number;
}

export interface EntityResolution {
  text: string;
  resolvedEntity: string;
  variants: EntityVariant[];
  confidence: number;
}

export class EntityResolver {
  private entityMap: Map<string, string> = new Map(); // variant -> canonical
  private canonicalEntities: Set<string> = new Set();

  // Common legal entity suffixes
  private legalSuffixes = [
    "llc", "ltd", "limited", "inc", "incorporated", "corp", "corporation",
    "plc", "gmbh", "ag", "sa", "nv", "bv", "oy", "ab", "as", "spa",
    "srl", "sro", "s.a.", "s.r.l.", "gmbh & co. kg", "lp", "llp",
  ];

  // Common abbreviations
  private abbreviations: Record<string, string> = {
    "co": "company",
    "ltd": "limited",
    "inc": "incorporated",
    "corp": "corporation",
    "llc": "limited liability company",
  };

  /**
   * Register a canonical entity and its variants
   */
  registerEntity(canonical: string, variants: string[] = []): void {
    const canonicalLower = canonical.toLowerCase().trim();
    this.canonicalEntities.add(canonicalLower);

    // Add canonical as its own variant
    this.entityMap.set(canonicalLower, canonicalLower);

    // Generate and register variants
    const allVariants = [
      ...variants,
      ...this.generateLegalVariants(canonical),
      ...this.generateAbbreviationVariants(canonical),
    ];

    for (const variant of allVariants) {
      const variantLower = variant.toLowerCase().trim();
      this.entityMap.set(variantLower, canonicalLower);
    }
  }

  /**
   * Generate legal entity variants (with/without suffixes)
   */
  private generateLegalVariants(entity: string): string[] {
    const variants: string[] = [];
    const words = entity.toLowerCase().split(/\s+/);
    const baseName = words.filter(w => !this.legalSuffixes.includes(w)).join(" ");

    // Add variants with different legal suffixes
    for (const suffix of this.legalSuffixes) {
      variants.push(`${baseName} ${suffix}`);
      variants.push(`${baseName} ${suffix.toUpperCase()}`);
    }

    // Remove existing legal suffixes and add new ones
    const hasLegalSuffix = words.some(w => this.legalSuffixes.includes(w));
    if (hasLegalSuffix) {
      variants.push(baseName); // Without any suffix
    }

    return variants;
  }

  /**
   * Generate abbreviation variants
   */
  private generateAbbreviationVariants(entity: string): string[] {
    const variants: string[] = [];
    const words = entity.toLowerCase().split(/\s+/);

    // Generate acronym from first letters
    if (words.length > 1) {
      const acronym = words.map(w => w[0]).join("");
      variants.push(acronym);
      variants.push(acronym.toUpperCase());
    }

    // Replace words with abbreviations
    const abbreviated = words.map(w => this.abbreviations[w] || w).join(" ");
    if (abbreviated !== entity.toLowerCase()) {
      variants.push(abbreviated);
    }

    return variants;
  }

  /**
   * Resolve entity from text
   */
  resolve(text: string): EntityResolution | null {
    const textLower = text.toLowerCase().trim();

    // Direct lookup
    if (this.entityMap.has(textLower)) {
      const canonical = this.entityMap.get(textLower)!;
      return {
        text,
        resolvedEntity: canonical,
        variants: [{
          canonical,
          variant: text,
          type: "alias",
          confidence: 1.0,
        }],
        confidence: 1.0,
      };
    }

    // Try to match against registered entities
    for (const [variant, canonical] of this.entityMap.entries()) {
      if (textLower.includes(variant) || variant.includes(textLower)) {
        // Check if it's a whole word match
        const regex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(text)) {
          return {
            text,
            resolvedEntity: canonical,
            variants: [{
              canonical,
              variant: text,
              type: this.determineVariantType(variant, canonical),
              confidence: 0.9,
            }],
            confidence: 0.9,
          };
        }
      }
    }

    // Try to extract and resolve legal entities
    const legalEntity = this.extractLegalEntity(text);
    if (legalEntity) {
      const baseName = legalEntity.base;
      const suffix = legalEntity.suffix;

      // Try to find canonical form
      for (const canonical of this.canonicalEntities) {
        const canonicalBase = canonical
          .split(/\s+/)
          .filter(w => !this.legalSuffixes.includes(w))
          .join(" ");

        if (canonicalBase === baseName) {
          return {
            text,
            resolvedEntity: canonical,
            variants: [{
              canonical,
              variant: text,
              type: "legal",
              confidence: 0.8,
            }],
            confidence: 0.8,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract legal entity from text
   */
  private extractLegalEntity(text: string): { base: string; suffix: string } | null {
    const textLower = text.toLowerCase();
    
    for (const suffix of this.legalSuffixes) {
      const suffixIndex = textLower.indexOf(suffix);
      if (suffixIndex !== -1) {
        const base = text.substring(0, suffixIndex).trim();
        return {
          base: base.toLowerCase(),
          suffix,
        };
      }
    }

    return null;
  }

  /**
   * Determine variant type
   */
  private determineVariantType(variant: string, canonical: string): EntityVariant["type"] {
    const variantLower = variant.toLowerCase();
    const canonicalLower = canonical.toLowerCase();

    // Check if it's a legal suffix variant
    const hasLegalSuffix = this.legalSuffixes.some(suffix => 
      variantLower.includes(suffix) || canonicalLower.includes(suffix)
    );

    if (hasLegalSuffix) {
      return "legal";
    }

    // Check if it's an abbreviation
    if (variantLower.length < canonicalLower.length * 0.5) {
      return "abbreviation";
    }

    return "alias";
  }

  /**
   * Resolve multiple entities from text
   */
  resolveMultiple(text: string): EntityResolution[] {
    const resolutions: EntityResolution[] = [];
    const words = text.toLowerCase().split(/\s+/);

    // Try to match sequences of words
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= words.length; j++) {
        const candidate = words.slice(i, j).join(" ");
        const resolution = this.resolve(candidate);
        
        if (resolution) {
          // Check if this overlaps with existing resolution
          const overlaps = resolutions.some(existing => {
            return existing.text.toLowerCase().includes(candidate) ||
              candidate.includes(existing.text.toLowerCase());
          });

          if (!overlaps) {
            resolutions.push(resolution);
          }
        }
      }
    }

    return resolutions;
  }

  /**
   * Normalize entity name to canonical form
   */
  normalize(entity: string): string {
    const resolution = this.resolve(entity);
    return resolution ? resolution.resolvedEntity : entity;
  }

  /**
   * Check if text contains any registered entities
   */
  containsEntity(text: string): boolean {
    return this.resolveMultiple(text).length > 0;
  }

  /**
   * Get all variants for a canonical entity
   */
  getVariants(canonical: string): string[] {
    const canonicalLower = canonical.toLowerCase();
    const variants: string[] = [];

    for (const [variant, resolved] of this.entityMap.entries()) {
      if (resolved === canonicalLower) {
        variants.push(variant);
      }
    }

    return [...new Set(variants)];
  }
}
