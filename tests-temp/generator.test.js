/**
 * Tests for Content Generator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentGenerator } from './generator.js';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Generated test content'
            }
          }]
        })
      }
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

describe('ContentGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ContentGenerator({
      apiKey: 'test-api-key',
      maxRetries: 2,
      timeout: 5000
    });
  });

  describe('generate', () => {
    it('should generate article content', async () => {
      const result = await generator.generate('article', {
        topic: 'Test Topic',
        length: 500,
        style: 'informative'
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.type).toBe('article');
      expect(result.quality).toBeDefined();
    });

    it('should generate social media content', async () => {
      const result = await generator.generate('social', {
        topic: 'Test Social Post',
        platform: 'LinkedIn',
        tone: 'professional'
      });

      expect(result).toBeDefined();
      expect(result.metadata.type).toBe('social');
    });

    it('should generate video script', async () => {
      const result = await generator.generate('video_script', {
        topic: 'Test Video',
        duration: 5,
        style: 'educational'
      });

      expect(result).toBeDefined();
      expect(result.metadata.type).toBe('video_script');
    });

    it('should throw error for invalid content type', async () => {
      await expect(
        generator.generate('invalid_type', { topic: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('buildPrompt', () => {
    it('should build article prompt correctly', () => {
      const prompt = generator.buildPrompt('article', {
        topic: 'AI Technology',
        length: 1000,
        style: 'technical',
        audience: 'developers'
      });

      expect(prompt).toContain('AI Technology');
      expect(prompt).toContain('1000 words');
      expect(prompt).toContain('technical');
      expect(prompt).toContain('developers');
    });

    it('should build social media prompt correctly', () => {
      const prompt = generator.buildPrompt('social', {
        topic: 'Product Launch',
        platform: 'Twitter',
        tone: 'casual',
        hashtags: true,
        cta: 'learn more'
      });

      expect(prompt).toContain('Product Launch');
      expect(prompt).toContain('Twitter');
      expect(prompt).toContain('casual');
      expect(prompt).toContain('hashtags');
    });
  });

  describe('assessQuality', () => {
    it('should assess content quality and return approved status', async () => {
      const content = {
        title: 'Test Article',
        body: ['Paragraph 1', 'Paragraph 2', 'Paragraph 3']
      };

      const quality = await generator.assessQuality(content, 'article');

      expect(quality).toBeDefined();
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(1);
      expect(quality.checks).toBeDefined();
      expect(quality.status).toMatch(/approved|needs_review/);
    });
  });

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({
          choices: [{
            message: { content: 'Success after retry' }
          }]
        });
      });

      generator.openai.chat.completions.create = mockFn;

      const result = await generator.generate('article', {
        topic: 'Test Retry'
      });

      expect(result).toBeDefined();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('helper methods', () => {
    it('should extract title correctly', () => {
      const text = 'This is the Title\n\nThis is the body content';
      const title = generator.extractTitle(text);
      expect(title).toBe('This is the Title');
    });

    it('should extract hashtags correctly', () => {
      const text = 'Check out our #AI #MachineLearning solution!';
      const hashtags = generator.extractHashtags(text);
      expect(hashtags).toEqual(['#AI', '#MachineLearning']);
    });

    it('should estimate duration correctly', () => {
      const text = 'word '.repeat(300); // 300 words
      const duration = generator.estimateDuration(text);
      expect(duration).toBe(2); // 300/150 = 2 minutes
    });
  });
});