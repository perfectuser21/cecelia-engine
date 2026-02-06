/**
 * End-to-end tests for monitoring and reporting system
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  TrafficMonitor,
  BaselineCalculator,
  ReportGenerator,
  TrafficData,
  Baseline,
  TrafficMetrics
} from '../../src/monitoring';

describe('Monitoring System E2E', () => {
  const testOutputDir = '/tmp/monitoring-e2e-test';

  beforeAll(() => {
    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Monthly baseline report generation', () => {
    it('should generate complete monthly baseline report', async () => {
      const monitor = new TrafficMonitor();
      const calculator = new BaselineCalculator();
      const generator = new ReportGenerator();

      // Simulate a month of traffic data (February 2026)
      const startDate = new Date('2026-02-01T00:00:00Z');
      const endDate = new Date('2026-02-28T23:59:59Z');

      // Generate realistic traffic patterns
      const generateTrafficForDay = (date: Date) => {
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        for (let hour = 0; hour < 24; hour++) {
          const isPeakHour = !isWeekend && hour >= 9 && hour <= 17;
          const isNightTime = hour >= 0 && hour <= 6;

          // Determine traffic volume based on patterns
          let requestsPerHour: number;
          if (isNightTime) {
            requestsPerHour = 100 + Math.random() * 50; // Low night traffic
          } else if (isPeakHour) {
            requestsPerHour = 800 + Math.random() * 200; // High business hours
          } else if (isWeekend) {
            requestsPerHour = 200 + Math.random() * 100; // Medium weekend traffic
          } else {
            requestsPerHour = 400 + Math.random() * 100; // Medium off-peak
          }

          // Generate requests for this hour
          for (let req = 0; req < requestsPerHour; req++) {
            const timestamp = new Date(date);
            timestamp.setHours(hour);
            timestamp.setMinutes(Math.floor(Math.random() * 60));
            timestamp.setSeconds(Math.floor(Math.random() * 60));

            const dataPoint: TrafficData = {
              timestamp,
              endpoint: selectEndpoint(),
              method: selectMethod(),
              statusCode: selectStatusCode(),
              responseTime: calculateResponseTime(isPeakHour),
              ip: generateIP(),
              userAgent: selectUserAgent()
            };

            monitor.addDataPoint(dataPoint);
          }
        }
      };

      // Helper functions for realistic data
      const selectEndpoint = (): string => {
        const endpoints = [
          '/api/users', '/api/posts', '/api/comments',
          '/api/auth/login', '/api/auth/logout', '/api/search',
          '/api/dashboard', '/api/metrics', '/api/profile',
          '/api/settings', '/api/notifications', '/api/upload'
        ];
        const weights = [20, 15, 10, 12, 8, 18, 25, 20, 15, 10, 5, 3];
        return weightedRandom(endpoints, weights);
      };

      const selectMethod = (): string => {
        const methods = ['GET', 'POST', 'PUT', 'DELETE'];
        const weights = [60, 25, 10, 5];
        return weightedRandom(methods, weights);
      };

      const selectStatusCode = (): number => {
        const rand = Math.random();
        if (rand < 0.85) return 200; // 85% success
        if (rand < 0.92) return 201; // 7% created
        if (rand < 0.95) return 404; // 3% not found
        if (rand < 0.98) return 400; // 3% bad request
        return 500; // 2% server error
      };

      const calculateResponseTime = (isPeak: boolean): number => {
        const base = isPeak ? 150 : 100;
        const variance = isPeak ? 100 : 50;
        return base + Math.random() * variance;
      };

      const generateIP = (): string => {
        return `${Math.floor(Math.random() * 5) + 10}.${
          Math.floor(Math.random() * 256)
        }.${Math.floor(Math.random() * 256)}.${
          Math.floor(Math.random() * 256)
        }`;
      };

      const selectUserAgent = (): string => {
        const agents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/98.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/15.0',
          'Mozilla/5.0 (X11; Linux x86_64) Firefox/96.0',
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0) Mobile/15E148'
        ];
        return agents[Math.floor(Math.random() * agents.length)];
      };

      const weightedRandom = <T>(items: T[], weights: number[]): T => {
        const total = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * total;

        for (let i = 0; i < items.length; i++) {
          random -= weights[i];
          if (random <= 0) {
            return items[i];
          }
        }
        return items[items.length - 1];
      };

      // Generate month of data
      console.log('Generating month of traffic data...');
      for (let day = 1; day <= 28; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(day);
        generateTrafficForDay(currentDate);
      }

      console.log(`Generated ${monitor.getDataPoints().length} data points`);

      // Calculate daily metrics for baseline
      const dailyMetrics: TrafficMetrics[] = [];
      for (let day = 1; day <= 28; day++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(day);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const metrics = monitor.getMetrics(dayStart, dayEnd);
        dailyMetrics.push(metrics);
      }

      // Calculate baseline from first 3 weeks
      const historicalMetrics = dailyMetrics.slice(0, 21);
      const baseline = calculator.calculateBaseline(
        historicalMetrics,
        'monthly',
        startDate,
        new Date('2026-02-21T23:59:59Z')
      );

      // Get current week metrics
      const currentWeekStart = new Date('2026-02-22T00:00:00Z');
      const currentWeekEnd = new Date('2026-02-28T23:59:59Z');
      const currentMetrics = monitor.getMetrics(currentWeekStart, currentWeekEnd);

      // Detect anomalies
      const anomalies = calculator.detectAnomalies(currentMetrics, baseline);

      // Generate reports in all formats
      const formats = ['json', 'markdown', 'html', 'csv'] as const;
      const reports = formats.map(format =>
        generator.generateReport(
          baseline,
          format,
          {
            includeRecommendations: true,
            customTitle: 'February 2026 Monthly Traffic Baseline Report'
          },
          currentMetrics,
          anomalies
        )
      );

      // Save reports to files
      for (const report of reports) {
        const filename = `monthly-report.${report.format === 'markdown' ? 'md' : report.format}`;
        const filepath = path.join(testOutputDir, filename);
        await generator.exportToFile(report, filepath);

        expect(fs.existsSync(filepath)).toBe(true);
        console.log(`Saved ${report.format} report to ${filepath}`);
      }

      // Verify report contents
      const jsonReport = JSON.parse(reports[0].content);
      expect(jsonReport.title).toBe('February 2026 Monthly Traffic Baseline Report');
      expect(jsonReport.period).toBe('monthly');
      expect(jsonReport.baseline).toBeDefined();
      expect(jsonReport.currentMetrics).toBeDefined();

      // Verify baseline calculations
      expect(baseline.metrics.avgRequestsPerMinute).toBeGreaterThan(0);
      expect(baseline.metrics.percentile95ResponseTime).toBeGreaterThan(baseline.metrics.avgResponseTime);
      expect(baseline.metrics.peakHourRequests).toBeGreaterThan(baseline.metrics.offPeakRequests);
    });
  });

  describe('Real-time monitoring simulation', () => {
    it('should handle real-time traffic monitoring and alerting', async () => {
      const monitor = new TrafficMonitor();
      const calculator = new BaselineCalculator();
      const generator = new ReportGenerator();

      // Create baseline from known good data
      const goodMetrics: TrafficMetrics[] = [];
      for (let i = 0; i < 24; i++) {
        goodMetrics.push({
          totalRequests: 1000,
          averageResponseTime: 100,
          errorRate: 1,
          requestsPerMinute: 16.67,
          uniqueIPs: 100,
          topEndpoints: []
        });
      }

      const baseline = calculator.calculateBaseline(
        goodMetrics,
        'daily',
        new Date('2026-02-05T00:00:00Z'),
        new Date('2026-02-05T23:59:59Z')
      );

      // Simulate real-time monitoring with various scenarios
      const scenarios = [
        { name: 'Normal Traffic', multiplier: 1, errorRate: 1 },
        { name: 'Traffic Spike', multiplier: 3, errorRate: 1 },
        { name: 'High Error Rate', multiplier: 1, errorRate: 15 },
        { name: 'Slow Response', multiplier: 1, errorRate: 1, responseMultiplier: 5 },
        { name: 'Combined Issues', multiplier: 2, errorRate: 8, responseMultiplier: 3 }
      ];

      const alertLog: string[] = [];

      for (const scenario of scenarios) {
        // Clear previous data
        monitor.clearData();

        // Simulate 5 minutes of traffic for this scenario
        const now = new Date();
        for (let second = 0; second < 300; second++) {
          const timestamp = new Date(now.getTime() + second * 1000);

          // Generate requests based on scenario
          const requestsPerSecond = Math.floor(scenario.multiplier * (1 + Math.random()));

          for (let req = 0; req < requestsPerSecond; req++) {
            const isError = Math.random() * 100 < scenario.errorRate;
            const responseTime = 100 * (scenario.responseMultiplier || 1) + Math.random() * 50;

            monitor.addDataPoint({
              timestamp,
              endpoint: '/api/monitor',
              method: 'GET',
              statusCode: isError ? 500 : 200,
              responseTime,
              ip: `10.0.0.${Math.floor(Math.random() * 100)}`
            });
          }
        }

        // Get metrics for the scenario
        const scenarioMetrics = monitor.getMetrics(
          now,
          new Date(now.getTime() + 300000)
        );

        // Detect anomalies
        const anomalies = calculator.detectAnomalies(scenarioMetrics, baseline);

        // Log alerts
        if (anomalies.hasAnomaly) {
          alertLog.push(`\n=== ALERT: ${scenario.name} ===`);
          anomalies.anomalies.forEach(anomaly => {
            alertLog.push(`${anomaly.severity.toUpperCase()}: ${anomaly.message}`);
          });

          // Generate quick report for the alert
          const alertReport = generator.generateReport(
            baseline,
            'markdown',
            {
              includeRecommendations: true,
              customTitle: `Alert Report: ${scenario.name}`
            },
            scenarioMetrics,
            anomalies
          );

          const alertFilename = `alert-${scenario.name.toLowerCase().replace(/\s+/g, '-')}.md`;
          const alertPath = path.join(testOutputDir, alertFilename);
          await generator.exportToFile(alertReport, alertPath);
        } else {
          alertLog.push(`\n=== OK: ${scenario.name} - No anomalies detected ===`);
        }
      }

      // Save alert log
      const alertLogPath = path.join(testOutputDir, 'alert-log.txt');
      fs.writeFileSync(alertLogPath, alertLog.join('\n'), 'utf-8');

      console.log('Alert Log:', alertLog.join('\n'));

      // Verify alerts were generated for problematic scenarios
      expect(alertLog.join('')).toContain('Traffic Spike');
      expect(alertLog.join('')).toContain('High Error Rate');
      expect(alertLog.join('')).toContain('Slow Response');
      expect(alertLog.join('')).toContain('Combined Issues');
    });
  });

  describe('Export functionality', () => {
    it('should export reports in multiple formats with correct structure', async () => {
      const monitor = new TrafficMonitor();
      const calculator = new BaselineCalculator();
      const generator = new ReportGenerator();

      // Generate sample data
      const now = new Date();
      for (let i = 0; i < 100; i++) {
        monitor.addDataPoint({
          timestamp: new Date(now.getTime() - i * 60000),
          endpoint: `/api/endpoint-${i % 10}`,
          method: 'GET',
          statusCode: i % 20 === 0 ? 500 : 200,
          responseTime: 100 + Math.random() * 200,
          ip: `192.168.1.${i % 256}`
        });
      }

      // Calculate metrics and baseline
      const metrics = monitor.getMetrics(
        new Date(now.getTime() - 100 * 60000),
        now
      );

      const historicalMetrics = [metrics]; // Simplified for testing
      const baseline = calculator.calculateBaseline(
        historicalMetrics,
        'hourly',
        new Date(now.getTime() - 3600000),
        now
      );

      // Test JSON export
      const jsonReport = generator.generateReport(baseline, 'json');
      const jsonPath = path.join(testOutputDir, 'export-test.json');
      await generator.exportToFile(jsonReport, jsonPath);

      const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
      const jsonParsed = JSON.parse(jsonContent);
      expect(jsonParsed).toHaveProperty('baseline');
      expect(jsonParsed).toHaveProperty('title');

      // Test CSV export
      const csvReport = generator.generateReport(baseline, 'csv');
      const csvPath = path.join(testOutputDir, 'export-test.csv');
      await generator.exportToFile(csvReport, csvPath);

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const csvLines = csvContent.split('\n');
      expect(csvLines[0]).toBe('Category,Metric,Value,Unit');
      expect(csvLines.length).toBeGreaterThan(10);

      // Test Markdown export
      const mdReport = generator.generateReport(baseline, 'markdown');
      const mdPath = path.join(testOutputDir, 'export-test.md');
      await generator.exportToFile(mdReport, mdPath);

      const mdContent = fs.readFileSync(mdPath, 'utf-8');
      expect(mdContent).toContain('# Platform Traffic Monitoring Report');
      expect(mdContent).toContain('## Baseline Metrics');
      expect(mdContent).toContain('| Metric | Value |');

      // Test HTML export
      const htmlReport = generator.generateReport(baseline, 'html');
      const htmlPath = path.join(testOutputDir, 'export-test.html');
      await generator.exportToFile(htmlReport, htmlPath);

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<style>');
      expect(htmlContent).toContain('<h1>');
    });
  });

  describe('Error recovery and edge cases', () => {
    it('should handle corrupted data gracefully', () => {
      const monitor = new TrafficMonitor();

      // Add some valid data
      const now = new Date();
      monitor.addDataPoint({
        timestamp: now,
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 100
      });

      // Add data with edge cases
      monitor.addDataPoint({
        timestamp: now,
        endpoint: '',  // Empty endpoint
        method: 'GET',
        statusCode: 200,
        responseTime: 0  // Zero response time
      });

      monitor.addDataPoint({
        timestamp: now,
        endpoint: '/api/test',
        method: 'INVALID' as any,  // Invalid method
        statusCode: 999,  // Invalid status code
        responseTime: -100  // Negative response time
      });

      // Should still calculate metrics without crashing
      const metrics = monitor.getMetrics(
        new Date(now.getTime() - 3600000),
        new Date(now.getTime() + 3600000)
      );

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.averageResponseTime).toBeDefined();
    });

    it('should handle date boundary conditions', () => {
      const monitor = new TrafficMonitor();

      // Add data at exact boundaries
      const startDate = new Date('2026-02-01T00:00:00.000Z');
      const endDate = new Date('2026-02-01T23:59:59.999Z');

      monitor.addDataPoint({
        timestamp: startDate,
        endpoint: '/api/start',
        method: 'GET',
        statusCode: 200,
        responseTime: 100
      });

      monitor.addDataPoint({
        timestamp: endDate,
        endpoint: '/api/end',
        method: 'GET',
        statusCode: 200,
        responseTime: 200
      });

      // Query with exact boundaries
      const metrics = monitor.getMetrics(startDate, endDate);
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.averageResponseTime).toBe(150);
    });
  });
});