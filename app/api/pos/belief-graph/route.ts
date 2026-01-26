/**
 * POS: Belief Graph Engineering API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { EnhancedBeliefGraphEngineering } from "@/lib/pos/belief-graph-engineering";
import type { WeakNodeAnalysis } from "@/lib/pos/belief-graph-engineering";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const bge = new EnhancedBeliefGraphEngineering();

const bgePostSchema = z.object({
  nodeId: z.string().min(1),
  strategy: z.enum(["neutralize", "isolate", "decay"]).optional().default("neutralize"),
});

/**
 * Generate beautiful HTML page for weak nodes
 */
function generateWeakNodesHTML(weakNodes: WeakNodeAnalysis[], options: {
  minIrrelevance?: number;
  limit?: number;
}): string {
  const totalNodes = weakNodes.length;
  const avgIrrelevance = totalNodes > 0
    ? weakNodes.reduce((sum, n) => sum + n.structuralIrrelevance, 0) / totalNodes
    : 0;
  const avgTrustScore = totalNodes > 0
    ? weakNodes.reduce((sum, n) => sum + n.trustScore, 0) / totalNodes
    : 0;
  const highIrrelevance = weakNodes.filter(n => n.structuralIrrelevance >= 0.8).length;
  const criticalNodes = weakNodes.filter(n => n.isWeak && n.trustScore < -0.7).length;

  const getIrrelevanceColor = (score: number): string => {
    // Using Obsidian theme destructive/status colors
    if (score >= 0.8) return "#f87171"; // red-400 (high irrelevance)
    if (score >= 0.6) return "#fb923c"; // orange-400
    if (score >= 0.4) return "#fbbf24"; // amber-400
    return "#a3a3a3"; // neutral-400 (low irrelevance)
  };

  const getRecommendationColor = (rec: string): string => {
    // Using Obsidian theme colors
    switch (rec) {
      case "isolate": return "#64748b"; // slate-500 (muted)
      case "neutralize": return "#06b6d4"; // cyan-500 (primary accent)
      case "decay": return "#a78bfa"; // violet-400 (secondary)
      case "reinforce": return "#34d399"; // emerald-400 (positive)
      default: return "#64748b";
    }
  };

  const formatScore = (score: number): string => {
    return (score * 100).toFixed(1);
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weak Nodes Analysis - Belief Graph Engineering</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      background: #0f172a; /* Obsidian: near-black slate background */
      min-height: 100vh;
      padding: 2rem;
      color: #f8fafc; /* Obsidian: foreground */
      line-height: 1.6;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: #1e293b; /* Obsidian: deep charcoal card */
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      border: 1px solid #334155; /* Obsidian: border */
    }
    
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc; /* Obsidian: foreground */
      padding: 2.5rem;
      border-bottom: 3px solid #06b6d4; /* Electric cyan primary accent */
    }
    
    .header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    
    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
      font-weight: 300;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      padding: 2rem;
      background: #1e293b; /* Obsidian: card background */
      border-bottom: 1px solid #334155; /* Obsidian: border */
    }
    
    .stat-card {
      background: #0f172a; /* Obsidian: background (darker card) */
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border-left: 4px solid #06b6d4; /* Electric cyan primary */
      border: 1px solid #334155; /* Obsidian: border */
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
      border-color: #06b6d4;
    }
    
    .stat-label {
      font-size: 0.875rem;
      color: #94a3b8; /* Obsidian: muted-foreground */
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #f8fafc; /* Obsidian: foreground */
    }
    
    .content {
      padding: 2rem;
    }
    
    .section-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f8fafc; /* Obsidian: foreground */
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #334155; /* Obsidian: border */
    }
    
    .table-container {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid #334155; /* Obsidian: border */
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: #1e293b; /* Obsidian: card background */
    }
    
    thead {
      background: #0f172a; /* Obsidian: background (darker) */
      border-bottom: 2px solid #334155;
    }
    
    th {
      padding: 1rem 1.5rem;
      text-align: left;
      font-weight: 600;
      color: #94a3b8; /* Obsidian: muted-foreground */
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #334155;
    }
    
    td {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #334155;
      color: #f8fafc; /* Obsidian: foreground */
    }
    
    tr:hover {
      background: #0f172a; /* Obsidian: background on hover */
    }
    
    .node-id {
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 0.875rem;
      color: #06b6d4; /* Electric cyan primary */
      font-weight: 500;
    }
    
    .score-badge {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      color: white;
    }
    
    .recommendation-badge {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: white;
    }
    
    .edge-counts {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .edge-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      background: #334155; /* Obsidian: muted */
      color: #94a3b8; /* Obsidian: muted-foreground */
    }
    
    .edge-badge.reinforce {
      background: rgba(6, 182, 212, 0.2); /* Cyan with opacity */
      color: #06b6d4; /* Electric cyan */
      border: 1px solid rgba(6, 182, 212, 0.3);
    }
    
    .edge-badge.neutralize {
      background: rgba(167, 139, 250, 0.2); /* Violet with opacity */
      color: #a78bfa; /* Muted violet */
      border: 1px solid rgba(167, 139, 250, 0.3);
    }
    
    .edge-badge.decay {
      background: rgba(248, 113, 113, 0.2); /* Red with opacity */
      color: #f87171; /* Destructive red */
      border: 1px solid rgba(248, 113, 113, 0.3);
    }
    
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #94a3b8; /* Obsidian: muted-foreground */
    }
    
    .empty-state svg {
      width: 64px;
      height: 64px;
      margin: 0 auto 1rem;
      opacity: 0.5;
    }
    
    .footer {
      padding: 1.5rem 2rem;
      background: #0f172a; /* Obsidian: background */
      border-top: 1px solid #334155; /* Obsidian: border */
      text-align: center;
      color: #94a3b8; /* Obsidian: muted-foreground */
      font-size: 0.875rem;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }
      
      .header h1 {
        font-size: 1.75rem;
      }
      
      .stats-grid {
        grid-template-columns: 1fr;
        padding: 1rem;
      }
      
      th, td {
        padding: 0.75rem;
        font-size: 0.875rem;
      }
      
      .table-container {
        font-size: 0.875rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 Weak Nodes Analysis</h1>
      <p>Belief Graph Engineering - Structural Irrelevance Detection</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Weak Nodes</div>
        <div class="stat-value">${totalNodes}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Irrelevance</div>
        <div class="stat-value">${formatScore(avgIrrelevance)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Trust Score</div>
        <div class="stat-value">${avgTrustScore.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">High Irrelevance (≥80%)</div>
        <div class="stat-value">${highIrrelevance}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Critical Nodes</div>
        <div class="stat-value">${criticalNodes}</div>
      </div>
    </div>
    
    <div class="content">
      <h2 class="section-title">Weak Node Details</h2>
      ${totalNodes === 0 ? `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p>No weak nodes found matching the criteria.</p>
          ${options.minIrrelevance ? `<p style="margin-top: 0.5rem; font-size: 0.875rem;">Minimum irrelevance filter: ${formatScore(options.minIrrelevance)}%</p>` : ""}
        </div>
      ` : `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Node ID</th>
                <th>Irrelevance</th>
                <th>Trust Score</th>
                <th>Decisiveness</th>
                <th>Edges</th>
                <th>Recommendation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${weakNodes.map(node => `
                <tr>
                  <td><span class="node-id">${node.nodeId.substring(0, 8)}...</span></td>
                  <td>
                    <span class="score-badge" style="background-color: ${getIrrelevanceColor(node.structuralIrrelevance)}">
                      ${formatScore(node.structuralIrrelevance)}%
                    </span>
                  </td>
                  <td>${node.trustScore.toFixed(3)}</td>
                  <td>${formatScore(node.decisiveness)}%</td>
                  <td>
                    <div class="edge-counts">
                      ${node.reinforcingEdges > 0 ? `<span class="edge-badge reinforce">+${node.reinforcingEdges}</span>` : ""}
                      ${node.neutralizationEdges > 0 ? `<span class="edge-badge neutralize">~${node.neutralizationEdges}</span>` : ""}
                      ${node.decayEdges > 0 ? `<span class="edge-badge decay">-${node.decayEdges}</span>` : ""}
                      ${node.reinforcingEdges === 0 && node.neutralizationEdges === 0 && node.decayEdges === 0 ? `<span class="edge-badge">None</span>` : ""}
                    </div>
                  </td>
                  <td>
                    <span class="recommendation-badge" style="background-color: ${getRecommendationColor(node.recommendation)}">
                      ${node.recommendation}
                    </span>
                  </td>
                  <td>
                    ${node.isWeak ? '<span style="color: #f87171; font-weight: 600;">⚠️ Weak</span>' : '<span style="color: #34d399; font-weight: 600;">✓ Stable</span>'}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
    
    <div class="footer">
      <p>Generated at ${new Date().toLocaleString()} • Belief Graph Engineering System</p>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("nodeId");
    const action = searchParams.get("action");
    const format = searchParams.get("format");
    const acceptHeader = request.headers.get("accept") || "";

    // Check if HTML is requested (browser request or explicit format=html)
    const wantsHTML = format === "html" || (!format && acceptHeader.includes("text/html"));

    if (action === "analyze" && nodeId) {
      const analysis = await bge.analyzeStructuralIrrelevance(tenantId, nodeId);
      return NextResponse.json({ analysis });
    }

    if (action === "find-weak" && !nodeId) {
      const minIrrelevance = searchParams.get("minIrrelevance")
        ? parseFloat(searchParams.get("minIrrelevance")!)
        : undefined;
      const limit = searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!)
        : undefined;

      const weakNodes = await bge.findWeakNodes(tenantId, {
        minIrrelevance,
        limit,
      });

      // Return HTML for browser requests, JSON for API calls
      if (wantsHTML) {
        const html = generateWeakNodesHTML(weakNodes, { minIrrelevance, limit });
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      }

      return NextResponse.json({ weakNodes });
    }

    if (action === "narrative-activation" && nodeId) {
      const activation = await bge.analyzeNarrativeActivation(tenantId, nodeId);
      return NextResponse.json({ activation });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("BGE API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = bgePostSchema.parse(body);

    const edgeIds = await bge.makeStructurallyIrrelevant(
      tenantId,
      validated.nodeId,
      validated.strategy
    );

    return NextResponse.json({ success: true, edgeIds });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("BGE API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
