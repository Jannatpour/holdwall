"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Database, Shield, BookOpen, Loader2, CheckSquare, User, Star } from "@/components/demo-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "claim" | "evidence" | "artifact" | "audit" | "signal" | "task" | "influencer" | "trust_asset";
  title: string;
  description?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "claim":
        return <Shield className="size-4" />;
      case "evidence":
        return <Database className="size-4" />;
      case "artifact":
        return <FileText className="size-4" />;
      case "audit":
        return <BookOpen className="size-4" />;
      case "signal":
        return <Search className="size-4" />;
      case "task":
        return <CheckSquare className="size-4" />;
      case "influencer":
        return <User className="size-4" />;
      case "trust_asset":
        return <Star className="size-4" />;
      default:
        return <FileText className="size-4" />;
    }
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.url);
    setOpen(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search claims, evidence, artifacts, audits, tasks, influencers, trust assets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[400px] px-4 pb-4">
          <div className="space-y-1">
            {results.length > 0 ? (
              results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {getIcon(result.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {result.type}
                      </Badge>
                    </div>
                    {result.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {result.description}
                      </div>
                    )}
                  </div>
                </button>
              ))
            ) : query.length >= 2 && !loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : query.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
