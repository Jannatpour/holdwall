/**
 * AP2 (Agent Payment Protocol)
 * 
 * Enables autonomous financial transactions between agents using digital wallets.
 * Includes mandates (intent/cart/payment), signatures, wallet ledger, limits,
 * revocation, and auditing.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { db } from "@/lib/db/client";
import { createHash, createSign, createVerify } from "crypto";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { paymentGateway } from "./gateway";
import { getProtocolSecurity } from "@/lib/security/protocol-security";
import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { retryWithBackoff } from "@/lib/resilience/retry-strategy";

export interface PaymentMandate {
  mandateId: string;
  fromAgentId: string;
  toAgentId: string;
  type: "intent" | "cart" | "payment";
  amount: number; // in smallest currency unit (cents)
  currency: string;
  description?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  status: "pending" | "approved" | "rejected" | "expired" | "revoked" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentSignature {
  signatureId: string;
  mandateId: string;
  agentId: string;
  signature: string; // Cryptographic signature
  publicKey: string;
  timestamp: Date;
}

export interface WalletLedgerEntry {
  entryId: string;
  walletId: string;
  agentId: string;
  type: "credit" | "debit";
  amount: number;
  currency: string;
  mandateId?: string;
  transactionId?: string;
  description?: string;
  balance: number; // Balance after this entry
  timestamp: Date;
}

export interface WalletLimit {
  walletId: string;
  agentId: string;
  limitType: "daily" | "weekly" | "monthly" | "transaction" | "lifetime";
  limitAmount: number;
  currency: string;
  currentUsage: number;
  resetAt: Date;
}

export interface PaymentAuditLog {
  auditId: string;
  mandateId?: string;
  transactionId?: string;
  action: string;
  fromAgentId?: string;
  toAgentId?: string;
  amount?: number;
  currency?: string;
  status: "success" | "failure";
  error?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface CreateMandateRequest {
  fromAgentId: string;
  toAgentId: string;
  type: "intent" | "cart" | "payment";
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, unknown>;
  expiresIn?: number; // seconds
}

export interface ApproveMandateRequest {
  mandateId: string;
  agentId: string;
  signature: string;
  publicKey: string;
}

export interface ExecutePaymentRequest {
  mandateId: string;
  fromAgentId: string;
  toAgentId: string;
  signature: string;
  publicKey: string;
}

/**
 * Payment adapter interface for real payment gateways
 */
