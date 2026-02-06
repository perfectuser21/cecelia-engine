/**
 * Tests for Batch Processor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchProcessor } from './batch.js';

// Mock ContentGenerator
vi.mock('./generator', () => ({
  ContentGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      content: { title: 'Test', body: 'Content' },
      metadata: { type: 'article' },
      quality: { score: 0.8, status: 'approved' }
    })
  }))
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock p-limit
vi.mock('p-limit', () => ({
  default: vi.fn(() => (fn) => fn())
}));

describe('BatchProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new BatchProcessor({ concurrency: 3 });
  });

  describe('processBatch', () => {
    it('should process multiple jobs successfully', async () => {
      const jobs = [
        { type: 'article', params: { topic: 'Topic 1' } },
        { type: 'social', params: { topic: 'Topic 2' } },
        { type: 'video_script', params: { topic: 'Topic 3' } }
      ];

      const result = await processor.processBatch(jobs);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.successRate).toBe(100);
    });

    it('should handle mixed success and failure', async () => {
      // Mock some failures
      let callCount = 0;
      processor.generator.generate = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Generation failed'));
        }
        return Promise.resolve({
          content: { title: 'Test', body: 'Content' },
          metadata: { type: 'article' },
          quality: { score: 0.8 }
        });
      });

      const jobs = [
        { type: 'article', params: { topic: 'Topic 1' } },
        { type: 'article', params: { topic: 'Topic 2' } },
        { type: 'article', params: { topic: 'Topic 3' } }
      ];

      const result = await processor.processBatch(jobs);

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.summary.successRate).toBeLessThan(100);
    });
  });

  describe('generateWave', () => {
    it('should process jobs in waves', async () => {
      const jobs = Array(10).fill(null).map((_, i) => ({
        type: 'article',
        params: { topic: `Topic ${i}` }
      }));

      const progressUpdates = [];
      const result = await processor.generateWave(jobs, (progress) => {
        progressUpdates.push(progress);
      });

      expect(result.results).toHaveLength(10);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
    });
  });

  describe('retryFailed', () => {
    it('should retry failed jobs', async () => {
      let attemptCount = 0;
      processor.generator.generate = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          content: { title: 'Success', body: 'After retry' },
          metadata: { type: 'article' },
          quality: { score: 0.9 }
        });
      });

      const initialResults = {
        results: [
          {
            job: { type: 'article', params: { topic: 'Test' } },
            status: 'rejected',
            data: null,
            error: 'Initial failure'
          }
        ],
        summary: { successful: 0, failed: 1 }
      };

      const retryResults = await processor.retryFailed(initialResults, 2);

      expect(retryResults.results.some(r => r.status === 'fulfilled')).toBe(true);
    });

    it('should handle permanent failures after max retries', async () => {
      processor.generator.generate = vi.fn().mockRejectedValue(
        new Error('Permanent failure')
      );

      const initialResults = {
        results: [
          {
            job: { type: 'article', params: { topic: 'Test' } },
            status: 'rejected',
            data: null,
            error: 'Initial failure'
          }
        ],
        summary: { successful: 0, failed: 1 }
      };

      const retryResults = await processor.retryFailed(initialResults, 2);

      expect(retryResults.results.every(r => r.status === 'rejected')).toBe(true);
    });
  });

  describe('summarizeResults', () => {
    it('should calculate correct summary statistics', () => {
      const results = [
        { status: 'fulfilled', value: { quality: { score: 0.8 } } },
        { status: 'fulfilled', value: { quality: { score: 0.9 } } },
        { status: 'rejected', reason: new Error('Failed') },
        { status: 'fulfilled', value: { quality: { score: 0.7 } } }
      ];

      const summary = processor.summarizeResults(results);

      expect(summary.successful).toBe(3);
      expect(summary.failed).toBe(1);
      expect(summary.successRate).toBe(75);
      expect(summary.averageQuality).toBeCloseTo(0.8, 1);
    });
  });
});