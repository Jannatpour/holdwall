import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ClaimsList } from "@/components/claims-list";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { GuideButton, GuideWalkthrough } from "@/components/guides";
import { FileText } from "lucide-react";

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
        <div className="flex items-start justify-between border-b pb-6" data-guide="claims-header">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Narrative Claims Intelligence
                </h1>
                <p className="text-base text-muted-foreground mt-2 leading-6">
                  AI-powered claim extraction, clustering, and verification with decisiveness scoring, 
                  evidence linking, and advanced analysis using FactReasoner, VERITAS-NLI, and Belief Inference
                </p>
              </div>
            </div>
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
