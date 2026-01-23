"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutopilotControls } from "@/components/autopilot-controls";
import { Play } from "lucide-react";
import { PlaybooksDataClient } from "@/components/playbooks-data-client";
import { CreatePlaybookDialog } from "@/components/create-playbook-dialog";
import { PlaybookEditor } from "@/components/playbook-editor";
import { GuideButton } from "@/components/guides";

interface PlaybooksPageClientProps {
  initialShowNewDialog?: boolean;
  executionId?: string;
  playbookId?: string;
}

export function PlaybooksPageClient({
  initialShowNewDialog = false,
  executionId,
  playbookId,
}: PlaybooksPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(() => initialShowNewDialog);
  const [activeTab, setActiveTab] = useState(() => (executionId ? "history" : "catalog"));

  const handleDialogChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      // Remove ?new=true from URL when dialog closes
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      const newUrl = params.toString() ? `?${params.toString()}` : "";
      router.replace(`/playbooks${newUrl}`, { scroll: false });
    }
  };

  // Show editor if playbookId is present
  if (playbookId) {
    return (
      <PlaybookEditor
        playbookId={playbookId}
        onClose={() => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("id");
          const newUrl = params.toString() ? `?${params.toString()}` : "";
          router.replace(`/playbooks${newUrl}`, { scroll: false });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between" data-guide="playbooks-header">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Playbooks</h1>
          <p className="text-muted-foreground">
            Automated workflows and response templates with autopilot modes for common scenarios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GuideButton pageId="playbooks" />
          <CreatePlaybookDialog open={createDialogOpen} onOpenChange={handleDialogChange}>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Play className="mr-2 size-4" />
              Create Playbook
            </Button>
          </CreatePlaybookDialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="active-runs">Active Runs</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="autopilot">Autopilot</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <PlaybooksDataClient tab="catalog" />
        </TabsContent>

        <TabsContent value="active-runs" className="space-y-4">
          <PlaybooksDataClient tab="active-runs" />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <PlaybooksDataClient tab="history" executionId={executionId} />
        </TabsContent>

        <TabsContent value="autopilot" className="space-y-4">
          <AutopilotControls />
        </TabsContent>
      </Tabs>
    </div>
  );
}
