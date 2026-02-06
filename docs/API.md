# AI Content Production Pipeline API Documentation

## Overview

The AI Content Production Pipeline provides a complete solution for generating, processing, validating, and scheduling AI-generated content at scale. It's designed to achieve production targets of 240+ pieces of content per month.

## Core Modules

### ContentGenerator

Generates AI content based on configuration parameters.

```typescript
import { ContentGenerator } from '@zenithjoy/content-pipeline';

const generator = new ContentGenerator();

// Generate single content
const content = await generator.generate({
  prompt: 'Write about AI technology',
  maxTokens: 800,
  temperature: 0.7,
  category: 'technology',
  style: 'informative'
});

// Generate batch
const contents = await generator.generateBatch([config1, config2, config3]);
```

#### Methods

- `generate(config: GenerationConfig): Promise<Content>` - Generate a single piece of content
- `generateBatch(configs: GenerationConfig[]): Promise<Content[]>` - Generate multiple pieces in parallel
- `validateConfig(config: GenerationConfig): boolean` - Validate generation configuration

### ContentProcessor

Processes and enhances generated content with formatting, metadata enrichment, and optimization.

```typescript
import { ContentProcessor } from '@zenithjoy/content-pipeline';

const processor = new ContentProcessor();

// Process single content
const processed = await processor.process(content);

// Process batch
const processedBatch = await processor.processBatch(contents);
```

#### Methods

- `process(content: Content): Promise<Content>` - Process a single content item
- `processBatch(contents: Content[]): Promise<Content[]>` - Process multiple items in parallel

#### Processing Steps

1. **Normalization**: Trim whitespace, normalize line breaks
2. **Metadata Enrichment**: Add word count, language detection, tags
3. **Content Optimization**: Improve structure and formatting
4. **Formatting**: Add section markers for better readability

### ContentValidator

Validates content against configurable rules to ensure quality standards.

```typescript
import { ContentValidator } from '@zenithjoy/content-pipeline';

const validator = new ContentValidator();

// Validate content
const result = await validator.validate(content);
if (!result.valid) {
  console.error('Validation failed:', result.errors);
}

// Add custom rules
validator.addRule({
  name: 'custom-length',
  validate: (content) => ({
    valid: content.metadata.wordCount >= 200,
    errors: content.metadata.wordCount < 200 ? ['Too short'] : undefined
  })
});
```

#### Methods

- `validate(content: Content): Promise<ValidationResult>` - Validate single content
- `validateBatch(contents: Content[]): Promise<ValidationResult[]>` - Validate multiple items
- `addRule(rule: ValidationRule): void` - Add custom validation rule
- `removeRule(name: string): void` - Remove a rule by name
- `clearRules(): void` - Clear all validation rules

#### Default Rules

- **minimum-length**: Requires at least 50 words
- **maximum-length**: Limits to 10,000 words
- **title-required**: Title must be present
- **body-required**: Body content must be present
- **metadata-complete**: Warns about missing metadata
- **content-quality**: Checks for repetition and placeholder text

### PipelineScheduler

Orchestrates the complete pipeline and manages batch processing.

```typescript
import { PipelineScheduler } from '@zenithjoy/content-pipeline';

const scheduler = new PipelineScheduler({
  batchSize: 10,
  maxRetries: 3,
  retryDelay: 1000,
  processingTimeout: 30000
});

// Run complete pipeline for single item
const content = await scheduler.runPipeline({
  prompt: 'Create article',
  maxTokens: 800
});

// Run batch pipeline
const result = await scheduler.runBatchPipeline(configs);
console.log(`Processed ${result.successful}/${result.totalItems} successfully`);

// Schedule daily production (8 items/day for 240/month target)
const dailyResult = await scheduler.scheduleDailyProduction(8);
```

#### Methods

- `runPipeline(config: GenerationConfig): Promise<Content>` - Run complete pipeline
- `runBatchPipeline(configs: GenerationConfig[]): Promise<BatchResult>` - Process batch with retry logic
- `scheduleDailyProduction(dailyTarget: number): Promise<BatchResult>` - Generate daily batch
- `calculateMonthlyCapacity(dailyTarget: number): number` - Calculate monthly production capacity
- `isMonthlyTargetAchievable(monthlyTarget: number, dailyCapacity: number): boolean` - Check feasibility
- `updateConfig(config: Partial<PipelineConfig>): void` - Update configuration at runtime
- `getPipelineStats(): Promise<Stats>` - Get current pipeline statistics

## Types

### Content

