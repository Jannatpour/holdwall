import { DashboardLoading } from "@/components/ui/loading-states";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <DashboardLoading />
      </div>
    </div>
  );
}
