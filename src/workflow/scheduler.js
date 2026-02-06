/**
 * Workflow Scheduler Module
 * Manages task scheduling and execution
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger');
const { BatchProcessor } = require('../content-pipeline/batch');

class WorkflowScheduler extends EventEmitter {
  constructor(config = {}) {
    super();
    this.queue = [];
    this.running = false;
    this.maxConcurrent = config.maxConcurrent || 5;
    this.activeJobs = new Map();
    this.completedJobs = new Map();
    this.batchProcessor = new BatchProcessor(config);
    this.checkInterval = config.checkInterval || 5000;
    this.scheduleTimer = null;
  }

  /**
   * Schedule a content generation job
   * @param {object} job - Job configuration
   * @returns {string} Job ID
   */
  schedule(job) {
    const jobId = this.generateJobId();
    const scheduledJob = {
      id: jobId,
      ...job,
      status: 'queued',
      scheduledAt: new Date().toISOString(),
      priority: job.priority || 0,
    };

    this.queue.push(scheduledJob);
    this.queue.sort((a, b) => b.priority - a.priority);

    logger.info('Job scheduled', { jobId, type: job.type });
    this.emit('job:scheduled', scheduledJob);

    if (!this.running) {
      this.start();
    }

    return jobId;
  }

  /**
   * Schedule multiple jobs
   */
  scheduleBatch(jobs) {
    const jobIds = jobs.map(job => this.schedule(job));
    logger.info(`Batch of ${jobs.length} jobs scheduled`);
    return jobIds;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.running) {
      logger.warn('Scheduler already running');
      return;
    }

    this.running = true;
    logger.info('Scheduler started');
    this.emit('scheduler:started');

    this.processQueue();
    this.scheduleTimer = setInterval(() => {
      this.processQueue();
    }, this.checkInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.running = false;
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    logger.info('Scheduler stopped');
    this.emit('scheduler:stopped');
  }

  /**
   * Process queued jobs
   */
  async processQueue() {
    if (!this.running) return;

    const availableSlots = this.maxConcurrent - this.activeJobs.size;
    if (availableSlots <= 0 || this.queue.length === 0) return;

    const jobsToProcess = this.queue.splice(0, availableSlots);

    for (const job of jobsToProcess) {
      this.executeJob(job);
    }
  }

  /**
   * Execute a single job
   */
  async executeJob(job) {
    try {
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      this.activeJobs.set(job.id, job);

      logger.info('Job execution started', { jobId: job.id });
      this.emit('job:started', job);

      const result = await this.batchProcessor.generator.generate(job.type, job.params);

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = result;
      job.duration = Date.now() - new Date(job.startedAt).getTime();

      this.activeJobs.delete(job.id);
      this.completedJobs.set(job.id, job);

      logger.info('Job completed successfully', {
        jobId: job.id,
        duration: job.duration
      });
      this.emit('job:completed', job);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date().toISOString();

      this.activeJobs.delete(job.id);
      this.completedJobs.set(job.id, job);

      logger.error('Job execution failed', {
        jobId: job.id,
        error: error.message
      });
      this.emit('job:failed', job);

      // Retry logic
      if (job.retryCount === undefined) {
        job.retryCount = 0;
      }

      if (job.retryCount < (job.maxRetries || 3)) {
        job.retryCount++;
        job.status = 'queued';
        job.retryDelay = Math.pow(2, job.retryCount) * 1000;

        setTimeout(() => {
          this.queue.push(job);
          logger.info('Job queued for retry', {
            jobId: job.id,
            attempt: job.retryCount
          });
        }, job.retryDelay);
      }
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId) {
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId);
    }
    if (this.completedJobs.has(jobId)) {
      return this.completedJobs.get(jobId);
    }
    const queuedJob = this.queue.find(j => j.id === jobId);
    return queuedJob || null;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId) {
    // Remove from queue if present
    const queueIndex = this.queue.findIndex(j => j.id === jobId);
    if (queueIndex > -1) {
      const job = this.queue.splice(queueIndex, 1)[0];
      job.status = 'cancelled';
      job.cancelledAt = new Date().toISOString();
      this.completedJobs.set(jobId, job);

      logger.info('Job cancelled', { jobId });
      this.emit('job:cancelled', job);
      return true;
    }

    // Cannot cancel running jobs
    if (this.activeJobs.has(jobId)) {
      logger.warn('Cannot cancel running job', { jobId });
      return false;
    }

    return false;
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    const completed = Array.from(this.completedJobs.values());
    const successful = completed.filter(j => j.status === 'completed');
    const failed = completed.filter(j => j.status === 'failed');

    const avgDuration = successful.length > 0
      ? successful.reduce((sum, j) => sum + (j.duration || 0), 0) / successful.length
      : 0;

    return {
      queued: this.queue.length,
      running: this.activeJobs.size,
      completed: successful.length,
      failed: failed.length,
      cancelled: completed.filter(j => j.status === 'cancelled').length,
      totalProcessed: completed.length,
      averageDuration: Math.round(avgDuration),
      successRate: completed.length > 0
        ? (successful.length / completed.length) * 100
        : 0,
      isRunning: this.running,
    };
  }

  /**
   * Clear completed jobs history
   */
  clearHistory() {
    const count = this.completedJobs.size;
    this.completedJobs.clear();
    logger.info(`Cleared ${count} completed jobs from history`);
    return count;
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule recurring job
   */
  scheduleRecurring(job, interval) {
    const recurringJob = {
      ...job,
      recurring: true,
      interval,
    };

    const executeRecurring = () => {
      const jobId = this.schedule(recurringJob);

      setTimeout(() => {
        if (this.running) {
          executeRecurring();
        }
      }, interval);

      return jobId;
    };

    return executeRecurring();
  }

  /**
   * Get queue position for a job
   */
  getQueuePosition(jobId) {
    const index = this.queue.findIndex(j => j.id === jobId);
    return index > -1 ? index + 1 : -1;
  }

  /**
   * Prioritize a job
   */
  prioritizeJob(jobId, newPriority) {
    const job = this.queue.find(j => j.id === jobId);
    if (job) {
      job.priority = newPriority;
      this.queue.sort((a, b) => b.priority - a.priority);
      logger.info('Job priority updated', { jobId, newPriority });
      return true;
    }
    return false;
  }
}

module.exports = { WorkflowScheduler };