/**
 * Content Validator - Validates content against defined rules
 */

import {
  Content,
  ValidationResult,
  ValidationRule,
  ContentStatus
} from './types';

export class ContentValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Minimum length rule
    this.addRule({
      name: 'minimum-length',
      validate: (content: Content): ValidationResult => {
        const minWords = 50;
        const wordCount = content.metadata.wordCount || 0;

        if (wordCount < minWords) {
          return {
            valid: false,
            errors: [`Content must have at least ${minWords} words, found ${wordCount}`]
          };
        }

        return { valid: true };
      }
    });

    // Maximum length rule
    this.addRule({
      name: 'maximum-length',
      validate: (content: Content): ValidationResult => {
        const maxWords = 10000;
        const wordCount = content.metadata.wordCount || 0;

        if (wordCount > maxWords) {
          return {
            valid: false,
            errors: [`Content exceeds maximum ${maxWords} words, found ${wordCount}`]
          };
        }

        return { valid: true };
      }
    });

    // Title presence rule
    this.addRule({
      name: 'title-required',
      validate: (content: Content): ValidationResult => {
        if (!content.title || content.title.trim().length === 0) {
          return {
            valid: false,
            errors: ['Title is required']
          };
        }

        return { valid: true };
      }
    });

    // Body presence rule
    this.addRule({
      name: 'body-required',
      validate: (content: Content): ValidationResult => {
        if (!content.body || content.body.trim().length === 0) {
          return {
            valid: false,
            errors: ['Body content is required']
          };
        }

        return { valid: true };
      }
    });

    // Metadata completeness rule
    this.addRule({
      name: 'metadata-complete',
      validate: (content: Content): ValidationResult => {
        const warnings: string[] = [];

        if (!content.metadata.category) {
          warnings.push('Category is not specified');
        }

        if (!content.metadata.tags || content.metadata.tags.length === 0) {
          warnings.push('No tags specified');
        }

        if (!content.metadata.language) {
          warnings.push('Language is not specified');
        }

        return {
          valid: true,
          warnings: warnings.length > 0 ? warnings : undefined
        };
      }
    });

    // Content quality rule
    this.addRule({
      name: 'content-quality',
      validate: (content: Content): ValidationResult => {
        const warnings: string[] = [];
        const errors: string[] = [];

        // Check for repetitive content
        const sentences = content.body.split(/[.!?。！？]/).filter(s => s.trim());
        const uniqueSentences = new Set(sentences);

        if (uniqueSentences.size < sentences.length * 0.7) {
          errors.push('Content contains too much repetition');
        }

        // Check for placeholder text
        if (content.body.includes('Lorem ipsum') ||
            content.body.includes('TODO') ||
            content.body.includes('PLACEHOLDER')) {
          errors.push('Content contains placeholder text');
        }

        // Check title length
        if (content.title.length < 5) {
          warnings.push('Title is too short');
        } else if (content.title.length > 200) {
          warnings.push('Title is too long');
        }

        return {
          valid: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined
        };
      }
    });
  }

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a validation rule by name
   */
  removeRule(name: string): void {
    this.rules = this.rules.filter(rule => rule.name !== name);
  }

  /**
   * Validate a single piece of content
   */
  async validate(content: Content): Promise<ValidationResult> {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Run all validation rules
    for (const rule of this.rules) {
      const result = rule.validate(content);

      if (!result.valid && result.errors) {
        allErrors.push(...result.errors.map(e => `[${rule.name}] ${e}`));
      }

      if (result.warnings) {
        allWarnings.push(...result.warnings.map(w => `[${rule.name}] ${w}`));
      }
    }

    // Update content status based on validation
    if (allErrors.length > 0) {
      content.status = ContentStatus.FAILED;
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors.length > 0 ? allErrors : undefined,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
  }

  /**
   * Validate multiple pieces of content
   */
  async validateBatch(contents: Content[]): Promise<ValidationResult[]> {
    const results = await Promise.all(
      contents.map(content => this.validate(content))
    );

    return results;
  }

  /**
   * Get all validation rule names
   */
  getRuleNames(): string[] {
    return this.rules.map(rule => rule.name);
  }

  /**
   * Clear all validation rules
   */
  clearRules(): void {
    this.rules = [];
  }
}