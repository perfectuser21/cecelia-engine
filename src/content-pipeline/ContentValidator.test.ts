/**
 * Unit tests for ContentValidator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContentValidator } from './ContentValidator';
import { Content, ContentStatus, ValidationRule } from './types';

describe('ContentValidator', () => {
  let validator: ContentValidator;

  beforeEach(() => {
    validator = new ContentValidator();
  });

  const createValidContent = (): Content => ({
    id: 'test-1',
    title: 'Valid Test Title',
    body: 'This is the first sentence with unique content. ' +
          'The second sentence provides additional information. ' +
          'A third sentence adds more context to the content. ' +
          'The fourth sentence continues the narrative flow. ' +
          'Finally, the fifth sentence concludes this paragraph.',
    metadata: {
      category: 'test',
      tags: ['test', 'validation'],
      language: 'en-US',
      wordCount: 80  // Ensure it's well above the minimum (50 for English)
    },
    status: ContentStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  describe('validate', () => {
    it('should pass validation for valid content', async () => {
      const content = createValidContent();
      const result = await validator.validate(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail validation for content below minimum length', async () => {
      const content: Content = {
        ...createValidContent(),
        body: 'Too short',
        metadata: { wordCount: 2 }
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('minimum-length');
      expect(result.errors![0]).toContain('at least 50 words');
    });

    it('should fail validation for content exceeding maximum length', async () => {
      const content: Content = {
        ...createValidContent(),
        body: 'word '.repeat(11000),
        metadata: { wordCount: 11000 }
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('maximum-length');
      expect(result.errors![0]).toContain('exceeds maximum 10000 words');
    });

    it('should fail validation for missing title', async () => {
      const content: Content = {
        ...createValidContent(),
        title: ''
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('title-required');
    });

    it('should fail validation for missing body', async () => {
      const content: Content = {
        ...createValidContent(),
        body: ''
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('body-required'))).toBe(true);
    });

    it('should provide warnings for incomplete metadata', async () => {
      const content: Content = {
        ...createValidContent(),
        metadata: { wordCount: 100 }
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('Category'))).toBe(true);
      expect(result.warnings!.some(w => w.includes('tags'))).toBe(true);
      expect(result.warnings!.some(w => w.includes('Language'))).toBe(true);
    });

    it('should detect repetitive content', async () => {
      const content: Content = {
        ...createValidContent(),
        body: 'Same sentence. Same sentence. Same sentence. Same sentence. Same sentence.'
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('repetition'))).toBe(true);
    });

    it('should detect placeholder text', async () => {
      const content: Content = {
        ...createValidContent(),
        body: 'This is content with Lorem ipsum dolor sit amet and TODO items.'
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('placeholder text'))).toBe(true);
    });

    it('should warn about title length issues', async () => {
      const shortTitleContent: Content = {
        ...createValidContent(),
        title: 'Test'
      };

      const longTitleContent: Content = {
        ...createValidContent(),
        title: 'a'.repeat(201)
      };

      const shortResult = await validator.validate(shortTitleContent);
      const longResult = await validator.validate(longTitleContent);

      expect(shortResult.warnings).toBeDefined();
      expect(shortResult.warnings!.some(w => w.includes('too short'))).toBe(true);

      expect(longResult.warnings).toBeDefined();
      expect(longResult.warnings!.some(w => w.includes('too long'))).toBe(true);
    });

    it('should update content status on validation failure', async () => {
      const content: Content = {
        ...createValidContent(),
        body: ''
      };

      await validator.validate(content);

      expect(content.status).toBe(ContentStatus.FAILED);
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple contents', async () => {
      const contents = [
        createValidContent(),
        { ...createValidContent(), id: 'test-2', body: 'Short', metadata: { ...createValidContent().metadata, wordCount: 1 } },
        { ...createValidContent(), id: 'test-3' }
      ];

      const results = await validator.validateBatch(contents);

      expect(results).toHaveLength(3);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
    });

    it('should handle empty batch', async () => {
      const results = await validator.validateBatch([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('rule management', () => {
    it('should add custom validation rules', () => {
      const customRule: ValidationRule = {
        name: 'custom-rule',
        validate: (content) => ({
          valid: content.title.includes('Custom'),
          errors: content.title.includes('Custom') ? undefined : ['Must contain "Custom"']
        })
      };

      validator.addRule(customRule);

      expect(validator.getRuleNames()).toContain('custom-rule');
    });

    it('should apply custom rules during validation', async () => {
      const customRule: ValidationRule = {
        name: 'must-have-keyword',
        validate: (content) => ({
          valid: content.body.includes('keyword'),
          errors: content.body.includes('keyword') ? undefined : ['Must contain "keyword"']
        })
      };

      validator.addRule(customRule);

      const content = createValidContent();
      const result = await validator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.includes('must-have-keyword'))).toBe(true);
    });

    it('should remove rules by name', () => {
      const initialRules = validator.getRuleNames();

      validator.removeRule('minimum-length');

      const updatedRules = validator.getRuleNames();
      expect(updatedRules).not.toContain('minimum-length');
      expect(updatedRules.length).toBe(initialRules.length - 1);
    });

    it('should clear all rules', () => {
      validator.clearRules();

      expect(validator.getRuleNames()).toHaveLength(0);
    });

    it('should reinitialize default rules on construction', () => {
      const newValidator = new ContentValidator();

      expect(newValidator.getRuleNames()).toContain('minimum-length');
      expect(newValidator.getRuleNames()).toContain('maximum-length');
      expect(newValidator.getRuleNames()).toContain('title-required');
      expect(newValidator.getRuleNames()).toContain('body-required');
      expect(newValidator.getRuleNames()).toContain('metadata-complete');
      expect(newValidator.getRuleNames()).toContain('content-quality');
    });
  });

  describe('edge cases', () => {
    it('should handle content with undefined metadata fields', async () => {
      const content: Content = {
        ...createValidContent(),
        metadata: {}
      };

      const result = await validator.validate(content);

      // Should still validate but with warnings
      expect(result.warnings).toBeDefined();
    });

    it('should handle content with empty arrays', async () => {
      const content: Content = {
        ...createValidContent(),
        metadata: {
          ...createValidContent().metadata,
          tags: []
        }
      };

      const result = await validator.validate(content);

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('tags'))).toBe(true);
    });

    it('should handle very long content correctly', async () => {
      const content: Content = {
        ...createValidContent(),
        body: 'word '.repeat(9999),
        metadata: { wordCount: 9999 }
      };

      const result = await validator.validate(content);

      expect(result.valid).toBe(true);
    });
  });
});