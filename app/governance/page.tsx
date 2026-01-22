import { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, Settings } from "lucide-react";
import { AuditBundleExport } from "@/components/audit-bundle-export";
import { AuthGuard } from "@/components/auth-guard";
import { GovernanceApprovals } from "@/components/governance-approvals";
import { GovernancePolicies } from "@/components/governance-policies";
import { GovernanceEntitlements } from "@/components/governance-entitlements";
import { AutopilotControls } from "@/components/autopilot-controls";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { auth } from "@/lib/auth";

export const metadata: Metadata = genMeta(
  "Governance",
  "Approvals, audit bundles export, policies, and entitlements. Human-gated autopilot modes with comprehensive audit trails.",
  "/governance"
);

export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ approval_id?: string; correlation?: string }>;
}) {
  const sp = await searchParams;

  // Protect this page server-side to avoid unauthenticated clients
  // spamming protected API routes (401s in console/network).
  const session = await auth();
  if (!session?.user) {
    const qp = new URLSearchParams();
    if (sp.approval_id) qp.set("approval_id", sp.approval_id);
    if (sp.correlation) qp.set("correlation", sp.correlation);
    const callbackUrl = `/governance${qp.toString() ? `?${qp.toString()}` : ""}`;
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <AppShell>
      <AuthGuard requiredRole="VIEWER">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Governance</h1>
            <p className="text-muted-foreground">
              Approvals, audit bundles export, policies, and entitlements
            </p>
          </div>

          <Tabs defaultValue="approvals" className="space-y-4">
            <TabsList>
              <TabsTrigger value="approvals">Approvals</TabsTrigger>
              <TabsTrigger value="autopilot">Autopilot</TabsTrigger>
              <TabsTrigger value="audit">Audit Bundles</TabsTrigger>
              <TabsTrigger value="policies">Policies</TabsTrigger>
              <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
            </TabsList>

            <TabsContent value="approvals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pending approvals</CardTitle>
                  <CardDescription>Items awaiting an approval decision</CardDescription>
                </CardHeader>
                <CardContent>
                  <GovernanceApprovals focusApprovalId={sp.approval_id ?? null} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="autopilot" className="space-y-4">
              <AutopilotControls />
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Bundle Export</CardTitle>
                  <CardDescription>
                    One-click export: PDF executive summary, JSON evidence package, immutable version IDs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AuditBundleExport />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="policies" className="space-y-4">
              <GovernancePolicies />
            </TabsContent>

            <TabsContent value="entitlements" className="space-y-4">
              <GovernanceEntitlements />
            </TabsContent>
          </Tabs>
        </div>
      </AuthGuard>
    </AppShell>
  );
}
