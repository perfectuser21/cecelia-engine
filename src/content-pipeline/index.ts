/**
 * AI Content Production Pipeline Module
 *
 * This module provides the core functionality for AI content generation,
 * processing, validation, and scheduling to achieve monthly production targets.
 */

export { ContentGenerator } from './ContentGenerator';
export { ContentProcessor } from './ContentProcessor';
export { ContentValidator } from './ContentValidator';
export { PipelineScheduler } from './PipelineScheduler';

export type {
  Content,
  ContentMetadata,
  GenerationConfig,
  PipelineConfig,
  ValidationRule,
  ValidationResult,
  BatchResult,
  ProcessingResult
} from './types';

export { ContentStatus } from './types';