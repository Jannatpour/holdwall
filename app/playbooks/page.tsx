import { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { PlaybooksPageClient } from "@/components/playbooks-page-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";
import { LoadingState } from "@/components/ui/loading-states";

export const metadata: Metadata = genMeta(
  "Playbooks",
  "Automated workflows and response templates with autopilot modes for common scenarios",
  "/playbooks"
);

export default async function PlaybooksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; execution?: string; id?: string }>;
}) {
  const params = await searchParams;
  const showNewDialog = params.new === "true";
  const executionId = params.execution;
  const playbookId = params.id;

  return (
    <AppShell>
      <GuideWalkthrough pageId="playbooks" />
      <Suspense fallback={<LoadingState count={5} />}>
        <PlaybooksPageClient
          initialShowNewDialog={showNewDialog}
          executionId={executionId}
          playbookId={playbookId}
        />
      </Suspense>
    </AppShell>
  );
}
