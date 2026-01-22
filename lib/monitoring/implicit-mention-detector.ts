/**
 * Implicit Mention Detector
 * 
 * Detects brand mentions even with misspellings, nicknames, abbreviations, and variations.
 * Uses fuzzy matching, phonetic matching, and entity resolution.
 */

export interface BrandVariant {
  original: string;
  variant: string;
  confidence: number;
  type: "misspelling" | "nickname" | "abbreviation" | "acronym" | "translation" | "phonetic";
}

export interface MentionMatch {
  text: string;
  brandName: string;
  variant: BrandVariant;
  context: string;
  position: {
    start: number;
    end: number;
  };
  confidence: number;
}

export class ImplicitMentionDetector {
  private brandNames: Map<string, string[]> = new Map(); // brand -> variants
  private phoneticCache: Map<string, string> = new Map();

  /**
   * Register a brand and its known variants
   */
  registerBrand(brandName: string, variants: string[] = []): void {
    const normalized = brandName.toLowerCase();
    const allVariants = [
      brandName,
      ...variants,
      ...this.generateVariants(brandName),
    ];
    this.brandNames.set(normalized, allVariants.map(v => v.toLowerCase()));
  }

  /**
   * Generate common variants of a brand name
   */
  private generateVariants(brandName: string): string[] {
    const variants: string[] = [];
    const lower = brandName.toLowerCase();

    // Common misspellings patterns
    const commonMisspellings: Record<string, string[]> = {
      "ie": ["ei", "y"],
      "ei": ["ie", "y"],
      "ph": ["f"],
      "ck": ["k", "c"],
      "ou": ["o", "u"],
      "tion": ["shun", "sion"],
    };

    // Generate phonetic variants
    variants.push(...this.generatePhoneticVariants(brandName));

    // Generate abbreviation
    const words = brandName.split(/\s+/);
    if (words.length > 1) {
      const abbreviation = words.map(w => w[0]).join("");
      variants.push(abbreviation);
    }

    // Generate acronym if all caps
    if (brandName === brandName.toUpperCase() && brandName.length <= 5) {
      variants.push(brandName.toLowerCase());
    }

    return [...new Set(variants)];
  }

  /**
   * Generate phonetic variants using Soundex-like algorithm
   */
  private generatePhoneticVariants(text: string): string[] {
    const variants: string[] = [];
    const lower = text.toLowerCase();

    // Simple phonetic substitutions
    const phoneticMap: Record<string, string[]> = {
      "c": ["k", "s"],
      "k": ["c", "ck"],
      "ph": ["f"],
      "f": ["ph"],
      "x": ["ks", "z"],
      "z": ["s", "x"],
      "qu": ["kw", "q"],
      "tion": ["shun"],
      "sion": ["shun", "tion"],
    };

    // Generate variants by substituting phonetic equivalents
    for (const [pattern, replacements] of Object.entries(phoneticMap)) {
      if (lower.includes(pattern)) {
        for (const replacement of replacements) {
          const variant = lower.replace(new RegExp(pattern, "g"), replacement);
          if (variant !== lower) {
            variants.push(variant);
          }
        }
      }
    }

    return [...new Set(variants)];
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // deletion
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity score (0-1) between two strings
   */
  private similarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Detect brand mentions in text
   */
  detectMentions(
    text: string,
    options?: {
      minConfidence?: number;
      contextWindow?: number;
    }
  ): MentionMatch[] {
    const matches: MentionMatch[] = [];
    const minConfidence = options?.minConfidence || 0.7;
    const contextWindow = options?.contextWindow || 50;

    const lowerText = text.toLowerCase();

    for (const [brandName, variants] of this.brandNames.entries()) {
      // Check exact matches first
      const exactIndex = lowerText.indexOf(brandName);
      if (exactIndex !== -1) {
        const start = exactIndex;
        const end = start + brandName.length;
        const context = this.extractContext(text, start, end, contextWindow);

        matches.push({
          text: text.substring(start, end),
          brandName,
          variant: {
            original: brandName,
            variant: brandName,
            confidence: 1.0,
            type: "misspelling", // Exact match, but using same type
          },
          context,
          position: { start, end },
          confidence: 1.0,
        });
      }

      // Check variants with fuzzy matching
      for (const variant of variants) {
        if (variant === brandName) continue; // Already checked

        // Simple substring match first
        const variantIndex = lowerText.indexOf(variant);
        if (variantIndex !== -1) {
          const start = variantIndex;
          const end = start + variant.length;
          const confidence = this.similarity(variant, brandName);
          const context = this.extractContext(text, start, end, contextWindow);

          if (confidence >= minConfidence) {
            matches.push({
              text: text.substring(start, end),
              brandName,
              variant: {
                original: brandName,
                variant,
                confidence,
                type: this.determineVariantType(variant, brandName),
              },
              context,
              position: { start, end },
              confidence,
            });
          }
        } else {
          // Fuzzy match using sliding window
          const windowSize = Math.max(variant.length - 2, variant.length * 0.8);
          for (let i = 0; i <= lowerText.length - windowSize; i++) {
            const window = lowerText.substring(i, i + Math.ceil(windowSize));
            const similarity = this.similarity(window, variant);

            if (similarity >= minConfidence) {
              // Check if this is part of a word (avoid partial matches)
              const before = i > 0 ? lowerText[i - 1] : " ";
              const after = i + windowSize < lowerText.length ? lowerText[i + windowSize] : " ";
              
              if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
                const start = i;
                const end = i + window.length;
                const context = this.extractContext(text, start, end, contextWindow);

                matches.push({
                  text: text.substring(start, end),
                  brandName,
                  variant: {
                    original: brandName,
                    variant,
                    confidence: similarity,
                    type: this.determineVariantType(variant, brandName),
                  },
                  context,
                  position: { start, end },
                  confidence: similarity,
                });
                break; // Found a match, move on
              }
            }
          }
        }
      }
    }

    // Remove overlapping matches (keep highest confidence)
    return this.deduplicateMatches(matches);
  }

