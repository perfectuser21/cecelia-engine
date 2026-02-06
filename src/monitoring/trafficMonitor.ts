/**
 * Traffic Monitor Module for Platform Monitoring
 * Collects and processes traffic data for baseline reporting
 */

export interface TrafficData {
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ip?: string;
}

export interface TrafficMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  uniqueIPs: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

export class TrafficMonitor {
  private dataPoints: TrafficData[] = [];

  /**
   * Add a traffic data point
   */
  addDataPoint(data: TrafficData): void {
    this.dataPoints.push(data);
  }

  /**
   * Clear all data points
   */
  clearData(): void {
    this.dataPoints = [];
  }

  /**
   * Get metrics for a specific time range
   */
  getMetrics(startTime: Date, endTime: Date): TrafficMetrics {
    const filteredData = this.dataPoints.filter(
      d => d.timestamp >= startTime && d.timestamp <= endTime
    );

    if (filteredData.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0,
        uniqueIPs: 0,
        topEndpoints: []
      };
    }

    const totalRequests = filteredData.length;
    const totalResponseTime = filteredData.reduce((sum, d) => sum + d.responseTime, 0);
    const averageResponseTime = totalResponseTime / totalRequests;

    const errorCount = filteredData.filter(d => d.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;

    const timeRangeMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    const requestsPerMinute = totalRequests / Math.max(1, timeRangeMinutes);

    const uniqueIPs = new Set(filteredData.map(d => d.ip).filter(ip => ip)).size;

    // Calculate top endpoints
    const endpointCounts = new Map<string, number>();
    filteredData.forEach(d => {
      endpointCounts.set(d.endpoint, (endpointCounts.get(d.endpoint) || 0) + 1);
    });

    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      requestsPerMinute,
      uniqueIPs,
      topEndpoints
    };
  }

  /**
   * Get data points for export
   */
  getDataPoints(): TrafficData[] {
    return [...this.dataPoints];
  }
}