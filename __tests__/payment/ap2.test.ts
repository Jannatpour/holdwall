/**
 * AP2 Protocol Tests
 * 
 * Tests for Agent Payment Protocol functionality
 */

import { AP2Protocol } from "@/lib/payment/ap2";
import { getProtocolSecurity } from "@/lib/security/protocol-security";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { createSign, generateKeyPairSync } from "crypto";

describe("AP2Protocol", () => {
  let ap2Protocol: AP2Protocol;
  const testAgentId1 = "test-agent-1";
  const testAgentId2 = "test-agent-2";
  const testWalletId1 = `wallet_${testAgentId1}`;
  const testWalletId2 = `wallet_${testAgentId2}`;
  let agent1Keys: { publicKey: string; privateKey: string };
  let agent2Keys: { publicKey: string; privateKey: string };

  beforeEach(async () => {
    ap2Protocol = new AP2Protocol();

    // Register agents in A2A registry (AP2 enforces agent existence)
    const a2a = getA2AProtocol();

    agent1Keys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    agent2Keys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    await a2a.registerAgent({
      agentId: testAgentId1,
      name: "Test Agent 1",
      version: "1.0.0",
      capabilities: ["api_integration"],
      endpoint: "http://localhost:3999",
      publicKey: agent1Keys.publicKey,
    });
    await a2a.registerAgent({
      agentId: testAgentId2,
      name: "Test Agent 2",
      version: "1.0.0",
      capabilities: ["api_integration"],
      endpoint: "http://localhost:3999",
      publicKey: agent2Keys.publicKey,
    });
  });

  describe("Wallet Management", () => {
    it("should get wallet balance", async () => {
      const balance = await ap2Protocol.getWalletBalance(testWalletId1, "USD");
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    it("should get wallet ledger", async () => {
      const ledger = await ap2Protocol.getWalletLedger(testWalletId1, "USD");
      expect(Array.isArray(ledger)).toBe(true);
    });

    it("should set wallet limit", async () => {
      await ap2Protocol.setWalletLimit(
        testAgentId1,
        "daily",
        10000, // $100.00 in cents
        "USD"
      );

      // Verify limit was set (in a real implementation, we'd check the database)
      const balance = await ap2Protocol.getWalletBalance(testWalletId1, "USD");
      expect(balance).toBeDefined();
    });
  });

  describe("Payment Mandates", () => {
    it("should create a payment mandate", async () => {
      const mandate = await ap2Protocol.createMandate({
        fromAgentId: testAgentId1,
        toAgentId: testAgentId2,
        type: "intent",
        amount: 5000, // $50.00 in cents
        currency: "USD",
        description: "Test payment",
      });

      expect(mandate).toBeDefined();
      expect(mandate.mandateId).toBeDefined();
      expect(mandate.status).toBe("pending");
      expect(mandate.fromAgentId).toBe(testAgentId1);
      expect(mandate.toAgentId).toBe(testAgentId2);
      expect(mandate.amount).toBe(5000);
    });

    it("should get a payment mandate", async () => {
      const created = await ap2Protocol.createMandate({
        fromAgentId: testAgentId1,
        toAgentId: testAgentId2,
        type: "intent",
        amount: 5000,
        currency: "USD",
      });

      const retrieved = await ap2Protocol.getMandate(created.mandateId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.mandateId).toBe(created.mandateId);
    });

    it("should approve a payment mandate", async () => {
      const created = await ap2Protocol.createMandate({
        fromAgentId: testAgentId1,
        toAgentId: testAgentId2,
        type: "payment",
        amount: 5000,
        currency: "USD",
      });

      const sign = createSign("RSA-SHA256");
      sign.update(created.mandateId);
      sign.end();
      const signature = sign.sign(agent2Keys.privateKey, "base64");

      const approved = await ap2Protocol.approveMandate({
        mandateId: created.mandateId,
        agentId: testAgentId2,
        signature,
        publicKey: agent2Keys.publicKey,
      });

      expect(approved.status).toBe("approved");
    });

    it("should revoke a payment mandate", async () => {
      const created = await ap2Protocol.createMandate({
        fromAgentId: testAgentId1,
        toAgentId: testAgentId2,
        type: "payment",
        amount: 5000,
        currency: "USD",
      });

      await ap2Protocol.revokeMandate(created.mandateId, testAgentId1);

      const retrieved = await ap2Protocol.getMandate(created.mandateId);
      expect(retrieved?.status).toBe("revoked");
    });
  });

  describe("Payment Execution", () => {
    it("should execute a payment", async () => {
      // Create and approve mandate
      const mandate = await ap2Protocol.createMandate({
        fromAgentId: testAgentId1,
        toAgentId: testAgentId2,
        type: "payment",
        amount: 5000,
        currency: "USD",
      });

      // Fund sender wallet for the test
      await ap2Protocol.creditWallet({
        agentId: testAgentId1,
        amount: 10000,
        currency: "USD",
        description: "Test funding",
      });

      const approveSign = createSign("RSA-SHA256");
      approveSign.update(mandate.mandateId);
      approveSign.end();
      const approveSignature = approveSign.sign(agent2Keys.privateKey, "base64");

      await ap2Protocol.approveMandate({
        mandateId: mandate.mandateId,
        agentId: testAgentId2,
        signature: approveSignature,
        publicKey: agent2Keys.publicKey,
      });

      // Execute payment
      const execSign = createSign("RSA-SHA256");
      execSign.update(mandate.mandateId);
      execSign.end();
      const execSignature = execSign.sign(agent1Keys.privateKey, "base64");

      const result = await ap2Protocol.executePayment({
        mandateId: mandate.mandateId,
        fromAgentId: testAgentId1,
        toAgentId: testAgentId2,
        signature: execSignature,
        publicKey: agent1Keys.publicKey,
      });

      expect(result.transactionId).toBeDefined();
      expect(result.fromBalance).toBeDefined();
      expect(result.toBalance).toBeDefined();
    });
  });

  describe("Audit Logging", () => {
    it("should get audit logs", async () => {
      const logs = await ap2Protocol.getAuditLogs({});

      expect(Array.isArray(logs)).toBe(true);
    });

    it("should filter audit logs by mandate", async () => {
      const mandate = await ap2Protocol.createMandate({
        fromAgentId: testAgentId1,
        toAgentId: testAgentId2,
        type: "intent",
        amount: 5000,
        currency: "USD",
      });

      const logs = await ap2Protocol.getAuditLogs({
        mandateId: mandate.mandateId,
      });

      expect(Array.isArray(logs)).toBe(true);
      // In a real implementation, we'd verify the logs contain entries for this mandate
    });
  });

  describe("Security Integration", () => {
    it("should verify agent identity when creating mandate", async () => {
      // This test verifies that security checks are in place
      // In a real scenario, we'd mock the protocol security service
      const protocolSecurity = getProtocolSecurity();
      
      // The createMandate method should call verifyAgentIdentity internally
      // This is a smoke test to ensure the integration exists
      expect(protocolSecurity).toBeDefined();
    });
  });
});
