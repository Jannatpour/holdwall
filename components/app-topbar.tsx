"use client";

import * as React from "react";
import { Search, Bell, Command } from "@/components/demo-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { GlobalSearch } from "@/components/global-search";

export function AppTopbar() {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <>
      <GlobalSearch />
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
        {/* Global Search */}
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search claims, evidence, artifacts... (Ctrl+F)"
              className="pl-9"
              onFocus={() => setSearchOpen(true)}
              onClick={() => setSearchOpen(true)}
            />
          </div>
        <Button
          variant="outline"
          size="icon"
          className="hidden sm:flex"
          onClick={() => {
            // Command palette trigger
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
        >
          <Command className="size-4" />
          <span className="sr-only">Command palette</span>
        </Button>
      </div>

      {/* Right side: Alerts, Theme, User */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 size-5 rounded-full p-0 text-xs"
          >
            3
          </Badge>
          <span className="sr-only">Notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="hidden sm:inline">Theme</span>
              <span className="capitalize">{theme}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme("obsidian")}>
              Holdwall Obsidian
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("regulator-light")}>
              Regulator Light
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                <AvatarFallback>HW</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const { signOut } = await import("next-auth/react");
                await signOut({ callbackUrl: "/auth/signin" });
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </header>
    </>
  );
}
