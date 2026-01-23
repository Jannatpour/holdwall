/**
 * Operational Dashboard Component
 * 
 * Team performance and operational metrics.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/loading-states";
import { Users, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

interface OperationalMetrics {
  teamPerformance: Array<{
    teamMember: string;
    casesAssigned: number;
    casesResolved: number;
    averageResolutionTime: number;
    slaCompliance: number;
  }>;
  caseAssignmentDistribution: Record<string, number>;
  slaCompliance: number;
  escalationRate: number;
  followUpEffectiveness: number;
  casesByPriority: Record<string, number>;
}

export function OperationalDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/cases/analytics/operational");
      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState count={4} />;
  }

  if (error || !metrics) {
    return <ErrorState error={error || "Failed to load metrics"} title="Failed to load operational metrics" />;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.slaCompliance.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalation Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.escalationRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Follow-Up Effectiveness</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.followUpEffectiveness.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.teamPerformance.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance</CardTitle>
          <CardDescription>Individual team member metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.teamPerformance.map((member, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{member.teamMember}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.casesResolved} of {member.casesAssigned} cases resolved
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{member.averageResolutionTime.toFixed(1)}h avg</p>
                  <p className="text-sm text-muted-foreground">{member.slaCompliance.toFixed(1)}% SLA</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Case Assignment Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Case Assignment Distribution</CardTitle>
          <CardDescription>How cases are distributed across teams</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(metrics.caseAssignmentDistribution).map(([team, count]) => (
              <div key={team} className="flex items-center justify-between">
                <span className="text-sm">{team || "Unassigned"}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cases by Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Cases by Priority</CardTitle>
          <CardDescription>Current priority distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(metrics.casesByPriority).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <span className="text-sm">{priority}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
