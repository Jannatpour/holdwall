/**
 * PADL Public Artifact API
 * 
 * Serves published artifacts with signed integrity verification and version pinning.
 * Supports both brand-owned domains and default PADL domain.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { DomainPublisher } from "@/lib/publishing/domain-publisher";
import { logger } from "@/lib/logging/logger";

const domainPublisher = new DomainPublisher();

/**
 * GET /api/padl/[...slug]
 * Serve PADL artifact with integrity verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  let slug: string[] | undefined;
  let artifactId: string | undefined;
  try {
    const resolvedParams = await params;
    slug = resolvedParams.slug;
    const artifactPath = slug.join("/");
    
    // Extract artifact ID from path (e.g., /artifacts/{artifactId} or just {artifactId})
    artifactId = artifactPath.includes("/")
      ? artifactPath.split("/").pop() || artifactPath
      : artifactPath;

    // Get artifact from database
    const artifact = await db.aAALArtifact.findFirst({
      where: {
        id: artifactId,
        padlPublished: true,
      },
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found or not published" },
        { status: 404 }
      );
    }

    // Verify integrity hash if provided
    const providedHash = request.headers.get("x-padl-hash");
    if (providedHash && artifact.padlHash) {
      if (providedHash !== artifact.padlHash) {
        return NextResponse.json(
          { error: "Integrity hash mismatch" },
          { status: 400 }
        );
      }
    }

    // Generate HTML with schema markup
    const html = generateArtifactHTML(artifact, artifact.evidenceRefs.map(ref => ref.evidence));

    // Return with integrity headers
    const headers = new Headers();
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("X-PADL-Artifact-ID", artifact.id);
    headers.set("X-PADL-Version", artifact.version);
    if (artifact.padlHash) {
      headers.set("X-PADL-Hash", artifact.padlHash);
    }
    headers.set("X-PADL-Published-At", artifact.publishedAt?.toISOString() || artifact.createdAt.toISOString());
    headers.set("Cache-Control", "public, max-age=3600, immutable");

    return new NextResponse(html, {
      status: 200,
      headers,
    });
  } catch (error) {
    logger.error("Error serving PADL artifact", {
      artifactPath: slug ? slug.join("/") : "unknown",
      artifactId: artifactId || "unknown",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Generate HTML for artifact with schema markup
 */
function generateArtifactHTML(
  artifact: {
    title: string;
    content: string;
    padlUrl: string | null;
    padlHash: string | null;
    publishedAt: Date | null;
  },
  evidence: Array<{ sourceUrl: string | null }>
): string {
  const citations = evidence
    .filter(e => e.sourceUrl)
    .map(e => e.sourceUrl)
    .filter((url): url is string => url !== null);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${artifact.title}</title>
  <meta name="description" content="${artifact.content.substring(0, 200)}">
  ${artifact.padlHash ? `<meta name="padl-hash" content="${artifact.padlHash}">` : ""}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${artifact.title}",
    "datePublished": "${artifact.publishedAt?.toISOString() || new Date().toISOString()}",
    "author": {
      "@type": "Organization",
      "name": "Holdwall"
    }${citations.length > 0 ? `,
    "citation": ${JSON.stringify(citations)}` : ""}
  }
  </script>
</head>
<body>
  <article>
    <h1>${artifact.title}</h1>
    <div>${artifact.content}</div>
    ${citations.length > 0 ? `
    <section>
      <h2>Sources</h2>
      <ul>
        ${citations.map(url => `<li><a href="${url}" rel="nofollow">${url}</a></li>`).join("\n        ")}
      </ul>
    </section>
    ` : ""}
  </article>
</body>
</html>`;
}
