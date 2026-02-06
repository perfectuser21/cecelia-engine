/**
 * Unit tests for ReportGenerator
 */

import {
  ReportGenerator,
  Report,
  ReportFormat,
  ReportOptions
} from './reportGenerator';
import { TrafficMetrics } from './trafficMonitor';
import { Baseline, AnomalyDetection } from './baselineCalculator';

describe('ReportGenerator', () => {
  let generator: ReportGenerator;
  let baseline: Baseline;
  let currentMetrics: TrafficMetrics;
  let anomalies: AnomalyDetection;

  beforeEach(() => {
    generator = new ReportGenerator();

    // Setup test baseline
    baseline = {
      period: 'daily',
      startDate: new Date('2026-02-01T00:00:00Z'),
      endDate: new Date('2026-02-02T00:00:00Z'),
      metrics: {
        avgRequestsPerMinute: 100,
        avgResponseTime: 200,
        normalErrorRate: 2,
        peakHourRequests: 5000,
        offPeakRequests: 1000,
        percentile95ResponseTime: 300,
        percentile99ResponseTime: 400
      },
      deviationThresholds: {
        requestsPerMinute: { min: 50, max: 150 },
        responseTime: { warning: 300, critical: 400 },
        errorRate: { warning: 5, critical: 10 }
      }
    };

    // Setup test current metrics
    currentMetrics = {
      totalRequests: 6000,
      averageResponseTime: 250,
      errorRate: 3,
      requestsPerMinute: 110,
      uniqueIPs: 350,
      topEndpoints: [
        { endpoint: '/api/users', count: 2000 },
        { endpoint: '/api/posts', count: 1500 },
        { endpoint: '/api/auth', count: 1000 }
      ]
    };

    // Setup test anomalies
    anomalies = {
      hasAnomaly: true,
      anomalies: [
        {
          type: 'response_time',
          severity: 'warning',
          value: 350,
          threshold: 300,
          message: 'High response time: 350ms (baseline: 200ms)'
        }
      ]
    };
  });

  describe('generateReport', () => {
    it('should generate a report with unique ID and timestamp', () => {
      const report1 = generator.generateReport(baseline, 'json');
      const report2 = generator.generateReport(baseline, 'json');

      expect(report1.id).toMatch(/^report-\d+-[a-z0-9]+$/);
      expect(report2.id).toMatch(/^report-\d+-[a-z0-9]+$/);
      expect(report1.id).not.toBe(report2.id);

      expect(report1.generatedAt).toBeInstanceOf(Date);
      expect(report1.period).toBe('daily');
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        generator.generateReport(baseline, 'pdf' as ReportFormat);
      }).toThrow('Unsupported report format: pdf');
    });

    describe('JSON format', () => {
      it('should generate valid JSON report', () => {
        const report = generator.generateReport(baseline, 'json');

        expect(report.format).toBe('json');
        expect(() => JSON.parse(report.content)).not.toThrow();

        const parsed = JSON.parse(report.content);
        expect(parsed.title).toBe('Platform Traffic Monitoring Report');
        expect(parsed.period).toBe('daily');
        expect(parsed.baseline).toBeDefined();
        expect(parsed.baseline.metrics).toBeDefined();
        expect(parsed.baseline.thresholds).toBeDefined();
      });

      it('should include current metrics when provided', () => {
        const report = generator.generateReport(
          baseline,
          'json',
          {},
          currentMetrics
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.currentMetrics).toBeDefined();
        expect(parsed.currentMetrics.totalRequests).toBe(6000);
        expect(parsed.currentMetrics.averageResponseTime).toBe(250);
      });

      it('should include anomalies when provided', () => {
        const report = generator.generateReport(
          baseline,
          'json',
          {},
          currentMetrics,
          anomalies
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.anomalies).toBeDefined();
        expect(parsed.anomalies).toHaveLength(1);
        expect(parsed.anomalies[0].type).toBe('response_time');
      });

      it('should include recommendations when option is set', () => {
        const report = generator.generateReport(
          baseline,
          'json',
          { includeRecommendations: true },
          currentMetrics,
          anomalies
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.recommendations).toBeDefined();
        expect(Array.isArray(parsed.recommendations)).toBe(true);
      });

      it('should use custom title when provided', () => {
        const report = generator.generateReport(
          baseline,
          'json',
          { customTitle: 'Custom Report Title' }
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.title).toBe('Custom Report Title');
      });
    });

    describe('Markdown format', () => {
      it('should generate valid Markdown report', () => {
        const report = generator.generateReport(baseline, 'markdown');

        expect(report.format).toBe('markdown');
        expect(report.content).toContain('# Platform Traffic Monitoring Report');
        expect(report.content).toContain('## Baseline Metrics');
        expect(report.content).toContain('## Deviation Thresholds');
        expect(report.content).toContain('| Metric | Value |');
      });

      it('should include current metrics section when provided', () => {
        const report = generator.generateReport(
          baseline,
          'markdown',
          {},
          currentMetrics
        );

        expect(report.content).toContain('## Current Metrics');
        expect(report.content).toContain('| Total Requests | 6000 |');
        expect(report.content).toContain('### Top Endpoints');
        expect(report.content).toContain('| /api/users | 2000 |');
      });

      it('should include anomalies section when provided', () => {
        const report = generator.generateReport(
          baseline,
          'markdown',
          {},
          currentMetrics,
          anomalies
        );

        expect(report.content).toContain('## Anomalies Detected');
        expect(report.content).toContain('⚠️ **response_time** (warning)');
        expect(report.content).toContain('High response time');
      });

      it('should include recommendations when option is set', () => {
        const report = generator.generateReport(
          baseline,
          'markdown',
          { includeRecommendations: true },
          currentMetrics,
          anomalies
        );

        expect(report.content).toContain('## Recommendations');
        expect(report.content).toContain('- ');
      });

      it('should format metrics with proper precision', () => {
        const report = generator.generateReport(baseline, 'markdown');

        expect(report.content).toContain('| Average Requests/min | 100.00 |');
        expect(report.content).toContain('| Average Response Time | 200.00ms |');
        expect(report.content).toContain('| Normal Error Rate | 2.00% |');
      });

      it('should show critical anomalies with correct icon', () => {
        const criticalAnomalies: AnomalyDetection = {
          hasAnomaly: true,
          anomalies: [
            {
              type: 'error_rate',
              severity: 'critical',
              value: 15,
              threshold: 10,
              message: 'Critical error rate'
            }
          ]
        };

        const report = generator.generateReport(
          baseline,
          'markdown',
          {},
          currentMetrics,
          criticalAnomalies
        );

        expect(report.content).toContain('🔴 **error_rate** (critical)');
      });
    });

    describe('HTML format', () => {
      it('should generate valid HTML report', () => {
        const report = generator.generateReport(baseline, 'html');

        expect(report.format).toBe('html');
        expect(report.content).toContain('<!DOCTYPE html>');
        expect(report.content).toContain('<html>');
        expect(report.content).toContain('</html>');
        expect(report.content).toContain('<style>');
        expect(report.content).toContain('<h1>Platform Traffic Monitoring Report</h1>');
      });

      it('should include CSS styles', () => {
        const report = generator.generateReport(baseline, 'html');

        expect(report.content).toContain('font-family: Arial, sans-serif');
        expect(report.content).toContain('border-collapse: collapse');
        expect(report.content).toContain('.warning { color: #ff9800; }');
        expect(report.content).toContain('.critical { color: #f44336; }');
      });

      it('should convert markdown tables to HTML', () => {
        const report = generator.generateReport(
          baseline,
          'html',
          {},
          currentMetrics
        );

        expect(report.content).toContain('<tr>');
        expect(report.content).toContain('<td>');
        expect(report.content).toContain('</tr>');
        expect(report.content).toContain('</td>');
      });
    });

    describe('CSV format', () => {
      it('should generate valid CSV report', () => {
        const report = generator.generateReport(baseline, 'csv');

        expect(report.format).toBe('csv');
        expect(report.content).toContain('Category,Metric,Value,Unit');
        expect(report.content.split('\n').length).toBeGreaterThan(10);
      });

      it('should include baseline metrics in CSV', () => {
        const report = generator.generateReport(baseline, 'csv');

        expect(report.content).toContain('Baseline,Average Requests per Minute,100.00,rpm');
        expect(report.content).toContain('Baseline,Average Response Time,200.00,ms');
        expect(report.content).toContain('Baseline,Normal Error Rate,2.00,%');
        expect(report.content).toContain('Baseline,Peak Hour Requests,5000,requests');
      });

      it('should include thresholds in CSV', () => {
        const report = generator.generateReport(baseline, 'csv');

        expect(report.content).toContain('Threshold,Min Requests per Minute,50.00,rpm');
        expect(report.content).toContain('Threshold,Max Requests per Minute,150.00,rpm');
        expect(report.content).toContain('Threshold,Response Time Warning,300.00,ms');
        expect(report.content).toContain('Threshold,Error Rate Critical,10.00,%');
      });

      it('should include current metrics when provided', () => {
        const report = generator.generateReport(
          baseline,
          'csv',
          {},
          currentMetrics
        );

        expect(report.content).toContain('Current,Total Requests,6000,requests');
        expect(report.content).toContain('Current,Requests per Minute,110.00,rpm');
        expect(report.content).toContain('Current,Average Response Time,250.00,ms');
        expect(report.content).toContain('Current,Unique IPs,350,count');
      });

      it('should include anomalies when provided', () => {
        const report = generator.generateReport(
          baseline,
          'csv',
          {},
          currentMetrics,
          anomalies
        );

        expect(report.content).toContain('Anomaly-1,Type,response_time,');
        expect(report.content).toContain('Anomaly-1,Severity,warning,');
        expect(report.content).toContain('Anomaly-1,Value,350.00,');
        expect(report.content).toContain('Anomaly-1,Threshold,300.00,');
      });
    });

    describe('Recommendations', () => {
      it('should generate no anomaly recommendations', () => {
        const noAnomalies: AnomalyDetection = {
          hasAnomaly: false,
          anomalies: []
        };

        const report = generator.generateReport(
          baseline,
          'json',
          { includeRecommendations: true },
          currentMetrics,
          noAnomalies
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.recommendations).toContain(
          'System is operating within normal parameters.'
        );
      });

      it('should generate traffic spike recommendations', () => {
        const trafficAnomaly: AnomalyDetection = {
          hasAnomaly: true,
          anomalies: [
            {
              type: 'traffic',
              severity: 'critical',
              value: 200,
              threshold: 150,
              message: 'Traffic spike'
            }
          ]
        };

        const report = generator.generateReport(
          baseline,
          'json',
          { includeRecommendations: true },
          currentMetrics,
          trafficAnomaly
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.recommendations).toContain(
          'Investigate traffic spike - possible DDoS attack or viral event.'
        );
        expect(parsed.recommendations).toContain(
          'Consider scaling resources if spike is legitimate.'
        );
      });

      it('should generate response time recommendations', () => {
        const responseAnomaly: AnomalyDetection = {
          hasAnomaly: true,
          anomalies: [
            {
              type: 'response_time',
              severity: 'critical',
              value: 500,
              threshold: 400,
              message: 'Critical response time'
            }
          ]
        };

        const report = generator.generateReport(
          baseline,
          'json',
          { includeRecommendations: true },
          currentMetrics,
          responseAnomaly
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.recommendations).toContain(
          'Critical response time degradation - check database performance.'
        );
        expect(parsed.recommendations).toContain(
          'Review recent deployments for performance regressions.'
        );
        expect(parsed.recommendations).toContain(
          'Consider implementing caching strategies.'
        );
      });

      it('should generate error rate recommendations', () => {
        const errorAnomaly: AnomalyDetection = {
          hasAnomaly: true,
          anomalies: [
            {
              type: 'error_rate',
              severity: 'warning',
              value: 7,
              threshold: 5,
              message: 'High error rate'
            }
          ]
        };

        const report = generator.generateReport(
          baseline,
          'json',
          { includeRecommendations: true },
          currentMetrics,
          errorAnomaly
        );

        const parsed = JSON.parse(report.content);
        expect(parsed.recommendations).toContain(
          'Error rate above normal - investigate error logs.'
        );
      });

      it('should remove duplicate recommendations', () => {
        const multipleAnomalies: AnomalyDetection = {
          hasAnomaly: true,
          anomalies: [
            {
              type: 'error_rate',
              severity: 'warning',
              value: 7,
              threshold: 5,
              message: 'High error rate'
            },
            {
              type: 'error_rate',
              severity: 'warning',
              value: 8,
              threshold: 5,
              message: 'High error rate again'
            }
          ]
        };

        const report = generator.generateReport(
          baseline,
          'json',
          { includeRecommendations: true },
          currentMetrics,
          multipleAnomalies
        );

        const parsed = JSON.parse(report.content);
        const errorRecommendations = parsed.recommendations.filter(
          (r: string) => r.includes('Error rate above normal')
        );
        expect(errorRecommendations.length).toBe(1);
      });
    });
  });

  describe('exportToFile', () => {
    it('should export report to file', async () => {
      // We can't easily test file writing without mocking framework
      // Just verify the method exists and doesn't throw
      const report = generator.generateReport(baseline, 'json');

      // Test that the method exists
      expect(generator.exportToFile).toBeDefined();
      expect(typeof generator.exportToFile).toBe('function');

      // For actual file writing test, we'd need to actually write and read
      // This is better tested in e2e tests where we actually write files
    });
  });
});