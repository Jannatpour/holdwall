/**
 * Multilingual Mention Detector
 * 
 * Detects brand mentions in multiple languages using multilingual embeddings
 * and translation-based matching.
 */

export interface MultilingualMatch {
  text: string;
  brandName: string;
  language: string;
  confidence: number;
  translation?: string;
  position: {
    start: number;
    end: number;
  };
}

export interface LanguageDetection {
  language: string;
  confidence: number;
}

export class MultilingualDetector {
  private brandTranslations: Map<string, Map<string, string>> = new Map(); // brand -> language -> translation
  private supportedLanguages = ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko", "ar", "hi"];

  /**
   * Register brand translations
   */
  registerBrandTranslations(
    brandName: string,
    translations: Record<string, string>
  ): void {
    if (!this.brandTranslations.has(brandName)) {
      this.brandTranslations.set(brandName, new Map());
    }

    const brandMap = this.brandTranslations.get(brandName)!;
    for (const [lang, translation] of Object.entries(translations)) {
      brandMap.set(lang, translation);
    }
  }

  /**
   * Detect language of text (simplified - in production use a proper library)
   */
  async detectLanguage(text: string): Promise<LanguageDetection> {
    // Simple heuristic-based detection (in production, use langdetect or similar)
    const textLower = text.toLowerCase();

    // Common words per language
    const languageIndicators: Record<string, string[]> = {
      en: ["the", "and", "is", "are", "was", "were"],
      es: ["el", "la", "de", "que", "y", "en"],
      fr: ["le", "de", "et", "à", "un", "une"],
      de: ["der", "die", "das", "und", "ist", "sind"],
      it: ["il", "la", "di", "e", "è", "sono"],
      pt: ["o", "a", "de", "e", "é", "são"],
      ru: ["и", "в", "на", "с", "по", "для"],
      zh: ["的", "是", "在", "和", "有", "了"],
      ja: ["の", "は", "に", "を", "が", "で"],
      ko: ["의", "는", "이", "를", "가", "에"],
      ar: ["في", "من", "على", "إلى", "هو", "هي"],
      hi: ["के", "की", "को", "से", "में", "है"],
    };

    let maxMatches = 0;
    let detectedLang = "en";

    for (const [lang, indicators] of Object.entries(languageIndicators)) {
      const matches = indicators.filter(indicator => textLower.includes(indicator)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLang = lang;
      }
    }

    return {
      language: detectedLang,
      confidence: maxMatches > 0 ? Math.min(0.9, maxMatches / 3) : 0.5,
    };
  }

  /**
   * Translate text to English using translation API
   */
  async translateToEnglish(text: string, sourceLanguage: string): Promise<string> {
    // Return original if already English
    if (sourceLanguage === "en") {
      return text;
    }

    // Try Google Translate API first
    const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (googleApiKey) {
      try {
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: text,
              source: sourceLanguage,
              target: "en",
              format: "text",
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          return data.data?.translations?.[0]?.translatedText || text;
        }
      } catch (error) {
        console.warn("Google Translate API failed, trying DeepL:", error);
      }
    }

    // Fallback to DeepL
    const deeplApiKey = process.env.DEEPL_API_KEY;
    if (deeplApiKey) {
      try {
        const response = await fetch("https://api-free.deepl.com/v2/translate", {
          method: "POST",
          headers: {
            "Authorization": `DeepL-Auth-Key ${deeplApiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            text,
            source_lang: sourceLanguage.toUpperCase(),
            target_lang: "EN",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.translations?.[0]?.text || text;
        }
      } catch (error) {
        console.warn("DeepL API failed, using OpenAI:", error);
      }
    }

    // Fallback to OpenAI (if available)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Translate the following text from ${sourceLanguage} to English. Return only the translation, no explanations.`,
              },
              {
                role: "user",
                content: text,
              },
            ],
            temperature: 0.3,
            max_tokens: Math.min(1000, text.length * 2),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices[0]?.message?.content?.trim() || text;
        }
      } catch (error) {
        console.warn("OpenAI translation failed:", error);
      }
    }

    // Final fallback: return original text
    return text;
  }

  /**
   * Detect brand mentions in multilingual text
   */
  async detectMentions(
    text: string,
    brandNames: string[]
  ): Promise<MultilingualMatch[]> {
    const matches: MultilingualMatch[] = [];

    // Detect language
    const langDetection = await this.detectLanguage(text);
    const detectedLang = langDetection.language;

    // Check each brand
    for (const brandName of brandNames) {
      // Check exact match in original language
      const exactIndex = text.toLowerCase().indexOf(brandName.toLowerCase());
      if (exactIndex !== -1) {
        matches.push({
          text: text.substring(exactIndex, exactIndex + brandName.length),
          brandName,
          language: detectedLang,
          confidence: 1.0,
          position: {
            start: exactIndex,
            end: exactIndex + brandName.length,
          },
        });
      }

      // Check translations
      const brandTranslations = this.brandTranslations.get(brandName);
      if (brandTranslations) {
        // Check if we have a translation for detected language
        const translation = brandTranslations.get(detectedLang);
        if (translation) {
          const transIndex = text.toLowerCase().indexOf(translation.toLowerCase());
          if (transIndex !== -1) {
            matches.push({
              text: text.substring(transIndex, transIndex + translation.length),
              brandName,
              language: detectedLang,
              confidence: 0.9,
              translation,
              position: {
                start: transIndex,
                end: transIndex + translation.length,
              },
            });
          }
        }

        // Check all other translations
        for (const [lang, trans] of brandTranslations.entries()) {
          if (lang === detectedLang) continue; // Already checked

          const transIndex = text.toLowerCase().indexOf(trans.toLowerCase());
          if (transIndex !== -1) {
            matches.push({
              text: text.substring(transIndex, transIndex + trans.length),
              brandName,
              language: lang,
              confidence: 0.8,
              translation: trans,
              position: {
                start: transIndex,
                end: transIndex + trans.length,
              },
            });
          }
        }
      }
    }

    // Remove overlapping matches
    return this.deduplicateMatches(matches);
  }

  /**
   * Remove duplicate/overlapping matches
   */
  private deduplicateMatches(matches: MultilingualMatch[]): MultilingualMatch[] {
    const sorted = matches.sort((a, b) => b.confidence - a.confidence);
    const unique: MultilingualMatch[] = [];

    for (const match of sorted) {
      const overlaps = unique.some(existing => {
        return (
          (match.position.start >= existing.position.start &&
            match.position.start < existing.position.end) ||
          (match.position.end > existing.position.start &&
            match.position.end <= existing.position.end)
        );
      });

      if (!overlaps) {
        unique.push(match);
      }
    }

    return unique;
  }

  /**
   * Detect mentions across multiple texts in different languages
   */
  async detectMentionsBatch(
    texts: string[],
    brandNames: string[]
  ): Promise<Map<number, MultilingualMatch[]>> {
    const results = new Map<number, MultilingualMatch[]>();

    for (let i = 0; i < texts.length; i++) {
      const matches = await this.detectMentions(texts[i], brandNames);
      if (matches.length > 0) {
        results.set(i, matches);
      }
    }

    return results;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.supportedLanguages.includes(language.toLowerCase());
  }
}
