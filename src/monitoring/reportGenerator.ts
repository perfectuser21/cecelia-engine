/**
 * Report Generator Module
 * Generates baseline reports in various formats
 */

import { TrafficMetrics } from './trafficMonitor';
import { Baseline, AnomalyDetection } from './baselineCalculator';

export type ReportFormat = 'json' | 'markdown' | 'html' | 'csv';

export interface Report {
  id: string;
  generatedAt: Date;
  period: string;
  baseline: Baseline;
  currentMetrics?: TrafficMetrics;
  anomalies?: AnomalyDetection;
  format: ReportFormat;
  content: string;
}

export interface ReportOptions {
  includeCharts?: boolean;
  includeRecommendations?: boolean;
  compareWithPreviousPeriod?: boolean;
  customTitle?: string;
}

export class ReportGenerator {
  /**
   * Generate a baseline report
   */
  generateReport(
    baseline: Baseline,
    format: ReportFormat,
    options: ReportOptions = {},
    currentMetrics?: TrafficMetrics,
    anomalies?: AnomalyDetection
  ): Report {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const generatedAt = new Date();

    let content: string;
    switch (format) {
      case 'json':
        content = this.generateJsonReport(baseline, currentMetrics, anomalies, options);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(baseline, currentMetrics, anomalies, options);
        break;
      case 'html':
        content = this.generateHtmlReport(baseline, currentMetrics, anomalies, options);
        break;
      case 'csv':
        content = this.generateCsvReport(baseline, currentMetrics, anomalies, options);
        break;
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }

    return {
      id: reportId,
      generatedAt,
      period: baseline.period,
      baseline,
      currentMetrics,
      anomalies,
      format,
      content
    };
  }

