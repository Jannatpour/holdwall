"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { CommandPalette } from "@/components/command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppTopbar />
        <main
          id="main-content"
          className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8"
          role="main"
          aria-label="Main content"
        >
          {children}
        </main>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
