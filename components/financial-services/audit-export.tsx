"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

export function FinancialServicesAuditExport() {
  const [startDate, setStartDate] = React.useState(
    format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [includeEvidence, setIncludeEvidence] = React.useState(true);
  const [includeApprovals, setIncludeApprovals] = React.useState(true);
  const [includeArtifacts, setIncludeArtifacts] = React.useState(true);
  const [includeForecasts, setIncludeForecasts] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/financial-services/audit-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          includeEvidence,
          includeApprovals,
          includeArtifacts,
          includeForecasts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export audit data");
      }

      // Download the JSON file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-services-audit-export-${format(new Date(), "yyyy-MM-dd")}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Shield className="h-6 w-6 text-primary" />
            Regulatory Compliance Export Center
          </CardTitle>
          <CardDescription className="text-base">
            Generate comprehensive audit-ready exports with evidence bundles, approval trails, 
            and complete publication history for regulatory examinations and internal compliance reviews
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <Label>Include in Export</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-evidence"
                  checked={includeEvidence}
                  onCheckedChange={(checked) => setIncludeEvidence(checked === true)}
                />
                <Label htmlFor="include-evidence" className="font-normal cursor-pointer">
                  Evidence Bundles
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-approvals"
                  checked={includeApprovals}
                  onCheckedChange={(checked) => setIncludeApprovals(checked === true)}
                />
                <Label htmlFor="include-approvals" className="font-normal cursor-pointer">
                  Approval Trails
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-artifacts"
                  checked={includeArtifacts}
                  onCheckedChange={(checked) => setIncludeArtifacts(checked === true)}
                />
                <Label htmlFor="include-artifacts" className="font-normal cursor-pointer">
                  Published Artifacts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-forecasts"
                  checked={includeForecasts}
                  onCheckedChange={(checked) => setIncludeForecasts(checked === true)}
                />
                <Label htmlFor="include-forecasts" className="font-normal cursor-pointer">
                  Forecasts (Optional)
                </Label>
              </div>
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Regulatory Compliance</AlertTitle>
            <AlertDescription>
              This export includes complete audit trails with timestamps, approval decisions, and
              evidence provenance. Suitable for regulatory exams, internal audits, and legal
              inquiries.
            </AlertDescription>
          </Alert>

          <Button onClick={handleExport} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Audit Data
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900 dark:text-green-100">
                Export Successful
              </AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                Audit data has been downloaded. The file includes all selected components with
                complete audit trails.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Export Information */}
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s Included in the Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Evidence Bundles</div>
                <div className="text-sm text-muted-foreground">
                  All evidence items with provenance, source information, and associated claims
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Approval Trails</div>
                <div className="text-sm text-muted-foreground">
                  Complete approval history with timestamps, approvers, decisions, and reasons
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Published Artifacts</div>
                <div className="text-sm text-muted-foreground">
                  All AAAL artifacts with content, status, publication dates, and approval trails
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Forecasts (Optional)</div>
                <div className="text-sm text-muted-foreground">
                  Narrative outbreak forecasts and risk predictions
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
