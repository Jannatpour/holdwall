import { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Forecasting",
  "Forecasts surface narrative drift and outbreak probability so teams can publish calm, evidence-backed explanations before virality spikes.",
  "/product/forecasting"
);

export default function ProductForecastingPage() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Forecasting</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Forecasts surface narrative drift and outbreak probability so teams can publish calm, evidence-backed
            explanations before virality spikes.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/product">Back to product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/forecasts">Open forecasts in app</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drift</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Detects consistent movement in sentiment or attention before it becomes a crisis.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outbreak probability</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Estimates the chance a narrative will outbreak over a specified horizon based on observed signals.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evaluation gates</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Forecasts can be scored and gated so downstream actions remain defensible and audit-ready.
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}

