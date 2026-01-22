/**
 * Response Personalizer
 * 
 * Personalizes responses based on user profile and history
 * to increase engagement and effectiveness.
 */

export interface UserProfile {
  userId?: string;
  username?: string;
  platform: string;
  history?: Array<{
    content: string;
    sentiment: "positive" | "negative" | "neutral";
    timestamp: string;
  }>;
  preferences?: {
    tone?: "formal" | "casual" | "friendly";
    length?: "short" | "medium" | "long";
  };
}

export interface PersonalizedResponse {
  original: string;
  personalized: string;
  personalizations: Array<{
    type: "tone" | "length" | "greeting" | "closing";
    description: string;
  }>;
}

export class Personalizer {
  /**
   * Personalize response
   */
  personalize(
    response: string,
    profile: UserProfile
  ): PersonalizedResponse {
    let personalized = response;
    const personalizations: PersonalizedResponse["personalizations"] = [];

    // Adjust tone based on preferences
    if (profile.preferences?.tone) {
      personalized = this.adjustTone(personalized, profile.preferences.tone);
      personalizations.push({
        type: "tone",
        description: `Adjusted tone to ${profile.preferences.tone}`,
      });
    }

    // Adjust length
    if (profile.preferences?.length) {
      personalized = this.adjustLength(personalized, profile.preferences.length);
      personalizations.push({
        type: "length",
        description: `Adjusted length to ${profile.preferences.length}`,
      });
    }

    // Add personalized greeting if first interaction
    if (!profile.history || profile.history.length === 0) {
      personalized = this.addGreeting(personalized, profile);
      personalizations.push({
        type: "greeting",
        description: "Added personalized greeting",
      });
    }

    // Add personalized closing
    personalized = this.addClosing(personalized, profile);
    personalizations.push({
      type: "closing",
      description: "Added personalized closing",
    });

    return {
      original: response,
      personalized,
      personalizations,
    };
  }

  /**
   * Adjust tone
   */
  private adjustTone(
    content: string,
    targetTone: "formal" | "casual" | "friendly"
  ): string {
    let adjusted = content;

    switch (targetTone) {
      case "casual":
        adjusted = adjusted.replace(/We are/gi, "We're");
        adjusted = adjusted.replace(/It is/gi, "It's");
        break;

      case "friendly":
        if (!adjusted.toLowerCase().startsWith("hi") && !adjusted.toLowerCase().startsWith("hello")) {
          adjusted = `Hi! ${adjusted}`;
        }
        break;

      case "formal":
        adjusted = adjusted.replace(/We're/gi, "We are");
        adjusted = adjusted.replace(/It's/gi, "It is");
        break;
    }

    return adjusted;
  }

  /**
   * Adjust length
   */
  private adjustLength(
    content: string,
    targetLength: "short" | "medium" | "long"
  ): string {
    switch (targetLength) {
      case "short":
        if (content.length > 200) {
          return content.substring(0, 197) + "...";
        }
        break;

      case "long":
        if (content.length < 500) {
          return `${content}\n\nFor more detailed information, please refer to our comprehensive documentation.`;
        }
        break;

      case "medium":
        // No change needed
        break;
    }

    return content;
  }

  /**
   * Add greeting
   */
  private addGreeting(content: string, profile: UserProfile): string {
    if (profile.username) {
      return `Hi ${profile.username}, ${content}`;
    } else {
      return `Hi there, ${content}`;
    }
  }

  /**
   * Add closing
   */
  private addClosing(content: string, profile: UserProfile): string {
    const closings = [
      "Hope this helps!",
      "Let me know if you have any other questions.",
      "Feel free to reach out if you need anything else.",
    ];

    const closing = closings[Math.floor(Math.random() * closings.length)];
    return `${content}\n\n${closing}`;
  }
}
