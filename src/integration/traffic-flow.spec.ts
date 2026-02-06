/**
 * 完整数据流集成测试
 */

import { MockPlatformCollector } from '../collectors/mock-platform.collector';
import { StorageService } from '../services/storage.service';
import { BaselineEngine } from '../engines/baseline.engine';
import { AnomalyDetector } from '../engines/anomaly.detector';
import { ReportGenerator } from '../generators/report.generator';
import { BaselineMode, BaselineData } from '../models/baseline.model';
import { PlatformType, TrafficData } from '../models/traffic.model';

describe('Traffic Monitoring Flow Integration', () => {
  let collector: MockPlatformCollector;
  let storageService: StorageService;
  let baselineEngine: BaselineEngine;
  let anomalyDetector: AnomalyDetector;
  let reportGenerator: ReportGenerator;

  beforeEach(() => {
    // Initialize all components
    collector = new MockPlatformCollector();
    storageService = new StorageService();
    baselineEngine = new BaselineEngine();
    anomalyDetector = new AnomalyDetector();
    reportGenerator = new ReportGenerator();

    // Disable mock failures for predictable tests
    process.env.DISABLE_MOCK_FAILURES = 'true';
  });

  afterEach(async () => {
    await storageService.clearAll();
    delete process.env.DISABLE_MOCK_FAILURES;
  });

  describe('End-to-End Data Flow', () => {
    it('should complete full data collection to report generation flow', async () => {
      // Step 1: Collect data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const collectionResult = await collector.collect(startDate, endDate);
      expect(collectionResult.success).toBe(true);
      expect(collectionResult.data).toBeDefined();
      expect(collectionResult.data!.length).toBe(31); // 30 days + today

      // Step 2: Store data
      const storedData = await storageService.saveTrafficDataBatch(collectionResult.data!);
      expect(storedData.length).toBe(31);

      // Step 3: Calculate baseline
      const historicalData = await storageService.queryTrafficData({
        platform: PlatformType.MOCK,
        startDate: startDate,
        endDate: endDate,
      });

      const baseline = baselineEngine.calculateBaseline(
        historicalData,
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );
      expect(baseline).toBeDefined();

      // Step 4: Store baseline
      const savedBaseline = await storageService.saveBaselineData(baseline!);
      expect(savedBaseline.id).toBeDefined();

      // Step 5: Detect anomalies
      const anomalies = anomalyDetector.detectBatchAnomalies(historicalData, baseline!);
      // May or may not have anomalies due to randomness
      expect(Array.isArray(anomalies)).toBe(true);

      // Step 6: Generate report
      const baselines = new Map<PlatformType, BaselineData>();
      baselines.set(PlatformType.MOCK, baseline!);

      const report = await reportGenerator.generateMonthlyReport(
        historicalData,
        baselines,
        startDate,
        endDate
      );

      expect(report).toBeDefined();
      expect(report.metadata.title).toBeDefined();
      expect(report.overview.platformCount).toBe(1);
      expect(report.platformSummaries.length).toBe(1);
      expect(report.trends.length).toBe(1);
    });

    it('should handle multiple platforms', async () => {
      // Collect data for multiple platforms
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);

      // Mock platform data
      const mockResult = await collector.collect(startDate, endDate);
      await storageService.saveTrafficDataBatch(mockResult.data!);

      // Simulate YouTube data
      const youtubeData: TrafficData[] = [];
      for (let i = 0; i <= 14; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        youtubeData.push({
          platform: PlatformType.YOUTUBE,
          timestamp: date,
          pageViews: 2000 + Math.random() * 400,
          uniqueVisitors: 600 + Math.random() * 120,
          sessions: 800 + Math.random() * 160,
          avgSessionDuration: 240 + Math.random() * 60,
          bounceRate: 35 + Math.random() * 10,
        });
      }
      await storageService.saveTrafficDataBatch(youtubeData);

      // Calculate baselines for both platforms
      const mockData = await storageService.queryTrafficData({
        platform: PlatformType.MOCK,
      });
      const mockBaseline = baselineEngine.calculateBaseline(
        mockData,
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );

      const youtubeDataStored = await storageService.queryTrafficData({
        platform: PlatformType.YOUTUBE,
      });
      const youtubeBaseline = baselineEngine.calculateBaseline(
        youtubeDataStored,
        PlatformType.YOUTUBE,
        BaselineMode.WEEKLY
      );

      expect(mockBaseline).toBeDefined();
      expect(youtubeBaseline).toBeDefined();

      // Generate combined report
      const baselines = new Map<PlatformType, BaselineData>();
      baselines.set(PlatformType.MOCK, mockBaseline!);
      baselines.set(PlatformType.YOUTUBE, youtubeBaseline!);

      const allData = await storageService.queryTrafficData();
      const report = await reportGenerator.generateMonthlyReport(
        allData,
        baselines,
        startDate,
        endDate
      );

      expect(report.overview.platformCount).toBe(2);
      expect(report.platformSummaries.length).toBe(2);
      expect(report.trends.length).toBe(2);
    });

    it('should update baselines over time', async () => {
      // Initial data collection
      const phase1End = new Date();
      const phase1Start = new Date();
      phase1Start.setDate(phase1Start.getDate() - 14);

      const phase1Result = await collector.collect(phase1Start, phase1End);
      await storageService.saveTrafficDataBatch(phase1Result.data!);

      // Calculate initial baseline
      const phase1Data = await storageService.queryTrafficData({
        platform: PlatformType.MOCK,
      });
      const initialBaseline = baselineEngine.calculateBaseline(
        phase1Data,
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );
      await storageService.saveBaselineData(initialBaseline!);

      // Collect more data (simulate next week)
      const phase2End = new Date();
      phase2End.setDate(phase2End.getDate() + 7);
      const phase2Start = new Date();
      phase2Start.setDate(phase2Start.getDate() + 1);

      const phase2Result = await collector.collect(phase2Start, phase2End);
      await storageService.saveTrafficDataBatch(phase2Result.data!);

      // Calculate updated baseline
      const allData = await storageService.queryTrafficData({
        platform: PlatformType.MOCK,
      });
      const updatedBaseline = baselineEngine.calculateBaseline(
        allData,
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );
      await storageService.saveBaselineData(updatedBaseline!);

      // Verify we can retrieve the latest baseline
      const latestBaseline = await storageService.queryBaselineData(
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );

      expect(latestBaseline).toBeDefined();
      expect(latestBaseline!.sampleSize).toBeGreaterThan(initialBaseline!.sampleSize);
    });

    it('should handle data quality issues', async () => {
      // Create data with quality issues
      const poorQualityData: TrafficData[] = [
        {
          platform: PlatformType.MOCK,
          timestamp: new Date('2024-01-01'),
          pageViews: 0, // Missing data
          uniqueVisitors: 0,
          sessions: 0,
          avgSessionDuration: 0,
          bounceRate: 0,
        },
        {
          platform: PlatformType.MOCK,
          timestamp: new Date('2024-01-02'),
          pageViews: 1000,
          uniqueVisitors: 2000, // Illogical: more visitors than views
          sessions: 1500,
          avgSessionDuration: 180,
          bounceRate: 100, // Suspicious: 100% bounce
        },
        {
          platform: PlatformType.MOCK,
          timestamp: new Date('2024-01-03'),
          pageViews: 1000,
          uniqueVisitors: 300,
          sessions: 400,
          avgSessionDuration: 180,
          bounceRate: 45,
        },
      ];

      await storageService.saveTrafficDataBatch(poorQualityData);

      const storedData = await storageService.queryTrafficData({
        platform: PlatformType.MOCK,
      });

      // Should still be able to calculate baseline despite quality issues
      const baseline = baselineEngine.calculateBaseline(
        storedData,
        PlatformType.MOCK,
        BaselineMode.DAILY
      );

      expect(baseline).toBeDefined(); // Should handle poor quality data gracefully
    });

    it('should properly aggregate data by different modes', async () => {
      // Collect a month of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const result = await collector.collect(startDate, endDate);
      await storageService.saveTrafficDataBatch(result.data!);

      const data = await storageService.queryTrafficData({
        platform: PlatformType.MOCK,
      });

      // Test different aggregation modes
      const dailyAggregated = baselineEngine.aggregateByMode(data, BaselineMode.DAILY);
      const weeklyAggregated = baselineEngine.aggregateByMode(data, BaselineMode.WEEKLY);
      const monthlyAggregated = baselineEngine.aggregateByMode(data, BaselineMode.MONTHLY);

      expect(dailyAggregated.length).toBe(31); // One per day
      expect(weeklyAggregated.length).toBeLessThanOrEqual(6); // ~4-5 weeks
      expect(monthlyAggregated.length).toBeLessThanOrEqual(2); // 1-2 months
    });

    it('should detect and report significant anomalies', async () => {
      // Create normal baseline data
      const normalData: TrafficData[] = [];
      for (let i = 1; i <= 14; i++) {
        normalData.push({
          platform: PlatformType.MOCK,
          timestamp: new Date(`2024-01-${i.toString().padStart(2, '0')}`),
          pageViews: 1000 + Math.random() * 50, // Small variation
          uniqueVisitors: 300 + Math.random() * 15,
          sessions: 400 + Math.random() * 20,
          avgSessionDuration: 180 + Math.random() * 10,
          bounceRate: 45 + Math.random() * 2,
        });
      }

      // Add anomalous data
      normalData.push({
        platform: PlatformType.MOCK,
        timestamp: new Date('2024-01-15'),
        pageViews: 3000, // 3x normal
        uniqueVisitors: 900,
        sessions: 1200,
        avgSessionDuration: 180,
        bounceRate: 45,
      });

      await storageService.saveTrafficDataBatch(normalData);

      // Calculate baseline from normal data only
      const baselineData = normalData.slice(0, 14);
      const baseline = baselineEngine.calculateBaseline(
        baselineData,
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );

      // Detect anomalies
      const allData = await storageService.queryTrafficData({
        platform: PlatformType.MOCK,
      });
      const anomalies = anomalyDetector.detectBatchAnomalies(allData, baseline!);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].result.type).toBeDefined();
      expect(['spike', 'drop', 'pattern']).toContain(anomalies[0].result.type);

      // Generate report with anomalies
      const baselines = new Map<PlatformType, BaselineData>();
      baselines.set(PlatformType.MOCK, baseline!);

      const report = await reportGenerator.generateMonthlyReport(
        allData,
        baselines,
        new Date('2024-01-01'),
        new Date('2024-01-15')
      );

      expect(report.anomalies).toBeDefined();
      expect(report.anomalies!.length).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
      expect(
        report.recommendations!.some(r => r.includes('spike') || r.includes('drop') || r.includes('detected'))
      ).toBe(true);
    });

    it('should handle concurrent data operations', async () => {
      // Simulate concurrent data collection from multiple sources
      const promises = [];

      // Collect data for different date ranges concurrently
      for (let i = 0; i < 5; i++) {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 7);

        promises.push(
          collector.collect(start, end).then(result => {
            return storageService.saveTrafficDataBatch(result.data!);
          })
        );
      }

      const results = await Promise.all(promises);

      // Verify all data was saved
      const allData = await storageService.queryTrafficData();
      expect(allData.length).toBeGreaterThan(0);

      // Should be able to calculate baseline from all collected data
      const baseline = baselineEngine.calculateBaseline(
        allData,
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );

      expect(baseline).toBeDefined();
    });

    it('should clean up old data while preserving baselines', async () => {
      // Create old and new data
      const oldData: TrafficData[] = [];
      const newData: TrafficData[] = [];

      // Old data (2 months ago)
      for (let i = 1; i <= 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - 60 - i);
        oldData.push({
          platform: PlatformType.MOCK,
          timestamp: date,
          pageViews: 1000,
          uniqueVisitors: 300,
          sessions: 400,
          avgSessionDuration: 180,
          bounceRate: 45,
        });
      }

      // Recent data
      for (let i = 1; i <= 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        newData.push({
          platform: PlatformType.MOCK,
          timestamp: date,
          pageViews: 1200,
          uniqueVisitors: 350,
          sessions: 450,
          avgSessionDuration: 190,
          bounceRate: 42,
        });
      }

      await storageService.saveTrafficDataBatch([...oldData, ...newData]);

      // Calculate and save baseline
      const baseline = baselineEngine.calculateBaseline(
        newData,
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );
      await storageService.saveBaselineData(baseline!);

      // Delete old data
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const deletedCount = await storageService.deleteOldData(cutoffDate);

      expect(deletedCount).toBe(10); // Old data deleted

      // Verify baseline is still available
      const savedBaseline = await storageService.queryBaselineData(
        PlatformType.MOCK,
        BaselineMode.WEEKLY
      );
      expect(savedBaseline).toBeDefined();

      // Verify only recent data remains
      const remainingData = await storageService.queryTrafficData();
      expect(remainingData.length).toBe(10);
    });
  });
});