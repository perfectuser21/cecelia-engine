/**
 * AI Content Generator Module
 * Core module for generating AI content
 */

import { OpenAI } from 'openai';
import { validateContentType, sanitizeContent } from '../api/validation.js';
import { logger } from '../utils/logger.js';

class ContentGenerator {
  constructor(config = {}) {
    this.openai = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    });

    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
    this.model = config.model || 'gpt-4';
  }

  /**
   * Generate content based on type and parameters
   * @param {string} type - Content type (article, social, video_script)
   * @param {object} params - Generation parameters
   * @returns {Promise<object>} Generated content with metadata
   */
  async generate(type, params) {
    validateContentType(type);

    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(type, params);

      const response = await this.callLLM(prompt, params);

      const content = this.processResponse(response, type);

      const metadata = {
        type,
        generatedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        model: this.model,
        parameters: params,
      };

      logger.info('Content generated successfully', { type, duration: metadata.duration });

      return {
        content: sanitizeContent(content),
        metadata,
        quality: await this.assessQuality(content, type),
      };
    } catch (error) {
      logger.error('Content generation failed', { type, error: error.message });
      throw new Error(`Failed to generate ${type} content: ${error.message}`);
    }
  }

  /**
   * Build prompt based on content type
   */
  buildPrompt(type, params) {
    const templates = {
      article: `Write a comprehensive article about "${params.topic}".
        Length: ${params.length || 1000} words
        Style: ${params.style || 'informative'}
        Target audience: ${params.audience || 'general'}

        Include:
        - Engaging introduction
        - Well-structured body with clear sections
        - Actionable conclusion`,

      social: `Create a ${params.platform || 'LinkedIn'} post about "${params.topic}".
        Tone: ${params.tone || 'professional'}
        Include: ${params.hashtags ? 'relevant hashtags' : ''}
        Call to action: ${params.cta || 'engagement'}`,

      video_script: `Write a video script about "${params.topic}".
        Duration: ${params.duration || '5'} minutes
        Style: ${params.style || 'educational'}

        Format:
        - Hook (first 10 seconds)
        - Main content with timestamps
        - Call to action`,
    };

    return templates[type] || templates.article;
  }

  /**
   * Call LLM API with retry logic
   */
  async callLLM(prompt, params, retryCount = 0) {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a professional content creator.' },
          { role: 'user', content: prompt }
        ],
        temperature: params.temperature || 0.7,
        max_tokens: params.maxTokens || 2000,
      });

      return response.choices[0].message.content;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        logger.warn(`LLM call failed, retrying... (${retryCount + 1}/${this.maxRetries})`);
        await this.delay(Math.pow(2, retryCount) * 1000);
        return this.callLLM(prompt, params, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Process and format response based on type
   */
  processResponse(response, type) {
    const processors = {
      article: (text) => ({
        title: this.extractTitle(text),
        body: this.formatArticleBody(text),
        wordCount: text.split(/\s+/).length,
      }),

      social: (text) => ({
        content: text.trim(),
        hashtags: this.extractHashtags(text),
        charCount: text.length,
      }),

      video_script: (text) => ({
        script: text,
        sections: this.parseScriptSections(text),
        estimatedDuration: this.estimateDuration(text),
      }),
    };

    return processors[type] ? processors[type](response) : { raw: response };
  }

  /**
   * Assess content quality
   */
  async assessQuality(content, type) {
    const qualityChecks = {
      completeness: this.checkCompleteness(content, type),
      readability: this.checkReadability(content),
      relevance: this.checkRelevance(content),
      originality: this.checkOriginality(content),
    };

    const scores = Object.values(qualityChecks);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      score: averageScore,
      checks: qualityChecks,
      status: averageScore >= 0.7 ? 'approved' : 'needs_review',
    };
  }

  // Helper methods
  extractTitle(text) {
    const lines = text.split('\n');
    return lines.find(line => line.trim().length > 0) || 'Untitled';
  }

  formatArticleBody(text) {
    return text.split('\n\n').map(paragraph => paragraph.trim()).filter(p => p.length > 0);
  }

  extractHashtags(text) {
    return text.match(/#\w+/g) || [];
  }

  parseScriptSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;

    lines.forEach(line => {
      if (line.match(/^\d+:/)) {
        if (currentSection) sections.push(currentSection);
        currentSection = { timestamp: line.split(':')[0], content: [] };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    });

    if (currentSection) sections.push(currentSection);
    return sections;
  }

  estimateDuration(text) {
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / 150); // 150 words per minute average
  }

  checkCompleteness(content, type) {
    const requirements = {
      article: ['title', 'body'],
      social: ['content'],
      video_script: ['script'],
    };

    const required = requirements[type] || [];
    const hasAll = required.every(field => content[field]);
    return hasAll ? 1.0 : 0.5;
  }

  checkReadability(content) {
    // Simple readability check
    const text = JSON.stringify(content);
    const avgSentenceLength = text.split('.').map(s => s.split(' ').length);
    const avg = avgSentenceLength.reduce((a, b) => a + b, 0) / avgSentenceLength.length;
    return avg < 20 ? 1.0 : 0.7;
  }

  checkRelevance(content) {
    // Placeholder for relevance check
    return 0.8;
  }

  checkOriginality(content) {
    // Placeholder for originality check
    return 0.9;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { ContentGenerator };