import { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, Settings, Shield, Sparkles, ArrowRight, CheckCircle2, FileText, Users } from "lucide-react";
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
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    // If auth() throws an error, treat as unauthenticated and redirect to sign-in
    // This prevents 500 errors from propagating to the client
    const qp = new URLSearchParams();
    if (sp.approval_id) qp.set("approval_id", sp.approval_id);
    if (sp.correlation) qp.set("correlation", sp.correlation);
    const callbackUrl = `/governance${qp.toString() ? `?${qp.toString()}` : ""}`;
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

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
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                <Shield className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Governance Command Center
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Comprehensive governance framework for approvals, audit bundles, policies, and entitlements. Human-gated autopilot modes with complete audit trails and compliance tracking.
            </p>
          </div>

          <Tabs defaultValue="approvals" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="approvals" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <CheckCircle2 className="mr-2 size-4" />
                Approvals
              </TabsTrigger>
              <TabsTrigger value="autopilot" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Sparkles className="mr-2 size-4" />
                Autopilot
              </TabsTrigger>
              <TabsTrigger value="audit" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="mr-2 size-4" />
                Audit Bundles
              </TabsTrigger>
              <TabsTrigger value="policies" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings className="mr-2 size-4" />
                Policies
              </TabsTrigger>
              <TabsTrigger value="entitlements" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="mr-2 size-4" />
                Entitlements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="approvals" className="space-y-4">
              <Card className="transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-primary" />
                    <CardTitle className="font-semibold">Pending Approvals</CardTitle>
                  </div>
                  <CardDescription>Items awaiting an approval decision with full audit context</CardDescription>
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
              <Card className="transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    <CardTitle className="font-semibold">Audit Bundle Export Center</CardTitle>
                  </div>
                  <CardDescription>
                    One-click export: PDF executive summary, JSON evidence package, immutable version IDs for regulatory compliance
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