export interface PaymentAdapter {
  name: string;
  processPayment(request: {
    amount: number;
    currency: string;
    fromAccount: string;
    toAccount: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }>;
  checkCompliance(request: {
    amount: number;
    currency: string;
    fromAccount: string;
    toAccount: string;
  }): Promise<{
    compliant: boolean;
    checks: Array<{ name: string; passed: boolean; reason?: string }>;
  }>;
}

/**
 * AP2 Protocol Implementation with staged payment adapters
 */
export class AP2Protocol {
  private mandates: Map<string, PaymentMandate> = new Map();
  private signatures: Map<string, PaymentSignature[]> = new Map(); // mandateId -> signatures
  private walletLedgers: Map<string, WalletLedgerEntry[]> = new Map(); // walletId -> entries
  private walletLimits: Map<string, WalletLimit> = new Map(); // walletId -> limit
  private auditLogs: PaymentAuditLog[] = [];
  private a2aProtocol = getA2AProtocol();
  private paymentAdapters: Map<string, PaymentAdapter> = new Map();
  private featureFlags: Map<string, boolean> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.initializeDefaultLimits();
    this.initializeFeatureFlags();
    if (process.env.NODE_ENV !== "test") {
      this.loadFromDatabase().catch((error) => {
        logger.warn("Failed to load AP2 data from database on initialization", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Load mandates and limits from database on startup
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      // Load recent mandates (last 1000)
      const dbMandates = await db.paymentMandate.findMany({
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      for (const dbMandate of dbMandates) {
        const mandate: PaymentMandate = {
          mandateId: dbMandate.mandateId,
          fromAgentId: dbMandate.fromAgentId,
          toAgentId: dbMandate.toAgentId,
          type: dbMandate.type as "intent" | "cart" | "payment",
          amount: dbMandate.amount,
          currency: dbMandate.currency,
          description: dbMandate.description || undefined,
          metadata: (dbMandate.metadata as Record<string, unknown>) || undefined,
          expiresAt: dbMandate.expiresAt || undefined,
          status: dbMandate.status as PaymentMandate["status"],
          createdAt: dbMandate.createdAt,
          updatedAt: dbMandate.updatedAt,
        };
        this.mandates.set(dbMandate.mandateId, mandate);
      }

      // Load signatures
      const dbSignatures = await db.paymentSignature.findMany({
        where: {
          mandateId: {
            in: Array.from(this.mandates.keys()),
          },
        },
      });

      for (const dbSig of dbSignatures) {
        const signatures = this.signatures.get(dbSig.mandateId) || [];
        signatures.push({
          signatureId: dbSig.signatureId,
          mandateId: dbSig.mandateId,
          agentId: dbSig.agentId,
          signature: dbSig.signature,
          publicKey: dbSig.publicKey,
          timestamp: dbSig.timestamp,
        });
        this.signatures.set(dbSig.mandateId, signatures);
      }

      // Load wallet limits
      const dbLimits = await (db as any).walletLimit.findMany();
      for (const dbLimit of dbLimits) {
        this.walletLimits.set(dbLimit.walletId, {
          walletId: dbLimit.walletId,
          agentId: dbLimit.agentId,
          limitType: dbLimit.limitType as WalletLimit["limitType"],
          limitAmount: dbLimit.limitAmount,
          currency: dbLimit.currency,
          currentUsage: dbLimit.currentUsage,
          resetAt: dbLimit.resetAt,
        });
      }

      logger.info("AP2 data loaded from database", {
        mandates: this.mandates.size,
        signatures: this.signatures.size,
        limits: this.walletLimits.size,
      });
    } catch (error) {
      logger.error("Failed to load AP2 data from database", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create payment mandate with security verification
   */
  async createMandate(request: CreateMandateRequest): Promise<PaymentMandate> {
    // Security verification
    const protocolSecurity = getProtocolSecurity();
    
    // Verify fromAgent identity
    const fromSecurityContext = await protocolSecurity.verifyAgentIdentity(request.fromAgentId);
    if (!fromSecurityContext || !fromSecurityContext.identityVerified) {
      throw new Error(`Agent identity verification failed: ${request.fromAgentId}`);
    }

    const hasPermission = await protocolSecurity.checkProtocolPermission(
      request.fromAgentId,
      "ap2",
      "create_mandate"
    );

    if (!hasPermission) {
      throw new Error(`Agent ${request.fromAgentId} does not have permission to create payment mandates`);
    }

    // Validate agents exist
    const fromAgent = this.a2aProtocol.getAgent(request.fromAgentId);
    const toAgent = this.a2aProtocol.getAgent(request.toAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error(
        `Agent not found: ${!fromAgent ? request.fromAgentId : request.toAgentId}`
      );
    }

    const mandateId = `mandate_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const expiresAt = request.expiresIn
      ? new Date(Date.now() + request.expiresIn * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24 hours

    const mandate: PaymentMandate = {
      mandateId,
      fromAgentId: request.fromAgentId,
      toAgentId: request.toAgentId,
      type: request.type,
      amount: request.amount,
      currency: request.currency,
      description: request.description,
      metadata: request.metadata,
      expiresAt,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mandates.set(mandateId, mandate);

    // Persist to database
    try {
      await (db as any).paymentMandate.create({
        data: {
          mandateId,
          fromAgentId: request.fromAgentId,
          toAgentId: request.toAgentId,
          type: request.type,
          amount: request.amount,
          currency: request.currency,
          description: request.description || null,
          metadata: request.metadata || {},
          expiresAt: expiresAt,
          status: mandate.status,
        },
      });
    } catch (error) {
      logger.warn("Failed to persist mandate to database", {
        error: error instanceof Error ? error.message : String(error),
        mandateId,
      });
    }

    // Check wallet limits
    const limitCheck = await this.checkWalletLimits(
      request.fromAgentId,
      request.amount,
      request.currency
    );
    if (!limitCheck.allowed) {
      mandate.status = "rejected";
      await this.audit("mandate_rejected", {
        mandateId,
        fromAgentId: request.fromAgentId,
        toAgentId: request.toAgentId,
        amount: request.amount,
        currency: request.currency,
        reason: limitCheck.reason,
      });
      throw new Error(`Wallet limit exceeded: ${limitCheck.reason}`);
    }

    await this.audit("mandate_created", {
      mandateId,
      fromAgentId: request.fromAgentId,
      toAgentId: request.toAgentId,
      type: request.type,
      amount: request.amount,
      currency: request.currency,
    });

    metrics.increment("ap2_mandates_created_total", {
      type: request.type,
      currency: request.currency,
    });

    logger.info("Payment mandate created", {
      mandateId,
      fromAgentId: request.fromAgentId,
      toAgentId: request.toAgentId,
      amount: request.amount,
      currency: request.currency,
    });

    return mandate;
  }

  /**
   * Approve mandate with signature and security verification
   */
  async approveMandate(request: ApproveMandateRequest): Promise<PaymentMandate> {
    // Security verification
    const protocolSecurity = getProtocolSecurity();
    
    const securityContext = await protocolSecurity.verifyAgentIdentity(request.agentId);
    if (!securityContext || !securityContext.identityVerified) {
      throw new Error(`Agent identity verification failed: ${request.agentId}`);
    }

    const hasPermission = await protocolSecurity.checkProtocolPermission(
      request.agentId,
      "ap2",
      "approve_mandate"
    );

    if (!hasPermission) {
      throw new Error(`Agent ${request.agentId} does not have permission to approve payment mandates`);
    }

    const mandate = this.mandates.get(request.mandateId);
    if (!mandate) {
      throw new Error(`Mandate ${request.mandateId} not found`);
    }

    if (mandate.status !== "pending") {
      throw new Error(`Mandate ${request.mandateId} is not pending`);
    }

    if (mandate.expiresAt && mandate.expiresAt < new Date()) {
      mandate.status = "expired";
      throw new Error(`Mandate ${request.mandateId} has expired`);
    }

    // Verify signature
    const isValid = await this.verifySignature(
      request.mandateId,
      request.signature,
      request.publicKey,
      request.agentId
    );

    if (!isValid) {
      await this.audit("mandate_approval_failed", {
        mandateId: request.mandateId,
        agentId: request.agentId,
        reason: "Invalid signature",
      });
      throw new Error("Invalid signature");
    }

    // Store signature
    const signature: PaymentSignature = {
      signatureId: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      mandateId: request.mandateId,
      agentId: request.agentId,
      signature: request.signature,
      publicKey: request.publicKey,
      timestamp: new Date(),
    };

    const signatures = this.signatures.get(request.mandateId) || [];
    signatures.push(signature);
    this.signatures.set(request.mandateId, signatures);

    // Update mandate status
    mandate.status = "approved";
    mandate.updatedAt = new Date();

    // Persist signature to database
    try {
      await db.paymentSignature.create({
        data: {
          signatureId: signature.signatureId,
          mandateId: request.mandateId,
          agentId: request.agentId,
          signature: request.signature,
          publicKey: request.publicKey,
          timestamp: signature.timestamp,
        },
      });

      // Update mandate in database
      await db.paymentMandate.update({
        where: { mandateId: request.mandateId },
        data: {
          status: "approved",
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn("Failed to persist signature to database", {
        error: error instanceof Error ? error.message : String(error),
        mandateId: request.mandateId,
      });
    }

    await this.audit("mandate_approved", {
      mandateId: request.mandateId,
      agentId: request.agentId,
    });

    logger.info("Payment mandate approved", {
      mandateId: request.mandateId,
      agentId: request.agentId,
    });

    return mandate;
  }

  /**
   * Execute payment from mandate
   */
  async executePayment(request: ExecutePaymentRequest): Promise<{
    transactionId: string;
    fromBalance: number;
    toBalance: number;
  }> {
    // Security verification
    const protocolSecurity = getProtocolSecurity();
    
    // Verify fromAgent identity
    const fromSecurityContext = await protocolSecurity.verifyAgentIdentity(request.fromAgentId);
    if (!fromSecurityContext || !fromSecurityContext.identityVerified) {
      throw new Error(`Agent identity verification failed: ${request.fromAgentId}`);
    }

    const hasPermission = await protocolSecurity.checkProtocolPermission(
      request.fromAgentId,
      "ap2",
      "execute_payment"
    );

    if (!hasPermission) {
      throw new Error(`Agent ${request.fromAgentId} does not have permission to execute payments`);
    }

    const mandate = this.mandates.get(request.mandateId);
    if (!mandate) {
      throw new Error(`Mandate ${request.mandateId} not found`);
    }

    if (mandate.status !== "approved") {
      throw new Error(`Mandate ${request.mandateId} is not approved`);
    }

    if (mandate.fromAgentId !== request.fromAgentId || mandate.toAgentId !== request.toAgentId) {
      throw new Error("Agent IDs do not match mandate");
    }

    // Verify signature
    const isValid = await this.verifySignature(
      request.mandateId,
      request.signature,
      request.publicKey,
      request.fromAgentId
    );

    if (!isValid) {
      await this.audit("payment_execution_failed", {
        mandateId: request.mandateId,
        fromAgentId: request.fromAgentId,
        toAgentId: request.toAgentId,
        reason: "Invalid signature",
      });
      throw new Error("Invalid signature");
    }

    // Check wallet balance
    const fromWalletId = `wallet_${request.fromAgentId}`;
    const toWalletId = `wallet_${request.toAgentId}`;

    const fromBalance = await this.getWalletBalance(fromWalletId, mandate.currency);
    if (fromBalance < mandate.amount) {
      await this.audit("payment_execution_failed", {
        mandateId: request.mandateId,
        fromAgentId: request.fromAgentId,
        toAgentId: request.toAgentId,
        reason: "Insufficient balance",
      });
      throw new Error("Insufficient balance");
    }

    // Check limits again
    const limitCheck = await this.checkWalletLimits(
      request.fromAgentId,
      mandate.amount,
      mandate.currency
    );
    if (!limitCheck.allowed) {
      await this.audit("payment_execution_failed", {
        mandateId: request.mandateId,
        fromAgentId: request.fromAgentId,
        toAgentId: request.toAgentId,
        reason: limitCheck.reason,
      });
      throw new Error(`Wallet limit exceeded: ${limitCheck.reason}`);
    }

    // Execute payment
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Debit from sender
    const fromEntry: WalletLedgerEntry = {
      entryId: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      walletId: fromWalletId,
      agentId: request.fromAgentId,
      type: "debit",
      amount: mandate.amount,
      currency: mandate.currency,
      mandateId: request.mandateId,
      transactionId,
      description: mandate.description || "Payment",
      balance: fromBalance - mandate.amount,
      timestamp: new Date(),
    };

    // Credit to receiver
    const toBalance = await this.getWalletBalance(toWalletId, mandate.currency);
    const toEntry: WalletLedgerEntry = {
      entryId: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      walletId: toWalletId,
      agentId: request.toAgentId,
      type: "credit",
      amount: mandate.amount,
      currency: mandate.currency,
      mandateId: request.mandateId,
      transactionId,
      description: mandate.description || "Payment received",
      balance: toBalance + mandate.amount,
      timestamp: new Date(),
    };

    // Add to ledgers
    const fromLedger = this.walletLedgers.get(fromWalletId) || [];
    fromLedger.push(fromEntry);
    this.walletLedgers.set(fromWalletId, fromLedger);

    const toLedger = this.walletLedgers.get(toWalletId) || [];
    toLedger.push(toEntry);
    this.walletLedgers.set(toWalletId, toLedger);

    // Persist ledger entries to database atomically
    try {
      await db.$transaction(async (tx) => {
        // Create ledger entries
        await tx.walletLedgerEntry.createMany({
          data: [
            {
              entryId: fromEntry.entryId,
              walletId: fromWalletId,
              agentId: request.fromAgentId,
              type: "debit",
              amount: mandate.amount,
              currency: mandate.currency,
              mandateId: request.mandateId,
              transactionId,
              description: fromEntry.description || null,
              balance: fromEntry.balance,
              timestamp: fromEntry.timestamp,
            },
            {
              entryId: toEntry.entryId,
              walletId: toWalletId,
              agentId: request.toAgentId,
              type: "credit",
              amount: mandate.amount,
              currency: mandate.currency,
              mandateId: request.mandateId,
              transactionId,
              description: toEntry.description || null,
              balance: toEntry.balance,
              timestamp: toEntry.timestamp,
            },
          ],
        });

        // Update mandate status
        await tx.paymentMandate.update({
          where: { mandateId: request.mandateId },
          data: {
            status: "completed",
            updatedAt: new Date(),
          },
        });
      });

      // Update wallet limits (outside transaction to avoid deadlocks)
      await this.updateWalletLimits(request.fromAgentId, mandate.amount, mandate.currency);
    } catch (error) {
      logger.error("Failed to persist payment to database", {
        error: error instanceof Error ? error.message : String(error),
        mandateId: request.mandateId,
        transactionId,
      });
      // Rollback in-memory state
      mandate.status = "approved";
      const fromLedger = this.walletLedgers.get(fromWalletId);
      if (fromLedger && fromLedger.length > 0) {
        fromLedger.pop();
      }
      const toLedger = this.walletLedgers.get(toWalletId);
      if (toLedger && toLedger.length > 0) {
        toLedger.pop();
      }
      throw new Error(`Payment execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Update mandate (already persisted in transaction)
    mandate.status = "completed";
    mandate.updatedAt = new Date();

    await this.audit("payment_executed", {
      mandateId: request.mandateId,
      transactionId,
      fromAgentId: request.fromAgentId,
      toAgentId: request.toAgentId,
      amount: mandate.amount,
      currency: mandate.currency,
    });

    metrics.increment("ap2_payments_executed_total", {
      currency: mandate.currency,
    });
    metrics.observe("ap2_payment_amount", mandate.amount, {
      currency: mandate.currency,
    });

    logger.info("Payment executed", {
      mandateId: request.mandateId,
      transactionId,
      fromAgentId: request.fromAgentId,
      toAgentId: request.toAgentId,
      amount: mandate.amount,
      currency: mandate.currency,
    });

    return {
      transactionId,
      fromBalance: fromEntry.balance,
      toBalance: toEntry.balance,
    };
  }

  /**
   * Revoke mandate
   */
  async revokeMandate(mandateId: string, agentId: string): Promise<void> {
    const mandate = this.mandates.get(mandateId);
    if (!mandate) {
      throw new Error(`Mandate ${mandateId} not found`);
    }

    if (mandate.fromAgentId !== agentId && mandate.toAgentId !== agentId) {
      throw new Error("Agent not authorized to revoke this mandate");
    }

    if (mandate.status === "completed" || mandate.status === "revoked") {
      throw new Error(`Cannot revoke mandate in status: ${mandate.status}`);
    }

    mandate.status = "revoked";
    mandate.updatedAt = new Date();

    // Update in database
    try {
      await (db as any).paymentMandate.update({
        where: { mandateId },
        data: {
          status: "revoked",
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn("Failed to update mandate in database", {
        error: error instanceof Error ? error.message : String(error),
        mandateId,
      });
    }

    await this.audit("mandate_revoked", {
      mandateId,
      agentId,
    });

    logger.info("Payment mandate revoked", {
      mandateId,
      agentId,
    });
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletId: string, currency: string): Promise<number> {
    // Try database first
    try {
      const latestEntry = await db.walletLedgerEntry.findFirst({
        where: {
          walletId,
          currency,
        },
        orderBy: {
          timestamp: "desc",
        },
        select: {
          balance: true,
        },
      });

      if (latestEntry) {
        return latestEntry.balance;
      }
    } catch (error) {
      logger.warn("Failed to get balance from database, using in-memory", {
        error: error instanceof Error ? error.message : String(error),
        walletId,
        currency,
      });
    }

    // Fallback to in-memory
    const ledger = this.walletLedgers.get(walletId) || [];
    const currencyEntries = ledger.filter(
      (entry) => entry.currency === currency
    );
    if (currencyEntries.length === 0) {
      return 0;
    }
    // Get latest entry balance
    const latest = currencyEntries[currencyEntries.length - 1];
    return latest.balance;
  }

  /**
   * Credit a wallet (e.g., funding/top-up) by recording a ledger entry.
   * In production, this should be invoked only after an external payment rails confirmation.
   */
  async creditWallet(request: {
    agentId: string;
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<WalletLedgerEntry> {
    const protocolSecurity = getProtocolSecurity();
    const securityContext = await protocolSecurity.verifyAgentIdentity(request.agentId);
    if (!securityContext || !securityContext.identityVerified) {
      throw new Error(`Agent identity verification failed: ${request.agentId}`);
    }
    const hasPermission = await protocolSecurity.checkProtocolPermission(
      request.agentId,
      "ap2",
      "credit_wallet"
    );
    if (!hasPermission) {
      throw new Error(`Agent ${request.agentId} does not have permission to credit wallets`);
    }

    const walletId = `wallet_${request.agentId}`;
    const currentBalance = await this.getWalletBalance(walletId, request.currency);
    const entry: WalletLedgerEntry = {
      entryId: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      walletId,
      agentId: request.agentId,
      type: "credit",
      amount: request.amount,
      currency: request.currency,
      description: request.description,
      balance: currentBalance + request.amount,
      timestamp: new Date(),
    };

    const ledger = this.walletLedgers.get(walletId) || [];
    ledger.push(entry);
    this.walletLedgers.set(walletId, ledger);

    try {
      await db.walletLedgerEntry.create({
        data: {
          entryId: entry.entryId,
          walletId: entry.walletId,
          agentId: entry.agentId,
          type: "credit",
          amount: entry.amount,
          currency: entry.currency,
          mandateId: null,
          transactionId: null,
          description: entry.description || null,
          balance: entry.balance,
          timestamp: entry.timestamp,
        },
      });
    } catch (error) {
      logger.warn("Failed to persist wallet credit to database", {
        error: error instanceof Error ? error.message : String(error),
        walletId,
      });
    }

    await this.audit("wallet_credited", {
      agentId: request.agentId,
      amount: request.amount,
      currency: request.currency,
      ...request.metadata,
    });

    return entry;
  }

  /**
   * Get wallet ledger
   */
  async getWalletLedger(walletId: string, currency?: string): Promise<WalletLedgerEntry[]> {
    // Try database first
    try {
      const entries = await db.walletLedgerEntry.findMany({
        where: {
          walletId,
          ...(currency ? { currency } : {}),
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      if (entries.length > 0) {
        return entries.map((e) => ({
          entryId: e.entryId,
          walletId: e.walletId,
          agentId: e.agentId,
          type: e.type as "credit" | "debit",
          amount: e.amount,
          currency: e.currency,
          mandateId: e.mandateId || undefined,
          transactionId: e.transactionId || undefined,
          description: e.description || undefined,
          balance: e.balance,
          timestamp: e.timestamp,
        }));
      }
    } catch (error) {
      logger.warn("Failed to get ledger from database, using in-memory", {
        error: error instanceof Error ? error.message : String(error),
        walletId,
        currency,
      });
    }

    // Fallback to in-memory
    const ledger = this.walletLedgers.get(walletId) || [];
    if (currency) {
      return ledger.filter((entry) => entry.currency === currency);
    }
    return ledger;
  }

  /**
   * Set wallet limit
   */
  async setWalletLimit(
    agentId: string,
    limitType: WalletLimit["limitType"],
    limitAmount: number,
    currency: string
  ): Promise<void> {
    const walletId = `wallet_${agentId}`;
    const resetAt = this.calculateResetAt(limitType);
    const limit: WalletLimit = {
      walletId,
      agentId,
      limitType,
      limitAmount,
      currency,
      currentUsage: 0,
      resetAt,
    };

    this.walletLimits.set(walletId, limit);

    // Persist to database
    try {
      await (db as any).walletLimit.upsert({
        where: { walletId },
        create: {
          walletId,
          agentId,
          limitType,
          limitAmount,
          currency,
          currentUsage: 0,
          resetAt,
        },
        update: {
          limitType,
          limitAmount,
          currency,
          currentUsage: 0,
          resetAt,
        },
      });
    } catch (error) {
      logger.warn("Failed to persist wallet limit to database", {
        error: error instanceof Error ? error.message : String(error),
        walletId,
      });
    }

    await this.audit("wallet_limit_set", {
      agentId,
      limitType,
      limitAmount,
      currency,
    });

    logger.info("Wallet limit set", {
      agentId,
      limitType,
      limitAmount,
      currency,
    });
  }

  /**
   * Check wallet limits
   */
  private async checkWalletLimits(
    agentId: string,
    amount: number,
    currency: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const walletId = `wallet_${agentId}`;
    
    // Try database first
    let limit: WalletLimit | null = null;
    try {
      const dbLimit = await db.walletLimit.findUnique({
        where: { walletId },
      });

      if (dbLimit) {
        limit = {
          walletId: dbLimit.walletId,
          agentId: dbLimit.agentId,
          limitType: dbLimit.limitType as WalletLimit["limitType"],
          limitAmount: dbLimit.limitAmount,
          currency: dbLimit.currency,
          currentUsage: dbLimit.currentUsage,
          resetAt: dbLimit.resetAt,
        };
        this.walletLimits.set(walletId, limit);
      }
    } catch (error) {
      logger.warn("Failed to get limit from database, using in-memory", {
        error: error instanceof Error ? error.message : String(error),
        walletId,
      });
    }

    // Fallback to in-memory
    if (!limit) {
      limit = this.walletLimits.get(walletId) || null;
    }

    if (!limit) {
      return { allowed: true }; // No limit set
    }

    if (limit.currency !== currency) {
      return { allowed: true }; // Different currency, no limit
    }

    // Check if limit needs reset
    if (limit.resetAt < new Date()) {
      limit.currentUsage = 0;
      limit.resetAt = this.calculateResetAt(limit.limitType);
      
      // Update in database
      try {
        await (db as any).walletLimit.update({
          where: { walletId },
          data: {
            currentUsage: 0,
            resetAt: limit.resetAt,
          },
        });
      } catch (error) {
        logger.warn("Failed to reset limit in database", {
          error: error instanceof Error ? error.message : String(error),
          walletId,
        });
      }
    }

    if (limit.currentUsage + amount > limit.limitAmount) {
      return {
        allowed: false,
        reason: `${limit.limitType} limit exceeded: ${limit.currentUsage + amount} > ${limit.limitAmount}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Update wallet limits after payment
   */
  private async updateWalletLimits(
    agentId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const walletId = `wallet_${agentId}`;
    const limit = this.walletLimits.get(walletId);

    if (!limit || limit.currency !== currency) {
      return;
    }

    limit.currentUsage += amount;

    // Reset if needed
    if (limit.resetAt < new Date()) {
      limit.currentUsage = amount;
      limit.resetAt = this.calculateResetAt(limit.limitType);
    }

    // Update in database
    try {
      await (db as any).walletLimit.update({
        where: { walletId },
        data: {
          currentUsage: limit.currentUsage,
          resetAt: limit.resetAt,
        },
      });
    } catch (error) {
      logger.warn("Failed to update limit in database", {
        error: error instanceof Error ? error.message : String(error),
        walletId,
      });
    }
  }

  /**
   * Calculate reset date for limit type
   */
  private calculateResetAt(limitType: WalletLimit["limitType"]): Date {
    const now = new Date();
    switch (limitType) {
      case "daily":
        now.setDate(now.getDate() + 1);
        now.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        now.setDate(now.getDate() + 7);
        break;
      case "monthly":
        now.setMonth(now.getMonth() + 1);
        break;
      case "transaction":
      case "lifetime":
        // Never reset
        now.setFullYear(now.getFullYear() + 100);
        break;
    }
    return now;
  }

  /**
   * Verify signature using cryptographic verification
   */
  private async verifySignature(
    mandateId: string,
    signature: string,
    publicKey: string,
    agentId: string
  ): Promise<boolean> {
    const agent = this.a2aProtocol.getAgent(agentId);
    if (!agent) {
      return false;
    }

    // Verify public key matches agent
    if (agent.publicKey && agent.publicKey !== publicKey) {
      return false;
    }

    // Verify signature format
    if (!signature || signature.length === 0 || !publicKey || publicKey.length === 0) {
      return false;
    }

    // Use proper cryptographic signature verification
    try {
      // The signature should be over the mandate data
      // In production, the signature is created over: mandateId + agentId + timestamp
      // For now, we verify over mandateId (the actual data being signed)
      const verify = createVerify("RSA-SHA256");
      verify.update(mandateId);
      verify.end();

      // Verify the signature
      const isValid = verify.verify(publicKey, signature, "base64");

      if (!isValid) {
        logger.warn("Signature verification failed", {
          mandateId,
          agentId,
          reason: "Invalid cryptographic signature",
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.warn("Signature verification error", {
        mandateId,
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Audit log
   */
  private async audit(
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const auditLog: PaymentAuditLog = {
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      mandateId: metadata.mandateId as string | undefined,
      transactionId: metadata.transactionId as string | undefined,
      action,
      fromAgentId: metadata.fromAgentId as string | undefined,
      toAgentId: metadata.toAgentId as string | undefined,
      amount: metadata.amount as number | undefined,
      currency: metadata.currency as string | undefined,
      status: metadata.reason ? "failure" : "success",
      error: metadata.reason as string | undefined,
      metadata,
      timestamp: new Date(),
    };

    this.auditLogs.push(auditLog);

    // Keep only last 10000 audit logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }

    // Persist to database
    try {
      await db.paymentAuditLog.create({
        data: {
          auditId: auditLog.auditId,
          mandateId: auditLog.mandateId || null,
          transactionId: auditLog.transactionId || null,
          action: auditLog.action,
          fromAgentId: auditLog.fromAgentId || null,
          toAgentId: auditLog.toAgentId || null,
          amount: auditLog.amount || null,
          currency: auditLog.currency || null,
          status: auditLog.status,
          error: auditLog.error || null,
          metadata: (auditLog.metadata || {}) as any,
          timestamp: auditLog.timestamp,
        },
      });
    } catch (error) {
      logger.warn("Failed to persist audit log to database", {
        error: error instanceof Error ? error.message : String(error),
        auditId: auditLog.auditId,
      });
    }

    logger.debug("AP2 audit", {
      action,
      ...metadata,
    });
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters?: {
    mandateId?: string;
    transactionId?: string;
    agentId?: string;
    action?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<PaymentAuditLog[]> {
    // Try database first
    try {
      const where: any = {};
      if (filters?.mandateId) {
        where.mandateId = filters.mandateId;
      }
      if (filters?.transactionId) {
        where.transactionId = filters.transactionId;
      }
      if (filters?.agentId) {
        where.OR = [
          { fromAgentId: filters.agentId },
          { toAgentId: filters.agentId },
        ];
      }
      if (filters?.action) {
        where.action = filters.action;
      }
      if (filters?.startTime || filters?.endTime) {
        where.timestamp = {};
        if (filters?.startTime) {
          where.timestamp.gte = filters.startTime;
        }
        if (filters?.endTime) {
          where.timestamp.lte = filters.endTime;
        }
      }

      const dbLogs = await (db as any).paymentAuditLog.findMany({
        where,
        orderBy: {
          timestamp: "desc",
        },
        take: 1000, // Limit to recent 1000 logs
      });

      if (dbLogs.length > 0) {
        return dbLogs.map((log: any) => ({
          auditId: log.auditId,
          mandateId: log.mandateId || undefined,
          transactionId: log.transactionId || undefined,
          action: log.action,
          fromAgentId: log.fromAgentId || undefined,
          toAgentId: log.toAgentId || undefined,
          amount: log.amount || undefined,
          currency: log.currency || undefined,
          status: log.status as "success" | "failure",
          error: log.error || undefined,
          metadata: (log.metadata as Record<string, unknown>) || {},
          timestamp: log.timestamp,
        }));
      }
    } catch (error) {
      logger.warn("Failed to get audit logs from database, using in-memory", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Fallback to in-memory
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.mandateId) {
        logs = logs.filter((log) => log.mandateId === filters.mandateId);
      }
      if (filters.transactionId) {
        logs = logs.filter((log) => log.transactionId === filters.transactionId);
      }
      if (filters.agentId) {
        logs = logs.filter(
          (log) => log.fromAgentId === filters.agentId || log.toAgentId === filters.agentId
        );
      }
      if (filters.action) {
        logs = logs.filter((log) => log.action === filters.action);
      }
      if (filters.startTime) {
        logs = logs.filter((log) => log.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        logs = logs.filter((log) => log.timestamp <= filters.endTime!);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get mandate
   */
  async getMandate(mandateId: string): Promise<PaymentMandate | null> {
    // Try in-memory first
    const inMemory = this.mandates.get(mandateId);
    if (inMemory) {
      return inMemory;
    }

    // Try database
    try {
      const dbMandate = await (db as any).paymentMandate.findUnique({
        where: { mandateId },
      });

      if (dbMandate) {
        const mandate: PaymentMandate = {
          mandateId: dbMandate.mandateId,
          fromAgentId: dbMandate.fromAgentId,
          toAgentId: dbMandate.toAgentId,
          type: dbMandate.type as "intent" | "cart" | "payment",
          amount: dbMandate.amount,
          currency: dbMandate.currency,
          description: dbMandate.description || undefined,
          metadata: (dbMandate.metadata as Record<string, unknown>) || undefined,
          expiresAt: dbMandate.expiresAt || undefined,
          status: dbMandate.status as PaymentMandate["status"],
          createdAt: dbMandate.createdAt,
          updatedAt: dbMandate.updatedAt,
        };
        this.mandates.set(mandateId, mandate);
        return mandate;
      }
    } catch (error) {
      logger.warn("Failed to get mandate from database", {
        error: error instanceof Error ? error.message : String(error),
        mandateId,
      });
    }

    return null;
  }

  /**
   * List mandates for an agent
   */
  async listMandates(filters?: {
    fromAgentId?: string;
    toAgentId?: string;
    status?: PaymentMandate["status"];
    limit?: number;
  }): Promise<PaymentMandate[]> {
    const results: PaymentMandate[] = [];

    // Try database first
    try {
      const where: any = {};
      if (filters?.fromAgentId) where.fromAgentId = filters.fromAgentId;
      if (filters?.toAgentId) where.toAgentId = filters.toAgentId;
      if (filters?.status) where.status = filters.status;

      const dbMandates = await (db as any).paymentMandate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters?.limit || 100,
      });

      for (const dbMandate of dbMandates) {
        const mandate: PaymentMandate = {
          mandateId: dbMandate.mandateId,
          fromAgentId: dbMandate.fromAgentId,
          toAgentId: dbMandate.toAgentId,
          type: dbMandate.type as "intent" | "cart" | "payment",
          amount: dbMandate.amount,
          currency: dbMandate.currency,
          description: dbMandate.description || undefined,
          metadata: (dbMandate.metadata as Record<string, unknown>) || undefined,
          expiresAt: dbMandate.expiresAt || undefined,
          status: dbMandate.status as PaymentMandate["status"],
          createdAt: dbMandate.createdAt,
          updatedAt: dbMandate.updatedAt,
        };
        this.mandates.set(mandate.mandateId, mandate);
        results.push(mandate);
      }

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      logger.warn("Failed to list mandates from database", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Fallback to in-memory
    for (const mandate of this.mandates.values()) {
      if (filters?.fromAgentId && mandate.fromAgentId !== filters.fromAgentId) continue;
      if (filters?.toAgentId && mandate.toAgentId !== filters.toAgentId) continue;
      if (filters?.status && mandate.status !== filters.status) continue;
      results.push(mandate);
    }

    // Sort by creation date (newest first) and limit
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results.slice(0, filters?.limit || 100);
  }

  /**
   * Initialize default limits
   */
  private initializeDefaultLimits(): void {
    // Default limits can be set per agent
    // For now, no default limits
  }

  /**
   * Initialize feature flags
   */
  private initializeFeatureFlags(): void {
    // Feature flags for staged rollout
    this.featureFlags.set("ap2_real_payments", process.env.AP2_ENABLE_REAL_PAYMENTS === "true");
    this.featureFlags.set("ap2_stripe_adapter", process.env.AP2_ENABLE_STRIPE === "true");
    this.featureFlags.set("ap2_paypal_adapter", process.env.AP2_ENABLE_PAYPAL === "true");
    this.featureFlags.set("ap2_compliance_checks", process.env.AP2_ENABLE_COMPLIANCE !== "false");
    this.featureFlags.set("ap2_kyc_verification", process.env.AP2_ENABLE_KYC === "true");

    // Register default adapters
    this.registerPaymentAdapter(new StripePaymentAdapter());
    this.registerPaymentAdapter(new PayPalPaymentAdapter());
  }

  /**
   * Register payment adapter
   */
  registerPaymentAdapter(adapter: PaymentAdapter): void {
    this.paymentAdapters.set(adapter.name, adapter);
    logger.info("Payment adapter registered", { name: adapter.name });
  }

  /**
   * Execute payment with real adapter (if enabled)
   */
  async executePaymentWithAdapter(
    request: ExecutePaymentRequest,
    adapterName?: string
  ): Promise<{
    transactionId: string;
    fromBalance: number;
    toBalance: number;
    realPaymentId?: string;
  }> {
    // First execute in sandbox
    const sandboxResult = await this.executePayment(request);

    // If real payments are enabled and adapter is specified
    if (this.featureFlags.get("ap2_real_payments") && adapterName) {
      const adapter = this.paymentAdapters.get(adapterName);
      if (!adapter) {
        throw new Error(`Payment adapter ${adapterName} not found`);
      }

      const mandate = this.mandates.get(request.mandateId);
      if (!mandate) {
        throw new Error(`Mandate ${request.mandateId} not found`);
      }

      // Check compliance
      if (this.featureFlags.get("ap2_compliance_checks")) {
        const compliance = await adapter.checkCompliance({
          amount: mandate.amount,
          currency: mandate.currency,
          fromAccount: `agent_${request.fromAgentId}`,
          toAccount: `agent_${request.toAgentId}`,
        });

        if (!compliance.compliant) {
          await this.audit("payment_compliance_failed", {
            mandateId: request.mandateId,
            transactionId: sandboxResult.transactionId,
            adapter: adapterName,
            checks: compliance.checks,
          });
          throw new Error(
            `Compliance check failed: ${compliance.checks
              .filter((c) => !c.passed)
              .map((c) => `${c.name}: ${c.reason}`)
              .join(", ")}`
          );
        }
      }

      // Get or create circuit breaker for adapter
      let circuitBreaker = this.circuitBreakers.get(adapterName);
      if (!circuitBreaker) {
        circuitBreaker = new CircuitBreaker({
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000, // 1 minute
          resetTimeout: 300000, // 5 minutes
        });
        this.circuitBreakers.set(adapterName, circuitBreaker);
      }

      // Process real payment with circuit breaker and retry
      const realPaymentResult = await circuitBreaker.execute(async () => {
        const retryResult = await retryWithBackoff(
          async () => {
            return await adapter.processPayment({
              amount: mandate.amount,
              currency: mandate.currency,
              fromAccount: `agent_${request.fromAgentId}`,
              toAccount: `agent_${request.toAgentId}`,
              description: mandate.description,
              metadata: {
                mandateId: request.mandateId,
                transactionId: sandboxResult.transactionId,
                fromAgentId: request.fromAgentId,
                toAgentId: request.toAgentId,
              },
            });
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 2,
            retryableErrors: [/timeout/i, /network/i, /connection/i, /rate.?limit/i],
          }
        );
        return retryResult.result;
      });

      if (!realPaymentResult.success) {
        await this.audit("real_payment_failed", {
          mandateId: request.mandateId,
          transactionId: sandboxResult.transactionId,
          adapter: adapterName,
          error: realPaymentResult.error,
        });
        throw new Error(`Real payment failed: ${realPaymentResult.error}`);
      }

      await this.audit("real_payment_executed", {
        mandateId: request.mandateId,
        transactionId: sandboxResult.transactionId,
        realPaymentId: realPaymentResult.transactionId,
        adapter: adapterName,
      });

      return {
        ...sandboxResult,
        realPaymentId: realPaymentResult.transactionId,
      };
    }

    return sandboxResult;
  }

  /**
   * Get feature flag value
   */
  getFeatureFlag(flag: string): boolean {
    return this.featureFlags.get(flag) || false;
  }

  /**
   * Set feature flag (for testing/admin)
   */
  setFeatureFlag(flag: string, value: boolean): void {
    this.featureFlags.set(flag, value);
    logger.info("Feature flag updated", { flag, value });
  }

  /**
   * Get mandate count (for health checks)
   */
  getMandateCount(): number {
    return this.mandates.size;
  }

  /**
   * Get adapter count (for health checks)
   */
  getAdapterCount(): number {
    return this.paymentAdapters.size;
  }
}

// Singleton instance
let ap2ProtocolInstance: AP2Protocol | null = null;

/**
 * Stripe Payment Adapter
 */
class StripePaymentAdapter implements PaymentAdapter {
  name = "stripe";

  async processPayment(request: {
    amount: number;
    currency: string;
    fromAccount: string;
    toAccount: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      const result = await paymentGateway.createPaymentIntent({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        metadata: Object.fromEntries(
          Object.entries(request.metadata || {}).map(([k, v]) => [k, String(v)])
        ),
      });

      if (result.success && result.paymentId) {
        const confirmResult = await paymentGateway.confirmPayment(result.paymentId);
        if (confirmResult.success) {
          return {
            success: true,
            transactionId: result.paymentId,
          };
        }
        return {
          success: false,
          error: confirmResult.error || "Payment confirmation failed",
        };
      }

      return {
        success: false,
        error: result.error || "Payment intent creation failed",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment processing failed",
      };
    }
  }

  async checkCompliance(request: {
    amount: number;
    currency: string;
    fromAccount: string;
    toAccount: string;
  }): Promise<{
    compliant: boolean;
    checks: Array<{ name: string; passed: boolean; reason?: string }>;
  }> {
    const checks: Array<{ name: string; passed: boolean; reason?: string }> = [];

    // Amount limits
    const maxAmount = 1000000; // $10,000 in cents
    checks.push({
      name: "amount_limit",
      passed: request.amount <= maxAmount,
      reason: request.amount > maxAmount ? `Amount exceeds limit: ${request.amount} > ${maxAmount}` : undefined,
    });

    // Currency validation
    const validCurrencies = ["usd", "eur", "gbp", "jpy", "cad", "aud"];
    checks.push({
      name: "currency_validation",
      passed: validCurrencies.includes(request.currency.toLowerCase()),
      reason: !validCurrencies.includes(request.currency.toLowerCase())
        ? `Unsupported currency: ${request.currency}`
        : undefined,
    });

    // Account format validation
    checks.push({
      name: "account_format",
      passed: request.fromAccount.startsWith("agent_") && request.toAccount.startsWith("agent_"),
      reason:
        !request.fromAccount.startsWith("agent_") || !request.toAccount.startsWith("agent_")
          ? "Invalid account format"
          : undefined,
    });

    const compliant = checks.every((check) => check.passed);

    return {
      compliant,
      checks,
    };
  }
}

/**
 * PayPal Payment Adapter
 */
class PayPalPaymentAdapter implements PaymentAdapter {
  name = "paypal";

  async processPayment(request: {
    amount: number;
    currency: string;
    fromAccount: string;
    toAccount: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      const result = await paymentGateway.createPaymentIntent({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        metadata: Object.fromEntries(
          Object.entries(request.metadata || {}).map(([k, v]) => [k, String(v)])
        ),
      });

      if (result.success && result.paymentId) {
        const confirmResult = await paymentGateway.confirmPayment(result.paymentId);
        if (confirmResult.success) {
          return {
            success: true,
            transactionId: result.paymentId,
          };
        }
        return {
          success: false,
          error: confirmResult.error || "Payment confirmation failed",
        };
      }

      return {
        success: false,
        error: result.error || "Payment intent creation failed",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment processing failed",
      };
    }
  }

  async checkCompliance(request: {
    amount: number;
    currency: string;
    fromAccount: string;
    toAccount: string;
  }): Promise<{
    compliant: boolean;
    checks: Array<{ name: string; passed: boolean; reason?: string }>;
  }> {
    const checks: Array<{ name: string; passed: boolean; reason?: string }> = [];

    // Amount limits (PayPal specific)
    const maxAmount = 10000000; // $100,000 in cents
    checks.push({
      name: "amount_limit",
      passed: request.amount <= maxAmount,
      reason: request.amount > maxAmount ? `Amount exceeds limit: ${request.amount} > ${maxAmount}` : undefined,
    });

    // Currency validation
    const validCurrencies = ["usd", "eur", "gbp", "jpy", "cad", "aud", "mxn", "brl"];
    checks.push({
      name: "currency_validation",
      passed: validCurrencies.includes(request.currency.toLowerCase()),
      reason: !validCurrencies.includes(request.currency.toLowerCase())
        ? `Unsupported currency: ${request.currency}`
        : undefined,
    });

    // Account format validation
    checks.push({
      name: "account_format",
      passed: request.fromAccount.startsWith("agent_") && request.toAccount.startsWith("agent_"),
      reason:
        !request.fromAccount.startsWith("agent_") || !request.toAccount.startsWith("agent_")
          ? "Invalid account format"
          : undefined,
    });

    const compliant = checks.every((check) => check.passed);

    return {
      compliant,
      checks,
    };
  }
}

export function getAP2Protocol(): AP2Protocol {
  if (!ap2ProtocolInstance) {
    ap2ProtocolInstance = new AP2Protocol();
  }
  return ap2ProtocolInstance;
}
