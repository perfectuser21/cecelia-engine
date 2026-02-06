/**
 * 异常检测器
 */

import { TrafficData } from '../models/traffic.model';
import {
  BaselineData,
  AnomalyDetectionResult,
  BaselineComparison,
} from '../models/baseline.model';

/**
 * 异常检测器
 */
export class AnomalyDetector {
  /**
   * 检测单个数据点是否异常
   * @param data 待检测的流量数据
   * @param baseline 基线数据
   * @returns 异常检测结果
   */
  detectAnomaly(data: TrafficData, baseline: BaselineData): AnomalyDetectionResult {
    const anomalousMetrics: string[] = [];
    const deviations: number[] = [];

    // 检查页面浏览量
    const pageViewsDeviation = this.calculateDeviation(
      data.pageViews,
      baseline.values.pageViews,
      baseline.standardDeviation.pageViews
    );
    if (Math.abs(pageViewsDeviation) > 2) {
      anomalousMetrics.push('pageViews');
      deviations.push(pageViewsDeviation);
    }

    // 检查独立访客数
    const uniqueVisitorsDeviation = this.calculateDeviation(
      data.uniqueVisitors,
      baseline.values.uniqueVisitors,
      baseline.standardDeviation.uniqueVisitors
    );
    if (Math.abs(uniqueVisitorsDeviation) > 2) {
      anomalousMetrics.push('uniqueVisitors');
      deviations.push(uniqueVisitorsDeviation);
    }

    // 检查会话数
    const sessionsDeviation = this.calculateDeviation(
      data.sessions,
      baseline.values.sessions,
      baseline.standardDeviation.sessions
    );
    if (Math.abs(sessionsDeviation) > 2) {
      anomalousMetrics.push('sessions');
      deviations.push(sessionsDeviation);
    }

    // 确定异常类型
    const isAnomaly = anomalousMetrics.length > 0;
    let type: 'spike' | 'drop' | 'pattern' | undefined;
    let description = '';

    if (isAnomaly) {
      const maxDeviation = Math.max(...deviations.map(Math.abs));
      const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;

      if (avgDeviation > 0) {
        type = 'spike';
        description = `Traffic spike detected: ${anomalousMetrics.join(', ')} are ${maxDeviation.toFixed(1)} standard deviations above normal`;
      } else {
        type = 'drop';
        description = `Traffic drop detected: ${anomalousMetrics.join(', ')} are ${Math.abs(maxDeviation).toFixed(1)} standard deviations below normal`;
      }

      // 检查模式异常（多个指标异常且方向不一致）
      if (anomalousMetrics.length >= 2) {
        const hasPositive = deviations.some(d => d > 0);
        const hasNegative = deviations.some(d => d < 0);
        if (hasPositive && hasNegative) {
          type = 'pattern';
          description = `Pattern anomaly detected: Multiple metrics (${anomalousMetrics.join(', ')}) are abnormal with mixed directions`;
        }
      }
    }

    return {
      isAnomaly,
      type,
      anomalousMetrics,
      deviation: isAnomaly ? Math.max(...deviations.map(Math.abs)) : 0,
      confidence: this.calculateConfidence(deviations),
      description,
    };
  }

