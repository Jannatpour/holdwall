/**
 * Language Detection Service
 * Production-ready language detection with confidence scoring
 */

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

export class LanguageDetectionService {
  /**
   * Detect language from text
   * Uses a combination of heuristics and statistical analysis
   */
  async detect(text: string): Promise<LanguageDetectionResult> {
    if (!text || text.trim().length === 0) {
      return { language: "en", confidence: 0.5 };
    }

    // Normalize text
    const normalized = text.trim().toLowerCase();
    const words = normalized.split(/\s+/);
    const chars = normalized.split("");

    // Common language patterns (heuristic-based for production)
    const patterns: Record<string, { keywords: string[]; weight: number }> = {
      en: {
        keywords: ["the", "and", "is", "are", "was", "were", "this", "that", "with", "from"],
        weight: 0.3,
      },
      es: {
        keywords: ["el", "la", "de", "que", "y", "en", "un", "es", "se", "no"],
        weight: 0.3,
      },
      fr: {
        keywords: ["le", "de", "et", "à", "un", "il", "être", "et", "en", "avoir"],
        weight: 0.3,
      },
      de: {
        keywords: ["der", "die", "das", "und", "ist", "den", "von", "zu", "dem", "mit"],
        weight: 0.3,
      },
      zh: {
        keywords: ["的", "了", "在", "是", "我", "有", "和", "就", "不", "人"],
        weight: 0.4,
      },
      ja: {
        keywords: ["の", "に", "は", "を", "た", "が", "で", "て", "と", "し"],
        weight: 0.4,
      },
      ar: {
        keywords: ["في", "من", "إلى", "على", "أن", "هذا", "كان", "عن", "مع", "هو"],
        weight: 0.4,
      },
    };

    // Character-based detection for non-Latin scripts
    const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text);
    const hasArabic = /[\u0600-\u06ff]/.test(text);
    const hasCyrillic = /[\u0400-\u04ff]/.test(text);

    if (hasCJK) {
      // Check for Chinese vs Japanese
      const hasHiragana = /[\u3040-\u309f]/.test(text);
      const hasKatakana = /[\u30a0-\u30ff]/.test(text);
      if (hasHiragana || hasKatakana) {
        return { language: "ja", confidence: 0.85 };
      }
      return { language: "zh", confidence: 0.85 };
    }

    if (hasArabic) {
      return { language: "ar", confidence: 0.85 };
    }

    if (hasCyrillic) {
      return { language: "ru", confidence: 0.8 };
    }

    // Score based on keyword frequency
    const scores: Record<string, number> = {};
    for (const [lang, pattern] of Object.entries(patterns)) {
      let matches = 0;
      for (const keyword of pattern.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        const count = (normalized.match(regex) || []).length;
        matches += count;
      }
      scores[lang] = (matches / words.length) * pattern.weight;
    }

    // Find best match
    let bestLang = "en";
    let bestScore = 0.1; // Default confidence for English

    for (const [lang, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    // Normalize confidence (0.5 to 0.95)
    const confidence = Math.min(0.95, Math.max(0.5, bestScore * 2));

    return { language: bestLang, confidence };
  }

  /**
   * Detect language with fallback to external service if available
   */
  async detectWithFallback(text: string): Promise<LanguageDetectionResult> {
    // Try external service if configured
    const apiKey = process.env.DETECT_LANGUAGE_API_KEY;
    if (apiKey && text.length > 50) {
      try {
        const response = await fetch("https://ws.detectlanguage.com/0.2/detect", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: text }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data?.detections?.[0]) {
            const detection = data.data.detections[0];
            return {
              language: detection.language || "en",
              confidence: detection.confidence || 0.5,
            };
          }
        }
      } catch (error) {
        console.warn("External language detection failed, using heuristic:", error);
      }
    }

    // Fallback to heuristic
    return this.detect(text);
  }
}
