/**
 * Unit tests for TrafficMonitor
 */

import { TrafficMonitor, TrafficData, TrafficMetrics } from './trafficMonitor';

describe('TrafficMonitor', () => {
  let monitor: TrafficMonitor;

  beforeEach(() => {
    monitor = new TrafficMonitor();
  });

  describe('addDataPoint', () => {
    it('should add a traffic data point', () => {
      const dataPoint: TrafficData = {
        timestamp: new Date('2026-02-06T12:00:00Z'),
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1'
      };

      monitor.addDataPoint(dataPoint);
      const points = monitor.getDataPoints();

      expect(points).toHaveLength(1);
      expect(points[0]).toEqual(dataPoint);
    });

    it('should add multiple data points', () => {
      const dataPoints: TrafficData[] = [
        {
          timestamp: new Date('2026-02-06T12:00:00Z'),
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 150
        },
        {
          timestamp: new Date('2026-02-06T12:01:00Z'),
          endpoint: '/api/posts',
          method: 'POST',
          statusCode: 201,
          responseTime: 250
        }
      ];

      dataPoints.forEach(dp => monitor.addDataPoint(dp));
      const points = monitor.getDataPoints();

      expect(points).toHaveLength(2);
    });
  });

  describe('clearData', () => {
    it('should clear all data points', () => {
      const dataPoint: TrafficData = {
        timestamp: new Date(),
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 200,
        responseTime: 150
      };

      monitor.addDataPoint(dataPoint);
      expect(monitor.getDataPoints()).toHaveLength(1);

      monitor.clearData();
      expect(monitor.getDataPoints()).toHaveLength(0);
    });
  });

  describe('getMetrics', () => {
    it('should return empty metrics for no data', () => {
      const startTime = new Date('2026-02-06T12:00:00Z');
      const endTime = new Date('2026-02-06T13:00:00Z');

      const metrics = monitor.getMetrics(startTime, endTime);

      expect(metrics).toEqual({
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0,
        uniqueIPs: 0,
        topEndpoints: []
      });
    });

    it('should calculate correct metrics for single data point', () => {
      const dataPoint: TrafficData = {
        timestamp: new Date('2026-02-06T12:30:00Z'),
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        ip: '192.168.1.1'
      };

      monitor.addDataPoint(dataPoint);

      const startTime = new Date('2026-02-06T12:00:00Z');
      const endTime = new Date('2026-02-06T13:00:00Z');
      const metrics = monitor.getMetrics(startTime, endTime);

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.averageResponseTime).toBe(150);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.requestsPerMinute).toBeCloseTo(1 / 60, 2);
      expect(metrics.uniqueIPs).toBe(1);
      expect(metrics.topEndpoints).toEqual([
        { endpoint: '/api/users', count: 1 }
      ]);
    });

    it('should calculate correct metrics for multiple data points', () => {
      const dataPoints: TrafficData[] = [
        {
          timestamp: new Date('2026-02-06T12:10:00Z'),
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 100,
          ip: '192.168.1.1'
        },
        {
          timestamp: new Date('2026-02-06T12:15:00Z'),
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 200,
          ip: '192.168.1.2'
        },
        {
          timestamp: new Date('2026-02-06T12:20:00Z'),
          endpoint: '/api/posts',
          method: 'POST',
          statusCode: 500,
          responseTime: 300,
          ip: '192.168.1.1'
        },
        {
          timestamp: new Date('2026-02-06T12:25:00Z'),
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 404,
          responseTime: 50,
          ip: '192.168.1.3'
        }
      ];

      dataPoints.forEach(dp => monitor.addDataPoint(dp));

      const startTime = new Date('2026-02-06T12:00:00Z');
      const endTime = new Date('2026-02-06T13:00:00Z');
      const metrics = monitor.getMetrics(startTime, endTime);

      expect(metrics.totalRequests).toBe(4);
      expect(metrics.averageResponseTime).toBe((100 + 200 + 300 + 50) / 4);
      expect(metrics.errorRate).toBe(50); // 2 errors out of 4 requests
      expect(metrics.requestsPerMinute).toBeCloseTo(4 / 60, 2);
      expect(metrics.uniqueIPs).toBe(3);
      expect(metrics.topEndpoints).toEqual([
        { endpoint: '/api/users', count: 3 },
        { endpoint: '/api/posts', count: 1 }
      ]);
    });

    it('should filter data points by time range', () => {
      const dataPoints: TrafficData[] = [
        {
          timestamp: new Date('2026-02-06T11:50:00Z'), // Before range
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 100
        },
        {
          timestamp: new Date('2026-02-06T12:10:00Z'), // In range
          endpoint: '/api/posts',
          method: 'POST',
          statusCode: 201,
          responseTime: 200
        },
        {
          timestamp: new Date('2026-02-06T12:30:00Z'), // In range
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 150
        },
        {
          timestamp: new Date('2026-02-06T13:10:00Z'), // After range
          endpoint: '/api/comments',
          method: 'DELETE',
          statusCode: 204,
          responseTime: 50
        }
      ];

      dataPoints.forEach(dp => monitor.addDataPoint(dp));

      const startTime = new Date('2026-02-06T12:00:00Z');
      const endTime = new Date('2026-02-06T13:00:00Z');
      const metrics = monitor.getMetrics(startTime, endTime);

      expect(metrics.totalRequests).toBe(2); // Only the 2 in range
      expect(metrics.averageResponseTime).toBe((200 + 150) / 2);
    });

    it('should handle data points without IP addresses', () => {
      const dataPoints: TrafficData[] = [
        {
          timestamp: new Date('2026-02-06T12:10:00Z'),
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 100,
          ip: '192.168.1.1'
        },
        {
          timestamp: new Date('2026-02-06T12:15:00Z'),
          endpoint: '/api/posts',
          method: 'POST',
          statusCode: 201,
          responseTime: 200
          // No IP
        },
        {
          timestamp: new Date('2026-02-06T12:20:00Z'),
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 150,
          ip: '192.168.1.2'
        }
      ];

      dataPoints.forEach(dp => monitor.addDataPoint(dp));

      const startTime = new Date('2026-02-06T12:00:00Z');
      const endTime = new Date('2026-02-06T13:00:00Z');
      const metrics = monitor.getMetrics(startTime, endTime);

      expect(metrics.uniqueIPs).toBe(2); // Only count the ones with IPs
    });

    it('should return top 5 endpoints only', () => {
      const endpoints = [
        '/api/users',
        '/api/posts',
        '/api/comments',
        '/api/tags',
        '/api/categories',
        '/api/search',
        '/api/auth'
      ];

      // Create data points with varying counts for each endpoint
      endpoints.forEach((endpoint, index) => {
        for (let i = 0; i < index + 1; i++) {
          monitor.addDataPoint({
            timestamp: new Date('2026-02-06T12:00:00Z'),
            endpoint,
            method: 'GET',
            statusCode: 200,
            responseTime: 100
          });
        }
      });

      const startTime = new Date('2026-02-06T12:00:00Z');
      const endTime = new Date('2026-02-06T13:00:00Z');
      const metrics = monitor.getMetrics(startTime, endTime);

      expect(metrics.topEndpoints).toHaveLength(5);
      expect(metrics.topEndpoints[0]).toEqual({ endpoint: '/api/auth', count: 7 });
      expect(metrics.topEndpoints[4]).toEqual({ endpoint: '/api/comments', count: 3 });
    });

    it('should calculate requests per minute correctly for different time ranges', () => {
      const dataPoints: TrafficData[] = [
        {
          timestamp: new Date('2026-02-06T12:00:00Z'),
          endpoint: '/api/users',
          method: 'GET',
          statusCode: 200,
          responseTime: 100
        },
        {
          timestamp: new Date('2026-02-06T12:05:00Z'),
          endpoint: '/api/posts',
          method: 'POST',
          statusCode: 201,
          responseTime: 200
        }
      ];

      dataPoints.forEach(dp => monitor.addDataPoint(dp));

      // 10 minute range
      const startTime1 = new Date('2026-02-06T12:00:00Z');
      const endTime1 = new Date('2026-02-06T12:10:00Z');
      const metrics1 = monitor.getMetrics(startTime1, endTime1);
      expect(metrics1.requestsPerMinute).toBeCloseTo(2 / 10, 2);

      // 60 minute range
      const startTime2 = new Date('2026-02-06T12:00:00Z');
      const endTime2 = new Date('2026-02-06T13:00:00Z');
      const metrics2 = monitor.getMetrics(startTime2, endTime2);
      expect(metrics2.requestsPerMinute).toBeCloseTo(2 / 60, 2);
    });
  });

  describe('getDataPoints', () => {
    it('should return a copy of data points array', () => {
      const dataPoint: TrafficData = {
        timestamp: new Date(),
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 200,
        responseTime: 150
      };

      monitor.addDataPoint(dataPoint);
      const points1 = monitor.getDataPoints();
      const points2 = monitor.getDataPoints();

      expect(points1).not.toBe(points2); // Different array references
      expect(points1).toEqual(points2); // But same content
    });
  });
});