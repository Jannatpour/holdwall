/**
 * Case Timeline API
 * 
 * GET /api/cases/[id]/timeline - Get timeline events for a case
 * Public endpoint (no auth required) for customer case tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

const eventStore = new DatabaseEventStore();

/**
 * GET /api/cases/[id]/timeline - Get case timeline
 * 
 * Returns all events related to a case, formatted for timeline display.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caseId = id;

    // Get case to verify it exists and get tenant ID
    // Try by ID first, then by case number (for public tracking)
    let case_ = await db.case.findUnique({
      where: { id: caseId },
    });
    
    if (!case_) {
      // Try by case number (for public tracking)
      case_ = await db.case.findUnique({
        where: { caseNumber: caseId },
      });
    }
    
    if (!case_) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    const actualCaseId = case_.id;
    const tenantId = case_.tenantId;

    // Query all events for this case (by correlation_id)
    const events = await eventStore.query({
      correlation_id: actualCaseId,
      tenant_id: tenantId || undefined,
    });

    // Format events for timeline display
    const timelineEvents = events
      .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
      .map((event) => {
        // Map event types to user-friendly descriptions
        const eventDescriptions: Record<string, string> = {
          "case.created": "Case Created",
          "case.triaged": "Case Triaged",
          "case.assigned": "Case Assigned",
          "case.updated": "Case Updated",
          "case.resolved": "Case Resolved",
          "case.closed": "Case Closed",
          "case.escalated": "Case Escalated",
          "case.resolution.generated": "Resolution Plan Generated",
          "case.comment.added": "Comment Added",
          "case.evidence.added": "Evidence Added",
          "case.verification.completed": "Verification Completed",
          "case.notification.sent": "Notification Sent",
        };

        const description = eventDescriptions[event.type] || event.type.replace(/case\./g, "").replace(/\./g, " ");

        // Extract relevant details from payload
        const payload = event.payload || {};
        let details = "";
        
        if (event.type === "case.created") {
          details = `Case ${payload.case_number || ""} was submitted`;
        } else if (event.type === "case.triaged") {
          details = `Severity: ${payload.severity || "N/A"}, Priority: ${payload.priority || "N/A"}`;
        } else if (event.type === "case.assigned") {
          details = `Assigned to: ${payload.assignee_id || "N/A"}`;
        } else if (event.type === "case.resolved") {
          details = typeof payload.outcome === "string" ? payload.outcome : "Case resolved";
        } else if (event.type === "case.comment.added") {
          details = payload.content ? (payload.content as string).substring(0, 100) : "";
        } else if (event.type === "case.evidence.added") {
          details = `Evidence type: ${payload.evidence_type || "N/A"}`;
        } else {
          details = JSON.stringify(payload).substring(0, 100);
        }

        return {
          timestamp: event.occurred_at,
          event: description,
          description: details,
          type: event.type,
          actor: event.actor_id,
        };
      });

    logger.info("Case timeline retrieved", {
      case_id: actualCaseId,
      event_count: timelineEvents.length,
    });

    return NextResponse.json({
      caseId: actualCaseId,
      events: timelineEvents,
    });
  } catch (error) {
    logger.error("Failed to get case timeline", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to get case timeline", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
