/**
 * GitHub Connector
 * Ingests issues, PRs, and repository content from GitHub
 */

import type { ConnectorExecutor, ConnectorConfig, ConnectorResult } from "./base";
import type { Signal } from "@/lib/signals/ingestion";

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
  };
  html_url: string;
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
  };
  html_url: string;
  merged_at: string | null;
}

export class GitHubConnector implements ConnectorExecutor {
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GITHUB_TOKEN || null;
  }

  async sync(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<ConnectorResult> {
    if (!this.apiKey) {
      throw new Error("GitHub API key is required. Set GITHUB_TOKEN or provide apiKeyId.");
    }

    const owner = config.owner as string;
    const repo = config.repo as string;
    const resourceTypes = (config.resourceTypes as string[]) || ["issues", "pull_requests"];

    if (!owner || !repo) {
      throw new Error("GitHub owner and repo are required");
    }

    const tenantId = config.tenantId as string;
    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    const signals: Signal[] = [];
    const cursorDate = cursor ? new Date(cursor) : null;
    let latestDate = cursorDate || new Date(0);

    // Fetch issues
    if (resourceTypes.includes("issues")) {
      const issues = await this.fetchIssues(owner, repo, cursorDate);
      for (const issue of issues) {
        const issueDate = new Date(issue.updated_at);
        if (issueDate > latestDate) {
          latestDate = issueDate;
        }

        signals.push({
          signal_id: crypto.randomUUID(),
          tenant_id: tenantId,
          source: {
            type: "github",
            id: `issue-${issue.id}`,
            url: issue.html_url,
          },
          content: {
            raw: issue.body || "",
            normalized: this.normalizeContent(issue.body || ""),
          },
          metadata: {
            author: issue.user.login,
            timestamp: issue.updated_at,
            title: issue.title,
            state: issue.state,
            number: issue.number,
            resourceType: "issue",
          },
          compliance: {
            source_allowed: true,
            collection_method: "api",
            retention_policy: config.retentionPolicy as string || "90 days",
          },
          created_at: new Date().toISOString(),
        });
      }
    }

    // Fetch pull requests
    if (resourceTypes.includes("pull_requests")) {
      const prs = await this.fetchPullRequests(owner, repo, cursorDate);
      for (const pr of prs) {
        const prDate = new Date(pr.updated_at);
        if (prDate > latestDate) {
          latestDate = prDate;
        }

        signals.push({
          signal_id: crypto.randomUUID(),
          tenant_id: tenantId,
          source: {
            type: "github",
            id: `pr-${pr.id}`,
            url: pr.html_url,
          },
          content: {
            raw: pr.body || "",
            normalized: this.normalizeContent(pr.body || ""),
          },
          metadata: {
            author: pr.user.login,
            timestamp: pr.updated_at,
            title: pr.title,
            state: pr.state,
            number: pr.number,
            merged: !!pr.merged_at,
            resourceType: "pull_request",
          },
          compliance: {
            source_allowed: true,
            collection_method: "api",
            retention_policy: config.retentionPolicy as string || "90 days",
          },
          created_at: new Date().toISOString(),
        });
      }
    }

    return {
      signals,
      cursor: latestDate.toISOString(),
      metadata: {
        owner,
        repo,
        resourceTypes,
        itemsProcessed: signals.length,
      },
    };
  }

  async validate(config: ConnectorConfig): Promise<{ valid: boolean; error?: string }> {
    if (!config.owner) {
      return { valid: false, error: "GitHub owner is required" };
    }
    if (!config.repo) {
      return { valid: false, error: "GitHub repo is required" };
    }
    if (!this.apiKey) {
      return { valid: false, error: "GitHub API key is required" };
    }
    return { valid: true };
  }

  async test(config: ConnectorConfig): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}`,
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Holdwall-GitHub-Connector/1.0",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        return { success: false, error: `GitHub API error: ${error.message || response.statusText}` };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch issues from GitHub API
   */
  private async fetchIssues(
    owner: string,
    repo: string,
    since?: Date | null
  ): Promise<GitHubIssue[]> {
    const issues: GitHubIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
      url.searchParams.set("state", "all");
      url.searchParams.set("per_page", perPage.toString());
      url.searchParams.set("page", page.toString());
      if (since) {
        url.searchParams.set("since", since.toISOString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Holdwall-GitHub-Connector/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data: GitHubIssue[] = await response.json();
      if (data.length === 0) {
        break;
      }

      // Filter out PRs (they have pull_request field)
      const actualIssues = data.filter((item: any) => !item.pull_request);
      issues.push(...actualIssues);

      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return issues;
  }

  /**
   * Fetch pull requests from GitHub API
   */
  private async fetchPullRequests(
    owner: string,
    repo: string,
    since?: Date | null
  ): Promise<GitHubPR[]> {
    const prs: GitHubPR[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
      url.searchParams.set("state", "all");
      url.searchParams.set("per_page", perPage.toString());
      url.searchParams.set("page", page.toString());
      if (since) {
        url.searchParams.set("since", since.toISOString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Holdwall-GitHub-Connector/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data: GitHubPR[] = await response.json();
      if (data.length === 0) {
        break;
      }

      prs.push(...data);

      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return prs;
  }

  /**
   * Normalize content
   */
  private normalizeContent(content: string): string {
    return content
      .replace(/<[^>]*>/g, "")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Markdown links
      .replace(/#{1,6}\s+/g, "") // Headers
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
      .replace(/\*([^*]+)\*/g, "$1") // Italic
      .replace(/`([^`]+)`/g, "$1") // Code
      .replace(/\s+/g, " ")
      .trim();
  }
}
