/**
 * Type definitions for AI Content Production Pipeline
 */

/**
 * Represents a single piece of content in the pipeline
 */
export interface Content {
  id: string;
  title: string;
  body: string;
  metadata: ContentMetadata;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metadata associated with content
 */
export interface ContentMetadata {
  author?: string;
  category?: string;
  tags?: string[];
  wordCount?: number;
  language?: string;
  aiModel?: string;
  generationParams?: Record<string, any>;
  processedAt?: string;
}

/**
 * Content status in the pipeline
 */
export enum ContentStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  PROCESSING = 'processing',
  VALIDATING = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Configuration for content generation
 */
export interface GenerationConfig {
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  model?: string;
  category?: string;
  style?: string;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  processingTimeout?: number;
  validationRules?: ValidationRule[];
}

/**
 * Validation rule for content
 */
export interface ValidationRule {
  name: string;
  validate: (content: Content) => ValidationResult;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Batch processing result
 */
export interface BatchResult {
  totalItems: number;
  successful: number;
  failed: number;
  results: ProcessingResult[];
  duration: number;
}

/**
 * Individual processing result
 */
export interface ProcessingResult {
  contentId: string;
  success: boolean;
  error?: Error;
  duration?: number;
}