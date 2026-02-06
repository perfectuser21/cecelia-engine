/**
 * Integration tests for the complete monitoring system
 */

import {
  TrafficMonitor,
  BaselineCalculator,
  ReportGenerator,
  TrafficData
} from '../../src/monitoring';

describe('Platform Monitoring Integration', () => {
  let trafficMonitor: TrafficMonitor;
  let baselineCalculator: BaselineCalculator;
  let reportGenerator: ReportGenerator;

  beforeEach(() => {
    trafficMonitor = new TrafficMonitor();
    baselineCalculator = new BaselineCalculator();
    reportGenerator = new ReportGenerator();
  });

  describe('Complete monitoring workflow', () => {
    it('should collect data, calculate baseline, and generate report', () => {
      // Step 1: Simulate collecting traffic data over time
      const now = new Date('2026-02-06T12:00:00Z');
      const dataPoints: TrafficData[] = [];

      // Generate data for 24 hours (1440 minutes)
      for (let minute = 0; minute < 1440; minute++) {
        const timestamp = new Date(now.getTime() - (1440 - minute) * 60000);
        const hour = timestamp.getHours();

        // Simulate traffic patterns
        const isPeakHour = hour >= 9 && hour <= 17;
        const baseRequests = isPeakHour ? 100 : 50;
        const variance = Math.random() * 20 - 10; // +/- 10 variance

        dataPoints.push({
          timestamp,
          endpoint: `/api/${['users', 'posts', 'auth', 'comments', 'search'][Math.floor(Math.random() * 5)]}`,
          method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
          statusCode: Math.random() > 0.95 ? 500 : (Math.random() > 0.9 ? 404 : 200),
          responseTime: isPeakHour ? 200 + Math.random() * 100 : 100 + Math.random() * 50,
          ip: `192.168.1.${Math.floor(Math.random() * 100)}`,
          userAgent: 'Mozilla/5.0'
        });

        trafficMonitor.addDataPoint(dataPoints[dataPoints.length - 1]);
      }

      // Step 2: Calculate metrics for each hour
      const hourlyMetrics = [];
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(now.getTime() - (24 - hour) * 3600000);
        const hourEnd = new Date(hourStart.getTime() + 3600000);
        const metrics = trafficMonitor.getMetrics(hourStart, hourEnd);
        hourlyMetrics.push(metrics);
      }

      expect(hourlyMetrics).toHaveLength(24);

      // Step 3: Calculate baseline from historical metrics
      const baseline = baselineCalculator.calculateBaseline(
        hourlyMetrics.slice(0, 20), // Use first 20 hours as historical data
        'daily',
        new Date(now.getTime() - 24 * 3600000),
        new Date(now.getTime() - 4 * 3600000)
      );

      expect(baseline.metrics.avgRequestsPerMinute).toBeGreaterThan(0);
      expect(baseline.metrics.avgResponseTime).toBeGreaterThan(0);
      expect(baseline.deviationThresholds.requestsPerMinute.min).toBeGreaterThan(0);

      // Step 4: Get current metrics (last 4 hours)
      const currentMetrics = trafficMonitor.getMetrics(
        new Date(now.getTime() - 4 * 3600000),
        now
      );

      expect(currentMetrics.totalRequests).toBeGreaterThan(0);

      // Step 5: Detect anomalies
      const anomalies = baselineCalculator.detectAnomalies(currentMetrics, baseline);

      // Anomalies may or may not exist depending on random data
      expect(anomalies.hasAnomaly).toBeDefined();

      // Step 6: Generate reports in multiple formats
      const jsonReport = reportGenerator.generateReport(
        baseline,
        'json',
        { includeRecommendations: true },
        currentMetrics,
        anomalies
      );

      const markdownReport = reportGenerator.generateReport(
        baseline,
        'markdown',
        { includeRecommendations: true, customTitle: 'Daily Traffic Report' },
        currentMetrics,
        anomalies
      );

      const csvReport = reportGenerator.generateReport(
        baseline,
        'csv',
        {},
        currentMetrics,
        anomalies
      );

      // Verify reports were generated
      expect(jsonReport.format).toBe('json');
      expect(JSON.parse(jsonReport.content)).toBeDefined();

      expect(markdownReport.format).toBe('markdown');
      expect(markdownReport.content).toContain('# Daily Traffic Report');

      expect(csvReport.format).toBe('csv');
      expect(csvReport.content).toContain('Category,Metric,Value,Unit');
    });

    it('should handle anomaly detection correctly', () => {
      // Create baseline with known values
      const historicalMetrics = [];
      for (let i = 0; i < 10; i++) {
        historicalMetrics.push({
          totalRequests: 1000,
          averageResponseTime: 100,
          errorRate: 1,
          requestsPerMinute: 16.67,
          uniqueIPs: 50,
          topEndpoints: []
        });
      }

      const baseline = baselineCalculator.calculateBaseline(
        historicalMetrics,
        'daily',
        new Date('2026-02-01'),
        new Date('2026-02-02')
      );

      // Simulate normal traffic
      const normalMetrics = {
        totalRequests: 1000,
        averageResponseTime: 105,
        errorRate: 1.2,
        requestsPerMinute: 16.5,
        uniqueIPs: 48,
        topEndpoints: []
      };

      const normalAnomalies = baselineCalculator.detectAnomalies(normalMetrics, baseline);
      expect(normalAnomalies.hasAnomaly).toBe(false);

      // Simulate anomalous traffic
      const anomalousMetrics = {
        totalRequests: 5000,
        averageResponseTime: 500, // 5x normal
        errorRate: 15, // 15x normal
        requestsPerMinute: 83.33, // 5x normal
        uniqueIPs: 200,
        topEndpoints: []
      };

      const detectedAnomalies = baselineCalculator.detectAnomalies(anomalousMetrics, baseline);
      expect(detectedAnomalies.hasAnomaly).toBe(true);
      expect(detectedAnomalies.anomalies.length).toBeGreaterThan(0);

      // Generate report with anomalies
      const report = reportGenerator.generateReport(
        baseline,
        'markdown',
        { includeRecommendations: true },
        anomalousMetrics,
        detectedAnomalies
      );

      expect(report.content).toContain('## Anomalies Detected');
      expect(report.content).toContain('## Recommendations');
    });

    it('should handle empty data gracefully', () => {
      // Get metrics from empty monitor
      const metrics = trafficMonitor.getMetrics(
        new Date('2026-02-01'),
        new Date('2026-02-02')
      );

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.errorRate).toBe(0);

      // Try to calculate baseline with minimal data
      expect(() => {
        baselineCalculator.calculateBaseline(
          [],
          'daily',
          new Date('2026-02-01'),
          new Date('2026-02-02')
        );
      }).toThrow('No historical metrics provided');
    });

    it('should track top endpoints correctly', () => {
      const endpoints = [
        '/api/users',
        '/api/posts',
        '/api/auth/login',
        '/api/auth/logout',
        '/api/search'
      ];

      const now = new Date();

      // Add traffic with different volumes per endpoint
      endpoints.forEach((endpoint, index) => {
        for (let i = 0; i < (index + 1) * 10; i++) {
          trafficMonitor.addDataPoint({
            timestamp: new Date(now.getTime() - i * 1000),
            endpoint,
            method: 'GET',
            statusCode: 200,
            responseTime: 100
          });
        }
      });

      const metrics = trafficMonitor.getMetrics(
        new Date(now.getTime() - 3600000),
        now
      );

      expect(metrics.topEndpoints).toHaveLength(5);
      expect(metrics.topEndpoints[0].endpoint).toBe('/api/search');
      expect(metrics.topEndpoints[0].count).toBe(50);
      expect(metrics.topEndpoints[4].endpoint).toBe('/api/users');
      expect(metrics.topEndpoints[4].count).toBe(10);
    });

    it('should calculate percentiles correctly', () => {
      // Create metrics with known response times
      const historicalMetrics = [];
      for (let i = 1; i <= 100; i++) {
        historicalMetrics.push({
          totalRequests: 100,
          averageResponseTime: i * 10, // 10, 20, 30, ..., 1000
          errorRate: 1,
          requestsPerMinute: 10,
          uniqueIPs: 50,
          topEndpoints: []
        });
      }

      const baseline = baselineCalculator.calculateBaseline(
        historicalMetrics,
        'daily',
        new Date('2026-02-01'),
        new Date('2026-02-05')
      );

      // P95 should be around 950 (95th value when sorted)
      expect(baseline.metrics.percentile95ResponseTime).toBeCloseTo(950, -1);

      // P99 should be around 990 (99th value when sorted)
      expect(baseline.metrics.percentile99ResponseTime).toBeCloseTo(990, -1);
    });
  });

  describe('Report generation with different options', () => {
    let baseline: any;
    let currentMetrics: any;

    beforeEach(() => {
      baseline = {
        period: 'weekly',
        startDate: new Date('2026-01-27'),
        endDate: new Date('2026-02-03'),
        metrics: {
          avgRequestsPerMinute: 50,
          avgResponseTime: 150,
          normalErrorRate: 1.5,
          peakHourRequests: 3000,
          offPeakRequests: 500,
          percentile95ResponseTime: 250,
          percentile99ResponseTime: 350
        },
        deviationThresholds: {
          requestsPerMinute: { min: 25, max: 75 },
          responseTime: { warning: 250, critical: 350 },
          errorRate: { warning: 3, critical: 5 }
        }
      };

      currentMetrics = {
        totalRequests: 20000,
        averageResponseTime: 180,
        errorRate: 2,
        requestsPerMinute: 55,
        uniqueIPs: 500,
        topEndpoints: [
          { endpoint: '/api/dashboard', count: 5000 },
          { endpoint: '/api/metrics', count: 4000 }
        ]
      };
    });

    it('should generate comprehensive JSON report', () => {
      const report = reportGenerator.generateReport(
        baseline,
        'json',
        {
          includeRecommendations: true,
          customTitle: 'Weekly Performance Analysis'
        },
        currentMetrics
      );

      const parsed = JSON.parse(report.content);

      expect(parsed.title).toBe('Weekly Performance Analysis');
      expect(parsed.period).toBe('weekly');
      expect(parsed.baseline.metrics.avgRequestsPerMinute).toBe(50);
      expect(parsed.currentMetrics.totalRequests).toBe(20000);
      expect(parsed.recommendations).toBeDefined();
    });

    it('should generate formatted HTML report', () => {
      const report = reportGenerator.generateReport(
        baseline,
        'html',
        {
          customTitle: 'Performance Dashboard'
        },
        currentMetrics
      );

      expect(report.content).toContain('<title>Performance Dashboard</title>');
      expect(report.content).toContain('<h1>Performance Dashboard</h1>');
      expect(report.content).toContain('<h2>Baseline Metrics</h2>');
      expect(report.content).toContain('<h2>Current Metrics</h2>');
      expect(report.content).toContain('font-family: Arial');
    });

    it('should generate complete CSV export', () => {
      const anomalies = baselineCalculator.detectAnomalies(currentMetrics, baseline);
      const report = reportGenerator.generateReport(
        baseline,
        'csv',
        {},
        currentMetrics,
        anomalies
      );

      const lines = report.content.split('\n');
      const header = lines[0];

      expect(header).toBe('Category,Metric,Value,Unit');

      // Check for baseline metrics
      expect(report.content).toContain('Baseline,Average Requests per Minute,50.00,rpm');

      // Check for current metrics
      expect(report.content).toContain('Current,Total Requests,20000,requests');

      // Check for thresholds
      expect(report.content).toContain('Threshold,Min Requests per Minute,25.00,rpm');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle concurrent data collection', () => {
      const promises = [];
      const now = new Date();

      // Simulate concurrent additions
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              trafficMonitor.addDataPoint({
                timestamp: new Date(now.getTime() + i * 1000),
                endpoint: '/api/concurrent',
                method: 'GET',
                statusCode: 200,
                responseTime: 100
              });
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      return Promise.all(promises).then(() => {
        const metrics = trafficMonitor.getMetrics(
          now,
          new Date(now.getTime() + 100000)
        );
        expect(metrics.totalRequests).toBe(100);
      });
    });

    it('should handle very large datasets', () => {
      const now = new Date();

      // Add 10,000 data points
      for (let i = 0; i < 10000; i++) {
        trafficMonitor.addDataPoint({
          timestamp: new Date(now.getTime() - i * 100),
          endpoint: `/api/endpoint-${i % 100}`,
          method: 'GET',
          statusCode: 200,
          responseTime: 50 + Math.random() * 200,
          ip: `10.0.${Math.floor(i / 100)}.${i % 100}`
        });
      }

      const metrics = trafficMonitor.getMetrics(
        new Date(now.getTime() - 1000000),
        now
      );

      expect(metrics.totalRequests).toBe(10000);
      expect(metrics.topEndpoints).toHaveLength(5);
      expect(metrics.uniqueIPs).toBeGreaterThan(0);
    });

    it('should handle time zone differences correctly', () => {
      const utcTime = new Date('2026-02-06T12:00:00Z');
      const localTime = new Date('2026-02-06T12:00:00'); // Local timezone

      trafficMonitor.addDataPoint({
        timestamp: utcTime,
        endpoint: '/api/timezone',
        method: 'GET',
        statusCode: 200,
        responseTime: 100
      });

      // Search with UTC range
      const metricsUtc = trafficMonitor.getMetrics(
        new Date('2026-02-06T11:00:00Z'),
        new Date('2026-02-06T13:00:00Z')
      );

      expect(metricsUtc.totalRequests).toBe(1);
    });
  });
});