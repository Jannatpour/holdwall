"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
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
    prefetchApi: ["/api/metrics/summary", "/api/claim-clusters/top", "/api/recommendations"],
  },
  {
    title: "AI Answer Monitor",
    href: "/ai-answer-monitor",
    icon: Search,
    ariaLabel: "Navigate to AI Answer Monitor - Track how AI systems cite and represent your brand",
    prefetchApi: ["/api/ai-answer-monitor"],
  },
  {
    title: "POS",
    href: "/pos",
    icon: Brain,
    ariaLabel: "Navigate to Perception Operating System",
    prefetchApi: ["/api/pos/orchestrator?action=metrics", "/api/pos/orchestrator?action=recommendations"],
  },
  {
    title: "Signals",
    href: "/signals",
    icon: Radio,
    ariaLabel: "Navigate to signals page",
    prefetchApi: ["/api/signals"],
  },
  {
    title: "Claims",
    href: "/claims",
    icon: FileText,
    ariaLabel: "Navigate to claims page",
    prefetchApi: ["/api/claims"],
  },
  {
    title: "Graph",
    href: "/graph",
    icon: Network,
    ariaLabel: "Navigate to belief graph",
    prefetchApi: ["/api/graph"],
  },
  {
    title: "Forecasts",
    href: "/forecasts",
    icon: TrendingUp,
    ariaLabel: "Navigate to forecasts page",
    prefetchApi: ["/api/forecasts"],
  },
  {
    title: "AAAL Studio",
    href: "/studio",
    icon: FileEdit,
    ariaLabel: "Navigate to AAAL studio",
    prefetchApi: ["/api/aaal"],
  },
  {
    title: "Trust Assets",
    href: "/trust",
    icon: Shield,
    ariaLabel: "Navigate to trust assets",
    prefetchApi: ["/api/trust/assets"],
  },
  {
    title: "Funnel Map",
    href: "/funnel",
    icon: Funnel,
    ariaLabel: "Navigate to funnel map",
    prefetchApi: ["/api/funnel"],
  },
  {
    title: "Playbooks",
    href: "/playbooks",
    icon: Play,
    ariaLabel: "Navigate to playbooks",
    prefetchApi: ["/api/playbooks"],
  },
  {
    title: "Governance",
    href: "/governance",
    icon: Settings,
    ariaLabel: "Navigate to governance",
    prefetchApi: ["/api/approvals"],
  },
  {
    title: "Financial Services",
    href: "/financial-services",
    icon: Building2,
    ariaLabel: "Navigate to Financial Services dashboard",
    prefetchApi: ["/api/financial-services/overview"],
  },
  {
    title: "Cases",
    href: "/cases",
    icon: Briefcase,
    ariaLabel: "Navigate to case management",
    prefetchApi: ["/api/cases"],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prefetchedRoutes = useRef<Set<string>>(new Set());

  const prefetchRoute = useCallback((href: string, prefetchApi?: string[]) => {
    // Prefetch the route immediately
    if (!prefetchedRoutes.current.has(href)) {
      router.prefetch(href);
      prefetchedRoutes.current.add(href);
    }

    // Prefetch API routes with a small delay to avoid blocking
    if (prefetchApi && prefetchApi.length > 0) {
      const timeoutId = setTimeout(() => {
        prefetchApi.forEach((api) => {
          // Use fetch with cache to prefetch API data
          fetch(api, { 
            method: "GET",
            cache: "force-cache",
            headers: {
              "Cache-Control": "public, max-age=60",
            },
          }).catch(() => {
            // Silently fail - prefetch is best effort
          });
        });
      }, 100);

      // Clear any existing timeout for this route
      const existing = prefetchTimeoutRef.current.get(href);
      if (existing) {
        clearTimeout(existing);
      }
      prefetchTimeoutRef.current.set(href, timeoutId);
    }
  }, [router]);

  const handleMouseEnter = useCallback((item: typeof navigation[0]) => {
    prefetchRoute(item.href, item.prefetchApi);
  }, [prefetchRoute]);

  const handleMouseLeave = useCallback((href: string) => {
    const timeoutId = prefetchTimeoutRef.current.get(href);
    if (timeoutId) {
      clearTimeout(timeoutId);
      prefetchTimeoutRef.current.delete(href);
    }
  }, []);

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
                        prefetch={true}
                        onMouseEnter={() => handleMouseEnter(item)}
                        onMouseLeave={() => handleMouseLeave(item.href)}
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
