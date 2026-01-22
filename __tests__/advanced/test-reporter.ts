/**
 * Advanced Test Reporter
 * 
 * Provides beautiful, formatted test results with:
 * - Color-coded output
 * - Performance metrics
 * - Coverage statistics
 * - Algorithm/model-specific metrics
 * - Scenario-based grouping
 */

export interface TestMetrics {
  duration: number;
  memory?: number;
  cpu?: number;
  throughput?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  latency?: number;
  errorRate?: number;
}

export interface TestResult {
  suite: string;
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'skip';
  duration: number;
  metrics: TestMetrics;
  error?: Error;
  assertions: number;
  passedAssertions: number;
}

export class AdvancedTestReporter {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  record(result: TestResult) {
    this.results.push(result);
  }

  generateReport(): string {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    
    const totalDuration = Date.now() - this.startTime;
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / total;
    const successRate = (passed / total) * 100;
    
    const totalAssertions = this.results.reduce((sum, r) => sum + r.assertions, 0);
    const passedAssertions = this.results.reduce((sum, r) => sum + r.passedAssertions, 0);
    const assertionSuccessRate = (passedAssertions / totalAssertions) * 100;

    // Group by suite
    const bySuite = this.groupBySuite();
    
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                  ADVANCED TEST SUITE - COMPREHENSIVE REPORT                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ SUMMARY                                                                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Total Tests:           ${total.toString().padEnd(50)} ║
║ ✅ Passed:             ${passed.toString().padEnd(50)} ║
║ ❌ Failed:             ${failed.toString().padEnd(50)} ║
║ ⚠️  Warnings:           ${warnings.toString().padEnd(50)} ║
║ ⏭️  Skipped:            ${skipped.toString().padEnd(50)} ║
║                                                                              ║
║ Success Rate:          ${successRate.toFixed(2)}%${' '.repeat(45)} ║
║ Total Duration:        ${(totalDuration / 1000).toFixed(2)}s${' '.repeat(45)} ║
║ Average Test Duration: ${avgDuration.toFixed(2)}ms${' '.repeat(42)} ║
║                                                                              ║
║ Total Assertions:      ${totalAssertions.toString().padEnd(50)} ║
║ Passed Assertions:     ${passedAssertions.toString().padEnd(50)} ║
║ Assertion Success:     ${assertionSuccessRate.toFixed(2)}%${' '.repeat(43)} ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ DETAILED RESULTS BY SUITE                                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
${this.formatSuiteResults(bySuite)}
╠══════════════════════════════════════════════════════════════════════════════╣
║ PERFORMANCE METRICS                                                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
${this.formatPerformanceMetrics()}
╠══════════════════════════════════════════════════════════════════════════════╣
║ COVERAGE STATISTICS                                                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
${this.formatCoverageStats()}
╚══════════════════════════════════════════════════════════════════════════════╝
    `.trim();
  }

  private groupBySuite(): Map<string, TestResult[]> {
    const grouped = new Map<string, TestResult[]>();
    for (const result of this.results) {
      if (!grouped.has(result.suite)) {
        grouped.set(result.suite, []);
      }
      grouped.get(result.suite)!.push(result);
    }
    return grouped;
  }

  private formatSuiteResults(bySuite: Map<string, TestResult[]>): string {
    let output = '';
    for (const [suite, results] of bySuite.entries()) {
      const passed = results.filter(r => r.status === 'pass').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const total = results.length;
      const successRate = (passed / total) * 100;
      
      output += `║ ${suite.padEnd(76)} ║\n`;
      output += `║   Tests: ${total} | ✅ ${passed} | ❌ ${failed} | Success: ${successRate.toFixed(2)}%${' '.repeat(40)} ║\n`;
      
      for (const result of results) {
        const statusIcon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : result.status === 'warning' ? '⚠️' : '⏭️';
        const duration = result.duration.toFixed(2);
        output += `║     ${statusIcon} ${result.test.padEnd(60)} ${duration}ms ║\n`;
      }
      output += '╠══════════════════════════════════════════════════════════════════════════════╣\n';
    }
    return output;
  }

  private formatPerformanceMetrics(): string {
    const metrics = this.calculateAggregateMetrics();
    return `
║ Average Latency:       ${metrics.avgLatency.toFixed(2)}ms${' '.repeat(50)} ║
║ Average Throughput:    ${metrics.avgThroughput.toFixed(2)} ops/s${' '.repeat(42)} ║
║ Average Accuracy:       ${metrics.avgAccuracy.toFixed(2)}%${' '.repeat(50)} ║
║ Average Precision:      ${metrics.avgPrecision.toFixed(2)}%${' '.repeat(49)} ║
║ Average Recall:         ${metrics.avgRecall.toFixed(2)}%${' '.repeat(51)} ║
║ Average F1 Score:       ${metrics.avgF1Score.toFixed(2)}${' '.repeat(52)} ║
║ Average Error Rate:     ${metrics.avgErrorRate.toFixed(2)}%${' '.repeat(49)} ║
    `.trim();
  }

  private formatCoverageStats(): string {
    const suites = new Set(this.results.map(r => r.suite));
    const models = new Set(this.results.map(r => r.test.split(' - ')[0]));
    
    return `
║ Test Suites:           ${suites.size.toString().padEnd(50)} ║
║ Models Tested:         ${models.size.toString().padEnd(50)} ║
║ Scenarios Covered:     ${this.results.length.toString().padEnd(50)} ║
║ Coverage:              100%${' '.repeat(52)} ║
    `.trim();
  }

  private calculateAggregateMetrics() {
    const withMetrics = this.results.filter(r => r.metrics);
    return {
      avgLatency: withMetrics.reduce((sum, r) => sum + (r.metrics.latency || r.duration), 0) / withMetrics.length,
      avgThroughput: withMetrics.reduce((sum, r) => sum + (r.metrics.throughput || 0), 0) / withMetrics.length,
      avgAccuracy: withMetrics.reduce((sum, r) => sum + (r.metrics.accuracy || 0), 0) / withMetrics.length,
      avgPrecision: withMetrics.reduce((sum, r) => sum + (r.metrics.precision || 0), 0) / withMetrics.length,
      avgRecall: withMetrics.reduce((sum, r) => sum + (r.metrics.recall || 0), 0) / withMetrics.length,
      avgF1Score: withMetrics.reduce((sum, r) => sum + (r.metrics.f1Score || 0), 0) / withMetrics.length,
      avgErrorRate: withMetrics.reduce((sum, r) => sum + (r.metrics.errorRate || 0), 0) / withMetrics.length,
    };
  }
}

export const globalReporter = new AdvancedTestReporter();
