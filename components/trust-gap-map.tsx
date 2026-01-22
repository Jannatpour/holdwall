/**
 * Trust Gap Map Component
 * 
 * Visualizes claim clusters missing trust assets
 * Shows gaps and recommendations
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Plus } from "lucide-react";
import Link from "next/link";

export interface TrustGap {
  cluster_id: string;
  primary_claim: string;
  size: number;
  decisiveness: number;
  missing_asset_types: string[];
  recommended_asset_types: string[];
}

interface TrustGapMapProps {
  brandId?: string;
}

export function TrustGapMap({ brandId }: TrustGapMapProps) {
  const [gaps, setGaps] = React.useState<TrustGap[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadGaps();
  }, [brandId]);

  const loadGaps = async () => {
    setLoading(true);
    try {
      const url = brandId ? `/api/trust/gaps?brand_id=${brandId}` : "/api/trust/gaps";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setGaps(data.gaps || []);
      }
    } catch (error) {
      console.error("Failed to load trust gaps:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading trust gaps...</div>;
  }

  if (gaps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              All high-impact clusters have trust coverage
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trust Gap Map</CardTitle>
        <CardDescription>Clusters missing trust assets</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cluster</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Decisiveness</TableHead>
              <TableHead>Missing Assets</TableHead>
              <TableHead>Recommended</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.map((gap) => (
              <TableRow key={gap.cluster_id}>
                <TableCell className="font-medium max-w-md">
                  {gap.primary_claim.substring(0, 100)}
                  {gap.primary_claim.length > 100 && "..."}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{gap.size}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>{(gap.decisiveness * 100).toFixed(0)}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {gap.missing_asset_types.map(type => (
                      <Badge key={type} variant="destructive">{type}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {gap.recommended_asset_types.map(type => (
                      <Badge key={type} variant="secondary">{type}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/trust?cluster=${gap.cluster_id}`}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Asset
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