  /**
   * Generate JSON format report
   */
  private generateJsonReport(
    baseline: Baseline,
    currentMetrics?: TrafficMetrics,
    anomalies?: AnomalyDetection,
    options?: ReportOptions
  ): string {
    const report = {
      title: options?.customTitle || 'Platform Traffic Monitoring Report',
      generatedAt: new Date().toISOString(),
      period: baseline.period,
      baseline: {
        startDate: baseline.startDate.toISOString(),
        endDate: baseline.endDate.toISOString(),
        metrics: baseline.metrics,
        thresholds: baseline.deviationThresholds
      },
      ...(currentMetrics && { currentMetrics }),
      ...(anomalies && { anomalies: anomalies.anomalies }),
      ...(options?.includeRecommendations && {
        recommendations: this.generateRecommendations(anomalies)
      })
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate Markdown format report
   */
  private generateMarkdownReport(
    baseline: Baseline,
    currentMetrics?: TrafficMetrics,
    anomalies?: AnomalyDetection,
    options?: ReportOptions
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${options?.customTitle || 'Platform Traffic Monitoring Report'}`);
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Period:** ${baseline.period}`);
    lines.push(`**Date Range:** ${baseline.startDate.toISOString()} - ${baseline.endDate.toISOString()}`);
    lines.push('');

    // Baseline Metrics
    lines.push('## Baseline Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| ------ | ----- |');
    lines.push(`| Average Requests/min | ${baseline.metrics.avgRequestsPerMinute.toFixed(2)} |`);
    lines.push(`| Average Response Time | ${baseline.metrics.avgResponseTime.toFixed(2)}ms |`);
    lines.push(`| Normal Error Rate | ${baseline.metrics.normalErrorRate.toFixed(2)}% |`);
    lines.push(`| Peak Hour Requests | ${baseline.metrics.peakHourRequests.toFixed(0)} |`);
    lines.push(`| Off-Peak Requests | ${baseline.metrics.offPeakRequests.toFixed(0)} |`);
    lines.push(`| 95th Percentile Response | ${baseline.metrics.percentile95ResponseTime.toFixed(2)}ms |`);
    lines.push(`| 99th Percentile Response | ${baseline.metrics.percentile99ResponseTime.toFixed(2)}ms |`);
    lines.push('');

    // Thresholds
    lines.push('## Deviation Thresholds');
    lines.push('');
    lines.push('### Traffic Volume');
    lines.push(`- **Min:** ${baseline.deviationThresholds.requestsPerMinute.min.toFixed(2)} rpm`);
    lines.push(`- **Max:** ${baseline.deviationThresholds.requestsPerMinute.max.toFixed(2)} rpm`);
    lines.push('');
    lines.push('### Response Time');
    lines.push(`- **Warning:** ${baseline.deviationThresholds.responseTime.warning.toFixed(2)}ms`);
    lines.push(`- **Critical:** ${baseline.deviationThresholds.responseTime.critical.toFixed(2)}ms`);
    lines.push('');
    lines.push('### Error Rate');
    lines.push(`- **Warning:** ${baseline.deviationThresholds.errorRate.warning.toFixed(2)}%`);
    lines.push(`- **Critical:** ${baseline.deviationThresholds.errorRate.critical.toFixed(2)}%`);
    lines.push('');

    // Current Metrics
    if (currentMetrics) {
      lines.push('## Current Metrics');
      lines.push('');
      lines.push('| Metric | Value |');
      lines.push('| ------ | ----- |');
      lines.push(`| Total Requests | ${currentMetrics.totalRequests} |`);
      lines.push(`| Requests/min | ${currentMetrics.requestsPerMinute.toFixed(2)} |`);
      lines.push(`| Average Response Time | ${currentMetrics.averageResponseTime.toFixed(2)}ms |`);
      lines.push(`| Error Rate | ${currentMetrics.errorRate.toFixed(2)}% |`);
      lines.push(`| Unique IPs | ${currentMetrics.uniqueIPs} |`);
      lines.push('');

      if (currentMetrics.topEndpoints.length > 0) {
        lines.push('### Top Endpoints');
        lines.push('');
        lines.push('| Endpoint | Requests |');
        lines.push('| -------- | -------- |');
        currentMetrics.topEndpoints.forEach(ep => {
          lines.push(`| ${ep.endpoint} | ${ep.count} |`);
        });
        lines.push('');
      }
    }

    // Anomalies
    if (anomalies && anomalies.hasAnomaly) {
      lines.push('## Anomalies Detected');
      lines.push('');
      anomalies.anomalies.forEach(anomaly => {
        const icon = anomaly.severity === 'critical' ? '🔴' : '⚠️';
        lines.push(`- ${icon} **${anomaly.type}** (${anomaly.severity}): ${anomaly.message}`);
      });
      lines.push('');
    }

    // Recommendations
    if (options?.includeRecommendations) {
      const recommendations = this.generateRecommendations(anomalies);
      if (recommendations.length > 0) {
        lines.push('## Recommendations');
        lines.push('');
        recommendations.forEach(rec => {
          lines.push(`- ${rec}`);
        });
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate HTML format report
   */
  private generateHtmlReport(
    baseline: Baseline,
    currentMetrics?: TrafficMetrics,
    anomalies?: AnomalyDetection,
    options?: ReportOptions
  ): string {
    const markdown = this.generateMarkdownReport(baseline, currentMetrics, anomalies, options);

    // Simple markdown to HTML conversion (in production, use a proper markdown parser)
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${options?.customTitle || 'Platform Traffic Monitoring Report'}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    h1 { color: #333; }
    h2 { color: #555; border-bottom: 2px solid #eee; padding-bottom: 5px; }
    h3 { color: #777; }
    .warning { color: #ff9800; }
    .critical { color: #f44336; }
  </style>
</head>
<body>
  <div class="content">`;

    // Convert markdown to HTML (simplified)
    const lines = markdown.split('\n');
    lines.forEach(line => {
      if (line.startsWith('# ')) {
        html += `<h1>${line.substring(2)}</h1>`;
      } else if (line.startsWith('## ')) {
        html += `<h2>${line.substring(3)}</h2>`;
      } else if (line.startsWith('### ')) {
        html += `<h3>${line.substring(4)}</h3>`;
      } else if (line.startsWith('- ')) {
        html += `<li>${line.substring(2)}</li>`;
      } else if (line.startsWith('| ')) {
        // Handle table rows (simplified)
        const cells = line.split('|').filter(cell => cell.trim());
        if (cells[0].includes('---')) {
          // Skip separator rows
        } else {
          html += '<tr>';
          cells.forEach(cell => {
            html += `<td>${cell.trim()}</td>`;
          });
          html += '</tr>';
        }
      } else if (line.trim() === '') {
        html += '<br>';
      } else {
        html += `<p>${line}</p>`;
      }
    });

    html += `
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate CSV format report
   */
  private generateCsvReport(
    baseline: Baseline,
    currentMetrics?: TrafficMetrics,
    anomalies?: AnomalyDetection,
    options?: ReportOptions
  ): string {
    const rows: string[] = [];

    // Header
    rows.push('Category,Metric,Value,Unit');

    // Baseline metrics
    rows.push(`Baseline,Average Requests per Minute,${baseline.metrics.avgRequestsPerMinute.toFixed(2)},rpm`);
    rows.push(`Baseline,Average Response Time,${baseline.metrics.avgResponseTime.toFixed(2)},ms`);
    rows.push(`Baseline,Normal Error Rate,${baseline.metrics.normalErrorRate.toFixed(2)},%`);
    rows.push(`Baseline,Peak Hour Requests,${baseline.metrics.peakHourRequests.toFixed(0)},requests`);
    rows.push(`Baseline,Off-Peak Requests,${baseline.metrics.offPeakRequests.toFixed(0)},requests`);
    rows.push(`Baseline,95th Percentile Response,${baseline.metrics.percentile95ResponseTime.toFixed(2)},ms`);
    rows.push(`Baseline,99th Percentile Response,${baseline.metrics.percentile99ResponseTime.toFixed(2)},ms`);

    // Thresholds
    rows.push(`Threshold,Min Requests per Minute,${baseline.deviationThresholds.requestsPerMinute.min.toFixed(2)},rpm`);
    rows.push(`Threshold,Max Requests per Minute,${baseline.deviationThresholds.requestsPerMinute.max.toFixed(2)},rpm`);
    rows.push(`Threshold,Response Time Warning,${baseline.deviationThresholds.responseTime.warning.toFixed(2)},ms`);
    rows.push(`Threshold,Response Time Critical,${baseline.deviationThresholds.responseTime.critical.toFixed(2)},ms`);
    rows.push(`Threshold,Error Rate Warning,${baseline.deviationThresholds.errorRate.warning.toFixed(2)},%`);
    rows.push(`Threshold,Error Rate Critical,${baseline.deviationThresholds.errorRate.critical.toFixed(2)},%`);

    // Current metrics
    if (currentMetrics) {
      rows.push(`Current,Total Requests,${currentMetrics.totalRequests},requests`);
      rows.push(`Current,Requests per Minute,${currentMetrics.requestsPerMinute.toFixed(2)},rpm`);
      rows.push(`Current,Average Response Time,${currentMetrics.averageResponseTime.toFixed(2)},ms`);
      rows.push(`Current,Error Rate,${currentMetrics.errorRate.toFixed(2)},%`);
      rows.push(`Current,Unique IPs,${currentMetrics.uniqueIPs},count`);
    }

    // Anomalies
    if (anomalies && anomalies.hasAnomaly) {
      anomalies.anomalies.forEach((anomaly, index) => {
        rows.push(`Anomaly-${index + 1},Type,${anomaly.type},`);
        rows.push(`Anomaly-${index + 1},Severity,${anomaly.severity},`);
        rows.push(`Anomaly-${index + 1},Value,${anomaly.value.toFixed(2)},`);
        rows.push(`Anomaly-${index + 1},Threshold,${anomaly.threshold.toFixed(2)},`);
      });
    }

    return rows.join('\n');
  }

  /**
   * Generate recommendations based on anomalies
   */
  private generateRecommendations(anomalies?: AnomalyDetection): string[] {
    const recommendations: string[] = [];

    if (!anomalies || !anomalies.hasAnomaly) {
      recommendations.push('System is operating within normal parameters.');
      return recommendations;
    }

    anomalies.anomalies.forEach(anomaly => {
      switch (anomaly.type) {
        case 'traffic':
          if (anomaly.severity === 'critical') {
            recommendations.push('Investigate traffic spike - possible DDoS attack or viral event.');
            recommendations.push('Consider scaling resources if spike is legitimate.');
          } else {
            recommendations.push('Monitor traffic patterns for sustained changes.');
          }
          break;

        case 'response_time':
          if (anomaly.severity === 'critical') {
            recommendations.push('Critical response time degradation - check database performance.');
            recommendations.push('Review recent deployments for performance regressions.');
            recommendations.push('Consider implementing caching strategies.');
          } else {
            recommendations.push('Response times elevated - monitor for further degradation.');
          }
          break;

        case 'error_rate':
          if (anomaly.severity === 'critical') {
            recommendations.push('Critical error rate - immediate investigation required.');
            recommendations.push('Check application logs for stack traces.');
            recommendations.push('Review recent deployments for bugs.');
          } else {
            recommendations.push('Error rate above normal - investigate error logs.');
          }
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Export report to file
   */
  async exportToFile(report: Report, filepath: string): Promise<void> {
    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(filepath, report.content, 'utf-8');
  }
}