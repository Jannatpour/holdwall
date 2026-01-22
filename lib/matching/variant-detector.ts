/**
 * Variant Detector
 * 
 * Detects brand name variants including nicknames, abbreviations, acronyms,
 * and common misspellings.
 */

export interface BrandVariant {
  original: string;
  variant: string;
  type: "nickname" | "abbreviation" | "acronym" | "misspelling" | "phonetic" | "translation";
  confidence: number;
  examples?: string[];
}

export class VariantDetector {
  private variants: Map<string, BrandVariant[]> = new Map(); // brand -> variants
  private commonMisspellings: Map<string, string[]> = new Map();

  constructor() {
    this.initializeCommonMisspellings();
  }

  /**
   * Initialize common misspelling patterns
   */
  private initializeCommonMisspellings(): void {
    // Common letter substitution patterns
    const patterns: Array<[string, string[]]> = [
      ["ie", ["ei", "y"]],
      ["ei", ["ie", "y"]],
      ["ph", ["f"]],
      ["ck", ["k", "c"]],
      ["ou", ["o", "u"]],
      ["tion", ["shun", "sion"]],
      ["able", ["ible"]],
      ["er", ["or", "ar"]],
      ["or", ["er", "ar"]],
    ];

    // This would be expanded with more patterns in production
  }

  /**
   * Register brand and its known variants
   */
  registerBrand(brandName: string, knownVariants?: BrandVariant[]): void {
    const normalized = brandName.toLowerCase();
    
    // Generate automatic variants
    const autoVariants = this.generateVariants(brandName);
    
    // Combine with known variants
    const allVariants = [
      ...(knownVariants || []),
      ...autoVariants,
    ];

    this.variants.set(normalized, allVariants);
  }

  /**
   * Generate variants for a brand name
   */
  private generateVariants(brandName: string): BrandVariant[] {
    const variants: BrandVariant[] = [];
    const lower = brandName.toLowerCase();
    const words = brandName.split(/\s+/);

    // Generate abbreviation
    if (words.length > 1) {
      const abbreviation = words.map(w => w[0]).join("");
      variants.push({
        original: brandName,
        variant: abbreviation,
        type: "abbreviation",
        confidence: 0.8,
      });
    }

    // Generate acronym (if all caps or short)
    if (brandName === brandName.toUpperCase() && brandName.length <= 5) {
      variants.push({
        original: brandName,
        variant: brandName.toLowerCase(),
        type: "acronym",
        confidence: 0.9,
      });
    }

    // Generate common misspellings
    const misspellings = this.generateMisspellings(brandName);
    variants.push(...misspellings);

    // Generate phonetic variants
    const phonetic = this.generatePhoneticVariants(brandName);
    variants.push(...phonetic);

    return variants;
  }

  /**
   * Generate common misspellings
   */
  private generateMisspellings(brandName: string): BrandVariant[] {
    const variants: BrandVariant[] = [];
    const lower = brandName.toLowerCase();

    // Common letter substitutions
    const substitutions: Array<[string, string]> = [
      ["ie", "ei"],
      ["ei", "ie"],
      ["ph", "f"],
      ["ck", "k"],
      ["ou", "o"],
    ];

    for (const [from, to] of substitutions) {
      if (lower.includes(from)) {
        const variant = lower.replace(new RegExp(from, "g"), to);
        if (variant !== lower) {
          variants.push({
            original: brandName,
            variant,
            type: "misspelling",
            confidence: 0.7,
          });
        }
      }
    }

    // Single character typos (simplified - would be more comprehensive)
    for (let i = 0; i < lower.length; i++) {
      // Character deletion
      const deleted = lower.substring(0, i) + lower.substring(i + 1);
      variants.push({
        original: brandName,
        variant: deleted,
        type: "misspelling",
        confidence: 0.6,
      });

      // Character substitution (adjacent keys on keyboard)
      const char = lower[i];
      const adjacent = this.getAdjacentKeys(char);
      for (const adj of adjacent) {
        const substituted = lower.substring(0, i) + adj + lower.substring(i + 1);
        variants.push({
          original: brandName,
          variant: substituted,
          type: "misspelling",
          confidence: 0.65,
        });
      }
    }

    return variants;
  }

