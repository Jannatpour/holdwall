/**
 * Metrics Tests
 */

import { MetricsCollector } from "@/lib/observability/metrics";

describe("MetricsCollector", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  afterEach(() => {
    metrics.reset();
  });

  it("should increment counters", () => {
    metrics.increment("test_counter");
    metrics.increment("test_counter");
    const summary = metrics.getSummary();
    expect(summary.counters["test_counter"]).toBe(2);
  });

  it("should set gauge values", () => {
    metrics.setGauge("test_gauge", 42);
    const summary = metrics.getSummary();
    expect(summary.gauges["test_gauge"]).toBe(42);
  });

  it("should observe histogram values", () => {
    metrics.observe("test_histogram", 10);
    metrics.observe("test_histogram", 20);
    metrics.observe("test_histogram", 30);
    const summary = metrics.getSummary();
    expect(summary.histograms["test_histogram"].count).toBe(3);
    expect(summary.histograms["test_histogram"].avg).toBe(20);
  });

  it("should generate Prometheus format", () => {
    metrics.increment("test_counter");
    metrics.setGauge("test_gauge", 42);
    const prometheus = metrics.getPrometheusFormat();
    expect(prometheus).toContain("test_counter_total");
    expect(prometheus).toContain("test_gauge");
  });
});
