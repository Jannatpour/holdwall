"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  FileText,
  Network,
  TrendingUp,
  FileEdit,
  Shield,
  Funnel,
  Play,
  Settings,
  Search,
  Brain,
  Building2,
  Presentation,
  Briefcase,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navigation = [
  {
    title: "Overview",
    href: "/overview",
    icon: LayoutDashboard,
    ariaLabel: "Navigate to overview dashboard",
  },
  {
    title: "Complete Demo",
    href: "/demo",
    icon: Presentation,
    ariaLabel: "Navigate to complete platform demonstration",
  },
  {
    title: "POS",
    href: "/pos",
    icon: Brain,
    ariaLabel: "Navigate to Perception Operating System",
  },
  {
    title: "Signals",
    href: "/signals",
    icon: Radio,
    ariaLabel: "Navigate to signals page",
  },
  {
    title: "Claims",
    href: "/claims",
    icon: FileText,
    ariaLabel: "Navigate to claims page",
  },
  {
    title: "Graph",
    href: "/graph",
    icon: Network,
    ariaLabel: "Navigate to belief graph",
  },
  {
    title: "Forecasts",
    href: "/forecasts",
    icon: TrendingUp,
    ariaLabel: "Navigate to forecasts page",
  },
  {
    title: "AAAL Studio",
    href: "/studio",
    icon: FileEdit,
    ariaLabel: "Navigate to AAAL studio",
  },
  {
    title: "Trust Assets",
    href: "/trust",
    icon: Shield,
    ariaLabel: "Navigate to trust assets",
  },
  {
    title: "Funnel Map",
    href: "/funnel",
    icon: Funnel,
    ariaLabel: "Navigate to funnel map",
  },
  {
    title: "Playbooks",
    href: "/playbooks",
    icon: Play,
    ariaLabel: "Navigate to playbooks",
  },
  {
    title: "Governance",
    href: "/governance",
    icon: Settings,
    ariaLabel: "Navigate to governance",
  },
  {
    title: "Financial Services",
    href: "/financial-services",
    icon: Building2,
    ariaLabel: "Navigate to Financial Services dashboard",
  },
  {
    title: "Cases",
    href: "/cases",
    icon: Briefcase,
    ariaLabel: "Navigate to case management",
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Holdwall POS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "w-full justify-start",
                        isActive && "bg-sidebar-accent"
                      )}
                    >
                      <Link
                        href={item.href}
                        aria-label={item.ariaLabel || `Navigate to ${item.title}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <item.icon className="mr-2 size-4" aria-hidden="true" />
                        {item.title}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
