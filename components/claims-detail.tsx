"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Network, Shield, Play, TrendingUp, Link2, BarChart3, Target, History, Zap, FileEdit, Plus, Clock } from "@/components/demo-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { ExplainScoreDrawer } from "@/components/explain-score-drawer";
import { SeverityBadge } from "@/components/severity-badge";
import { EvidenceLink } from "@/components/evidence-link";
import { ApprovalStepper } from "@/components/approval-stepper";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

interface ClaimDetail {
  id: string;
  canonicalText: string;
  variants: string[];
  decisiveness: number;
  clusterId?: string;
  evidenceRefs: Array<{
    evidence: {
      id: string;
      type: string;
      sourceType: string;
      contentRaw?: string;
    };
  }>;
}

export function ClaimsDetail({ claimId }: { claimId: string }) {
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beliefPaths, setBeliefPaths] = useState<any[]>([]);
  const [trustAssets, setTrustAssets] = useState<any[]>([]);
  const [trustMappings, setTrustMappings] = useState<any[]>([]);
  const [recommendedActions, setRecommendedActions] = useState<any[]>([]);
  const [impactHistory, setImpactHistory] = useState<any[]>([]);
  const [clusterData, setClusterData] = useState<any>(null);
  const [relatedClusters, setRelatedClusters] = useState<any[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchClaim() {
      try {
        // Try to fetch as cluster first (if claimId is actually a cluster ID)
        const clusterResponse = await fetch(`/api/claim-clusters/top?id=${claimId}`);
        if (clusterResponse.ok) {
          const clusterData = await clusterResponse.json();
          if (clusterData && !cancelled) {
            setClusterData(clusterData);
            // Set primary claim from cluster
            if (clusterData.primaryClaim) {
              setClaim({
                id: clusterData.primaryClaim.id,
                canonicalText: clusterData.primaryClaim.canonicalText,
                variants: clusterData.primaryClaim.variants || [],
                decisiveness: clusterData.decisiveness,
                clusterId: clusterData.id,
                evidenceRefs: clusterData.primaryClaim.evidenceRefs || [],
              });
            }
          }
        }

        // Also fetch as regular claim
        const claimResponse = await fetch(`/api/claims?id=${claimId}`);
        if (claimResponse.ok) {
          const data = await claimResponse.json();
          if (!cancelled) {
            const claimData = data[0] || data;
            setClaim(claimData);
            
            // If claim has clusterId, fetch cluster data
            if (claimData.clusterId) {
              const clusterRes = await fetch(`/api/claim-clusters/top?id=${claimData.clusterId}`);
              if (clusterRes.ok) {
                const cluster = await clusterRes.json();
                setClusterData(cluster);
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchClaim();
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  useEffect(() => {
    if (!claim) return;
    const currentClaim = claim;
    let cancelled = false;

    async function fetchRelatedData() {
      const clusterId = currentClaim.clusterId || clusterData?.id;
      
      // Fetch variants if cluster
      if (clusterId) {
        fetch(`/api/claim-clusters/${clusterId}/variants`)
          .then(res => res.ok ? res.json() : null)
          .then(data => !cancelled && setVariants(data?.variants || []))
          .catch(() => {});
      }

      // Fetch belief paths
      const nodeId = clusterId || claimId;
      fetch(`/api/graph/paths?node_id=${nodeId}&depth=3`)
        .then(res => res.ok ? res.json() : null)
        .then(data => !cancelled && setBeliefPaths(data?.paths || []))
        .catch(() => setBeliefPaths([]));

      // Fetch trust mappings
      if (clusterId) {
        fetch(`/api/trust/mappings?cluster_id=${clusterId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (!cancelled) {
              setTrustMappings(data?.mappings || []);
              setTrustAssets(data?.assets || []);
            }
          })
          .catch(() => {});
      }

      // Fetch recommended actions
      fetch(`/api/recommendations?cluster_id=${clusterId || claimId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => !cancelled && setRecommendedActions(data?.recommendations || []))
        .catch(() => setRecommendedActions([]));

      // Fetch impact metrics
      if (clusterId) {
        fetch(`/api/metrics/cluster-impact?cluster_id=${clusterId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => !cancelled && setImpactHistory(data?.trends || []))
          .catch(() => setImpactHistory([]));
      }

      // Fetch related clusters
      fetch(`/api/claim-clusters/top?limit=5`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!cancelled && data?.clusters) {
            const related = data.clusters.filter((c: any) => c.cluster_id !== clusterId).slice(0, 3);
            setRelatedClusters(related);
          }
        })
        .catch(() => {});

      // Fetch audit trail
      fetch(`/api/audit?entity_type=cluster&entity_id=${clusterId || claimId}&limit=10`)
        .then(res => res.ok ? res.json() : null)
        .then(data => !cancelled && setAuditTrail(data?.events || []))
        .catch(() => setAuditTrail([]));
    }

    fetchRelatedData();
    return () => {
      cancelled = true;
    };
  }, [claim, claimId, clusterData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !claim) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive">Error: {error || "Claim not found"}</div>
        </CardContent>
      </Card>
    );
  }

  const severity = claim.decisiveness > 0.8 ? "critical" : claim.decisiveness > 0.6 ? "high" : claim.decisiveness > 0.4 ? "medium" : "low";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
      {/* Left Column: Primary Content */}
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/claims">Claims</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{clusterData?.primaryClaim?.canonicalText?.substring(0, 30) || claim.canonicalText.substring(0, 30)}...</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Cluster Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">
                  {clusterData?.primaryClaim?.canonicalText || claim.canonicalText}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={severity} />
                  <Badge variant="outline">
                    Decisiveness: {(claim.decisiveness * 100).toFixed(0)}%
                  </Badge>
                  {clusterData && (
                    <Badge variant="secondary">
                      {clusterData.size} claims
                    </Badge>
                  )}
                </div>
              </div>
              <ExplainScoreDrawer
                entityType="cluster"
                entityId={claim.clusterId || claimId}
                scoreType="decisiveness"
              />
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="belief-paths">Belief Paths</TabsTrigger>
            <TabsTrigger value="trust-map">Trust Mapping</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="impact">Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>Primary claim, variants, and key metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="font-medium text-lg mb-2">{claim.canonicalText}</div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>Evidence: {claim.evidenceRefs.length} items</span>
                    {clusterData && (
                      <>
                        <span>•</span>
                        <span>Cluster size: {clusterData.size} claims</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Variants */}
                {(variants.length > 0 || claim.variants.length > 0) && (
                  <div>
                    <div className="text-sm font-medium mb-2">Claim Variants:</div>
                    <div className="flex flex-wrap gap-2">
                      {(variants.length > 0 ? variants : claim.variants.map(v => ({ text: v }))).map((variant: any, i: number) => (
                        <HoverCard key={i}>
                          <HoverCardTrigger asChild>
                            <Badge variant="outline" className="cursor-help">
                              {variant.text || variant}
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent>
                            <div className="text-sm">
                              <div className="font-medium mb-1">Variant {i + 1}</div>
                              <div className="text-muted-foreground">
                                {variant.text || variant}
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Metrics */}
                {clusterData && (
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Claims</div>
                      <div className="text-2xl font-bold">{clusterData.size}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Decisiveness</div>
                      <div className="text-2xl font-bold">{(clusterData.decisiveness * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Trust Coverage</div>
                      <div className="text-2xl font-bold">
                        {trustMappings.length > 0 ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evidence</CardTitle>
                <CardDescription>
                  Immutable evidence references supporting this claim cluster
                </CardDescription>
              </CardHeader>
              <CardContent>
                {claim.evidenceRefs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Content Preview</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claim.evidenceRefs.map((ref) => (
                        <TableRow key={ref.evidence.id}>
                          <TableCell>
                            <Badge variant="outline">{ref.evidence.type}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {ref.evidence.sourceType}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-sm text-muted-foreground line-clamp-2">
                              {ref.evidence.contentRaw?.substring(0, 150) || "No content"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <EvidenceLink evidenceId={ref.evidence.id} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-sm text-muted-foreground mb-4">
                      No evidence linked to this cluster
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/signals?cluster=${claim.clusterId || claimId}`}>
                        <Link2 className="h-4 w-4 mr-2" />
                        Link Evidence from Signals
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="belief-paths" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Belief Paths</CardTitle>
                <CardDescription>
                  Reinforcement and neutralization paths in the belief graph
                </CardDescription>
              </CardHeader>
              <CardContent>
                {beliefPaths.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {beliefPaths
                      .filter((p: any) => p.type === "reinforcement" || p.type === "neutralization")
                      .map((path: any, i: number) => (
                        <AccordionItem key={i} value={`path-${i}`}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-2">
                              <Network className="size-4 text-primary" />
                              <span className="font-medium capitalize">{path.type || "Path"}</span>
                              <Badge variant={path.type === "reinforcement" ? "default" : "secondary"}>
                                {path.type === "reinforcement" ? "Reinforces" : "Neutralizes"}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                Weight: {path.weight?.toFixed(2) || "N/A"}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              {path.nodes && path.nodes.length > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Path:</span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {path.nodes.map((node: any, idx: number) => (
                                      <span key={idx} className="flex items-center gap-1">
                                        <span className="font-mono text-xs">
                                          {node.content?.substring(0, 30) || node.id?.substring(0, 16)}
                                        </span>
                                        {idx < path.nodes.length - 1 && (
                                          <span className="text-muted-foreground">→</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {path.description && (
                                <div className="text-sm text-muted-foreground">
                                  {path.description}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                  </Accordion>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-sm text-muted-foreground mb-4">
                      No belief paths found. Paths will appear as the belief graph is built.
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/graph?node=${claimId}`}>
                        <Network className="h-4 w-4 mr-2" />
                        View Graph
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trust-map" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trust Mapping</CardTitle>
                <CardDescription>
                  Trust assets mapped to this cluster and identified gaps
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trustMappings.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm font-medium">Mapped Trust Assets:</div>
                    <div className="space-y-2">
                      {trustMappings.map((mapping: any) => (
                        <div key={mapping.asset_id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{mapping.asset_title}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Type: {mapping.asset_type} • Mapping: {mapping.mapping_type}
                              </div>
                            </div>
                            <Badge variant={mapping.mapping_type === "primary" ? "default" : "outline"}>
                              {mapping.mapping_type}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-sm text-muted-foreground mb-4">
                      No trust assets mapped to this cluster
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/trust?cluster=${claim.clusterId || claimId}`}>
                        <Shield className="h-4 w-4 mr-2" />
                        Map Trust Asset
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Actions & Playbooks</CardTitle>
                <CardDescription>
                  Recommended actions and available playbooks for this cluster
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recommendedActions.length > 0 ? (
                  <div className="space-y-3">
                    {recommendedActions.map((action: any) => (
                      <div key={action.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className="size-4 text-primary" />
                              <span className="font-medium">{action.action || action.name}</span>
                              <Badge variant={
                                action.priority === "high" ? "destructive" :
                                action.priority === "medium" ? "default" : "outline"
                              }>
                                {action.priority || "medium"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {action.rationale || action.description || "No description"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button size="sm" variant="default" asChild>
                            <Link href={`/studio?template=scam_explainer&cluster_id=${claim.clusterId || claimId}`}>
                              <FileEdit className="h-4 w-4 mr-2" />
                              Create AAAL
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/playbooks?cluster=${claim.clusterId || claimId}`}>
                              <Play className="h-4 w-4 mr-2" />
                              Run Playbook
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No specific recommendations. Create a playbook or artifact to address this cluster.
                    </div>
                    <div className="flex items-center gap-2 justify-center">
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/playbooks">
                          <Play className="h-4 w-4 mr-2" />
                          Browse Playbooks
                        </Link>
                      </Button>
                      <Button size="sm" variant="default" asChild>
                        <Link href={`/studio?cluster=${claim.clusterId || claimId}`}>
                          <FileEdit className="h-4 w-4 mr-2" />
                          Create Artifact
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

      <TabsContent value="impact" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Impact History</CardTitle>
            <CardDescription>
              Before/after measurements of actions taken on this claim
            </CardDescription>
          </CardHeader>
          <CardContent>
            {impactHistory.length > 0 ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impactHistory.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">{entry.action_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{entry.before_score?.toFixed(2) || "N/A"}</span>
                            {entry.before_score !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                {entry.before_metric || "Score"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{entry.after_score?.toFixed(2) || "N/A"}</span>
                            {entry.after_score !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                {entry.after_metric || "Score"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.before_score !== undefined && entry.after_score !== undefined && (
                            <div className={`flex items-center gap-1 ${entry.after_score > entry.before_score ? "text-green-600" : entry.after_score < entry.before_score ? "text-destructive" : "text-muted-foreground"}`}>
                              {entry.after_score > entry.before_score ? (
                                <TrendingUp className="size-4" />
                              ) : entry.after_score < entry.before_score ? (
                                <TrendingUp className="size-4 rotate-180" />
                              ) : null}
                              <span className="text-sm font-medium">
                                {((entry.after_score - entry.before_score) * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No impact history yet. Impact metrics will appear after actions are taken on this claim.
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
      </div>

      {/* Right Column: Context + Quick Actions */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cluster context</CardTitle>
            <CardDescription>Fast references for this claim cluster</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cluster ID</span>
              <span className="font-mono text-xs">{claim.clusterId || claimId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Evidence refs</span>
              <span>{claim.evidenceRefs.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Trust assets</span>
              <span>{trustAssets.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recommended actions</span>
              <span>{recommendedActions.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Start a response workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link href={`/playbooks?claim_id=${encodeURIComponent(claimId)}`}>
                <Play className="mr-2 size-4" />
                Run playbook
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/studio?claim_id=${encodeURIComponent(claimId)}`}>
                <FileEdit className="mr-2 size-4" />
                Draft AAAL
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/governance?cluster_id=${encodeURIComponent(claim.clusterId || claimId)}`}>
                <Shield className="mr-2 size-4" />
                Route approval
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