  /**
   * Determine variant type
   */
  private determineVariantType(variant: string, original: string): BrandVariant["type"] {
    const variantLower = variant.toLowerCase();
    const originalLower = original.toLowerCase();

    // Check if it's an abbreviation
    if (variantLower.length < originalLower.length * 0.5) {
      return "abbreviation";
    }

    // Check if it's an acronym
    if (variantLower === variantLower.toUpperCase() && variantLower.length <= 5) {
      return "acronym";
    }

    // Check phonetic similarity
    if (this.phoneticSimilarity(variantLower, originalLower) > 0.8) {
      return "phonetic";
    }

    // Default to misspelling
    return "misspelling";
  }

  /**
   * Simple phonetic similarity check
   */
  private phoneticSimilarity(str1: string, str2: string): number {
    // Simple approach: compare first few characters and length
    const len1 = str1.length;
    const len2 = str2.length;
    const minLen = Math.min(len1, len2);

    if (minLen === 0) return 0;

    let matches = 0;
    for (let i = 0; i < Math.min(3, minLen); i++) {
      if (str1[i] === str2[i]) {
        matches++;
      }
    }

    return matches / Math.min(3, minLen);
  }

  /**
   * Extract context around a match
   */
  private extractContext(
    text: string,
    start: number,
    end: number,
    window: number
  ): string {
    const contextStart = Math.max(0, start - window);
    const contextEnd = Math.min(text.length, end + window);
    return text.substring(contextStart, contextEnd);
  }

  /**
   * Remove duplicate/overlapping matches
   */
  private deduplicateMatches(matches: MentionMatch[]): MentionMatch[] {
    // Sort by confidence (highest first)
    const sorted = matches.sort((a, b) => b.confidence - a.confidence);
    const unique: MentionMatch[] = [];

    for (const match of sorted) {
      // Check if this match overlaps with any already added
      const overlaps = unique.some(existing => {
        return (
          (match.position.start >= existing.position.start &&
            match.position.start < existing.position.end) ||
          (match.position.end > existing.position.start &&
            match.position.end <= existing.position.end) ||
          (match.position.start <= existing.position.start &&
            match.position.end >= existing.position.end)
        );
      });

      if (!overlaps) {
        unique.push(match);
      }
    }

    return unique;
  }

  /**
   * Detect mentions across multiple texts
   */
  detectMentionsBatch(
    texts: string[],
    options?: {
      minConfidence?: number;
      contextWindow?: number;
    }
  ): Map<number, MentionMatch[]> {
    const results = new Map<number, MentionMatch[]>();

    for (let i = 0; i < texts.length; i++) {
      const matches = this.detectMentions(texts[i], options);
      if (matches.length > 0) {
        results.set(i, matches);
      }
    }

    return results;
  }
}
