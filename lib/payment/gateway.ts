/**
 * Payment Gateway Integration
 * Production-ready payment processing with Stripe, PayPal, and others
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface PaymentIntent {
  amount: number; // in cents
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
  customerId?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  clientSecret?: string;
  error?: string;
  requiresAction?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in cents
  interval: "month" | "year";
  features: string[];
}

export class PaymentGateway {
  private provider: "stripe" | "paypal" | "none";

  constructor() {
    if (process.env.STRIPE_SECRET_KEY) {
      this.provider = "stripe";
    } else if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
      this.provider = "paypal";
    } else {
      this.provider = "none";
    }
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(
    intent: PaymentIntent
  ): Promise<PaymentResult> {
    const startTime = Date.now();

    try {
      let result: PaymentResult;

      switch (this.provider) {
        case "stripe":
          result = await this.createStripePaymentIntent(intent);
          break;
        case "paypal":
          result = await this.createPayPalOrder(intent);
          break;
        default:
          return {
            success: false,
            error: "Payment gateway not configured",
          };
      }

      const duration = Date.now() - startTime;
      metrics.increment("payment_intents_created", { provider: this.provider });
      metrics.observe("payment_processing_duration_ms", duration, { provider: this.provider });

      return result;
    } catch (error) {
      metrics.increment("payment_errors", { provider: this.provider });
      logger.error("Payment intent creation failed", { error, provider: this.provider });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment processing failed",
      };
    }
  }

  /**
   * Create Stripe payment intent
   */
  private async createStripePaymentIntent(
    intent: PaymentIntent
  ): Promise<PaymentResult> {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Stripe secret key not configured");
    }

    try {
      const response = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount: intent.amount.toString(),
          currency: intent.currency || "usd",
          description: intent.description || "",
          metadata: JSON.stringify(intent.metadata || {}),
          ...(intent.customerId ? { customer: intent.customerId } : {}),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          paymentId: data.id,
          clientSecret: data.client_secret,
          requiresAction: data.status === "requires_action",
        };
      }

      const error = await response.text();
      return { success: false, error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Stripe API error",
      };
    }
  }

  /**
   * Create PayPal order
   */
  private async createPayPalOrder(
    intent: PaymentIntent
  ): Promise<PaymentResult> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const baseUrl = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    try {
      // Get access token
      const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to get PayPal access token");
      }

      const { access_token } = await tokenResponse.json();

      // Create order
      const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: intent.currency.toUpperCase() || "USD",
                value: (intent.amount / 100).toFixed(2),
              },
              description: intent.description,
            },
          ],
        }),
      });

      if (orderResponse.ok) {
        const data = await orderResponse.json();
        return {
          success: true,
          paymentId: data.id,
          clientSecret: data.id, // PayPal uses order ID
        };
      }

      const error = await orderResponse.text();
      return { success: false, error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "PayPal API error",
      };
    }
  }

  /**
   * Confirm payment
   */
  async confirmPayment(
    paymentId: string,
    paymentMethodId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (this.provider) {
        case "stripe":
          return await this.confirmStripePayment(paymentId, paymentMethodId);
        case "paypal":
          return await this.capturePayPalOrder(paymentId);
        default:
          return { success: false, error: "Payment gateway not configured" };
      }
    } catch (error) {
      logger.error("Payment confirmation failed", { error, paymentId, provider: this.provider });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment confirmation failed",
      };
    }
  }

  /**
   * Confirm Stripe payment
   */
  private async confirmStripePayment(
    paymentId: string,
    paymentMethodId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { success: false, error: "Stripe not configured" };
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentId}/confirm`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: paymentMethodId ? new URLSearchParams({ payment_method: paymentMethodId }) : undefined,
      });

      if (response.ok) {
        metrics.increment("payments_confirmed", { provider: "stripe" });
        return { success: true };
      }

      const error = await response.text();
      return { success: false, error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Stripe confirmation failed",
      };
    }
  }

  /**
   * Capture PayPal order
   */
  private async capturePayPalOrder(
    orderId: string
  ): Promise<{ success: boolean; error?: string }> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const baseUrl = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

    if (!clientId || !clientSecret) {
      return { success: false, error: "PayPal not configured" };
    }

    try {
      // Get access token
      const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenResponse.ok) {
        return { success: false, error: "Failed to get PayPal access token" };
      }

      const { access_token } = await tokenResponse.json();

      // Capture order
      const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (captureResponse.ok) {
        metrics.increment("payments_confirmed", { provider: "paypal" });
        return { success: true };
      }

      const error = await captureResponse.text();
      return { success: false, error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "PayPal capture failed",
      };
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(
    customerId: string,
    plan: SubscriptionPlan
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    if (this.provider !== "stripe") {
      return { success: false, error: "Subscriptions only supported with Stripe" };
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { success: false, error: "Stripe not configured" };
    }

    try {
      const response = await fetch("https://api.stripe.com/v1/subscriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customerId,
          items: JSON.stringify([{ price: plan.id }]),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        metrics.increment("subscriptions_created", { provider: "stripe" });
        return { success: true, subscriptionId: data.id };
      }

      const error = await response.text();
      return { success: false, error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Subscription creation failed",
      };
    }
  }
}

export const paymentGateway = new PaymentGateway();
