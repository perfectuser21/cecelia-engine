/**
 * Unit tests for ContentGenerator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContentGenerator } from './ContentGenerator';
import { GenerationConfig, ContentStatus } from './types';

describe('ContentGenerator', () => {
  let generator: ContentGenerator;

  beforeEach(() => {
    generator = new ContentGenerator();
  });

  describe('generate', () => {
    it('should generate content with valid configuration', async () => {
      const config: GenerationConfig = {
        prompt: 'Test content generation',
        maxTokens: 500,
        temperature: 0.7,
        category: 'test',
        style: 'informative'
      };

      const content = await generator.generate(config);

      expect(content).toBeDefined();
      expect(content.id).toMatch(/^content-\d+$/);
      expect(content.title).toContain('Test content generation');
      expect(content.body).toBeDefined();
      expect(content.body.length).toBeGreaterThan(0);
      expect(content.status).toBe(ContentStatus.COMPLETED);
      expect(content.metadata.category).toBe('test');
      expect(content.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should use default values when config is minimal', async () => {
      const config: GenerationConfig = {};

      const content = await generator.generate(config);

      expect(content).toBeDefined();
      expect(content.metadata.category).toBe('general');
      expect(content.metadata.aiModel).toBe('default-model');
      expect(content.status).toBe(ContentStatus.COMPLETED);
    });

    it('should include generation parameters in metadata', async () => {
      const config: GenerationConfig = {
        prompt: 'Test prompt',
        maxTokens: 1000,
        temperature: 0.5,
        topP: 0.9
      };

      const content = await generator.generate(config);

      expect(content.metadata.generationParams).toBeDefined();
      expect(content.metadata.generationParams?.prompt).toBe('Test prompt');
      expect(content.metadata.generationParams?.maxTokens).toBe(1000);
      expect(content.metadata.generationParams?.temperature).toBe(0.5);
      expect(content.metadata.generationParams?.topP).toBe(0.9);
      expect(content.metadata.generationParams?.duration).toBeGreaterThan(0);
    });

    it('should generate unique IDs for each content', async () => {
      const config: GenerationConfig = { prompt: 'Test' };

      const content1 = await generator.generate(config);
      const content2 = await generator.generate(config);

      expect(content1.id).not.toBe(content2.id);
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple pieces of content', async () => {
      const configs: GenerationConfig[] = [
        { prompt: 'First content' },
        { prompt: 'Second content' },
        { prompt: 'Third content' }
      ];

      const contents = await generator.generateBatch(configs);

      expect(contents).toHaveLength(3);
      expect(contents[0].title).toContain('First content');
      expect(contents[1].title).toContain('Second content');
      expect(contents[2].title).toContain('Third content');

      // Check all contents are unique
      const ids = contents.map(c => c.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('should handle empty batch', async () => {
      const contents = await generator.generateBatch([]);

      expect(contents).toHaveLength(0);
    });

    it('should process batch in parallel', async () => {
      const configs: GenerationConfig[] = Array(10).fill(null).map((_, i) => ({
        prompt: `Content ${i}`
      }));

      const startTime = Date.now();
      const contents = await generator.generateBatch(configs);
      const duration = Date.now() - startTime;

      expect(contents).toHaveLength(10);
      // Should be much faster than sequential processing
      // (10 * 100ms minimum = 1000ms if sequential)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config: GenerationConfig = {
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9
      };

      expect(generator.validateConfig(config)).toBe(true);
    });

    it('should reject configuration with invalid maxTokens', () => {
      const config: GenerationConfig = {
        maxTokens: 5 // Too small
      };

      expect(generator.validateConfig(config)).toBe(false);
    });

    it('should reject configuration with invalid temperature', () => {
      expect(generator.validateConfig({ temperature: -0.1 })).toBe(false);
      expect(generator.validateConfig({ temperature: 2.1 })).toBe(false);
    });

    it('should reject configuration with invalid topP', () => {
      expect(generator.validateConfig({ topP: -0.1 })).toBe(false);
      expect(generator.validateConfig({ topP: 1.1 })).toBe(false);
    });

    it('should accept edge case values', () => {
      expect(generator.validateConfig({ maxTokens: 10 })).toBe(true);
      expect(generator.validateConfig({ temperature: 0 })).toBe(true);
      expect(generator.validateConfig({ temperature: 2 })).toBe(true);
      expect(generator.validateConfig({ topP: 0 })).toBe(true);
      expect(generator.validateConfig({ topP: 1 })).toBe(true);
    });
  });

  describe('content generation quality', () => {
    it('should generate content with appropriate length', async () => {
      const config: GenerationConfig = {
        maxTokens: 1000
      };

      const content = await generator.generate(config);

      expect(content.body.split('\n\n').length).toBeGreaterThanOrEqual(3);
      expect(content.metadata.wordCount).toBeGreaterThan(100);
    });

    it('should respect maxTokens parameter', async () => {
      const smallConfig: GenerationConfig = { maxTokens: 100 };
      const largeConfig: GenerationConfig = { maxTokens: 1000 };

      const smallContent = await generator.generate(smallConfig);
      const largeContent = await generator.generate(largeConfig);

      expect(largeContent.body.length).toBeGreaterThan(smallContent.body.length);
    });

    it('should include style in generated content', async () => {
      const config: GenerationConfig = {
        style: 'narrative'
      };

      const content = await generator.generate(config);

      expect(content.body).toContain('narrative');
    });
  });
});