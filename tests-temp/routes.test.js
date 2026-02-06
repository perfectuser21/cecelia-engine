/**
 * Tests for API Routes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from './routes.js';

// Mock dependencies
vi.mock('../content-pipeline/generator', () => ({
  ContentGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      content: { title: 'Test', body: 'Content' },
      metadata: { type: 'article' },
      quality: { score: 0.8 }
    })
  }))
}));

vi.mock('../content-pipeline/batch', () => ({
  BatchProcessor: vi.fn().mockImplementation(() => ({
    processBatch: vi.fn().mockResolvedValue({
      results: [
        {
          status: 'fulfilled',
          data: { content: 'Test' },
          job: { type: 'article' }
        }
      ],
      summary: { successful: 1, failed: 0 }
    })
  }))
}));

vi.mock('../workflow/scheduler', () => ({
  WorkflowScheduler: vi.fn().mockImplementation(() => ({
    schedule: vi.fn(() => 'job_123'),
    getJobStatus: vi.fn(() => ({ id: 'job_123', status: 'queued' })),
    getStats: vi.fn(() => ({
      queued: 1,
      running: 0,
      completed: 0
    })),
    start: vi.fn(),
    stop: vi.fn()
  }))
}));

vi.mock('../storage/content', () => ({
  ContentStorage: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(),
    save: vi.fn(() => 'content_123'),
    get: vi.fn(() => ({ id: 'content_123', type: 'article' })),
    update: vi.fn(() => ({ id: 'content_123', updated: true })),
    list: vi.fn(() => [{ id: 'content_123' }]),
    delete: vi.fn(() => ({ id: 'content_123' })),
    getVersionHistory: vi.fn(() => [{ version: 1 }])
  }))
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', router);
  });

  describe('POST /api/content/generate', () => {
    it('should generate content successfully', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .send({
          type: 'article',
          params: { topic: 'Test Topic' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.contentId).toBe('content_123');
      expect(response.body.content).toBeDefined();
    });

    it('should return error for invalid request', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/content/batch', () => {
    it('should process batch generation', async () => {
      const response = await request(app)
        .post('/api/content/batch')
        .send({
          jobs: [
            { type: 'article', params: { topic: 'Topic 1' } },
            { type: 'social', params: { topic: 'Topic 2' } }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(response.body.summary).toBeDefined();
    });
  });

  describe('POST /api/workflow/schedule', () => {
    it('should schedule a job', async () => {
      const response = await request(app)
        .post('/api/workflow/schedule')
        .send({
          type: 'article',
          params: { topic: 'Scheduled Topic' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe('job_123');
    });
  });

  describe('GET /api/workflow/status/:jobId', () => {
    it('should return job status', async () => {
      const response = await request(app)
        .get('/api/workflow/status/job_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
      expect(response.body.job.id).toBe('job_123');
    });
  });

  describe('GET /api/workflow/stats', () => {
    it('should return scheduler statistics', async () => {
      const response = await request(app)
        .get('/api/workflow/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.queued).toBe(1);
    });
  });

  describe('GET /api/content/:contentId', () => {
    it('should retrieve content by ID', async () => {
      const response = await request(app)
        .get('/api/content/content_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.content).toBeDefined();
      expect(response.body.content.id).toBe('content_123');
    });
  });

  describe('PUT /api/content/:contentId', () => {
    it('should update content', async () => {
      const response = await request(app)
        .put('/api/content/content_123')
        .send({
          title: 'Updated Title',
          status: 'published'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.content.updated).toBe(true);
    });
  });

  describe('GET /api/content', () => {
    it('should list content with filters', async () => {
      const response = await request(app)
        .get('/api/content')
        .query({
          type: 'article',
          status: 'published'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.content).toBeDefined();
      expect(response.body.count).toBe(1);
    });
  });

  describe('DELETE /api/content/:contentId', () => {
    it('should delete content', async () => {
      const response = await request(app)
        .delete('/api/content/content_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });
  });

  describe('GET /api/content/:contentId/versions', () => {
    it('should return version history', async () => {
      const response = await request(app)
        .get('/api/content/content_123/versions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.versions).toBeDefined();
      expect(response.body.versions).toHaveLength(1);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/workflow/start', () => {
    it('should start the scheduler', async () => {
      const response = await request(app)
        .post('/api/workflow/start');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('started');
    });
  });

  describe('POST /api/workflow/stop', () => {
    it('should stop the scheduler', async () => {
      const response = await request(app)
        .post('/api/workflow/stop');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('stopped');
    });
  });
});