import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { StudioEditorClient } from "@/components/studio-editor-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";

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
        <div className="flex items-start justify-between" data-guide="studio-header">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AAAL Studio</h1>
            <p className="text-muted-foreground">
              Traceability-first authoring with evidence picker, policy checker, and AI-powered assistance
            </p>
          </div>
          <GuideButton pageId="studio" />
        </div>
        <div data-guide="editor">
          <StudioEditorClient artifactId={artifactId} />
        </div>
      </div>
    </AppShell>
  );
}