  /**
   * 比较当前数据与基线
   * @param data 当前流量数据
   * @param baseline 基线数据
   * @returns 基线比较结果
   */
  compareWithBaseline(data: TrafficData, baseline: BaselineData): BaselineComparison {
    // 计算当前值
    const current = {
      pageViews: data.pageViews,
      uniqueVisitors: data.uniqueVisitors,
      sessions: data.sessions,
      avgSessionDuration: data.avgSessionDuration,
      bounceRate: data.bounceRate,
    };

    // 基线值
    const baselineValues = baseline.values;

    // 计算变化率（百分比）
    const changeRate = {
      pageViews: this.calculateChangeRate(current.pageViews, baselineValues.pageViews),
      uniqueVisitors: this.calculateChangeRate(current.uniqueVisitors, baselineValues.uniqueVisitors),
      sessions: this.calculateChangeRate(current.sessions, baselineValues.sessions),
      avgSessionDuration: this.calculateChangeRate(current.avgSessionDuration, baselineValues.avgSessionDuration),
      bounceRate: this.calculateChangeRate(current.bounceRate, baselineValues.bounceRate),
    };

    // 计算偏差（标准差倍数）
    const deviation = {
      pageViews: this.calculateDeviation(
        current.pageViews,
        baselineValues.pageViews,
        baseline.standardDeviation.pageViews
      ),
      uniqueVisitors: this.calculateDeviation(
        current.uniqueVisitors,
        baselineValues.uniqueVisitors,
        baseline.standardDeviation.uniqueVisitors
      ),
      sessions: this.calculateDeviation(
        current.sessions,
        baselineValues.sessions,
        baseline.standardDeviation.sessions
      ),
      avgSessionDuration: this.calculateDeviation(
        current.avgSessionDuration,
        baselineValues.avgSessionDuration,
        baseline.standardDeviation.avgSessionDuration
      ),
      bounceRate: this.calculateDeviation(
        current.bounceRate,
        baselineValues.bounceRate,
        baseline.standardDeviation.bounceRate
      ),
    };

    // 异常检测
    const anomalyDetection = this.detectAnomaly(data, baseline);

    return {
      current,
      baseline: baselineValues,
      changeRate,
      deviation,
      anomalyDetection,
    };
  }

  /**
   * 批量检测异常
   * @param dataArray 流量数据数组
   * @param baseline 基线数据
   * @returns 异常数据数组
   */
  detectBatchAnomalies(
    dataArray: TrafficData[],
    baseline: BaselineData
  ): Array<{ data: TrafficData; result: AnomalyDetectionResult }> {
    const anomalies: Array<{ data: TrafficData; result: AnomalyDetectionResult }> = [];

    dataArray.forEach(data => {
      const result = this.detectAnomaly(data, baseline);
      if (result.isAnomaly) {
        anomalies.push({ data, result });
      }
    });

    return anomalies;
  }

  /**
   * 检测趋势异常
   * @param dataArray 时间序列数据（按时间排序）
   * @param windowSize 滑动窗口大小
   * @returns 趋势异常点
   */
  detectTrendAnomalies(
    dataArray: TrafficData[],
    windowSize: number = 7
  ): Array<{ index: number; data: TrafficData; trend: string }> {
    const anomalies: Array<{ index: number; data: TrafficData; trend: string }> = [];

    if (dataArray.length < windowSize * 2) {
      return anomalies;
    }

    for (let i = windowSize; i < dataArray.length - windowSize; i++) {
      // 前窗口
      const beforeWindow = dataArray.slice(i - windowSize, i);
      const beforeAvg = this.calculateAverage(beforeWindow.map(d => d.pageViews));

      // 后窗口
      const afterWindow = dataArray.slice(i, i + windowSize);
      const afterAvg = this.calculateAverage(afterWindow.map(d => d.pageViews));

      // 当前点
      const current = dataArray[i];

      // 检测突变
      const changeRate = Math.abs((afterAvg - beforeAvg) / beforeAvg) * 100;
      if (changeRate > 50) {
        // 50% 的突变
        const trend = afterAvg > beforeAvg ? 'sudden_increase' : 'sudden_decrease';
        anomalies.push({ index: i, data: current, trend });
      }
    }

    return anomalies;
  }

  /**
   * 计算偏差（标准差倍数）
   * @param value 当前值
   * @param mean 平均值
   * @param stdDev 标准差
   * @returns 偏差倍数
   */
  private calculateDeviation(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * 计算变化率
   * @param current 当前值
   * @param baseline 基线值
   * @returns 变化率（百分比）
   */
  private calculateChangeRate(current: number, baseline: number): number {
    if (baseline === 0) return current === 0 ? 0 : 100;
    return ((current - baseline) / baseline) * 100;
  }

  /**
   * 计算置信度
   * @param deviations 偏差数组
   * @returns 置信度（0-100）
   */
  private calculateConfidence(deviations: number[]): number {
    if (deviations.length === 0) return 0;

    const maxDeviation = Math.max(...deviations.map(Math.abs));

    // 根据偏差大小计算置信度
    if (maxDeviation < 2) return 50;
    if (maxDeviation < 3) return 75;
    if (maxDeviation < 4) return 90;
    return 95;
  }

  /**
   * 计算平均值
   * @param values 数值数组
   * @returns 平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}