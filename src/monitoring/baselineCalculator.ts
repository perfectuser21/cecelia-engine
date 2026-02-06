/**
 * Baseline Calculator Module
 * Calculates baseline metrics for traffic monitoring
 */

import { TrafficMetrics } from './trafficMonitor';

export interface Baseline {
  period: string;
  startDate: Date;
  endDate: Date;
  metrics: BaselineMetrics;
  deviationThresholds: DeviationThresholds;
}

export interface BaselineMetrics {
  avgRequestsPerMinute: number;
  avgResponseTime: number;
  normalErrorRate: number;
  peakHourRequests: number;
  offPeakRequests: number;
  percentile95ResponseTime: number;
  percentile99ResponseTime: number;
}

export interface DeviationThresholds {
  requestsPerMinute: { min: number; max: number };
  responseTime: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
}

export interface AnomalyDetection {
  hasAnomaly: boolean;
  anomalies: Array<{
    type: 'traffic' | 'response_time' | 'error_rate';
    severity: 'warning' | 'critical';
    value: number;
    threshold: number;
    message: string;
  }>;
}

export class BaselineCalculator {
  /**
   * Calculate baseline from historical metrics
   */
  calculateBaseline(
    historicalMetrics: TrafficMetrics[],
    period: string,
    startDate: Date,
    endDate: Date
  ): Baseline {
    if (historicalMetrics.length === 0) {
      throw new Error('No historical metrics provided for baseline calculation');
    }

    // Calculate averages
    const avgRequestsPerMinute = this.calculateAverage(
      historicalMetrics.map(m => m.requestsPerMinute)
    );

    const avgResponseTime = this.calculateAverage(
      historicalMetrics.map(m => m.averageResponseTime)
    );

    const normalErrorRate = this.calculateAverage(
      historicalMetrics.map(m => m.errorRate)
    );

    // Calculate peak and off-peak
    const sortedByRequests = [...historicalMetrics].sort(
      (a, b) => b.totalRequests - a.totalRequests
    );
    const topQuartile = Math.max(1, Math.floor(historicalMetrics.length * 0.25));
    const bottomQuartile = Math.max(1, Math.floor(historicalMetrics.length * 0.75));

    const peakHourRequests = this.calculateAverage(
      sortedByRequests.slice(0, topQuartile).map(m => m.totalRequests)
    );

    const offPeakRequests = this.calculateAverage(
      sortedByRequests.slice(-topQuartile).map(m => m.totalRequests)
    );

    // Calculate response time percentiles
    const responseTimes = historicalMetrics
      .map(m => m.averageResponseTime)
      .sort((a, b) => a - b);

    const percentile95ResponseTime = this.calculatePercentile(responseTimes, 95);
    const percentile99ResponseTime = this.calculatePercentile(responseTimes, 99);

    // Calculate standard deviations for thresholds
    const rpmStdDev = this.calculateStandardDeviation(
      historicalMetrics.map(m => m.requestsPerMinute)
    );

    const responseStdDev = this.calculateStandardDeviation(
      historicalMetrics.map(m => m.averageResponseTime)
    );

    // Ensure minimum tolerance when std dev is 0 (all values same)
    const rpmTolerance = Math.max(rpmStdDev, avgRequestsPerMinute * 0.1);
    const responseTolerance = Math.max(responseStdDev, avgResponseTime * 0.1);

    // Set deviation thresholds
    const deviationThresholds: DeviationThresholds = {
      requestsPerMinute: {
        min: Math.max(0, avgRequestsPerMinute - 2 * rpmTolerance),
        max: avgRequestsPerMinute + 3 * rpmTolerance
      },
      responseTime: {
        warning: avgResponseTime + 2 * responseTolerance,
        critical: avgResponseTime + 3 * responseTolerance
      },
      errorRate: {
        warning: Math.min(100, normalErrorRate + 5),
        critical: Math.min(100, normalErrorRate + 10)
      }
    };

    return {
      period,
      startDate,
      endDate,
      metrics: {
        avgRequestsPerMinute,
        avgResponseTime,
        normalErrorRate,
        peakHourRequests,
        offPeakRequests,
        percentile95ResponseTime,
        percentile99ResponseTime
      },
      deviationThresholds
    };
  }

  /**
   * Detect anomalies based on baseline
   */
  detectAnomalies(
    currentMetrics: TrafficMetrics,
    baseline: Baseline
  ): AnomalyDetection {
    const anomalies: AnomalyDetection['anomalies'] = [];

    // Check traffic volume
    if (currentMetrics.requestsPerMinute < baseline.deviationThresholds.requestsPerMinute.min) {
      anomalies.push({
        type: 'traffic',
        severity: 'warning',
        value: currentMetrics.requestsPerMinute,
        threshold: baseline.deviationThresholds.requestsPerMinute.min,
        message: `Traffic below normal: ${currentMetrics.requestsPerMinute.toFixed(1)} rpm (baseline: ${baseline.metrics.avgRequestsPerMinute.toFixed(1)} rpm)`
      });
    }

    if (currentMetrics.requestsPerMinute > baseline.deviationThresholds.requestsPerMinute.max) {
      anomalies.push({
        type: 'traffic',
        severity: 'critical',
        value: currentMetrics.requestsPerMinute,
        threshold: baseline.deviationThresholds.requestsPerMinute.max,
        message: `Traffic spike detected: ${currentMetrics.requestsPerMinute.toFixed(1)} rpm (baseline: ${baseline.metrics.avgRequestsPerMinute.toFixed(1)} rpm)`
      });
    }

    // Check response time
    if (currentMetrics.averageResponseTime > baseline.deviationThresholds.responseTime.critical) {
      anomalies.push({
        type: 'response_time',
        severity: 'critical',
        value: currentMetrics.averageResponseTime,
        threshold: baseline.deviationThresholds.responseTime.critical,
        message: `Critical response time: ${currentMetrics.averageResponseTime.toFixed(0)}ms (baseline: ${baseline.metrics.avgResponseTime.toFixed(0)}ms)`
      });
    } else if (currentMetrics.averageResponseTime > baseline.deviationThresholds.responseTime.warning) {
      anomalies.push({
        type: 'response_time',
        severity: 'warning',
        value: currentMetrics.averageResponseTime,
        threshold: baseline.deviationThresholds.responseTime.warning,
        message: `High response time: ${currentMetrics.averageResponseTime.toFixed(0)}ms (baseline: ${baseline.metrics.avgResponseTime.toFixed(0)}ms)`
      });
    }

    // Check error rate
    if (currentMetrics.errorRate > baseline.deviationThresholds.errorRate.critical) {
      anomalies.push({
        type: 'error_rate',
        severity: 'critical',
        value: currentMetrics.errorRate,
        threshold: baseline.deviationThresholds.errorRate.critical,
        message: `Critical error rate: ${currentMetrics.errorRate.toFixed(1)}% (baseline: ${baseline.metrics.normalErrorRate.toFixed(1)}%)`
      });
    } else if (currentMetrics.errorRate > baseline.deviationThresholds.errorRate.warning) {
      anomalies.push({
        type: 'error_rate',
        severity: 'warning',
        value: currentMetrics.errorRate,
        threshold: baseline.deviationThresholds.errorRate.warning,
        message: `High error rate: ${currentMetrics.errorRate.toFixed(1)}% (baseline: ${baseline.metrics.normalErrorRate.toFixed(1)}%)`
      });
    }

    return {
      hasAnomaly: anomalies.length > 0,
      anomalies
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const avg = this.calculateAverage(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = this.calculateAverage(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sortedValues[lower];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
}