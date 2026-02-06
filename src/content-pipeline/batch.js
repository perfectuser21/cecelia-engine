/**
 * Batch Content Generation Module
 * Handles concurrent content generation with rate limiting
 */

const { ContentGenerator } = require('./generator');
const { logger } = require('../utils/logger');
const pLimit = require('p-limit');

class BatchProcessor {
  constructor(config = {}) {
    this.generator = new ContentGenerator(config);
    this.concurrency = config.concurrency || 5;
    this.limit = pLimit(this.concurrency);
    this.results = [];
  }

  /**
   * Process multiple content generation requests
   * @param {Array} jobs - Array of generation jobs
   * @returns {Promise<object>} Batch processing results
   */
  async processBatch(jobs) {
    const startTime = Date.now();
    logger.info(`Starting batch processing of ${jobs.length} jobs`);

    try {
      const promises = jobs.map((job, index) =>
        this.limit(() => this.processJob(job, index))
      );

      const results = await Promise.allSettled(promises);

      const summary = this.summarizeResults(results);

      logger.info('Batch processing completed', {
        total: jobs.length,
        successful: summary.successful,
        failed: summary.failed,
        duration: Date.now() - startTime,
      });

      return {
        results: results.map((r, i) => ({
          job: jobs[i],
          status: r.status,
          data: r.value || null,
          error: r.reason?.message || null,
        })),
        summary,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Batch processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Process individual job with error handling
   */
  async processJob(job, index) {
    const jobStartTime = Date.now();

    try {
      logger.debug(`Processing job ${index + 1}`, { type: job.type });

      const result = await this.generator.generate(job.type, job.params);

      logger.debug(`Job ${index + 1} completed`, {
        duration: Date.now() - jobStartTime,
      });

      return {
        ...result,
        jobIndex: index,
        processingTime: Date.now() - jobStartTime,
      };
    } catch (error) {
      logger.error(`Job ${index + 1} failed`, { error: error.message });
      throw error;
    }
  }

  /**
   * Summarize batch processing results
   */
  summarizeResults(results) {
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    const qualityScores = results
      .filter(r => r.status === 'fulfilled' && r.value?.quality)
      .map(r => r.value.quality.score);

    return {
      successful,
      failed,
      successRate: (successful / results.length) * 100,
      averageQuality: qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0,
    };
  }

  /**
   * Generate content in waves with progress tracking
   */
  async generateWave(jobs, onProgress) {
    const batchSize = this.concurrency;
    const waves = Math.ceil(jobs.length / batchSize);
    const allResults = [];

    for (let i = 0; i < waves; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, jobs.length);
      const waveJobs = jobs.slice(start, end);

      logger.info(`Processing wave ${i + 1}/${waves}`);

      const waveResults = await this.processBatch(waveJobs);
      allResults.push(...waveResults.results);

      if (onProgress) {
        onProgress({
          wave: i + 1,
          totalWaves: waves,
          processedJobs: end,
          totalJobs: jobs.length,
          progress: (end / jobs.length) * 100,
        });
      }
    }

    return {
      results: allResults,
      summary: this.summarizeResults(allResults.map(r => ({
        status: r.status === 'success' ? 'fulfilled' : 'rejected',
        value: r.data,
        reason: r.error ? new Error(r.error) : null,
      }))),
    };
  }

  /**
   * Retry failed jobs
   */
  async retryFailed(results, maxRetries = 2) {
    const failedJobs = results.results
      .filter(r => r.status === 'rejected')
      .map(r => r.job);

    if (failedJobs.length === 0) {
      logger.info('No failed jobs to retry');
      return results;
    }

    logger.info(`Retrying ${failedJobs.length} failed jobs`);

    let retryCount = 0;
    let jobsToRetry = failedJobs;
    const finalResults = [...results.results.filter(r => r.status === 'fulfilled')];

    while (retryCount < maxRetries && jobsToRetry.length > 0) {
      retryCount++;
      logger.info(`Retry attempt ${retryCount}/${maxRetries}`);

      const retryResults = await this.processBatch(jobsToRetry);

      finalResults.push(...retryResults.results.filter(r => r.status === 'fulfilled'));
      jobsToRetry = retryResults.results
        .filter(r => r.status === 'rejected')
        .map(r => r.job);
    }

    if (jobsToRetry.length > 0) {
      finalResults.push(...jobsToRetry.map(job => ({
        job,
        status: 'rejected',
        data: null,
        error: `Failed after ${maxRetries} retries`,
      })));
    }

    return {
      results: finalResults,
      summary: this.summarizeResults(finalResults.map(r => ({
        status: r.status === 'success' ? 'fulfilled' : 'rejected',
        value: r.data,
      }))),
    };
  }
}

module.exports = { BatchProcessor };