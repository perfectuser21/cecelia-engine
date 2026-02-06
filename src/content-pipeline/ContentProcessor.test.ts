/**
 * Unit tests for ContentProcessor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContentProcessor } from './ContentProcessor';
import { Content, ContentStatus } from './types';

describe('ContentProcessor', () => {
  let processor: ContentProcessor;

  beforeEach(() => {
    processor = new ContentProcessor();
  });

  const createMockContent = (): Content => ({
    id: 'test-1',
    title: '  Test Title  ',
    body: 'Test body content\r\n\r\nWith multiple\n\n\nparagraphs   and  extra  spaces.',
    metadata: {
      category: 'test'
    },
    status: ContentStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  describe('process', () => {
    it('should process content successfully', async () => {
      const content = createMockContent();
      const processed = await processor.process(content);

      expect(processed).toBeDefined();
      expect(processed.status).toBe(ContentStatus.COMPLETED);
      expect(processed.updatedAt).toBeInstanceOf(Date);
    });

    it('should normalize whitespace and line breaks', async () => {
      const content = createMockContent();
      const processed = await processor.process(content);

      // Title should be trimmed
      expect(processed.title).toBe('Test Title');

      // Body should have normalized line breaks
      expect(processed.body).not.toContain('\r\n');
      expect(processed.body).not.toContain('\n\n\n');
      expect(processed.body).not.toMatch(/  +/);
    });

    it('should enrich metadata', async () => {
      const content = createMockContent();
      const processed = await processor.process(content);

      expect(processed.metadata.wordCount).toBeGreaterThan(0);
      expect(processed.metadata.processedAt).toBeDefined();
      expect(processed.metadata.language).toBeDefined();
      expect(processed.metadata.tags).toBeDefined();
      expect(processed.metadata.tags!.length).toBeGreaterThan(0);
    });

    it('should optimize content structure', async () => {
      const content: Content = {
        ...createMockContent(),
        title: 'Test Title,',
        body: 'First paragraph\n\nSecond paragraph\n\nThird paragraph'
      };

      const processed = await processor.process(content);

      // Title punctuation should be cleaned (commas, semicolons, colons)
      expect(processed.title).toBe('Test Title');

      // Body should have proper punctuation
      expect(processed.body).toMatch(/[.!?。]$/m);
    });

    it('should format content with section markers', async () => {
      const content: Content = {
        ...createMockContent(),
        body: 'Para 1\n\nPara 2\n\nPara 3\n\nPara 4\n\nPara 5'
      };

      const processed = await processor.process(content);

      expect(processed.body).toContain('【引言】');
      expect(processed.body).toContain('【要点');
      expect(processed.body).toContain('【总结】');
    });
  });

  describe('processBatch', () => {
    it('should process multiple contents', async () => {
      const contents = [
        createMockContent(),
        { ...createMockContent(), id: 'test-2' },
        { ...createMockContent(), id: 'test-3' }
      ];

      const processed = await processor.processBatch(contents);

      expect(processed).toHaveLength(3);
      processed.forEach(content => {
        expect(content.status).toBe(ContentStatus.COMPLETED);
        expect(content.metadata.processedAt).toBeDefined();
      });
    });

    it('should handle empty batch', async () => {
      const processed = await processor.processBatch([]);

      expect(processed).toHaveLength(0);
    });
  });

  describe('language detection', () => {
    it('should detect Chinese content', async () => {
      const content: Content = {
        ...createMockContent(),
        body: '这是一段中文内容。包含了很多中文字符。用于测试语言检测功能。'
      };

      const processed = await processor.process(content);

      expect(processed.metadata.language).toBe('zh-CN');
    });

    it('should detect English content', async () => {
      const content: Content = {
        ...createMockContent(),
        body: 'This is English content without any Chinese characters.'
      };

      const processed = await processor.process(content);

      expect(processed.metadata.language).toBe('en-US');
    });

    it('should detect mixed content as Chinese if threshold met', async () => {
      const content: Content = {
        ...createMockContent(),
        body: 'This is mixed content. 但是包含了足够多的中文字符，所以应该被识别为中文内容。'
      };

      const processed = await processor.process(content);

      expect(processed.metadata.language).toBe('zh-CN');
    });
  });

  describe('tag generation', () => {
    it('should generate appropriate tags', async () => {
      const content: Content = {
        ...createMockContent(),
        body: 'Short content',
        metadata: {
          category: 'technology',
          language: 'zh-CN'
        }
      };

      const processed = await processor.process(content);

      expect(processed.metadata.tags).toContain('technology');
      expect(processed.metadata.tags).toContain('AI生成');
      expect(processed.metadata.tags).toContain('短文');
      expect(processed.metadata.tags).toContain('中文');
    });

    it('should classify content length correctly', async () => {
      const shortContent = { ...createMockContent(), body: 'Short' };
      const mediumContent = { ...createMockContent(), body: 'a'.repeat(500) };
      const longContent = { ...createMockContent(), body: 'a'.repeat(1500) };

      const shortProcessed = await processor.process(shortContent);
      const mediumProcessed = await processor.process(mediumContent);
      const longProcessed = await processor.process(longContent);

      expect(shortProcessed.metadata.tags).toContain('短文');
      expect(mediumProcessed.metadata.tags).toContain('中等长度');
      expect(longProcessed.metadata.tags).toContain('长文');
    });
  });

  describe('word counting', () => {
    it('should count Chinese characters correctly', async () => {
      const content: Content = {
        ...createMockContent(),
        body: '这是十个中文字符内容'
      };

      const processed = await processor.process(content);

      expect(processed.metadata.wordCount).toBe(10);
    });

    it('should count English words correctly', async () => {
      const content: Content = {
        ...createMockContent(),
        body: 'This is five words content'
      };

      const processed = await processor.process(content);

      expect(processed.metadata.wordCount).toBe(5);
    });

    it('should count mixed content correctly', async () => {
      const content: Content = {
        ...createMockContent(),
        body: '这是五个字 and three words'
      };

      const processed = await processor.process(content);

      expect(processed.metadata.wordCount).toBe(8); // 5 Chinese + 3 English
    });
  });
});