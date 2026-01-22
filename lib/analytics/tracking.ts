/**
 * Analytics & Tracking
 * Production-ready analytics with multiple provider support
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  userId?: string;
  tenantId?: string;
  timestamp?: number;
}

export interface PageViewEvent extends AnalyticsEvent {
  name: "page_view";
  properties: {
    path: string;
    referrer?: string;
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
  };
}

export interface UserActionEvent extends AnalyticsEvent {
  name: "user_action";
  properties: {
    action: string;
    category?: string;
    label?: string;
    value?: number;
  };
}

export class AnalyticsTracker {
  private providers: Array<"posthog" | "mixpanel" | "google-analytics" | "amplitude"> = [];

  constructor() {
    // Determine enabled providers
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      this.providers.push("posthog");
    }
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      this.providers.push("mixpanel");
    }
    if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      this.providers.push("google-analytics");
    }
    if (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY) {
      this.providers.push("amplitude");
    }
  }

  /**
   * Track event
   */
  async track(event: AnalyticsEvent): Promise<void> {
    const timestamp = event.timestamp || Date.now();

    // Track metrics
    metrics.increment("analytics_events_total", {
      event_name: event.name,
    });

    // Log event
    logger.info("Analytics event", {
      name: event.name,
      properties: event.properties,
      userId: event.userId,
      tenantId: event.tenantId,
    });

    // Send to providers (client-side)
    if (typeof window !== "undefined") {
      this.trackClientSide(event);
    } else {
      // Server-side tracking
      await this.trackServerSide(event);
    }
  }

  /**
   * Track page view
   */
  async pageView(
    path: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    const event: PageViewEvent = {
      name: "page_view",
      properties: {
        path,
        referrer: typeof window !== "undefined" ? document.referrer : undefined,
        userAgent: typeof window !== "undefined" ? navigator.userAgent : undefined,
        screenWidth: typeof window !== "undefined" ? window.screen.width : undefined,
        screenHeight: typeof window !== "undefined" ? window.screen.height : undefined,
        ...properties,
      },
    };

    await this.track(event);
  }

  /**
   * Track user action
   */
  async action(
    action: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    const event: UserActionEvent = {
      name: "user_action",
      properties: {
        action,
        ...properties,
      },
    };

    await this.track(event);
  }

  /**
   * Track conversion
   */
  async conversion(
    conversionName: string,
    value?: number,
    properties?: Record<string, unknown>
  ): Promise<void> {
    await this.track({
      name: "conversion",
      properties: {
        conversion_name: conversionName,
        value,
        ...properties,
      },
    });

    metrics.increment("conversions_total", { conversion_name: conversionName });
    if (value) {
      metrics.observe("conversion_value", value, { conversion_name: conversionName });
    }
  }

  /**
   * Identify user
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    if (typeof window === "undefined") {
      return;
    }

    // PostHog
    if (this.providers.includes("posthog") && (window as any).posthog) {
      (window as any).posthog.identify(userId, traits);
    }

    // Mixpanel
    if (this.providers.includes("mixpanel") && (window as any).mixpanel) {
      (window as any).mixpanel.identify(userId);
      if (traits) {
        (window as any).mixpanel.people.set(traits);
      }
    }

    // Amplitude
    if (this.providers.includes("amplitude") && (window as any).amplitude) {
      (window as any).amplitude.setUserId(userId);
      if (traits) {
        (window as any).amplitude.setUserProperties(traits);
      }
    }
  }

  /**
   * Client-side tracking
   */
  private trackClientSide(event: AnalyticsEvent): void {
    // PostHog
    if (this.providers.includes("posthog") && (window as any).posthog) {
      (window as any).posthog.capture(event.name, event.properties);
    }

    // Mixpanel
    if (this.providers.includes("mixpanel") && (window as any).mixpanel) {
      (window as any).mixpanel.track(event.name, event.properties);
    }

    // Google Analytics
    if (this.providers.includes("google-analytics") && (window as any).gtag) {
      (window as any).gtag("event", event.name, {
        ...event.properties,
        user_id: event.userId,
      });
    }

    // Amplitude
    if (this.providers.includes("amplitude") && (window as any).amplitude) {
      (window as any).amplitude.logEvent(event.name, event.properties);
    }
  }

  /**
   * Server-side tracking
   */
  private async trackServerSide(event: AnalyticsEvent): Promise<void> {
    // Send to analytics API endpoint
    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch (error) {
      logger.warn("Server-side analytics tracking failed", { error });
    }
  }
}

export const analytics = new AnalyticsTracker();

/**
 * React hook for analytics
 */
export function useAnalytics() {
  if (typeof window === "undefined") {
    return {
      track: async () => {},
      pageView: async () => {},
      action: async () => {},
      conversion: async () => {},
      identify: () => {},
    };
  }

  return {
    track: analytics.track.bind(analytics),
    pageView: analytics.pageView.bind(analytics),
    action: analytics.action.bind(analytics),
    conversion: analytics.conversion.bind(analytics),
    identify: analytics.identify.bind(analytics),
  };
}