  /**
   * Get adjacent keys on QWERTY keyboard
   */
  private getAdjacentKeys(char: string): string[] {
    const qwerty: Record<string, string[]> = {
      "q": ["w", "a"],
      "w": ["q", "e", "a", "s"],
      "e": ["w", "r", "s", "d"],
      "r": ["e", "t", "d", "f"],
      "t": ["r", "y", "f", "g"],
      "y": ["t", "u", "g", "h"],
      "u": ["y", "i", "h", "j"],
      "i": ["u", "o", "j", "k"],
      "o": ["i", "p", "k", "l"],
      "p": ["o", "l"],
      "a": ["q", "w", "s", "z"],
      "s": ["a", "w", "e", "d", "x", "z"],
      "d": ["s", "e", "r", "f", "c", "x"],
      "f": ["d", "r", "t", "g", "v", "c"],
      "g": ["f", "t", "y", "h", "b", "v"],
      "h": ["g", "y", "u", "j", "n", "b"],
      "j": ["h", "u", "i", "k", "m", "n"],
      "k": ["j", "i", "o", "l", "m"],
      "l": ["k", "o", "p"],
      "z": ["a", "s", "x"],
      "x": ["z", "s", "d", "c"],
      "c": ["x", "d", "f", "v"],
      "v": ["c", "f", "g", "b"],
      "b": ["v", "g", "h", "n"],
      "n": ["b", "h", "j", "m"],
      "m": ["n", "j", "k"],
    };

    return qwerty[char.toLowerCase()] || [];
  }

  /**
   * Generate phonetic variants
   */
  private generatePhoneticVariants(brandName: string): BrandVariant[] {
    const variants: BrandVariant[] = [];
    const lower = brandName.toLowerCase();

    // Phonetic substitutions
    const phoneticMap: Record<string, string[]> = {
      "c": ["k", "s"],
      "k": ["c"],
      "ph": ["f"],
      "f": ["ph"],
      "x": ["ks", "z"],
      "z": ["s", "x"],
      "qu": ["kw"],
    };

    for (const [pattern, replacements] of Object.entries(phoneticMap)) {
      if (lower.includes(pattern)) {
        for (const replacement of replacements) {
          const variant = lower.replace(new RegExp(pattern, "g"), replacement);
          if (variant !== lower) {
            variants.push({
              original: brandName,
              variant,
              type: "phonetic",
              confidence: 0.75,
            });
          }
        }
      }
    }

    return variants;
  }

  /**
   * Detect if text contains a variant of brand
   */
  detectVariant(text: string, brandName: string): BrandVariant | null {
    const brandVariants = this.variants.get(brandName.toLowerCase());
    if (!brandVariants) {
      return null;
    }

    const textLower = text.toLowerCase();

    for (const variant of brandVariants) {
      if (textLower.includes(variant.variant.toLowerCase())) {
        return variant;
      }
    }

    return null;
  }

  /**
   * Get all variants for a brand
   */
  getVariants(brandName: string): BrandVariant[] {
    return this.variants.get(brandName.toLowerCase()) || [];
  }

  /**
   * Check if two strings are variants of each other
   */
  areVariants(str1: string, str2: string): boolean {
    const str1Lower = str1.toLowerCase();
    const str2Lower = str2.toLowerCase();

    // Check if str2 is a variant of str1
    const variants1 = this.getVariants(str1);
    for (const variant of variants1) {
      if (variant.variant.toLowerCase() === str2Lower) {
        return true;
      }
    }

    // Check if str1 is a variant of str2
    const variants2 = this.getVariants(str2);
    for (const variant of variants2) {
      if (variant.variant.toLowerCase() === str1Lower) {
        return true;
      }
    }

    return false;
  }
}
