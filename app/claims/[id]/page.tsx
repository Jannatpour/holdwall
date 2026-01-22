import { AppShell } from "@/components/app-shell";
import { ClaimsDetail } from "@/components/claims-detail";

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Claim Details</h1>
          <p className="text-muted-foreground">Battle card view with evidence and actions</p>
        </div>
        <ClaimsDetail claimId={id} />
      </div>
    </AppShell>
  );
}
