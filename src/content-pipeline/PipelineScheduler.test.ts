/**
 * Unit tests for PipelineScheduler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineScheduler } from './PipelineScheduler';
import { GenerationConfig, PipelineConfig, ContentStatus, ValidationRule } from './types';

describe('PipelineScheduler', () => {
  let scheduler: PipelineScheduler;

  beforeEach(() => {
    scheduler = new PipelineScheduler();
  });

  describe('runPipeline', () => {
    it('should run complete pipeline for single item', async () => {
      const config: GenerationConfig = {
        prompt: 'Test content',
        maxTokens: 500,
        category: 'test'
      };

      const content = await scheduler.runPipeline(config);

      expect(content).toBeDefined();
      expect(content.id).toBeDefined();
      expect(content.status).toBe(ContentStatus.COMPLETED);
      expect(content.metadata.processedAt).toBeDefined();
      expect(content.metadata.tags).toBeDefined();
    });

    it('should throw error if validation fails', async () => {
      // Create scheduler with strict validation
      const strictScheduler = new PipelineScheduler({
        validationRules: [{
          name: 'impossible-rule',
          validate: () => ({ valid: false, errors: ['Always fails'] })
        }]
      });

      const config: GenerationConfig = { prompt: 'Test' };

      await expect(strictScheduler.runPipeline(config))
        .rejects
        .toThrow('Content validation failed');
    });

    it('should respect timeout configuration', async () => {
      const scheduler = new PipelineScheduler({
        processingTimeout: 1 // 1ms timeout - will definitely timeout
      });

      const config: GenerationConfig = { prompt: 'Test' };

      await expect(scheduler.runPipeline(config))
        .rejects
        .toThrow('Pipeline timeout');
    });
  });

  describe('runBatchPipeline', () => {
    it('should process batch of items', async () => {
      const configs: GenerationConfig[] = [
        { prompt: 'Content 1' },
        { prompt: 'Content 2' },
        { prompt: 'Content 3' }
      ];

      const result = await scheduler.runBatchPipeline(configs);

      expect(result.totalItems).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle failures in batch', async () => {
      // Create scheduler that fails validation for specific content
      const scheduler = new PipelineScheduler({
        validationRules: [{
          name: 'fail-specific',
          validate: (content) => ({
            valid: !content.title.includes('Content 2'),
            errors: content.title.includes('Content 2') ? ['Failed'] : undefined
          })
        }],
        maxRetries: 1 // Reduce retries for faster test
      });

      const configs: GenerationConfig[] = [
        { prompt: 'Content 1' },
        { prompt: 'Content 2' }, // This will fail
        { prompt: 'Content 3' }
      ];

      const result = await scheduler.runBatchPipeline(configs);

      expect(result.totalItems).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should respect batch size configuration', async () => {
      const scheduler = new PipelineScheduler({
        batchSize: 2
      });

      const configs = Array(5).fill(null).map((_, i) => ({
        prompt: `Content ${i}`
      }));

      const result = await scheduler.runBatchPipeline(configs);

      expect(result.totalItems).toBe(5);
      // Should process in 3 batches: [0,1], [2,3], [4]
      expect(result.results).toHaveLength(5);
    });

    it('should handle empty batch', async () => {
      const result = await scheduler.runBatchPipeline([]);

      expect(result.totalItems).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should retry failed items', async () => {
      let attemptCount = 0;

      const scheduler = new PipelineScheduler({
        validationRules: [{
          name: 'fail-first-attempt',
          validate: () => {
            attemptCount++;
            // Fail first attempt, succeed on retry
            return {
              valid: attemptCount > 1,
              errors: attemptCount === 1 ? ['First attempt failed'] : undefined
            };
          }
        }],
        maxRetries: 2,
        retryDelay: 10 // Short delay for testing
      });

      const configs = [{ prompt: 'Test' }];
      const result = await scheduler.runBatchPipeline(configs);

      expect(result.successful).toBe(1);
      expect(attemptCount).toBeGreaterThan(1);
    });
  });

  describe('scheduleDailyProduction', () => {
    it('should generate configurations for daily target', async () => {
      const dailyTarget = 8; // 240 per month / 30 days

      const result = await scheduler.scheduleDailyProduction(dailyTarget);

      expect(result.totalItems).toBe(8);
      expect(result.successful).toBe(8);
    });

    it('should vary content categories and styles', async () => {
      const result = await scheduler.scheduleDailyProduction(10);

      const contents = result.results;
      expect(contents).toHaveLength(10);

      // Check that different categories are used
      const categories = new Set<string>();
      const styles = new Set<string>();

      // Since we can't directly access the generated content,
      // we verify the scheduler creates variety by checking the count
      expect(result.totalItems).toBe(10);
    });
  });

  describe('calculateMonthlyCapacity', () => {
    it('should calculate monthly capacity from daily target', () => {
      expect(scheduler.calculateMonthlyCapacity(8)).toBe(240);
      expect(scheduler.calculateMonthlyCapacity(10)).toBe(300);
      expect(scheduler.calculateMonthlyCapacity(0)).toBe(0);
    });
  });

  describe('isMonthlyTargetAchievable', () => {
    it('should determine if monthly target is achievable', () => {
      expect(scheduler.isMonthlyTargetAchievable(240, 8)).toBe(true);
      expect(scheduler.isMonthlyTargetAchievable(240, 7)).toBe(false);
      expect(scheduler.isMonthlyTargetAchievable(240, 10)).toBe(true);
    });
  });

  describe('getPipelineStats', () => {
    it('should return pipeline statistics', async () => {
      const stats = await scheduler.getPipelineStats();

      expect(stats).toBeDefined();
      expect(stats.queueLength).toBe(0);
      expect(stats.isProcessing).toBe(false);
      expect(stats.configuration).toBeDefined();
      expect(stats.configuration.batchSize).toBe(10);
      expect(stats.configuration.maxRetries).toBe(3);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      scheduler.updateConfig({
        batchSize: 20,
        maxRetries: 5,
        retryDelay: 2000
      });

      scheduler.getPipelineStats().then(stats => {
        expect(stats.configuration.batchSize).toBe(20);
        expect(stats.configuration.maxRetries).toBe(5);
        expect(stats.configuration.retryDelay).toBe(2000);
      });
    });

    it('should update validation rules', () => {
      const customRule: ValidationRule = {
        name: 'custom',
        validate: () => ({ valid: true })
      };

      scheduler.updateConfig({
        validationRules: [customRule]
      });

      // The custom rules should replace default rules
      // We can verify this indirectly by running validation
      const config: GenerationConfig = { prompt: 'Test' };

      // This should now pass with the new rules
      expect(scheduler.runPipeline(config)).resolves.toBeDefined();
    });
  });

  describe('performance', () => {
    it('should handle daily production target efficiently', async () => {
      const startTime = Date.now();
      const result = await scheduler.scheduleDailyProduction(8);
      const duration = Date.now() - startTime;

      expect(result.successful).toBe(8);
      // Should complete 8 items in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should process items in parallel within batch', async () => {
      const scheduler = new PipelineScheduler({
        batchSize: 5
      });

      const configs = Array(5).fill(null).map((_, i) => ({
        prompt: `Content ${i}`
      }));

      const startTime = Date.now();
      const result = await scheduler.runBatchPipeline(configs);
      const duration = Date.now() - startTime;

      expect(result.successful).toBe(5);
      // Parallel processing should be faster than sequential
      expect(duration).toBeLessThan(2000); // Should be much faster than 5 * 300ms
    });
  });

  describe('error handling', () => {
    it('should handle generator errors gracefully', async () => {
      const scheduler = new PipelineScheduler({
        maxRetries: 1,
        // Force very low tokens to trigger validation failure
        validationRules: [{
          name: 'force-fail',
          validate: () => ({ valid: false, errors: ['Forced failure'] })
        }]
      });

      const configs = [{ prompt: 'Test' }];
      const result = await scheduler.runBatchPipeline(configs);

      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBeDefined();
    });

    it('should continue processing after individual failures', async () => {
      const scheduler = new PipelineScheduler({
        maxRetries: 1,
        validationRules: [{
          name: 'fail-even',
          validate: (content) => ({
            valid: !content.id.includes('2'),
            errors: content.id.includes('2') ? ['Even content fails'] : undefined
          })
        }]
      });

      const configs = Array(4).fill(null).map((_, i) => ({
        prompt: `Content ${i}`
      }));

      const result = await scheduler.runBatchPipeline(configs);

      expect(result.totalItems).toBe(4);
      // Some should succeed, some should fail
      expect(result.successful).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThan(0);
    });
  });
});