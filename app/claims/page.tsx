import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ClaimsList } from "@/components/claims-list";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { GuideButton, GuideWalkthrough } from "@/components/guides";

export const metadata: Metadata = genMeta(
  "Claims",
  "Extracted claims and clusters with AI-powered analysis. View decisiveness scores, evidence links, and use FactReasoner, VERITAS-NLI, and Belief Inference for verification.",
  "/claims"
);

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ cluster?: string; cluster_id?: string }>;
}) {
  const sp = await searchParams;
  const clusterId = sp.cluster_id || sp.cluster;

  return (
    <AppShell>
      <GuideWalkthrough pageId="claims" />
      <div className="space-y-6">
        <div className="flex items-start justify-between" data-guide="claims-header">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Claims</h1>
            <p className="text-muted-foreground">
              Extracted claims and clusters with AI-powered verification and analysis
            </p>
          </div>
          <GuideButton pageId="claims" />
        </div>
        <div data-guide="clusters-list">
          <ClaimsList clusterId={clusterId} />
        </div>
      </div>
    </AppShell>
  );
}
