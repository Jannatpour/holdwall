/**
 * Operational Analytics API
 * 
 * GET /api/cases/analytics/operational - Get operational dashboard metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { db } from "@/lib/db/client";
import { caseSLAService } from "@/lib/cases/sla";
import { logger } from "@/lib/logging/logger";

export const GET = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    try {
      const tenantId = context?.tenantId;

      if (!tenantId) {
        return NextResponse.json(
          { error: "Tenant ID required" },
          { status: 400 }
        );
      }

      // Get all cases
      const allCases = await db.case.findMany({
        where: { tenantId },
      });

      // Get SLA compliance
      const slaCompliance = await caseSLAService.getSLACompliancePercentage(tenantId, 30);

      // Calculate escalation rate
      const escalations = await db.caseEscalation.findMany({
        where: {
          case: {
            tenantId,
          },
        },
      });
      const escalationRate = allCases.length > 0
        ? (escalations.length / allCases.length) * 100
        : 0;

      // Calculate follow-up effectiveness (cases with follow-ups that got responses)
      const followUpNotifications = await db.caseNotification.findMany({
        where: {
          case: {
            tenantId,
          },
          type: "EMAIL",
          status: "OPENED",
        },
      });
      const totalFollowUps = await db.caseNotification.count({
        where: {
          case: {
            tenantId,
          },
          type: "EMAIL",
        },
      });
      const followUpEffectiveness = totalFollowUps > 0
        ? (followUpNotifications.length / totalFollowUps) * 100
        : 0;

      // Team performance
      const teamMembers = new Set<string>();
      allCases.forEach((c) => {
        if (c.assignedTo) {
          teamMembers.add(c.assignedTo);
        }
      });

      const teamPerformance = await Promise.all(
        Array.from(teamMembers).map(async (memberId) => {
          const memberCases = allCases.filter((c) => c.assignedTo === memberId);
          const resolvedCases = memberCases.filter((c) => c.status === "RESOLVED" && c.resolvedAt);

          const totalResolutionTime = resolvedCases.reduce((sum, c) => {
            if (c.resolvedAt) {
              return sum + (c.resolvedAt.getTime() - c.createdAt.getTime());
            }
            return sum;
          }, 0);

          const averageResolutionTime = resolvedCases.length > 0
            ? totalResolutionTime / resolvedCases.length / (1000 * 60 * 60)
            : 0;

          // Calculate SLA compliance for this member
          const memberSlaCompliant = resolvedCases.filter((c) => {
            if (!c.slaDeadline || !c.resolvedAt) {
              return false;
            }
            return c.resolvedAt <= c.slaDeadline;
          }).length;

          const memberSlaCompliance = resolvedCases.length > 0
            ? (memberSlaCompliant / resolvedCases.length) * 100
            : 100;

          // Get user name
          const user = await db.user.findUnique({
            where: { id: memberId },
            select: { email: true, name: true },
          });

          return {
            teamMember: user?.name || user?.email || memberId,
            casesAssigned: memberCases.length,
            casesResolved: resolvedCases.length,
            averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
            slaCompliance: Math.round(memberSlaCompliance * 100) / 100,
          };
        })
      );

      // Case assignment distribution
      const caseAssignmentDistribution: Record<string, number> = {};
      allCases.forEach((c) => {
        const team = c.assignedTeam || "Unassigned";
        caseAssignmentDistribution[team] = (caseAssignmentDistribution[team] || 0) + 1;
      });

      // Cases by priority
      const casesByPriority: Record<string, number> = {
        P0: 0,
        P1: 0,
        P2: 0,
        P3: 0,
      };
      allCases.forEach((c) => {
        if (c.priority) {
          casesByPriority[c.priority]++;
        }
      });

      return NextResponse.json({
        teamPerformance,
        caseAssignmentDistribution,
        slaCompliance: Math.round(slaCompliance * 100) / 100,
        escalationRate: Math.round(escalationRate * 100) / 100,
        followUpEffectiveness: Math.round(followUpEffectiveness * 100) / 100,
        casesByPriority,
      });
    } catch (error) {
      logger.error("Failed to get operational metrics", {
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { error: "Failed to get operational metrics", message: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 100,
    },
  }
);
