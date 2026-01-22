/**
 * PADL Public Artifact Page
 * Public-facing page for published AAAL artifacts
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { SchemaGenerator } from "@/lib/seo/schema-generator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, Shield, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ artifactId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { artifactId } = await params;
  const artifact = await db.aAALArtifact.findUnique({
    where: { id: artifactId, padlPublished: true },
    include: {
      evidenceRefs: {
        include: {
          evidence: {
            select: {
              id: true,
              type: true,
              sourceType: true,
              sourceUrl: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!artifact) {
    return genMeta("Artifact Not Found", "The requested artifact could not be found.", `/padl/${artifactId}`);
  }

  const content = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
  const description = content.substring(0, 200) + (content.length > 200 ? "..." : "");

  return genMeta(artifact.title, description, `/padl/${artifactId}`);
}

export default async function PADLArtifactPage({ params }: PageProps) {
  const { artifactId } = await params;
  const artifact = await db.aAALArtifact.findUnique({
    where: { id: artifactId, padlPublished: true },
    include: {
      evidenceRefs: {
        include: {
          evidence: {
            select: {
              id: true,
              type: true,
              sourceType: true,
              sourceUrl: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!artifact) {
    notFound();
  }

  const content = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
  const schemaGenerator = new SchemaGenerator();
  const articleSchema = schemaGenerator.generateArticle({
    headline: artifact.title,
    description: content.substring(0, 200),
    url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com"}/padl/${artifactId}`,
    datePublished: artifact.createdAt.toISOString(),
    dateModified: artifact.updatedAt?.toISOString() || artifact.createdAt.toISOString(),
    author: {
      name: "Holdwall",
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-flex size-7 items-center justify-center rounded-md border bg-card text-sm">
                HW
              </span>
              <span>Holdwall</span>
            </Link>
            <Badge variant="outline">Public Artifact</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="space-y-8">
          <header className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />
              <span>AAAL Artifact</span>
              <span>•</span>
              <span>Version {artifact.version}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">{artifact.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="size-4" />
                <span>
                  Published {artifact.publishedAt?.toLocaleDateString() || artifact.createdAt.toLocaleDateString()}
                </span>
              </div>
              {artifact.padlHash && (
                <div className="flex items-center gap-2">
                  <Shield className="size-4" />
                  <span className="font-mono text-xs">{artifact.padlHash.substring(0, 16)}...</span>
                </div>
              )}
            </div>
          </header>

          <Separator />

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap">{content}</div>
          </div>

          {artifact.evidenceRefs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence References</CardTitle>
                <CardDescription>
                  This artifact is backed by {artifact.evidenceRefs.length} evidence reference(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {artifact.evidenceRefs.map((ref: { id: string; evidence: { id: string; type: string; sourceType: string; sourceUrl?: string | null; createdAt: Date } }) => (
                    <div
                      key={ref.id}
                      className="flex items-start justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {ref.evidence.type}
                          </Badge>
                          <span className="text-sm font-medium">{ref.evidence.sourceType}</span>
                        </div>
                        {ref.evidence.sourceUrl && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new URL(ref.evidence.sourceUrl).hostname}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          Collected {ref.evidence.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                      {ref.evidence.sourceUrl && (
                        <Link
                          href={ref.evidence.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-4"
                        >
                          <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Artifact Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="size-3" />
                      {artifact.status}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Version</dt>
                  <dd className="mt-1 text-sm">{artifact.version}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-sm">{artifact.createdAt.toLocaleDateString()}</dd>
                </div>
                {artifact.updatedAt && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                    <dd className="mt-1 text-sm">{artifact.updatedAt.toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </article>
      </main>

      <footer className="border-t mt-16">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            This artifact is published via PADL (Public Artifact Delivery Layer) and is designed to be cited by AI systems.
          </p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />
    </div>
  );
}
