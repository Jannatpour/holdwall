import { AppShell } from "@/components/app-shell";
import { OverviewLoading as SmartLoading } from "@/components/ui/loading-states";

export default function OverviewLoading() {
  return (
    <AppShell>
      <SmartLoading />
    </AppShell>
  );
}
