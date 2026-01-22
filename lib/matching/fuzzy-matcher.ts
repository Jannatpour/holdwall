/**
 * Fuzzy Brand Matcher
 * 
 * Advanced fuzzy matching for brand names with misspellings, typos, and variations.
 * Uses Levenshtein distance, phonetic matching, and contextual analysis.
 */

import { ImplicitMentionDetector } from "../monitoring/implicit-mention-detector";

export interface FuzzyMatch {
  brandName: string;
  matchedText: string;
  confidence: number;
  distance: number;
  type: "exact" | "fuzzy" | "phonetic" | "abbreviation";
  position: {
    start: number;
    end: number;
  };
}

export interface FuzzyMatchOptions {
  minConfidence?: number;
  maxDistance?: number;
  caseSensitive?: boolean;
  wholeWordOnly?: boolean;
}

export class FuzzyMatcher {
  private detector: ImplicitMentionDetector;
  private brands: Set<string> = new Set();

  constructor() {
    this.detector = new ImplicitMentionDetector();
  }

  /**
   * Register brands for matching
   */
  registerBrands(brandNames: string[]): void {
    for (const brandName of brandNames) {
      this.brands.add(brandName.toLowerCase());
      this.detector.registerBrand(brandName);
    }
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity score (0-1)
   */
  private similarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Check if strings are phonetically similar (simplified Soundex)
   */
  private phoneticSimilarity(str1: string, str2: string): number {
    const soundex1 = this.soundex(str1);
    const soundex2 = this.soundex(str2);
    return soundex1 === soundex2 ? 1.0 : 0.0;
  }

  /**
   * Simple Soundex implementation
   */
  private soundex(str: string): string {
    const s = str.toUpperCase();
    let result = s[0] || "";

    const mapping: Record<string, string> = {
      "B": "1", "F": "1", "P": "1", "V": "1",
      "C": "2", "G": "2", "J": "2", "K": "2", "Q": "2", "S": "2", "X": "2", "Z": "2",
      "D": "3", "T": "3",
      "L": "4",
      "M": "5", "N": "5",
      "R": "6",
    };

    let lastCode = "";
    for (let i = 1; i < s.length && result.length < 4; i++) {
      const char = s[i];
      const code = mapping[char] || "";

      if (code && code !== lastCode) {
        result += code;
        lastCode = code;
      } else if (!code) {
        lastCode = "";
      }
    }

    return result.padEnd(4, "0");
  }

  /**
   * Find fuzzy matches in text
   */
  findMatches(
    text: string,
    options: FuzzyMatchOptions = {}
  ): FuzzyMatch[] {
    const {
      minConfidence = 0.7,
      maxDistance = 3,
      caseSensitive = false,
      wholeWordOnly = true,
    } = options;

    const matches: FuzzyMatch[] = [];
    const searchText = caseSensitive ? text : text.toLowerCase();

    for (const brandName of this.brands) {
      const brandLower = brandName.toLowerCase();
      const brandLength = brandLower.length;

      // Exact match
      const exactIndex = searchText.indexOf(brandLower);
      if (exactIndex !== -1) {
        const start = exactIndex;
        const end = start + brandLength;

        // Check if whole word if required
        if (!wholeWordOnly || this.isWholeWord(searchText, start, end)) {
          matches.push({
            brandName,
            matchedText: text.substring(start, end),
            confidence: 1.0,
            distance: 0,
            type: "exact",
            position: { start, end },
          });
        }
      }

      // Fuzzy match using sliding window
      const windowSize = brandLength;
      const maxWindowSize = brandLength + maxDistance;

      for (let window = windowSize; window <= maxWindowSize; window++) {
        for (let i = 0; i <= searchText.length - window; i++) {
          const candidate = searchText.substring(i, i + window);

          // Skip if not whole word (when required)
          if (wholeWordOnly && !this.isWholeWord(searchText, i, i + window)) {
            continue;
          }

          const distance = this.levenshteinDistance(brandLower, candidate);
          const similarity = this.similarity(brandLower, candidate);

          if (distance <= maxDistance && similarity >= minConfidence) {
            // Check phonetic similarity for additional confidence
            const phoneticSim = this.phoneticSimilarity(brandLower, candidate);
            const finalConfidence = Math.max(similarity, phoneticSim * 0.9);

            if (finalConfidence >= minConfidence) {
              matches.push({
                brandName,
                matchedText: text.substring(i, i + window),
                confidence: finalConfidence,
                distance,
                type: phoneticSim > 0.8 ? "phonetic" : "fuzzy",
                position: { start: i, end: i + window },
              });
            }
          }
        }
      }

      // Check abbreviations
      if (brandLength > 3) {
        const abbreviation = brandLower
          .split(/\s+/)
          .map(word => word[0])
          .join("");

        const abbrevIndex = searchText.indexOf(abbreviation);
        if (abbrevIndex !== -1) {
          const start = abbrevIndex;
          const end = start + abbreviation.length;

          if (!wholeWordOnly || this.isWholeWord(searchText, start, end)) {
            matches.push({
              brandName,
              matchedText: text.substring(start, end),
              confidence: 0.8,
              distance: brandLength - abbreviation.length,
              type: "abbreviation",
              position: { start, end },
            });
          }
        }
      }
    }

    // Remove duplicates and overlaps (keep highest confidence)
    return this.deduplicateMatches(matches);
  }

  /**
   * Check if match is a whole word
   */
  private isWholeWord(text: string, start: number, end: number): boolean {
    const before = start > 0 ? text[start - 1] : " ";
    const after = end < text.length ? text[end] : " ";
    return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
  }

  /**
   * Remove duplicate/overlapping matches
   */
  private deduplicateMatches(matches: FuzzyMatch[]): FuzzyMatch[] {
    // Sort by confidence (highest first)
    const sorted = matches.sort((a, b) => b.confidence - a.confidence);
    const unique: FuzzyMatch[] = [];

    for (const match of sorted) {
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
   * Find best match for a given text
   */
  findBestMatch(
    text: string,
    options: FuzzyMatchOptions = {}
  ): FuzzyMatch | null {
    const matches = this.findMatches(text, options);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Check if text contains any brand mentions
   */
  containsBrand(text: string, options: FuzzyMatchOptions = {}): boolean {
    return this.findMatches(text, options).length > 0;
  }
}
