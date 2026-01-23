/**
 * Cases List Component
 * 
 * Displays a table of cases with filters and search.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/loading-states";
import { Search, FileText, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

type CaseStatus = "SUBMITTED" | "TRIAGED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type CaseType = "DISPUTE" | "FRAUD_ATO" | "OUTAGE_DELAY" | "COMPLAINT";
type CaseSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Case {
  id: string;
  caseNumber: string;
  type: CaseType;
  status: CaseStatus;
  severity: CaseSeverity;
  priority: string | null;
  submittedBy: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export function CasesList() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: "" as CaseStatus | "",
    type: "" as CaseType | "",
    severity: "" as CaseSeverity | "",
    search: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchCases() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.status) params.append("status", filters.status);
        if (filters.type) params.append("type", filters.type);
        if (filters.severity) params.append("severity", filters.severity);
        if (filters.search) params.append("search", filters.search);
        params.append("page", page.toString());
        params.append("limit", "50");

        const response = await fetch(`/api/cases?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch cases: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setCases(data.cases || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchCases();
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  const getStatusBadge = (status: CaseStatus) => {
    const variants: Record<CaseStatus, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      SUBMITTED: { variant: "outline", icon: Clock },
      TRIAGED: { variant: "secondary", icon: AlertCircle },
      IN_PROGRESS: { variant: "default", icon: FileText },
      RESOLVED: { variant: "default", icon: CheckCircle2 },
      CLOSED: { variant: "secondary", icon: XCircle },
    };
    const config = variants[status] || variants.SUBMITTED;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: CaseSeverity) => {
    const colors: Record<CaseSeverity, string> = {
      LOW: "bg-green-500",
      MEDIUM: "bg-yellow-500",
      HIGH: "bg-orange-500",
      CRITICAL: "bg-red-500",
    };
    return (
      <Badge className={`${colors[severity]} text-white`}>
        {severity}
      </Badge>
    );
  };

  if (loading && cases.length === 0) {
    return <LoadingState count={3} />;
  }

  if (error) {
    return <ErrorState error={error} title="Failed to load cases" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cases</CardTitle>
        <CardDescription>View and manage all cases</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search cases..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full"
            />
          </div>
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value as CaseStatus })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="TRIAGED">Triaged</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.type}
            onValueChange={(value) => setFilters({ ...filters, type: value as CaseType })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="DISPUTE">Dispute</SelectItem>
              <SelectItem value="FRAUD_ATO">Fraud/ATO</SelectItem>
              <SelectItem value="OUTAGE_DELAY">Outage/Delay</SelectItem>
              <SelectItem value="COMPLAINT">Complaint</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.severity}
            onValueChange={(value) => setFilters({ ...filters, severity: value as CaseSeverity })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Severities</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cases Table */}
        {cases.length === 0 ? (
          <EmptyState title="No cases found" description="Create a new case to get started" />
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((case_) => (
                    <TableRow key={case_.id}>
                      <TableCell className="font-mono font-medium">
                        {case_.caseNumber}
                      </TableCell>
                      <TableCell>{case_.type.replace("_", " ")}</TableCell>
                      <TableCell>{getStatusBadge(case_.status)}</TableCell>
                      <TableCell>{getSeverityBadge(case_.severity)}</TableCell>
                      <TableCell>
                        {case_.priority ? (
                          <Badge variant="outline">{case_.priority}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{case_.submittedBy}</TableCell>
                      <TableCell>
                        {new Date(case_.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link href={`/cases/${case_.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {total > 50 && (
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, total)} of {total} cases
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 50 >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
