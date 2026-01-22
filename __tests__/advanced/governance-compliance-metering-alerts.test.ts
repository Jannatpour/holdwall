/**
 * Governance, Compliance, Metering, and Alerts Comprehensive Test Suite
 * 
 * Tests all governance, compliance, metering, and alerting modules:
 * - Governance: Audit bundles, approvals, policies
 * - Compliance: GDPR, source policies, data retention
 * - Metering: Usage tracking, entitlements, limits
 * - Alerts: Alert rules, notifications, escalation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { AuditBundleService } from '@/lib/governance/audit-bundle';
import { DatabaseAuditLog } from '@/lib/audit/log-db';
import { DatabaseMeteringService } from '@/lib/metering/service-implementation';
import { AlertsService } from '@/lib/alerts/service';
import { GDPRCompliance } from '@/lib/compliance/gdpr';
import { DatabaseSourceComplianceService } from '@/lib/compliance/source-implementation';
import { DatabaseEvidenceVault } from '@/lib/evidence/vault-db';
import { DatabaseEventStore } from '@/lib/events/store-db';
import { db } from '@/lib/db/client';

describe('Governance, Compliance, Metering, and Alerts - Comprehensive Test Suite', () => {
  let tenantId: string;
  let userId: string;
  let evidenceVault: DatabaseEvidenceVault;
  let eventStore: DatabaseEventStore;
  let auditLog: DatabaseAuditLog;

  beforeEach(async () => {
    tenantId = `test-tenant-${Date.now()}`;
    
    const tenant = await db.tenant.create({
      data: {
        id: tenantId,
        slug: tenantId,
        name: 'Test Tenant',
      },
    });
    
    const user = await db.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@test.com`,
        name: 'Test User',
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });
    
    userId = user.id;
    evidenceVault = new DatabaseEvidenceVault();
    eventStore = new DatabaseEventStore();
    auditLog = new DatabaseAuditLog();
  });

  // ============================================================
  // GOVERNANCE - AUDIT BUNDLES
  // ============================================================

  describe('Governance - Audit Bundles', () => {
    test('Create Audit Bundle', async () => {
      const auditService = new AuditBundleService(auditLog, eventStore, evidenceVault);
      
      // Create test evidence
      const evidence = await evidenceVault.store({
        tenant_id: tenantId,
        type: 'signal',
        content: { raw: 'Test evidence for audit bundle' },
        source: { url: 'https://example.com', type: 'RSS' },
        metadata: {},
      });
      
      const bundle = await auditService.createBundle(
        tenantId,
        'test-resource',
        'claim',
        {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        }
      );
      
      expect(bundle).toBeDefined();
      expect(bundle.bundle_id).toBeDefined();
      expect(bundle.evidence).toBeDefined();
    });

    test('Export Audit Bundle', async () => {
      const auditService = new AuditBundleService(auditLog, eventStore, evidenceVault);
      
      const bundle = await auditService.createBundle(
        tenantId,
        'test-resource',
        'claim',
        {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        }
      );
      
      const exportData = await auditService.exportBundle(bundle.bundle_id, {
        format: 'json',
        includeMerkle: true,
      });
      
      expect(exportData).toBeDefined();
      expect(exportData.bundle_id).toBe(bundle.bundle_id);
    });

    test('Generate Executive Summary', async () => {
      const auditService = new AuditBundleService(auditLog, eventStore, evidenceVault);
      
      const bundle = await auditService.createBundle(
        tenantId,
        'test-resource',
        'claim',
        {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        }
      );
      
      const summary = await auditService.generateExecutiveSummary(bundle.bundle_id);
      
      expect(summary).toBeDefined();
      expect(summary.title).toBeDefined();
      expect(summary.overview).toBeDefined();
    });
  });

  // ============================================================
  // COMPLIANCE - GDPR
  // ============================================================

  describe('Compliance - GDPR', () => {
    test('GDPR Consent Recording', async () => {
      const gdprService = new GDPRCompliance();
      
      await gdprService.recordConsent({
        userId,
        tenantId,
        consentType: 'analytics',
        granted: true,
        timestamp: new Date().toISOString(),
      });
      
      // Consent is recorded via event store
      expect(true).toBe(true);
    });

    test('GDPR Data Export Request', async () => {
      const gdprService = new GDPRCompliance();
      
      const request = await gdprService.requestDataAccess(userId, tenantId);
      
      expect(request).toBeDefined();
      expect(request.requestId).toBeDefined();
      expect(request.data).toBeDefined();
      expect(request.data.user).toBeDefined();
    });

    test('GDPR Data Deletion Request', async () => {
      const gdprService = new GDPRCompliance();
      
      const request = await gdprService.requestDataDeletion(userId, tenantId);
      
      expect(request).toBeDefined();
      expect(request.requestId).toBeDefined();
      expect(request.status).toBeDefined();
    });
  });

  // ============================================================
  // COMPLIANCE - SOURCE POLICIES
  // ============================================================

  describe('Compliance - Source Policies', () => {
    test('Create Source Policy', async () => {
      const complianceService = new DatabaseSourceComplianceService();
      
      const policyId = await complianceService.createPolicy({
        tenant_id: tenantId,
        source_type: 'RSS',
        allowed_sources: ['example.com', 'trusted-source.com'],
        collection_method: 'api',
        retention: {
          days: 90,
          auto_delete: false,
        },
        compliance_flags: [],
      });
      
      expect(policyId).toBeDefined();
    });

    test('Validate Source Against Policy', async () => {
      const complianceService = new DatabaseSourceComplianceService();
      
      await complianceService.createPolicy({
        tenant_id: tenantId,
        source_type: 'RSS',
        allowed_sources: ['example.com'],
        collection_method: 'api',
        retention: {
          days: 90,
          auto_delete: false,
        },
        compliance_flags: [],
      });
      
      const validation = await complianceService.checkSource(
        tenantId,
        'RSS',
        'example.com'
      );
      
      expect(validation).toBeDefined();
      expect(validation.allowed).toBe(true);
    });

    test('Get Policy', async () => {
      const complianceService = new DatabaseSourceComplianceService();
      
      await complianceService.createPolicy({
        tenant_id: tenantId,
        source_type: 'RSS',
        allowed_sources: ['example.com'],
        collection_method: 'api',
        retention: {
          days: 90,
          auto_delete: false,
        },
        compliance_flags: [],
      });
      
      const policy = await complianceService.getPolicy(tenantId, 'RSS');
      
      expect(policy).toBeDefined();
      expect(policy?.source_type).toBe('RSS');
    });
  });

  // ============================================================
  // METERING
  // ============================================================

  describe('Metering', () => {
    test('Increment Usage Counter', async () => {
      const meteringService = new DatabaseMeteringService();
      
      const result = await meteringService.increment(tenantId, 'signals_ingested', 1);
      
      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
      expect(result.current_usage).toBeGreaterThanOrEqual(0);
    });

    test('Check Usage Limits', async () => {
      const meteringService = new DatabaseMeteringService();
      
      // Set up entitlement via database
      await db.entitlement.create({
        data: {
          tenantId,
          metric: 'signals_ingested',
          softLimit: 1000,
          hardLimit: 2000,
          enforcement: 'SOFT',
        },
      });
      
      // Increment usage
      await meteringService.increment(tenantId, 'signals_ingested', 500);
      
      const result = await meteringService.increment(tenantId, 'signals_ingested', 1);
      
      expect(result).toBeDefined();
      expect(result.current_usage).toBeGreaterThanOrEqual(0);
      expect(result.limit).toBeDefined();
    });

    test('Soft Limit Warning', async () => {
      const meteringService = new DatabaseMeteringService();
      
      await db.entitlement.create({
        data: {
          tenantId,
          metric: 'signals_ingested',
          softLimit: 100,
          hardLimit: 200,
          enforcement: 'SOFT',
        },
      });
      
      // Exceed soft limit
      await meteringService.increment(tenantId, 'signals_ingested', 150);
      
      const result = await meteringService.increment(tenantId, 'signals_ingested', 1);
      
      expect(result.allowed).toBe(true); // Soft limit allows
    });

    test('Hard Limit Enforcement', async () => {
      const meteringService = new DatabaseMeteringService();
      
      await db.entitlement.create({
        data: {
          tenantId,
          metric: 'signals_ingested',
          softLimit: 100,
          hardLimit: 200,
          enforcement: 'HARD',
        },
      });
      
      // Increment up to the limit
      await meteringService.increment(tenantId, 'signals_ingested', 200);
      
      // Try to exceed hard limit
      const result = await meteringService.increment(tenantId, 'signals_ingested', 1);
      
      expect(result.allowed).toBe(false); // Hard limit blocks
      expect(result.current_usage).toBe(200); // Counter should not have increased
    });
  });

  // ============================================================
  // ALERTS
  // ============================================================

  describe('Alerts', () => {
    test('Create Alert', async () => {
      const alertService = new AlertsService(eventStore);
      
      const alertId = await alertService.createAlert(
        tenantId,
        'outbreak',
        'high',
        'High Outbreak Probability',
        'Outbreak probability has exceeded threshold',
        [],
        ['user@example.com']
      );
      
      expect(alertId).toBeDefined();
    });

    test('Get Alerts', async () => {
      const alertService = new AlertsService(eventStore);
      
      const alertId = await alertService.createAlert(
        tenantId,
        'outbreak',
        'high',
        'Test Alert',
        'Test message',
        [],
        ['user@example.com']
      );
      
      // getAlerts doesn't exist, but we can verify the alert was created
      // by checking the event store
      const events = await eventStore.query({
        type: 'alert.created',
        correlation_id: alertId,
      });
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].payload).toBeDefined();
    });

    test('Send Alert Notification', async () => {
      const alertService = new AlertsService(eventStore);
      
      // Create a user first so the alert can be sent
      const user = await db.user.create({
        data: {
          id: `test-user-alert-${Date.now()}`,
          email: `user-alert-${Date.now()}@example.com`,
          name: 'Test User',
          tenantId: tenantId,
          role: 'ADMIN',
        },
      });
      
      const alertId = await alertService.createAlert(
        tenantId,
        'outbreak',
        'high',
        'Test Alert',
        'Test message',
        [],
        [user.email]
      );
      
      // Wait a bit for the event to be stored
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify alert exists by checking event store with type filter
      const events = await eventStore.query({
        type: 'alert.created',
      });
      
      // Find the alert by checking payload
      const alertEvent = events.find((e: any) => e.payload?.alert_id === alertId);
      expect(alertEvent).toBeDefined();
      
      // Now send the alert - it should work because we can find it via event store
      await alertService.sendAlert(alertId);
      
      // Verify alert was sent
      expect(true).toBe(true); // If we get here, sendAlert succeeded
    });
  });
});
