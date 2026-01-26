import { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { StudioEditorClient } from "@/components/studio-editor-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";
import { Sparkles } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-states";

export const metadata: Metadata = genMeta(
  "AAAL Studio",
  "Traceability-first authoring with evidence picker, policy checker, and AI-powered assistance. Use GraphRAG, semantic search, and AI orchestration to enhance your artifacts.",
  "/studio"
);

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string }>;
}) {
  const params = await searchParams;
  const artifactId = params.id || (params.new ? undefined : undefined);

  return (
    <AppShell>
      <GuideWalkthrough pageId="studio" />
      <div className="space-y-6">
        <div className="flex items-start justify-between border-b pb-6" data-guide="studio-header">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Authoritative Response Studio
                </h1>
                <p className="text-base text-muted-foreground mt-2 leading-6">
                  Create evidence-backed, traceability-first authoritative artifacts with intelligent evidence 
                  picker, automated policy checking, and AI-powered assistance using GraphRAG, semantic search, 
                  and advanced orchestration.
                </p>
              </div>
            </div>
          </div>
          <GuideButton pageId="studio" />
        </div>
        <div data-guide="editor">
          <Suspense fallback={<LoadingState count={3} />}>
            <StudioEditorClient artifactId={artifactId} />
          </Suspense>
        </div>
      </div>
    </AppShell>
  );
}
