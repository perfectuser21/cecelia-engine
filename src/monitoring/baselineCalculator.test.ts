/**
 * Unit tests for BaselineCalculator
 */

import {
  BaselineCalculator,
  Baseline,
  AnomalyDetection
} from './baselineCalculator';
import { TrafficMetrics } from './trafficMonitor';

describe('BaselineCalculator', () => {
  let calculator: BaselineCalculator;

  beforeEach(() => {
    calculator = new BaselineCalculator();
  });

  describe('calculateBaseline', () => {
    it('should throw error when no historical metrics provided', () => {
      expect(() => {
        calculator.calculateBaseline(
          [],
          'daily',
          new Date('2026-02-01'),
          new Date('2026-02-06')
        );
      }).toThrow('No historical metrics provided for baseline calculation');
    });

    it('should calculate baseline from single metric', () => {
      const metrics: TrafficMetrics[] = [
        {
          totalRequests: 1000,
          averageResponseTime: 200,
          errorRate: 2,
          requestsPerMinute: 16.67,
          uniqueIPs: 50,
          topEndpoints: []
        }
      ];

      const baseline = calculator.calculateBaseline(
        metrics,
        'daily',
        new Date('2026-02-01'),
        new Date('2026-02-02')
      );

      expect(baseline.metrics.avgRequestsPerMinute).toBe(16.67);
      expect(baseline.metrics.avgResponseTime).toBe(200);
      expect(baseline.metrics.normalErrorRate).toBe(2);
      expect(baseline.metrics.peakHourRequests).toBe(1000);
      expect(baseline.metrics.offPeakRequests).toBe(1000);
      expect(baseline.metrics.percentile95ResponseTime).toBe(200);
      expect(baseline.metrics.percentile99ResponseTime).toBe(200);
    });

    it('should calculate baseline from multiple metrics', () => {
      const metrics: TrafficMetrics[] = [
        {
          totalRequests: 1000,
          averageResponseTime: 100,
          errorRate: 1,
          requestsPerMinute: 16.67,
          uniqueIPs: 50,
          topEndpoints: []
        },
        {
          totalRequests: 2000,
          averageResponseTime: 200,
          errorRate: 2,
          requestsPerMinute: 33.33,
          uniqueIPs: 100,
          topEndpoints: []
        },
        {
          totalRequests: 1500,
          averageResponseTime: 150,
          errorRate: 1.5,
          requestsPerMinute: 25,
          uniqueIPs: 75,
          topEndpoints: []
        },
        {
          totalRequests: 500,
          averageResponseTime: 300,
          errorRate: 3,
          requestsPerMinute: 8.33,
          uniqueIPs: 25,
          topEndpoints: []
        }
      ];

      const baseline = calculator.calculateBaseline(
        metrics,
        'daily',
        new Date('2026-02-01'),
        new Date('2026-02-05')
      );

      // Average requests per minute
      expect(baseline.metrics.avgRequestsPerMinute).toBeCloseTo(
        (16.67 + 33.33 + 25 + 8.33) / 4,
        2
      );

      // Average response time
      expect(baseline.metrics.avgResponseTime).toBe(
        (100 + 200 + 150 + 300) / 4
      );

      // Normal error rate
      expect(baseline.metrics.normalErrorRate).toBe(
        (1 + 2 + 1.5 + 3) / 4
      );

      // Peak hour requests (top 25% = 1 item)
      expect(baseline.metrics.peakHourRequests).toBe(2000);

      // Off-peak requests (bottom 25% = 1 item)
      expect(baseline.metrics.offPeakRequests).toBe(500);
    });

    it('should calculate correct percentiles', () => {
      const metrics: TrafficMetrics[] = [];

      // Create 100 metrics with response times from 1 to 100
      for (let i = 1; i <= 100; i++) {
        metrics.push({
          totalRequests: 1000,
          averageResponseTime: i,
          errorRate: 1,
          requestsPerMinute: 10,
          uniqueIPs: 50,
          topEndpoints: []
        });
      }

      const baseline = calculator.calculateBaseline(
        metrics,
        'daily',
        new Date('2026-02-01'),
        new Date('2026-02-10')
      );

      // 95th percentile should be around 95
      expect(baseline.metrics.percentile95ResponseTime).toBeCloseTo(95, 0);

      // 99th percentile should be around 99
      expect(baseline.metrics.percentile99ResponseTime).toBeCloseTo(99, 0);
    });

    it('should calculate deviation thresholds correctly', () => {
      const metrics: TrafficMetrics[] = [
        {
          totalRequests: 1000,
          averageResponseTime: 100,
          errorRate: 1,
          requestsPerMinute: 10,
          uniqueIPs: 50,
          topEndpoints: []
        },
        {
          totalRequests: 1000,
          averageResponseTime: 200,
          errorRate: 2,
          requestsPerMinute: 20,
          uniqueIPs: 50,
          topEndpoints: []
        },
        {
          totalRequests: 1000,
          averageResponseTime: 150,
          errorRate: 1.5,
          requestsPerMinute: 15,
          uniqueIPs: 50,
          topEndpoints: []
        }
      ];

      const baseline = calculator.calculateBaseline(
        metrics,
        'daily',
        new Date('2026-02-01'),
        new Date('2026-02-04')
      );

      // Check that thresholds exist and are reasonable
      expect(baseline.deviationThresholds.requestsPerMinute.min).toBeGreaterThanOrEqual(0);
      expect(baseline.deviationThresholds.requestsPerMinute.max).toBeGreaterThan(
        baseline.metrics.avgRequestsPerMinute
      );

      expect(baseline.deviationThresholds.responseTime.warning).toBeGreaterThan(
        baseline.metrics.avgResponseTime
      );
      expect(baseline.deviationThresholds.responseTime.critical).toBeGreaterThan(
        baseline.deviationThresholds.responseTime.warning
      );

      expect(baseline.deviationThresholds.errorRate.warning).toBeGreaterThan(
        baseline.metrics.normalErrorRate
      );
      expect(baseline.deviationThresholds.errorRate.critical).toBeGreaterThan(
        baseline.deviationThresholds.errorRate.warning
      );
      expect(baseline.deviationThresholds.errorRate.critical).toBeLessThanOrEqual(100);
    });

    it('should store period and date range correctly', () => {
      const metrics: TrafficMetrics[] = [
        {
          totalRequests: 1000,
          averageResponseTime: 100,
          errorRate: 1,
          requestsPerMinute: 10,
          uniqueIPs: 50,
          topEndpoints: []
        }
      ];

      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-06');

      const baseline = calculator.calculateBaseline(
        metrics,
        'weekly',
        startDate,
        endDate
      );

      expect(baseline.period).toBe('weekly');
      expect(baseline.startDate).toEqual(startDate);
      expect(baseline.endDate).toEqual(endDate);
    });
  });

  describe('detectAnomalies', () => {
    let baseline: Baseline;

    beforeEach(() => {
      // Create a standard baseline for testing
      baseline = {
        period: 'daily',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-02'),
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
    });

    it('should detect no anomalies when metrics are normal', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 6000,
        averageResponseTime: 200,
        errorRate: 2,
        requestsPerMinute: 100,
        uniqueIPs: 300,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(false);
      expect(result.anomalies).toHaveLength(0);
    });

    it('should detect low traffic anomaly', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 2000,
        averageResponseTime: 200,
        errorRate: 2,
        requestsPerMinute: 30, // Below minimum of 50
        uniqueIPs: 100,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('traffic');
      expect(result.anomalies[0].severity).toBe('warning');
      expect(result.anomalies[0].value).toBe(30);
      expect(result.anomalies[0].threshold).toBe(50);
    });

    it('should detect traffic spike anomaly', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 10000,
        averageResponseTime: 200,
        errorRate: 2,
        requestsPerMinute: 200, // Above maximum of 150
        uniqueIPs: 500,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('traffic');
      expect(result.anomalies[0].severity).toBe('critical');
      expect(result.anomalies[0].value).toBe(200);
      expect(result.anomalies[0].threshold).toBe(150);
    });

    it('should detect warning response time anomaly', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 6000,
        averageResponseTime: 350, // Above warning of 300, below critical of 400
        errorRate: 2,
        requestsPerMinute: 100,
        uniqueIPs: 300,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('response_time');
      expect(result.anomalies[0].severity).toBe('warning');
      expect(result.anomalies[0].value).toBe(350);
      expect(result.anomalies[0].threshold).toBe(300);
    });

    it('should detect critical response time anomaly', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 6000,
        averageResponseTime: 500, // Above critical of 400
        errorRate: 2,
        requestsPerMinute: 100,
        uniqueIPs: 300,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('response_time');
      expect(result.anomalies[0].severity).toBe('critical');
      expect(result.anomalies[0].value).toBe(500);
      expect(result.anomalies[0].threshold).toBe(400);
    });

    it('should detect warning error rate anomaly', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 6000,
        averageResponseTime: 200,
        errorRate: 7, // Above warning of 5, below critical of 10
        requestsPerMinute: 100,
        uniqueIPs: 300,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('error_rate');
      expect(result.anomalies[0].severity).toBe('warning');
      expect(result.anomalies[0].value).toBe(7);
      expect(result.anomalies[0].threshold).toBe(5);
    });

    it('should detect critical error rate anomaly', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 6000,
        averageResponseTime: 200,
        errorRate: 15, // Above critical of 10
        requestsPerMinute: 100,
        uniqueIPs: 300,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('error_rate');
      expect(result.anomalies[0].severity).toBe('critical');
      expect(result.anomalies[0].value).toBe(15);
      expect(result.anomalies[0].threshold).toBe(10);
    });

    it('should detect multiple anomalies', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 10000,
        averageResponseTime: 500, // Critical
        errorRate: 15, // Critical
        requestsPerMinute: 200, // Critical
        uniqueIPs: 500,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies).toHaveLength(3);

      const types = result.anomalies.map(a => a.type);
      expect(types).toContain('traffic');
      expect(types).toContain('response_time');
      expect(types).toContain('error_rate');

      // All should be critical
      result.anomalies.forEach(anomaly => {
        expect(anomaly.severity).toBe('critical');
      });
    });

    it('should include meaningful messages in anomalies', () => {
      const currentMetrics: TrafficMetrics = {
        totalRequests: 2000,
        averageResponseTime: 200,
        errorRate: 2,
        requestsPerMinute: 30,
        uniqueIPs: 100,
        topEndpoints: []
      };

      const result = calculator.detectAnomalies(currentMetrics, baseline);

      expect(result.anomalies[0].message).toContain('Traffic below normal');
      expect(result.anomalies[0].message).toContain('30.0 rpm');
      expect(result.anomalies[0].message).toContain('baseline: 100.0 rpm');
    });
  });
});