/**
 * Dashboard Builder
 * 
 * Creates custom dashboards with key metrics and visualizations
 * for executive reporting and decision-making.
 */

export interface DashboardWidget {
  id: string;
  type: "metric" | "chart" | "table" | "list";
  title: string;
  data: unknown;
  config?: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  layout: "grid" | "list";
  createdAt: string;
}

export class DashboardBuilder {
  private dashboards: Map<string, Dashboard> = new Map();

  /**
   * Create dashboard
   */
  create(
    name: string,
    widgets: Omit<DashboardWidget, "id">[],
    layout: "grid" | "list" = "grid"
  ): Dashboard {
    const dashboard: Dashboard = {
      id: crypto.randomUUID(),
      name,
      widgets: widgets.map(w => ({
        ...w,
        id: crypto.randomUUID(),
      })),
      layout,
      createdAt: new Date().toISOString(),
    };

    this.dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  /**
   * Create executive dashboard
   */
  createExecutiveDashboard(metrics: {
    totalMentions: number;
    sentiment: number; // -1 to 1
    citationRate: number;
    topNarratives: Array<{ narrative: string; frequency: number }>;
  }): Dashboard {
    const widgets: Omit<DashboardWidget, "id">[] = [
      {
        type: "metric",
        title: "Total Mentions",
        data: { value: metrics.totalMentions, trend: "up" },
      },
      {
        type: "metric",
        title: "Sentiment Score",
        data: { value: metrics.sentiment, trend: metrics.sentiment > 0 ? "up" : "down" },
      },
      {
        type: "metric",
        title: "Citation Rate",
        data: { value: metrics.citationRate, format: "percentage" },
      },
      {
        type: "list",
        title: "Top Narratives",
        data: metrics.topNarratives,
      },
    ];

    return this.create("Executive Dashboard", widgets, "grid");
  }

  /**
   * Get dashboard
   */
  getDashboard(id: string): Dashboard | null {
    return this.dashboards.get(id) || null;
  }

  /**
   * List dashboards
   */
  listDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