```typescript
interface Content {
  id: string;
  title: string;
  body: string;
  metadata: ContentMetadata;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

### ContentMetadata

```typescript
interface ContentMetadata {
  author?: string;
  category?: string;
  tags?: string[];
  wordCount?: number;
  language?: string;
  aiModel?: string;
  generationParams?: Record<string, any>;
  processedAt?: string;
}
```

### GenerationConfig

```typescript
interface GenerationConfig {
  prompt?: string;
  maxTokens?: number;
  temperature?: number;  // 0-2
  topP?: number;        // 0-1
  model?: string;
  category?: string;
  style?: string;
}
```

### PipelineConfig

```typescript
interface PipelineConfig {
  batchSize?: number;       // Default: 10
  maxRetries?: number;      // Default: 3
  retryDelay?: number;      // Default: 1000ms
  processingTimeout?: number; // Default: 30000ms
  validationRules?: ValidationRule[];
}
```

### BatchResult

```typescript
interface BatchResult {
  totalItems: number;
  successful: number;
  failed: number;
  results: ProcessingResult[];
  duration: number;
}
```

## Usage Examples

### Basic Pipeline Usage

```typescript
import { PipelineScheduler } from '@zenithjoy/content-pipeline';

const scheduler = new PipelineScheduler();

// Generate single article
const article = await scheduler.runPipeline({
  prompt: 'Write about the future of renewable energy',
  maxTokens: 1000,
  category: 'technology',
  style: 'informative'
});

console.log(article.title);
console.log(`Word count: ${article.metadata.wordCount}`);
console.log(`Language: ${article.metadata.language}`);
```

### Batch Production for Monthly Target

```typescript
// Configure for production
const scheduler = new PipelineScheduler({
  batchSize: 20,
  maxRetries: 3,
  processingTimeout: 60000
});

// Daily production (240 items/month = 8 items/day)
async function runDailyProduction() {
  const result = await scheduler.scheduleDailyProduction(8);

  console.log(`Daily production complete:`);
  console.log(`- Total: ${result.totalItems}`);
  console.log(`- Successful: ${result.successful}`);
  console.log(`- Failed: ${result.failed}`);
  console.log(`- Duration: ${result.duration}ms`);

  // Check monthly capacity
  const monthlyCapacity = scheduler.calculateMonthlyCapacity(8);
  console.log(`Monthly capacity: ${monthlyCapacity} items`);
}

runDailyProduction();
```

### Custom Validation Rules

```typescript
const scheduler = new PipelineScheduler({
  validationRules: [
    {
      name: 'technology-keywords',
      validate: (content) => {
        const hasTechKeywords = ['AI', 'technology', '技术', '人工智能']
          .some(keyword => content.body.includes(keyword));

        return {
          valid: hasTechKeywords,
          errors: hasTechKeywords ? undefined : ['Missing technology keywords']
        };
      }
    },
    {
      name: 'minimum-sections',
      validate: (content) => {
        const sections = content.body.split('\n\n').length;
        return {
          valid: sections >= 3,
          errors: sections < 3 ? ['Content needs at least 3 sections'] : undefined
        };
      }
    }
  ]
});
```

### Error Handling

```typescript
try {
  const result = await scheduler.runBatchPipeline(configs);

  // Check for failures
  if (result.failed > 0) {
    console.error(`${result.failed} items failed:`);

    result.results
      .filter(r => !r.success)
      .forEach(r => {
        console.error(`- ${r.contentId}: ${r.error?.message}`);
      });
  }
} catch (error) {
  console.error('Pipeline error:', error);
}
```

### Performance Monitoring

```typescript
const stats = await scheduler.getPipelineStats();

console.log('Pipeline Statistics:');
console.log(`- Queue Length: ${stats.queueLength}`);
console.log(`- Processing: ${stats.isProcessing}`);
console.log(`- Batch Size: ${stats.configuration.batchSize}`);
console.log(`- Max Retries: ${stats.configuration.maxRetries}`);
```

## Testing

Run the test suite:

```bash
# Unit tests
npm test -- ContentGenerator
npm test -- ContentProcessor
npm test -- ContentValidator
npm test -- PipelineScheduler

# Integration tests
npm test -- integration

# Coverage report
npm run coverage
```

## Performance Benchmarks

Based on testing, the pipeline achieves:

- **Single item processing**: < 5 seconds
- **Daily batch (8 items)**: < 10 seconds
- **Monthly capacity**: 240+ items easily achievable
- **Parallel processing**: 20 items in < 10 seconds
- **Average throughput**: > 100ms per item in batch mode

## Best Practices

1. **Batch Processing**: Use batch methods for better performance
2. **Retry Configuration**: Set appropriate retry counts for production
3. **Validation Rules**: Add domain-specific validation rules
4. **Error Handling**: Always check BatchResult for failures
5. **Monitoring**: Use getPipelineStats() to monitor pipeline health
6. **Configuration**: Tune batch size based on your infrastructure

## Troubleshooting

### Common Issues

1. **Validation Failures**
   - Check content meets minimum length (50 words)
   - Ensure title and body are present
   - Remove placeholder text (Lorem ipsum, TODO)

2. **Timeout Errors**
   - Increase processingTimeout in configuration
   - Reduce batch size for slower systems

3. **High Failure Rate**
   - Check validation rules aren't too strict
   - Increase maxRetries for transient failures
   - Review error messages in BatchResult

4. **Performance Issues**
   - Use batch processing instead of sequential
   - Adjust batchSize based on system resources
   - Monitor with getPipelineStats()