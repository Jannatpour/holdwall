"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutopilotControls } from "@/components/autopilot-controls";
import { Play, Sparkles, BookOpen, Clock, History, Settings } from "@/components/demo-icons";
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
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
              <Play className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Automated Playbooks Engine
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Intelligent automated workflows and response templates with autopilot modes for common scenarios. Streamline operations with pre-configured playbooks that adapt to your narrative landscape.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GuideButton pageId="playbooks" />
          <CreatePlaybookDialog open={createDialogOpen} onOpenChange={handleDialogChange}>
            <Button onClick={() => setCreateDialogOpen(true)} className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
              <Play className="mr-2 size-4" />
              Create Playbook
            </Button>
          </CreatePlaybookDialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="catalog" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BookOpen className="mr-2 size-4" />
            Catalog
          </TabsTrigger>
          <TabsTrigger value="active-runs" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clock className="mr-2 size-4" />
            Active Runs
          </TabsTrigger>
          <TabsTrigger value="history" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <History className="mr-2 size-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="autopilot" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings className="mr-2 size-4" />
            Autopilot
          </TabsTrigger>
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
