"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Link2, Sparkles, Search, Loader2, FileText, Plus } from "@/components/demo-icons";
import { toast } from "sonner";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/loading-states";
import { PADLPublishDialog } from "@/components/padl-publish-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

interface Artifact {
  id: string;
  title: string;
  content: string;
  status: string;
  evidenceRefs: Array<{
    evidence: {
      id: string;
      type: string;
      contentRaw?: string;
    };
  }>;
}

export function StudioEditor({ artifactId }: { artifactId?: string }) {
  const router = useRouter();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(!!artifactId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [evidenceRefs, setEvidenceRefs] = useState<string[]>([]);
  const [policyChecks, setPolicyChecks] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [evidencePickerOpen, setEvidencePickerOpen] = useState(false);
  const [availableEvidence, setAvailableEvidence] = useState<any[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [schemaType, setSchemaType] = useState<string>("Article");

  useEffect(() => {
    if (!artifactId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchArtifact() {
      try {
        const res = await fetch(`/api/aaal?id=${artifactId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch artifact: ${res.statusText}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setArtifact(data);
          setTitle(data.title);
          setContent(data.content);
          setEvidenceRefs(data.evidenceRefs.map((ref: any) => ref.evidenceId));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch artifact:", err);
          toast.error(err instanceof Error ? err.message : "Failed to load artifact");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchArtifact();
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  const handleCheckPolicies = async () => {
    if (!artifactId) return;

    try {
      const res = await fetch("/api/aaal/check-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact_id: artifactId }),
      });

      const data = await res.json();
      setPolicyChecks(data.results || []);
      toast.success("Policy check completed");
    } catch (error) {
      toast.error("Failed to check policies");
    }
  };

  const handleSave = async () => {
    try {
      if (artifactId) {
        // Update existing
        const res = await fetch("/api/aaal", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifact_id: artifactId,
            title,
            content,
            evidence_refs: evidenceRefs,
          }),
        });

        if (res.ok) {
          toast.success("Draft updated successfully");
        } else {
          const errorData = await res.json();
          toast.error(errorData.error || "Failed to update draft");
        }
      } else {
        // Create new
        const res = await fetch("/api/aaal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content,
            evidence_refs: evidenceRefs,
            schema_type: schemaType,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          toast.success("Draft created successfully");
          router.push(`/studio?id=${data.artifact_id}`);
        } else {
          const errorData = await res.json();
          toast.error(errorData.error || "Failed to create draft");
        }
      }
    } catch (error) {
      toast.error("Failed to save");
    }
  };

  const handleSubmitForApproval = async () => {
    if (!artifactId) {
      toast.error("Please save the draft first");
      return;
    }

    try {
      // Check policies first
      const policyRes = await fetch("/api/aaal/check-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact_id: artifactId,
        }),
      });

      if (!policyRes.ok) {
        toast.error("Policy check failed");
        return;
      }

      const policyData = await policyRes.json();
      const failedPolicies = policyData.results?.filter(
        (p: any) => !p.passed
      );

      if (failedPolicies && failedPolicies.length > 0) {
        toast.error(
          `Policy checks failed: ${failedPolicies.map((p: any) => p.policy_type).join(", ")}`
        );
        return;
      }

      // Create approval request
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_type: "AAAL_ARTIFACT",
          resource_id: artifactId,
          action: "publish",
          approvers: [], // Will be determined by system based on policies
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Submitted for approval");
        
        // Update artifact status to PENDING_APPROVAL
        await fetch("/api/aaal", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifact_id: artifactId,
            status: "PENDING_APPROVAL",
          }),
        });

        router.push(`/governance?approval=${data.id}`);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to submit for approval");
      }
    } catch (error) {
      toast.error("Failed to submit for approval");
    }
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch("/api/ai/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
        toast.success(`Found ${data.results?.length || 0} relevant evidence`);
      } else {
        throw new Error("Search failed");
      }
    } catch (error) {
      toast.error("Failed to search evidence");
    } finally {
      setSearching(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!title) {
      toast.error("Please enter a title first");
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Generate content for an AAAL artifact titled "${title}". The content should be evidence-based and cite sources.`,
          use_graphrag: true,
          use_composite: false,
          use_k2: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.content || data.response) {
          const generated = data.content || data.response || "";
          setAiSuggestions([generated]);
          toast.success("AI content generated");
        }
      } else {
        throw new Error("Generation failed");
      }
    } catch (error) {
      toast.error("Failed to generate content");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return <LoadingState count={3} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Editor */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Editor</CardTitle>
            <CardDescription>Traceability mode enabled</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Document title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Write your AAAL document here... Every claim should cite evidence."
              className="min-h-[400px] font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Link2 className="size-4" />
                <span>{evidenceRefs.length} evidence references linked</span>
              </div>
              {content && (
                <Badge variant="outline" className="text-xs">
                  Citation Density: {Math.round((evidenceRefs.length / (content.split(/\s+/).length / 100)) * 100) / 100 || 0}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Citations</CardTitle>
                <CardDescription>Evidence references</CardDescription>
              </div>
              <Dialog open={evidencePickerOpen} onOpenChange={setEvidencePickerOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={async () => {
                    setLoadingEvidence(true);
                    try {
                      const res = await fetch("/api/evidence?limit=50");
                      if (res.ok) {
                        const data = await res.json();
                        setAvailableEvidence(data.evidence || []);
                      }
                    } catch (err) {
                      toast.error("Failed to load evidence");
                    } finally {
                      setLoadingEvidence(false);
                    }
                  }}>
                    <Plus className="mr-2 size-4" />
                    Add Evidence
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Select Evidence</DialogTitle>
                    <DialogDescription>
                      Choose evidence to cite in this artifact
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[400px]">
                    {loadingEvidence ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Loading evidence...
                      </div>
                    ) : availableEvidence.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No evidence available
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableEvidence.map((ev) => (
                          <div
                            key={ev.id}
                            className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                              evidenceRefs.includes(ev.id)
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-accent"
                            }`}
                            onClick={() => {
                              if (evidenceRefs.includes(ev.id)) {
                                setEvidenceRefs(evidenceRefs.filter(id => id !== ev.id));
                                toast.success("Evidence removed");
                              } else {
                                setEvidenceRefs([...evidenceRefs, ev.id]);
                                toast.success("Evidence added");
                              }
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-mono text-xs text-muted-foreground mb-1">
                                  {ev.id}
                                </div>
                                <div className="text-sm font-medium mb-1">{ev.type}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {typeof ev.content === "string" 
                                    ? ev.content 
                                    : ev.content?.raw || JSON.stringify(ev.content) || "No content"}
                                </div>
                              </div>
                              {evidenceRefs.includes(ev.id) && (
                                <CheckCircle2 className="size-5 text-primary ml-2 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {artifact?.evidenceRefs.length === 0 && evidenceRefs.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No evidence references. Click &quot;Add Evidence&quot; to add citations.
                </div>
              ) : (
                <>
                  {artifact?.evidenceRefs.map((ref) => (
                    <div key={ref.evidence.id} className="rounded-lg border p-3 text-sm">
                      <div className="font-mono text-xs text-muted-foreground mb-1">
                        {ref.evidence.id}
                      </div>
                      <div className="text-xs font-medium mb-1">{ref.evidence.type}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {ref.evidence.contentRaw?.substring(0, 100) || "No content"}...
                      </div>
                    </div>
                  ))}
                  {evidenceRefs
                    .filter(id => !artifact?.evidenceRefs.find((ref: any) => ref.evidence.id === id))
                    .map((evidenceId) => {
                      const evidence = availableEvidence.find(e => e.id === evidenceId);
                      if (!evidence) return null;
                      return (
                        <div key={evidenceId} className="rounded-lg border p-3 text-sm">
                          <div className="font-mono text-xs text-muted-foreground mb-1">
                            {evidence.id}
                          </div>
                          <div className="text-xs font-medium mb-1">{evidence.type}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {typeof evidence.content === "string" 
                              ? evidence.content.substring(0, 100)
                              : evidence.content?.raw?.substring(0, 100) || "No content"}...
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy Checker</CardTitle>
            <CardDescription>Compliance validation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {policyChecks.length > 0 ? (
                policyChecks.map((check, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      className={`size-4 ${check.passed ? "text-green-600" : "text-red-600"}`}
                    />
                    <span>{check.policy_type}: {check.reason}</span>
                  </div>
                ))
              ) : (
                <Button onClick={handleCheckPolicies} variant="outline" className="w-full">
                  Check Policies
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Assistance</CardTitle>
            <CardDescription>Use advanced AI to enhance your document</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Search evidence with AI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    handleAISearch();
                  }
                }}
              />
              <Button
                onClick={handleAISearch}
                variant="outline"
                className="w-full"
                disabled={!searchQuery.trim() || searching}
              >
                {searching ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    Search with RAG
                  </>
                )}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="rounded-lg border p-2 text-sm cursor-pointer hover:bg-accent"
                    onClick={() => {
                      if (!evidenceRefs.includes(result.id)) {
                        setEvidenceRefs([...evidenceRefs, result.id]);
                        toast.success("Evidence added");
                      }
                    }}
                  >
                    <div className="font-medium text-xs mb-1">{result.type}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {result.content?.substring(0, 100)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              onClick={handleAIGenerate}
              variant="outline"
              className="w-full"
              disabled={aiLoading || !title}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  Generate with AI
                </>
              )}
            </Button>
            {aiSuggestions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium">AI Suggestions:</div>
                {aiSuggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-2 text-sm cursor-pointer hover:bg-accent"
                    onClick={() => {
                      setContent(content + "\n\n" + suggestion);
                      toast.success("Suggestion added");
                    }}
                  >
                    {suggestion.substring(0, 150)}...
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleSave}
              className="w-full"
              disabled={!title || !content}
              aria-label="Save draft artifact"
            >
              Save Draft
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSubmitForApproval}
              disabled={!artifactId || !title || !content}
              aria-label="Submit artifact for approval"
            >
              Submit for Approval
            </Button>
            {artifactId && artifact?.status === "APPROVED" && (
              <PADLPublishDialog
                artifactId={artifactId}
                artifactTitle={title || artifact?.title || "Untitled"}
                trigger={
                  <Button
                    variant="default"
                    className="w-full"
                    aria-label="Publish to PADL"
                  >
                    <Link2 className="mr-2 size-4" />
                    Publish to PADL
                  </Button>
                }
                onPublished={(url) => {
                  toast.success(`Published to ${url}`);
                  // Refresh artifact to get updated status
                  if (artifactId) {
                    fetch(`/api/aaal?id=${artifactId}`)
                      .then(res => res.json())
                      .then(data => setArtifact(data))
                      .catch((err) => {
                        // Silently handle - error already logged by API
                      });
                  }
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
