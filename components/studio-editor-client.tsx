"use client";

import dynamic from "next/dynamic";

const StudioEditor = dynamic(() => import("@/components/studio-editor").then((mod) => ({ default: mod.StudioEditor })), {
  loading: () => <div className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2 space-y-4"><div className="h-64 w-full bg-muted animate-pulse rounded" /></div><div className="space-y-4"><div className="h-32 w-full bg-muted animate-pulse rounded" /></div></div>,
  ssr: false,
});

export function StudioEditorClient({ artifactId }: { artifactId?: string }) {
  return <StudioEditor artifactId={artifactId} />;
}
