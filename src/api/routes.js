/**
 * API Routes Module
 * REST API endpoints for content pipeline
 */

import express from 'express';
const router = express.Router();
import { ContentGenerator } from '../content-pipeline/generator.js';
import { BatchProcessor } from '../content-pipeline/batch.js';
import { QualityController } from '../content-pipeline/quality.js';
import { WorkflowScheduler } from '../workflow/scheduler.js';
import { ContentStorage } from '../storage/content.js';
import { validateRequest } from './validation.js';
import { logger } from '../utils/logger.js';

// Initialize services
const generator = new ContentGenerator();
const batchProcessor = new BatchProcessor();
const qualityController = new QualityController();
const scheduler = new WorkflowScheduler();
const storage = new ContentStorage();

// Initialize storage on startup
storage.initialize().catch(err => {
  logger.error('Failed to initialize storage', { error: err.message });
});

/**
 * Generate single content
 * POST /api/content/generate
 */
router.post('/content/generate', validateRequest('generate'), async (req, res) => {
  try {
    const { type, params } = req.body;

    const content = await generator.generate(type, params);
    const quality = await qualityController.evaluate(content, type);

    const contentId = await storage.save({
      type,
      ...content,
      quality,
    });

    res.json({
      success: true,
      contentId,
      content,
      quality,
    });
  } catch (error) {
    logger.error('Content generation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Batch content generation
 * POST /api/content/batch
 */
router.post('/content/batch', validateRequest('batch'), async (req, res) => {
  try {
    const { jobs } = req.body;

    const results = await batchProcessor.processBatch(jobs);

    // Save successful results
    const savedContent = [];
    for (const result of results.results) {
      if (result.status === 'fulfilled' && result.data) {
        const contentId = await storage.save({
          type: result.job.type,
          ...result.data,
        });
        savedContent.push(contentId);
      }
    }

    res.json({
      success: true,
      results: results.results,
      summary: results.summary,
      savedContent,
    });
  } catch (error) {
    logger.error('Batch processing failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Schedule content generation
 * POST /api/workflow/schedule
 */
router.post('/workflow/schedule', validateRequest('schedule'), async (req, res) => {
  try {
    const job = req.body;
    const jobId = scheduler.schedule(job);

    res.json({
      success: true,
      jobId,
      message: 'Job scheduled successfully',
    });
  } catch (error) {
    logger.error('Scheduling failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get job status
 * GET /api/workflow/status/:jobId
 */
router.get('/workflow/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = scheduler.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    res.json({
      success: true,
      job: status,
    });
  } catch (error) {
    logger.error('Failed to get job status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get scheduler statistics
 * GET /api/workflow/stats
 */
router.get('/workflow/stats', async (req, res) => {
  try {
    const stats = scheduler.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Failed to get scheduler stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Evaluate content quality
 * POST /api/quality/evaluate
 */
router.post('/quality/evaluate', validateRequest('evaluate'), async (req, res) => {
  try {
    const { content, type } = req.body;
    const assessment = await qualityController.evaluate(content, type);

    res.json({
      success: true,
      assessment,
    });
  } catch (error) {
    logger.error('Quality evaluation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get content by ID
 * GET /api/content/:contentId
 */
router.get('/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { version } = req.query;

    const content = await storage.get(contentId, version);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    res.json({
      success: true,
      content,
    });
  } catch (error) {
    logger.error('Failed to retrieve content', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update content
 * PUT /api/content/:contentId
 */
router.put('/content/:contentId', validateRequest('update'), async (req, res) => {
  try {
    const { contentId } = req.params;
    const updates = req.body;

    const updated = await storage.update(contentId, updates);

    res.json({
      success: true,
      content: updated,
    });
  } catch (error) {
    logger.error('Failed to update content', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List content with filters
 * GET /api/content
 */
router.get('/content', async (req, res) => {
  try {
    const filters = req.query;
    const content = await storage.list(filters);

    res.json({
      success: true,
      content,
      count: content.length,
    });
  } catch (error) {
    logger.error('Failed to list content', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete content
 * DELETE /api/content/:contentId
 */
router.delete('/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const deleted = await storage.delete(contentId);

    res.json({
      success: true,
      message: 'Content deleted successfully',
      content: deleted,
    });
  } catch (error) {
    logger.error('Failed to delete content', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get version history
 * GET /api/content/:contentId/versions
 */
router.get('/content/:contentId/versions', async (req, res) => {
  try {
    const { contentId } = req.params;
    const versions = await storage.getVersionHistory(contentId);

    res.json({
      success: true,
      versions,
    });
  } catch (error) {
    logger.error('Failed to get version history', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Health check
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    scheduler: scheduler.getStats(),
  });
});

/**
 * Start scheduler
 * POST /api/workflow/start
 */
router.post('/workflow/start', (req, res) => {
  scheduler.start();
  res.json({
    success: true,
    message: 'Scheduler started',
  });
});

/**
 * Stop scheduler
 * POST /api/workflow/stop
 */
router.post('/workflow/stop', (req, res) => {
  scheduler.stop();
  res.json({
    success: true,
    message: 'Scheduler stopped',
  });
});

export default router;