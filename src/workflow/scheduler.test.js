/**
 * Tests for Workflow Scheduler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowScheduler } from './scheduler.js';

// Mock BatchProcessor
vi.mock('../content-pipeline/batch', () => ({
  BatchProcessor: vi.fn().mockImplementation(() => ({
    generator: {
      generate: vi.fn().mockResolvedValue({
        content: { title: 'Test', body: 'Content' },
        metadata: { type: 'article' },
        quality: { score: 0.8 }
      })
    }
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

describe('WorkflowScheduler', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new WorkflowScheduler({
      maxConcurrent: 2,
      checkInterval: 100
    });
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('schedule', () => {
    it('should schedule a job and return job ID', () => {
      const job = {
        type: 'article',
        params: { topic: 'Test Topic' }
      };

      const jobId = scheduler.schedule(job);

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job_/);
      expect(scheduler.queue).toHaveLength(1);
    });

    it('should prioritize jobs correctly', () => {
      const highPriorityJob = {
        type: 'article',
        params: { topic: 'High Priority' },
        priority: 10
      };

      const lowPriorityJob = {
        type: 'article',
        params: { topic: 'Low Priority' },
        priority: 1
      };

      scheduler.schedule(lowPriorityJob);
      scheduler.schedule(highPriorityJob);

      expect(scheduler.queue[0].priority).toBe(10);
      expect(scheduler.queue[1].priority).toBe(1);
    });
  });

  describe('scheduleBatch', () => {
    it('should schedule multiple jobs', () => {
      const jobs = [
        { type: 'article', params: { topic: 'Topic 1' } },
        { type: 'social', params: { topic: 'Topic 2' } },
        { type: 'video_script', params: { topic: 'Topic 3' } }
      ];

      const jobIds = scheduler.scheduleBatch(jobs);

      expect(jobIds).toHaveLength(3);
      expect(scheduler.queue).toHaveLength(3);
    });
  });

  describe('start/stop', () => {
    it('should start and stop the scheduler', () => {
      expect(scheduler.running).toBe(false);

      scheduler.start();
      expect(scheduler.running).toBe(true);

      scheduler.stop();
      expect(scheduler.running).toBe(false);
    });

    it('should not start if already running', () => {
      scheduler.start();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      scheduler.start();

      expect(scheduler.running).toBe(true);
      warnSpy.mockRestore();
    });
  });

  describe('executeJob', () => {
    it('should execute job successfully', async () => {
      const job = {
        id: 'test_job_1',
        type: 'article',
        params: { topic: 'Test' },
        status: 'queued'
      };

      await scheduler.executeJob(job);

      expect(scheduler.completedJobs.has('test_job_1')).toBe(true);
      const completedJob = scheduler.completedJobs.get('test_job_1');
      expect(completedJob.status).toBe('completed');
      expect(completedJob.result).toBeDefined();
    });

    it('should handle job failure', async () => {
      scheduler.batchProcessor.generator.generate = vi.fn().mockRejectedValue(
        new Error('Generation failed')
      );

      const job = {
        id: 'test_job_2',
        type: 'article',
        params: { topic: 'Test' },
        status: 'queued',
        maxRetries: 0
      };

      await scheduler.executeJob(job);

      expect(scheduler.completedJobs.has('test_job_2')).toBe(true);
      const failedJob = scheduler.completedJobs.get('test_job_2');
      expect(failedJob.status).toBe('failed');
      expect(failedJob.error).toBe('Generation failed');
    });

    it('should retry failed jobs', async () => {
      vi.useFakeTimers();

      let attemptCount = 0;
      scheduler.batchProcessor.generator.generate = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          content: { title: 'Success', body: 'After retry' },
          metadata: { type: 'article' },
          quality: { score: 0.9 }
        });
      });

      const job = {
        id: 'test_job_3',
        type: 'article',
        params: { topic: 'Test' },
        status: 'queued',
        maxRetries: 1
      };

      await scheduler.executeJob(job);

      // Fast forward to trigger retry
      vi.advanceTimersByTime(2000);

      expect(scheduler.queue.some(j => j.id === 'test_job_3')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('getJobStatus', () => {
    it('should return job status from active jobs', () => {
      const job = {
        id: 'active_job',
        status: 'running'
      };
      scheduler.activeJobs.set('active_job', job);

      const status = scheduler.getJobStatus('active_job');
      expect(status).toEqual(job);
    });

    it('should return job status from completed jobs', () => {
      const job = {
        id: 'completed_job',
        status: 'completed'
      };
      scheduler.completedJobs.set('completed_job', job);

      const status = scheduler.getJobStatus('completed_job');
      expect(status).toEqual(job);
    });

    it('should return job status from queue', () => {
      const job = {
        id: 'queued_job',
        status: 'queued'
      };
      scheduler.queue.push(job);

      const status = scheduler.getJobStatus('queued_job');
      expect(status).toEqual(job);
    });

    it('should return null for non-existent job', () => {
      const status = scheduler.getJobStatus('non_existent');
      expect(status).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should cancel queued job', () => {
      const job = {
        id: 'cancel_job',
        status: 'queued'
      };
      scheduler.queue.push(job);

      const cancelled = scheduler.cancelJob('cancel_job');

      expect(cancelled).toBe(true);
      expect(scheduler.queue).toHaveLength(0);
      expect(scheduler.completedJobs.has('cancel_job')).toBe(true);
      expect(scheduler.completedJobs.get('cancel_job').status).toBe('cancelled');
    });

    it('should not cancel running job', () => {
      scheduler.activeJobs.set('running_job', { id: 'running_job' });

      const cancelled = scheduler.cancelJob('running_job');

      expect(cancelled).toBe(false);
      expect(scheduler.activeJobs.has('running_job')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Add some jobs
      scheduler.queue.push({ id: 'q1', status: 'queued' });
      scheduler.queue.push({ id: 'q2', status: 'queued' });

      scheduler.activeJobs.set('a1', { id: 'a1', status: 'running' });

      scheduler.completedJobs.set('c1', {
        id: 'c1',
        status: 'completed',
        duration: 1000
      });
      scheduler.completedJobs.set('c2', {
        id: 'c2',
        status: 'completed',
        duration: 2000
      });
      scheduler.completedJobs.set('f1', {
        id: 'f1',
        status: 'failed'
      });

      const stats = scheduler.getStats();

      expect(stats.queued).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.totalProcessed).toBe(3);
      expect(stats.averageDuration).toBe(1500);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('scheduleRecurring', () => {
    it('should schedule recurring job', async () => {
      vi.useFakeTimers();

      const job = {
        type: 'article',
        params: { topic: 'Recurring Test' }
      };

      const jobId = scheduler.scheduleRecurring(job, 1000);

      expect(jobId).toBeDefined();
      expect(scheduler.queue).toHaveLength(1);

      // Clear queue and advance time
      scheduler.queue = [];
      vi.advanceTimersByTime(1000);

      // Should have scheduled another job
      expect(scheduler.queue.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('prioritizeJob', () => {
    it('should update job priority', () => {
      scheduler.queue.push(
        { id: 'job1', priority: 1 },
        { id: 'job2', priority: 5 },
        { id: 'job3', priority: 3 }
      );

      const updated = scheduler.prioritizeJob('job1', 10);

      expect(updated).toBe(true);
      expect(scheduler.queue[0].id).toBe('job1');
      expect(scheduler.queue[0].priority).toBe(10);
    });

    it('should return false for non-existent job', () => {
      const updated = scheduler.prioritizeJob('non_existent', 10);
      expect(updated).toBe(false);
    });
  });
});