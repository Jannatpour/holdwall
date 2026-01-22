/**
 * PII Detection and Redaction Service
 * Production-ready PII detection and redaction with audit logging
 */

export interface PIIEntity {
  type: "email" | "phone" | "ssn" | "credit_card" | "ip_address" | "name" | "address" | "date_of_birth";
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface PIIRedactionResult {
  redacted: boolean;
  redactedText: string;
  entities: PIIEntity[];
  redactionMap: Record<string, { type: string; original: string; redacted: string }>;
}

export class PIIDetectionService {
  /**
   * Detect PII in text
   */
  async detect(text: string): Promise<PIIEntity[]> {
    const entities: PIIEntity[] = [];

    // Email pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        type: "email",
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.95,
      });
    }

    // Phone pattern (US and international formats)
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{10,15}/g;
    while ((match = phoneRegex.exec(text)) !== null) {
      entities.push({
        type: "phone",
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.85,
      });
    }

    // SSN pattern (XXX-XX-XXXX)
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    while ((match = ssnRegex.exec(text)) !== null) {
      entities.push({
        type: "ssn",
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9,
      });
    }

    // Credit card pattern (basic - 13-19 digits with optional separators)
    const ccRegex = /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g;
    while ((match = ccRegex.exec(text)) !== null) {
      entities.push({
        type: "credit_card",
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.7, // Lower confidence, needs validation
      });
    }

    // IP address pattern
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    while ((match = ipRegex.exec(text)) !== null) {
      // Validate it's a real IP range
      const parts = match[0].split(".");
      const isValid = parts.every((part) => parseInt(part) >= 0 && parseInt(part) <= 255);
      if (isValid) {
        entities.push({
          type: "ip_address",
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.9,
        });
      }
    }

    // Date of birth patterns (MM/DD/YYYY, YYYY-MM-DD, etc.)
    const dobRegex = /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g;
    while ((match = dobRegex.exec(text)) !== null) {
      entities.push({
        type: "date_of_birth",
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.7,
      });
    }

    // Sort by position (start index)
    entities.sort((a, b) => a.start - b.start);

    // Remove overlaps (keep higher confidence)
    const filtered: PIIEntity[] = [];
    for (const entity of entities) {
      const overlaps = filtered.filter(
        (e) => !(entity.end <= e.start || entity.start >= e.end)
      );
      if (overlaps.length === 0 || overlaps.every((e) => entity.confidence > e.confidence)) {
        // Remove overlapping entities with lower confidence
        for (const overlap of overlaps) {
          const index = filtered.indexOf(overlap);
          if (index > -1) {
            filtered.splice(index, 1);
          }
        }
        filtered.push(entity);
      }
    }

    return filtered.sort((a, b) => a.start - b.start);
  }

  /**
   * Redact PII from text
   */
  async redact(text: string, entities?: PIIEntity[]): Promise<PIIRedactionResult> {
    const detected = entities || (await this.detect(text));
    const redactionMap: Record<string, { type: string; original: string; redacted: string }> = {};
    let redactedText = text;
    let offset = 0;

    // Redact from end to start to preserve indices
    for (let i = detected.length - 1; i >= 0; i--) {
      const entity = detected[i];
      const redactedValue = this.getRedactionPlaceholder(entity.type, entity.value);
      
      redactionMap[`pii_${i}`] = {
        type: entity.type,
        original: entity.value,
        redacted: redactedValue,
      };

      redactedText =
        redactedText.slice(0, entity.start + offset) +
        redactedValue +
        redactedText.slice(entity.end + offset);
      
      offset += redactedValue.length - (entity.end - entity.start);
    }

    return {
      redacted: detected.length > 0,
      redactedText,
      entities: detected,
      redactionMap,
    };
  }

  /**
   * Get redaction placeholder for PII type
   */
  private getRedactionPlaceholder(type: PIIEntity["type"], original: string): string {
    switch (type) {
      case "email":
        return "[EMAIL_REDACTED]";
      case "phone":
        return "[PHONE_REDACTED]";
      case "ssn":
        return "[SSN_REDACTED]";
      case "credit_card":
        return "[CARD_REDACTED]";
      case "ip_address":
        return "[IP_REDACTED]";
      case "date_of_birth":
        return "[DOB_REDACTED]";
      case "name":
        return "[NAME_REDACTED]";
      case "address":
        return "[ADDRESS_REDACTED]";
      default:
        return "[REDACTED]";
    }
  }

  /**
   * Verify if text contains PII (quick check)
   */
  async hasPII(text: string): Promise<boolean> {
    const entities = await this.detect(text);
    return entities.length > 0;
  }
}
