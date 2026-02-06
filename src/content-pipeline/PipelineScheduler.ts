/**
 * Pipeline Scheduler - Orchestrates the content production pipeline
 */

import { ContentGenerator } from './ContentGenerator';
import { ContentProcessor } from './ContentProcessor';
import { ContentValidator } from './ContentValidator';
import {
  Content,
  GenerationConfig,
  PipelineConfig,
  BatchResult,
  ProcessingResult,
  ContentStatus
} from './types';

export class PipelineScheduler {
  private generator: ContentGenerator;
  private processor: ContentProcessor;
  private validator: ContentValidator;
  private config: PipelineConfig;
  private processingQueue: Content[] = [];
  private isProcessing = false;

  constructor(config?: PipelineConfig) {
    this.generator = new ContentGenerator();
    this.processor = new ContentProcessor();
    this.validator = new ContentValidator();
    this.config = {
      batchSize: config?.batchSize || 10,
      maxRetries: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 1000,
      processingTimeout: config?.processingTimeout || 30000,
      validationRules: config?.validationRules || []
    };

    // Add custom validation rules
    if (this.config.validationRules) {
      for (const rule of this.config.validationRules) {
        this.validator.addRule(rule);
      }
    }
  }

  /**
   * Run the complete pipeline for a single item
   */
  async runPipeline(config: GenerationConfig): Promise<Content> {
    // Generate content
    let content = await this.generator.generate(config);

    // Process content
    content = await this.processor.process(content);

    // Validate content
    const validationResult = await this.validator.validate(content);

    if (!validationResult.valid) {
      throw new Error(`Content validation failed: ${validationResult.errors?.join(', ')}`);
    }

    return content;
  }

  /**
   * Run the pipeline for multiple items with batch processing
   */
  async runBatchPipeline(configs: GenerationConfig[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results: ProcessingResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < configs.length; i += this.config.batchSize!) {
      const batchConfigs = configs.slice(i, i + this.config.batchSize!);
      const batchResults = await this.processBatch(batchConfigs);

      for (const result of batchResults) {
        results.push(result);
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      totalItems: configs.length,
      successful,
      failed,
      results,
      duration
    };
  }

  /**
   * Process a batch of configurations
   */
  private async processBatch(configs: GenerationConfig[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    const processingPromises = configs.map(async (config) => {
      const itemStartTime = Date.now();
      let retries = 0;

      while (retries < this.config.maxRetries!) {
        try {
          const content = await this.runPipelineWithTimeout(config);
          const duration = Date.now() - itemStartTime;

          return {
            contentId: content.id,
            success: true,
            duration
          } as ProcessingResult;
        } catch (error) {
          retries++;

          if (retries >= this.config.maxRetries!) {
            return {
              contentId: `failed-${Date.now()}`,
              success: false,
              error: error as Error,
              duration: Date.now() - itemStartTime
            } as ProcessingResult;
          }

          // Wait before retry
          await this.delay(this.config.retryDelay! * retries);
        }
      }

      // This should not be reached, but TypeScript needs it
      return {
        contentId: `failed-${Date.now()}`,
        success: false,
        error: new Error('Max retries exceeded')
      } as ProcessingResult;
    });

    const batchResults = await Promise.all(processingPromises);
    results.push(...batchResults);

    return results;
  }

  /**
   * Run pipeline with timeout
   */
  private async runPipelineWithTimeout(config: GenerationConfig): Promise<Content> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline timeout after ${this.config.processingTimeout}ms`));
      }, this.config.processingTimeout!);
    });

    const pipelinePromise = this.runPipeline(config);

    return Promise.race([pipelinePromise, timeoutPromise]);
  }

  /**
   * Schedule daily content production
   */
  async scheduleDailyProduction(dailyTarget: number): Promise<BatchResult> {
    const configs: GenerationConfig[] = [];

    // Generate configurations for daily target
    for (let i = 0; i < dailyTarget; i++) {
      configs.push({
        prompt: `Daily content item ${i + 1}`,
        maxTokens: 500 + Math.floor(Math.random() * 1000),
        temperature: 0.7,
        category: this.selectCategory(i),
        style: this.selectStyle(i)
      });
    }

    return this.runBatchPipeline(configs);
  }

  /**
   * Calculate monthly capacity
   */
  calculateMonthlyCapacity(dailyTarget: number): number {
    // Assuming 30 days per month average
    return dailyTarget * 30;
  }

  /**
   * Check if monthly target is achievable
   */
  isMonthlyTargetAchievable(monthlyTarget: number, dailyCapacity: number): boolean {
    const monthlyCapacity = this.calculateMonthlyCapacity(dailyCapacity);
    return monthlyCapacity >= monthlyTarget;
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(): Promise<{
    queueLength: number;
    isProcessing: boolean;
    configuration: PipelineConfig;
  }> {
    return {
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      configuration: this.config
    };
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(config: Partial<PipelineConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    // Update validation rules if provided
    if (config.validationRules) {
      this.validator.clearRules();
      for (const rule of config.validationRules) {
        this.validator.addRule(rule);
      }
    }
  }

  /**
   * Select category based on index for variety
   */
  private selectCategory(index: number): string {
    const categories = ['技术', '生活', '商业', '教育', '娱乐'];
    return categories[index % categories.length];
  }

  /**
   * Select style based on index for variety
   */
  private selectStyle(index: number): string {
    const styles = ['信息性', '叙述性', '说明性', '论述性', '描述性'];
    return styles[index % styles.length];
  }

  /**
   * Utility function to create delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}