"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ArrowRight } from "@/components/demo-icons";

export default function BriefPage() {
  const router = useRouter();
  const params = useParams();
  const sku = (params.sku as string)?.toUpperCase() || "A";

  const [isGenerating, setIsGenerating] = useState(true);
  const [brief, setBrief] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateBrief();
  }, []);

  const generateBrief = async () => {
    try {
      setIsGenerating(true);
      const response = await fetch("/api/onboarding/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });

      if (response.ok) {
        const data = await response.json();
        setBrief(data);
      } else {
        setError("Failed to generate brief");
      }
    } catch (err) {
      setError("Error generating brief");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = () => {
    // For SKU B (Financial Services), redirect to Financial Services dashboard
    if (sku === "B" || sku === "b") {
      router.push("/financial-services");
    } else if (sku === "D" || sku === "d") {
      // For SKU D (Security Incidents), redirect to overview with security incidents filter
      router.push("/overview?filter=security_incidents");
    } else {
      router.push("/overview");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your First Perception Brief</h1>
          <p className="text-slate-600 dark:text-slate-400">
            POS is generating your baseline report...
          </p>
        </div>

        {isGenerating && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                Analyzing your sources and generating your first brief...
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent className="py-12">
              <p className="text-red-500 text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        {brief && !isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle>Perception Brief</CardTitle>
              <CardDescription>Your baseline analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Top Claim Clusters</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {brief.claim_clusters?.length || 0} clusters detected
                  </p>
                  {brief.claim_clusters && brief.claim_clusters.length > 0 && (
                    <div className="space-y-1">
                      {brief.claim_clusters.slice(0, 3).map((cluster: any, idx: number) => (
                        <div key={idx} className="text-xs text-slate-500 dark:text-slate-400">
                          • {cluster.primary_claim?.substring(0, 60)}...
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Outbreak Probability</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {brief.outbreak_probability ? `${(brief.outbreak_probability * 100).toFixed(1)}%` : "N/A"}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Evidence Items</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {brief.evidence_count || 0} items collected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {brief && !isGenerating && (
          <div className="flex justify-end mt-6">
            <Button onClick={handleComplete} size="lg">
              Complete Setup
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
