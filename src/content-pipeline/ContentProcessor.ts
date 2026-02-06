/**
 * Content Processor - Processes and transforms content in the pipeline
 */

import { Content, ContentStatus } from './types';

export class ContentProcessor {
  /**
   * Process a single piece of content
   */
  async process(content: Content): Promise<Content> {
    // Update status
    content.status = ContentStatus.PROCESSING;

    // Apply processing steps
    let processedContent = await this.normalizeContent(content);
    processedContent = await this.enrichMetadata(processedContent);
    processedContent = await this.optimizeContent(processedContent);
    processedContent = await this.formatContent(processedContent);

    // Update status and timestamp
    processedContent.status = ContentStatus.COMPLETED;
    processedContent.updatedAt = new Date();

    return processedContent;
  }

  /**
   * Process multiple pieces of content
   */
  async processBatch(contents: Content[]): Promise<Content[]> {
    const results = await Promise.all(
      contents.map(content => this.process(content))
    );

    return results;
  }

  /**
   * Normalize content format
   */
  private async normalizeContent(content: Content): Promise<Content> {
    const normalized = { ...content };

    // Trim whitespace
    normalized.title = normalized.title.trim();
    normalized.body = normalized.body.trim();

    // Normalize line breaks
    normalized.body = normalized.body.replace(/\r\n/g, '\n');

    // Remove excessive whitespace
    normalized.body = normalized.body.replace(/\n{3,}/g, '\n\n');
    normalized.body = normalized.body.replace(/ {2,}/g, ' ');

    return normalized;
  }

  /**
   * Enrich metadata with additional information
   */
  private async enrichMetadata(content: Content): Promise<Content> {
    const enriched = { ...content };

    // Calculate word count if not present
    if (!enriched.metadata.wordCount) {
      enriched.metadata.wordCount = this.countWords(enriched.body);
    }

    // Add processing timestamp
    enriched.metadata.processedAt = new Date().toISOString();

    // Detect language if not specified
    if (!enriched.metadata.language) {
      enriched.metadata.language = this.detectLanguage(enriched.body);
    }

    // Generate tags if not present
    if (!enriched.metadata.tags || enriched.metadata.tags.length === 0) {
      enriched.metadata.tags = this.generateTags(enriched);
    }

    return enriched;
  }

  /**
   * Optimize content for better quality
   */
  private async optimizeContent(content: Content): Promise<Content> {
    const optimized = { ...content };

    // Add title optimization
    if (!optimized.title.endsWith('.') && !optimized.title.endsWith('?') && !optimized.title.endsWith('!')) {
      // Title should not have ending punctuation unless it's a question or exclamation
      optimized.title = optimized.title.replace(/[.,;:]$/, '');
    }

    // Ensure proper paragraph structure
    const paragraphs = optimized.body.split('\n\n');
    const optimizedParagraphs = paragraphs.map(para => {
      // Ensure each paragraph ends with proper punctuation
      if (para.length > 0 && !para.match(/[.!?]$/)) {
        return para + '。';
      }
      return para;
    });

    optimized.body = optimizedParagraphs.join('\n\n');

    return optimized;
  }

  /**
   * Format content for final output
   */
  private async formatContent(content: Content): Promise<Content> {
    const formatted = { ...content };

    // Add content structure markers
    const sections = formatted.body.split('\n\n');

    if (sections.length > 3) {
      // Add section headers for better structure
      const formattedSections = sections.map((section, index) => {
        if (index === 0) {
          return `【引言】\n${section}`;
        } else if (index === sections.length - 1) {
          return `【总结】\n${section}`;
        } else {
          return `【要点 ${index}】\n${section}`;
        }
      });

      formatted.body = formattedSections.join('\n\n');
    }

    return formatted;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    // For Chinese text, count characters
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // For English text, count space-separated words
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;

    // If predominantly Chinese (more Chinese chars than English words), return Chinese char count
    // Otherwise return total of both
    if (chineseChars > englishWords * 2) {
      return chineseChars;
    }

    // For mixed or primarily English content, count both
    return chineseChars + englishWords;
  }

  /**
   * Detect language of the content
   */
  private detectLanguage(text: string): string {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = text.length;

    // If more than 30% Chinese characters, consider it Chinese
    if (chineseChars / totalChars > 0.3) {
      return 'zh-CN';
    }

    return 'en-US';
  }

  /**
   * Generate tags based on content
   */
  private generateTags(content: Content): string[] {
    const tags: string[] = [];

    // Add category as tag
    if (content.metadata.category) {
      tags.push(content.metadata.category);
    }

    // Add AI-generated tag
    tags.push('AI生成');

    // Add content type tag
    if (content.body.length > 1000) {
      tags.push('长文');
    } else if (content.body.length < 300) {
      tags.push('短文');
    } else {
      tags.push('中等长度');
    }

    // Add language tag
    if (content.metadata.language === 'zh-CN') {
      tags.push('中文');
    } else {
      tags.push('英文');
    }

    return tags;
  }
}