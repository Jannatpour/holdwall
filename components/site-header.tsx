"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "@/components/demo-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const productNav = [
  { href: "/product", label: "Overview", description: "Platform capabilities" },
  { href: "/product/pipeline", label: "Pipeline", description: "Signals → Evidence → Claims" },
  { href: "/product/claims", label: "Claims & Clustering", description: "Extract and cluster narratives" },
  { href: "/product/graph", label: "Belief Graph", description: "Model narrative dynamics" },
  { href: "/product/forecasting", label: "Forecasting", description: "Predict narrative outbreaks" },
  { href: "/product/governance", label: "Governance", description: "Approvals and policies" },
  { href: "/product/aaal", label: "AAAL Studio", description: "AI-Answer Authority artifacts" },
  { href: "/product/agents", label: "Agents", description: "MCP/ACP orchestration" },
];

const solutionsNav = [
  { href: "/solutions", label: "Overview", description: "All solutions" },
  { href: "/solutions/comms", label: "Comms & PR", description: "SKU A: AI Answer Authority" },
  { href: "/solutions/security", label: "Security & Trust", description: "SKU B: Narrative Risk Early Warning" },
  { href: "/solutions/procurement", label: "Procurement", description: "SKU C: Evidence-Backed Intake" },
  { href: "/solutions/security-incidents", label: "Security Incidents", description: "SKU D: AI-Governed Incident Narratives" },
  { href: "/solutions/support", label: "Support & Ops", description: "Incident narrative control" },
  { href: "/solutions/financial-services", label: "Financial Services", description: "Banks, FinTech, Payments, Insurance" },
];

const mainNav = [
  { href: "/product", label: "Product", hasDropdown: true, items: productNav },
  { href: "/solutions", label: "Solutions", hasDropdown: true, items: solutionsNav },
  { href: "/resources", label: "Resources" },
  { href: "/security", label: "Security" },
  { href: "/ethics", label: "Ethics" },
  { href: "/compliance", label: "Compliance" },
];

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex size-7 items-center justify-center rounded-md border bg-card text-sm font-bold">
              HW
            </span>
            <span className="hidden sm:inline">Holdwall</span>
            <span className="hidden sm:inline text-muted-foreground font-normal">POS</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            {mainNav.map((item) => {
              if (item.hasDropdown && item.items) {
                return (
                  <DropdownMenu key={item.href}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "text-sm text-muted-foreground hover:text-foreground",
                          pathname.startsWith(item.href) && "text-foreground"
                        )}
                      >
                        {item.label}
                        <ChevronDown className="ml-1 size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {item.items.map((subItem) => (
                        <DropdownMenuItem key={subItem.href} asChild>
                          <Link href={subItem.href} className="flex flex-col items-start gap-1">
                            <span className="font-medium">{subItem.label}</span>
                            <span className="text-xs text-muted-foreground">{subItem.description}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md",
                    pathname === item.href && "text-foreground font-medium"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/demo">Try Demo</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/auth/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/overview">Command Center</Link>
          </Button>
          
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-4">
                {mainNav.map((item) => {
                  if (item.hasDropdown && item.items) {
                    return (
                      <div key={item.href} className="space-y-2">
                        <Link
                          href={item.href}
                          className="text-base font-semibold text-foreground"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                        <div className="ml-4 space-y-1 border-l pl-4">
                          {item.items.map((subItem) => (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={cn(
                                "block text-sm text-muted-foreground hover:text-foreground py-1",
                                pathname === subItem.href && "text-foreground font-medium"
                              )}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <div className="font-medium">{subItem.label}</div>
                              <div className="text-xs">{subItem.description}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "text-base text-muted-foreground hover:text-foreground",
                        pathname === item.href && "text-foreground font-semibold"
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mt-4 space-y-2 border-t pt-4">
                  <Button asChild className="w-full justify-start">
                    <Link href="/demo" onClick={() => setMobileMenuOpen(false)}>
                      Try Demo
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/overview" onClick={() => setMobileMenuOpen(false)}>
                      Command Center
                    </Link>
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

