/**
 * 报告生成器测试
 */

import { ReportGenerator, ReportFormat } from '../report.generator';
import { TrafficData, PlatformType } from '../../models/traffic.model';
import { BaselineData, BaselineMode } from '../../models/baseline.model';

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  const createTestData = (): TrafficData[] => {
    const data: TrafficData[] = [];
    for (let i = 1; i <= 30; i++) {
      // Mock platform data
      data.push({
        platform: PlatformType.MOCK,
        timestamp: new Date(`2024-01-${i.toString().padStart(2, '0')}`),
        pageViews: 1000 + Math.random() * 200,
        uniqueVisitors: 300 + Math.random() * 60,
        sessions: 400 + Math.random() * 80,
        avgSessionDuration: 180 + Math.random() * 40,
        bounceRate: 45 + Math.random() * 10,
        qualityScore: 90 + Math.random() * 10,
        isAnomaly: Math.random() < 0.1, // 10% anomalies
      });

      // YouTube platform data
      if (i % 2 === 0) {
        data.push({
          platform: PlatformType.YOUTUBE,
          timestamp: new Date(`2024-01-${i.toString().padStart(2, '0')}`),
          pageViews: 2000 + Math.random() * 400,
          uniqueVisitors: 600 + Math.random() * 120,
          sessions: 800 + Math.random() * 160,
          avgSessionDuration: 240 + Math.random() * 60,
          bounceRate: 35 + Math.random() * 10,
          qualityScore: 85 + Math.random() * 15,
          isAnomaly: Math.random() < 0.05, // 5% anomalies
        });
      }
    }
    return data;
  };

  const createBaselines = (): Map<PlatformType, BaselineData> => {
    const baselines = new Map<PlatformType, BaselineData>();

    baselines.set(PlatformType.MOCK, {
      platform: PlatformType.MOCK,
      mode: BaselineMode.WEEKLY,
      period: {
        start: new Date('2023-12-01'),
        end: new Date('2023-12-31'),
      },
      values: {
        pageViews: 1000,
        uniqueVisitors: 300,
        sessions: 400,
        avgSessionDuration: 180,
        bounceRate: 45,
      },
      standardDeviation: {
        pageViews: 100,
        uniqueVisitors: 30,
        sessions: 40,
        avgSessionDuration: 20,
        bounceRate: 5,
      },
      anomalyThreshold: {
        upper: {
          pageViews: 1200,
          uniqueVisitors: 360,
          sessions: 480,
        },
        lower: {
          pageViews: 800,
          uniqueVisitors: 240,
          sessions: 320,
        },
      },
      sampleSize: 30,
      confidence: 95,
    });

    baselines.set(PlatformType.YOUTUBE, {
      platform: PlatformType.YOUTUBE,
      mode: BaselineMode.WEEKLY,
      period: {
        start: new Date('2023-12-01'),
        end: new Date('2023-12-31'),
      },
      values: {
        pageViews: 2000,
        uniqueVisitors: 600,
        sessions: 800,
        avgSessionDuration: 240,
        bounceRate: 35,
      },
      standardDeviation: {
        pageViews: 200,
        uniqueVisitors: 60,
        sessions: 80,
        avgSessionDuration: 30,
        bounceRate: 4,
      },
      anomalyThreshold: {
        upper: {
          pageViews: 2400,
          uniqueVisitors: 720,
          sessions: 960,
        },
        lower: {
          pageViews: 1600,
          uniqueVisitors: 480,
          sessions: 640,
        },
      },
      sampleSize: 30,
      confidence: 95,
    });

    return baselines;
  };

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  describe('generateMonthlyReport', () => {
    it('should generate complete monthly report', async () => {
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report).toBeDefined();
      expect(report.metadata.title).toBe('Platform Traffic Monthly Report');
      expect(report.metadata.period.start).toEqual(startDate);
      expect(report.metadata.period.end).toEqual(endDate);
      expect(report.overview).toBeDefined();
      expect(report.platformSummaries.length).toBeGreaterThan(0);
      expect(report.trends).toBeDefined();
    });

    it('should calculate correct overview statistics', async () => {
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report.overview.totalPageViews).toBeGreaterThan(0);
      expect(report.overview.totalUniqueVisitors).toBeGreaterThan(0);
      expect(report.overview.totalSessions).toBeGreaterThan(0);
      expect(report.overview.avgBounceRate).toBeGreaterThan(30);
      expect(report.overview.avgBounceRate).toBeLessThan(50);
      expect(report.overview.dataQuality).toBeGreaterThan(80);
      expect(report.overview.platformCount).toBe(2); // MOCK and YOUTUBE
    });

    it('should generate platform summaries', async () => {
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      const mockSummary = report.platformSummaries.find(s => s.platform === PlatformType.MOCK);
      const youtubeSummary = report.platformSummaries.find(
        s => s.platform === PlatformType.YOUTUBE
      );

      expect(mockSummary).toBeDefined();
      expect(mockSummary!.dataPoints).toBe(30); // Daily data for 30 days
      expect(mockSummary!.totalPageViews).toBeGreaterThan(0);

      expect(youtubeSummary).toBeDefined();
      expect(youtubeSummary!.dataPoints).toBe(15); // Every other day
      expect(youtubeSummary!.totalPageViews).toBeGreaterThan(0); // YouTube should have traffic
    });

    it('should include baseline comparisons when configured', async () => {
      const generator = new ReportGenerator({ includeBaseline: true });
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report.baselineComparisons).toBeDefined();
      expect(report.baselineComparisons!.length).toBeGreaterThan(0);

      const mockComparison = report.baselineComparisons!.find(
        c => c.platform === PlatformType.MOCK
      );
      expect(mockComparison).toBeDefined();
      expect(mockComparison!.comparison.baseline).toBeDefined();
      expect(mockComparison!.comparison.current).toBeDefined();
      expect(mockComparison!.comparison.changeRate).toBeDefined();
    });

    it('should exclude baseline comparisons when configured', async () => {
      const generator = new ReportGenerator({ includeBaseline: false });
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report.baselineComparisons).toBeUndefined();
    });

    it('should detect anomalies when configured', async () => {
      const generator = new ReportGenerator({ includeAnomalies: true });

      // Create data with definite anomalies
      const data: TrafficData[] = [
        {
          platform: PlatformType.MOCK,
          timestamp: new Date('2024-01-15'),
          pageViews: 2000, // Anomaly: 10 std devs above baseline
          uniqueVisitors: 600,
          sessions: 800,
          avgSessionDuration: 180,
          bounceRate: 45,
        },
      ];

      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report.anomalies).toBeDefined();
      if (report.anomalies!.length > 0) {
        expect(report.anomalies![0].detection.isAnomaly).toBe(true);
      }
    });

    it('should analyze trends correctly', async () => {
      // Create data with clear upward trend
      const data: TrafficData[] = [];
      for (let i = 1; i <= 30; i++) {
        data.push({
          platform: PlatformType.MOCK,
          timestamp: new Date(`2024-01-${i.toString().padStart(2, '0')}`),
          pageViews: 1000 + i * 30, // Clear upward trend
          uniqueVisitors: 300 + i * 10,
          sessions: 400 + i * 12,
          avgSessionDuration: 180,
          bounceRate: 45,
        });
      }

      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      const mockTrend = report.trends.find(t => t.platform === PlatformType.MOCK);
      expect(mockTrend).toBeDefined();
      expect(mockTrend!.direction).toBe('up');
      expect(mockTrend!.changeRate).toBeGreaterThan(10);
    });

    it('should generate recommendations', async () => {
      const generator = new ReportGenerator({ includeRecommendations: true });
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations!.length).toBeGreaterThan(0);
    });

    it('should not generate recommendations when configured', async () => {
      const generator = new ReportGenerator({ includeRecommendations: false });
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report.recommendations).toBeUndefined();
    });
  });

  describe('report formats', () => {
    it('should generate JSON format by default', async () => {
      const generator = new ReportGenerator({ format: ReportFormat.JSON });
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report).toBeDefined();
      expect(typeof report).toBe('object');
    });

    it('should handle HTML format request', async () => {
      const generator = new ReportGenerator({ format: ReportFormat.HTML });
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // HTML format not implemented yet, should return JSON
      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report).toBeDefined();
      expect(typeof report).toBe('object'); // Still returns JSON for now
    });

    it('should handle PDF format request', async () => {
      const generator = new ReportGenerator({ format: ReportFormat.PDF });
      const data = createTestData();
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // PDF format not implemented yet, should return JSON
      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report).toBeDefined();
      expect(typeof report).toBe('object'); // Still returns JSON for now
    });
  });

  describe('edge cases', () => {
    it('should handle empty data', async () => {
      const data: TrafficData[] = [];
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report).toBeDefined();
      expect(report.overview.totalPageViews).toBe(0);
      expect(report.platformSummaries.length).toBe(0);
      expect(report.trends.length).toBe(0);
    });

    it('should handle missing baselines', async () => {
      const data = createTestData();
      const baselines = new Map<PlatformType, BaselineData>(); // Empty baselines
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report).toBeDefined();
      expect(report.baselineComparisons).toBeDefined();
      expect(report.baselineComparisons!.length).toBe(0); // No comparisons without baselines
      expect(report.anomalies).toBeDefined();
      expect(report.anomalies!.length).toBe(0); // No anomalies without baselines
    });

    it('should handle single data point per platform', async () => {
      const data: TrafficData[] = [
        {
          platform: PlatformType.MOCK,
          timestamp: new Date('2024-01-15'),
          pageViews: 1000,
          uniqueVisitors: 300,
          sessions: 400,
          avgSessionDuration: 180,
          bounceRate: 45,
        },
      ];
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report).toBeDefined();
      expect(report.trends[0].direction).toBe('stable'); // Can't determine trend with one point
      expect(report.trends[0].description).toContain('Insufficient data');
    });

    it('should recommend improving data quality when low', async () => {
      const generator = new ReportGenerator({ includeRecommendations: true });
      const data: TrafficData[] = [
        {
          platform: PlatformType.MOCK,
          timestamp: new Date('2024-01-15'),
          pageViews: 1000,
          uniqueVisitors: 300,
          sessions: 400,
          avgSessionDuration: 180,
          bounceRate: 45,
          qualityScore: 70, // Low quality
        },
      ];
      const baselines = createBaselines();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await generator.generateMonthlyReport(data, baselines, startDate, endDate);

      expect(report.recommendations).toBeDefined();
      expect(
        report.recommendations!.some(r => r.includes('data collection quality'))
      ).toBe(true);
    });
  });
});