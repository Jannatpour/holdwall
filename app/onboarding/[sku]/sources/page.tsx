"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Plus, X } from "lucide-react";

type SourceType = "reddit" | "twitter" | "reviews" | "support" | "internal" | "knowledge_base" | "custom";

interface Source {
  type: SourceType;
  name: string;
  config: Record<string, string>;
}

export default function SourcesPage() {
  const router = useRouter();
  const params = useParams();
  const sku = (params.sku as string)?.toUpperCase() || "A";

  const [sources, setSources] = useState<Source[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<SourceType>>(new Set());

  const sourceTemplates: Record<SourceType, { name: string; fields: string[] }> = {
    reddit: { name: "Reddit", fields: ["subreddit", "api_key"] },
    twitter: { name: "X (Twitter)", fields: ["api_key", "api_secret"] },
    reviews: { name: "Reviews (Google/Yelp)", fields: ["platform", "business_id"] },
    support: { name: "Support Tickets", fields: ["provider", "api_key"] },
    internal: { name: "Internal Logs", fields: ["endpoint", "auth_token"] },
    knowledge_base: { name: "Knowledge Base", fields: ["url", "api_key"] },
    custom: { name: "Custom Source", fields: ["url", "auth_token"] },
  };

  const handleTypeToggle = (type: SourceType) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(type)) {
      newSelected.delete(type);
      setSources(sources.filter((s) => s.type !== type));
    } else {
      newSelected.add(type);
      setSources([...sources, { type, name: sourceTemplates[type].name, config: {} }]);
    }
    setSelectedTypes(newSelected);
  };

  const updateSourceConfig = (index: number, field: string, value: string) => {
    const updated = [...sources];
    updated[index] = {
      ...updated[index],
      config: { ...updated[index].config, [field]: value },
    };
    setSources(updated);
  };

  const handleContinue = async () => {
    if (sources.length === 0) {
      alert("Please select at least one source");
      return;
    }

    // Save sources (in production, call API)
    try {
      const response = await fetch("/api/onboarding/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, sources }),
      });

      if (response.ok) {
        router.push(`/onboarding/${sku.toLowerCase()}/policy`);
      }
    } catch (error) {
      // Error handling is done in the API route
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Connect Your Data Sources</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Select 3-5 sources to start. You can add more later.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Available Sources</CardTitle>
            <CardDescription>Choose the sources you want to monitor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(sourceTemplates).map(([type, template]) => {
                const isSelected = selectedTypes.has(type as SourceType);
                const sourceIndex = sources.findIndex((s) => s.type === type);

                return (
                  <div key={type} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleTypeToggle(type as SourceType)}
                      />
                      <Label className="font-medium">{template.name}</Label>
                    </div>

                    {isSelected && sourceIndex >= 0 && (
                      <div className="ml-7 space-y-3 mt-3">
                        {template.fields.map((field) => (
                          <div key={field}>
                            <Label className="text-sm capitalize">{field.replace("_", " ")}</Label>
                            <Input
                              type={field.includes("key") || field.includes("token") ? "password" : "text"}
                              placeholder={`Enter ${field}`}
                              value={sources[sourceIndex].config[field] || ""}
                              onChange={(e) => updateSourceConfig(sourceIndex, field, e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => router.push("/onboarding")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleContinue} disabled={sources.length === 0}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
