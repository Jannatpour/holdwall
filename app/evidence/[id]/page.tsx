import { AppShell } from "@/components/app-shell";
import { EvidenceDetail } from "@/components/evidence-detail";

export default async function EvidenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Evidence</h1>
          <p className="text-muted-foreground">Immutable evidence record with lineage links</p>
        </div>
        <EvidenceDetail evidenceId={id} />
      </div>
    </AppShell>
  );
}

