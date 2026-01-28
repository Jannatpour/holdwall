"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "@/components/demo-icons";

interface PlaybookData {
  content: string;
  title: string;
  subtitle: string;
}

// Simple markdown parser for basic formatting
function parseMarkdown(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4">
            <code>{codeBlockContent.join("\n")}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headers
    if (trimmed.startsWith("# ")) {
      if (currentList.length > 0) {
        elements.push(renderList(currentList, `list-${i}`));
        currentList = [];
      }
      elements.push(
        <h1 key={`h1-${i}`} className="text-3xl font-bold mt-8 mb-4 first:mt-0">
          {trimmed.substring(2)}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      if (currentList.length > 0) {
        elements.push(renderList(currentList, `list-${i}`));
        currentList = [];
      }
      elements.push(
        <h2 key={`h2-${i}`} className="text-2xl font-semibold mt-6 mb-3 border-b pb-2">
          {trimmed.substring(3)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      if (currentList.length > 0) {
        elements.push(renderList(currentList, `list-${i}`));
        currentList = [];
      }
      elements.push(
        <h3 key={`h3-${i}`} className="text-xl font-semibold mt-4 mb-2">
          {trimmed.substring(4)}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      if (currentList.length > 0) {
        elements.push(renderList(currentList, `list-${i}`));
        currentList = [];
      }
      elements.push(
        <h4 key={`h4-${i}`} className="text-lg font-semibold mt-3 mb-2">
          {trimmed.substring(5)}
        </h4>
      );
      continue;
    }

    // Horizontal rule
    if (trimmed === "---" || trimmed.startsWith("---")) {
      if (currentList.length > 0) {
        elements.push(renderList(currentList, `list-${i}`));
        currentList = [];
      }
      elements.push(<hr key={`hr-${i}`} className="my-8 border-t" />);
      continue;
    }

    // Lists
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      currentList.push(trimmed.substring(2));
      continue;
    }

    // Empty line - flush list if exists
    if (trimmed === "" && currentList.length > 0) {
      elements.push(renderList(currentList, `list-${i}`));
      currentList = [];
      continue;
    }

    // Regular paragraph
    if (trimmed && !trimmed.startsWith(">")) {
      if (currentList.length > 0) {
        elements.push(renderList(currentList, `list-${i}`));
        currentList = [];
      }
      elements.push(
        <p key={`p-${i}`} className="mb-4 leading-7 text-muted-foreground">
          {parseInlineMarkdown(trimmed)}
        </p>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      if (currentList.length > 0) {
        elements.push(renderList(currentList, `list-${i}`));
        currentList = [];
      }
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
          {parseInlineMarkdown(trimmed.substring(2))}
        </blockquote>
      );
      continue;
    }
  }

  // Flush any remaining list
  if (currentList.length > 0) {
    elements.push(renderList(currentList, "list-final"));
  }

  return elements;
}

function renderList(items: string[], key: string) {
  return (
    <ul key={key} className="list-disc list-inside mb-4 space-y-2 text-muted-foreground ml-4">
      {items.map((item, idx) => (
        <li key={idx}>{parseInlineMarkdown(item)}</li>
      ))}
    </ul>
  );
}

function parseInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  // Handle **bold**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match;
  const matches: Array<{ start: number; end: number; text: string; type: "bold" }> = [];

  while ((match = boldRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[1],
      type: "bold",
    });
  }

  matches.sort((a, b) => a.start - b.start);

  for (const m of matches) {
    if (m.start > currentIndex) {
      parts.push(text.substring(currentIndex, m.start));
    }
    parts.push(
      <strong key={`bold-${key++}`} className="font-semibold text-foreground">
        {m.text}
      </strong>
    );
    currentIndex = m.end;
  }

  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

export function FinancialServicesPlaybookContent() {
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/playbooks/financial-services");
        if (!res.ok) throw new Error("Failed to load playbook");
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load playbook");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const parsedContent = useMemo(() => {
    if (!data) return null;
    return parseMarkdown(data.content);
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          {error || "Failed to load playbook. Please try again later."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      {parsedContent}
    </div>
  );
}
