/**
 * Content Quality Control Module
 * Evaluates and filters content based on quality metrics
 */

import { logger } from '../utils/logger.js';

class QualityController {
  constructor(config = {}) {
    this.thresholds = {
      minScore: config.minScore || 0.7,
      minWordCount: config.minWordCount || 100,
      maxWordCount: config.maxWordCount || 5000,
      requiredElements: config.requiredElements || [],
    };

    this.weights = {
      completeness: config.weights?.completeness || 0.25,
      readability: config.weights?.readability || 0.25,
      relevance: config.weights?.relevance || 0.25,
      originality: config.weights?.originality || 0.25,
    };
  }

  /**
   * Evaluate content quality
   * @param {object} content - Content to evaluate
   * @param {string} type - Content type
   * @returns {object} Quality assessment results
   */
  async evaluate(content, type) {
    try {
      const metrics = await this.calculateMetrics(content, type);
      const score = this.calculateWeightedScore(metrics);
      const issues = this.identifyIssues(metrics, content, type);

      const assessment = {
        score,
        metrics,
        issues,
        status: this.determineStatus(score, issues),
        recommendations: this.generateRecommendations(issues),
        timestamp: new Date().toISOString(),
      };

      logger.info('Quality assessment completed', {
        type,
        score,
        status: assessment.status,
      });

      return assessment;
    } catch (error) {
      logger.error('Quality evaluation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate quality metrics
   */
  async calculateMetrics(content, type) {
    return {
      completeness: this.assessCompleteness(content, type),
      readability: this.assessReadability(content),
      relevance: this.assessRelevance(content, type),
      originality: this.assessOriginality(content),
      grammar: this.assessGrammar(content),
      formatting: this.assessFormatting(content, type),
    };
  }

  /**
   * Assess content completeness
   */
  assessCompleteness(content, type) {
    const requirements = this.getTypeRequirements(type);
    let score = 1.0;

    requirements.forEach(req => {
      if (!this.checkRequirement(content, req)) {
        score -= 0.2;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Assess readability using Flesch Reading Ease approximation
   */
  assessReadability(content) {
    const text = this.extractText(content);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    // Simplified Flesch Reading Ease formula
    const fleschScore = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, fleschScore / 100));
  }

  /**
   * Assess content relevance
   */
  assessRelevance(content, type) {
    // Placeholder implementation
    // In production, this would use keyword matching, semantic analysis, etc.
    const hasKeywords = this.checkKeywordDensity(content);
    const hasStructure = this.checkStructure(content, type);

    return (hasKeywords * 0.6) + (hasStructure * 0.4);
  }

  /**
   * Assess content originality
   */
  assessOriginality(content) {
    // Placeholder implementation
    // In production, this would check against existing content database
    const uniquePhrases = this.countUniquePhrases(content);
    const commonPatterns = this.detectCommonPatterns(content);

    return Math.max(0, 1 - (commonPatterns / 10));
  }

  /**
   * Assess grammar quality
   */
  assessGrammar(content) {
    const text = this.extractText(content);
    const issues = [];

    // Simple grammar checks
    if (text.match(/\s{2,}/g)) issues.push('multiple_spaces');
    if (text.match(/[.!?]{2,}/g)) issues.push('multiple_punctuation');
    if (!text.match(/^[A-Z]/)) issues.push('no_capital_start');

    return Math.max(0, 1 - (issues.length * 0.2));
  }

  /**
   * Assess content formatting
   */
  assessFormatting(content, type) {
    const formatChecks = {
      article: () => {
        const hasTitle = content.title && content.title.length > 0;
        const hasBody = content.body && content.body.length > 0;
        const hasParagraphs = Array.isArray(content.body);
        return (hasTitle && hasBody && hasParagraphs) ? 1.0 : 0.5;
      },
      social: () => {
        const hasContent = content.content && content.content.length > 0;
        const appropriateLength = content.charCount < 280;
        return (hasContent && appropriateLength) ? 1.0 : 0.7;
      },
      video_script: () => {
        const hasScript = content.script && content.script.length > 0;
        const hasSections = content.sections && content.sections.length > 0;
        return (hasScript && hasSections) ? 1.0 : 0.6;
      },
    };

    const checker = formatChecks[type] || (() => 0.8);
    return checker();
  }

  /**
   * Calculate weighted quality score
   */
  calculateWeightedScore(metrics) {
    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(this.weights).forEach(([metric, weight]) => {
      if (metrics[metric] !== undefined) {
        weightedSum += metrics[metric] * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Identify quality issues
   */
  identifyIssues(metrics, content, type) {
    const issues = [];

    Object.entries(metrics).forEach(([metric, score]) => {
      if (score < 0.6) {
        issues.push({
          metric,
          score,
          severity: score < 0.3 ? 'critical' : score < 0.5 ? 'major' : 'minor',
          description: this.getIssueDescription(metric, score),
        });
      }
    });

    // Check word count
    const wordCount = this.getWordCount(content);
    if (wordCount < this.thresholds.minWordCount) {
      issues.push({
        metric: 'word_count',
        severity: 'major',
        description: `Content too short (${wordCount} words, minimum ${this.thresholds.minWordCount})`,
      });
    }

    return issues;
  }

  /**
   * Determine content status based on quality
   */
  determineStatus(score, issues) {
    const hasCriticalIssues = issues.some(i => i.severity === 'critical');

    if (hasCriticalIssues || score < 0.5) return 'rejected';
    if (score < this.thresholds.minScore) return 'needs_review';
    if (score >= 0.9 && issues.length === 0) return 'excellent';
    return 'approved';
  }

  /**
   * Generate improvement recommendations
   */
  generateRecommendations(issues) {
    const recommendations = [];

    issues.forEach(issue => {
      const recommendation = this.getRecommendation(issue.metric, issue.severity);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    });

    return recommendations;
  }

  // Helper methods
  getTypeRequirements(type) {
    const requirements = {
      article: ['title', 'introduction', 'body', 'conclusion'],
      social: ['content', 'call_to_action'],
      video_script: ['hook', 'main_content', 'closing'],
    };
    return requirements[type] || [];
  }

  checkRequirement(content, requirement) {
    const text = this.extractText(content).toLowerCase();
    return text.includes(requirement) || content[requirement] !== undefined;
  }

  extractText(content) {
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
      return JSON.stringify(content);
    }
    return '';
  }

  countSyllables(word) {
    // Simple syllable counting approximation
    return word.toLowerCase().replace(/[^aeiou]/g, '').length || 1;
  }

  checkKeywordDensity(content) {
    // Placeholder implementation
    return 0.8;
  }

  checkStructure(content, type) {
    // Placeholder implementation
    return 0.9;
  }

  countUniquePhrases(content) {
    // Placeholder implementation
    return 10;
  }

  detectCommonPatterns(content) {
    // Placeholder implementation
    return 2;
  }

  getWordCount(content) {
    const text = this.extractText(content);
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  getIssueDescription(metric, score) {
    const descriptions = {
      completeness: `Content lacks required elements (score: ${score.toFixed(2)})`,
      readability: `Content is difficult to read (score: ${score.toFixed(2)})`,
      relevance: `Content may not be relevant to topic (score: ${score.toFixed(2)})`,
      originality: `Content lacks originality (score: ${score.toFixed(2)})`,
      grammar: `Grammar issues detected (score: ${score.toFixed(2)})`,
      formatting: `Formatting issues detected (score: ${score.toFixed(2)})`,
    };
    return descriptions[metric] || `Quality issue in ${metric}`;
  }

  getRecommendation(metric, severity) {
    const recommendations = {
      completeness: 'Add missing content sections and ensure all requirements are met',
      readability: 'Simplify sentence structure and use clearer language',
      relevance: 'Ensure content directly addresses the topic and target audience',
      originality: 'Add unique insights and avoid generic phrases',
      grammar: 'Review and fix grammar issues',
      formatting: 'Improve content structure and formatting',
      word_count: 'Expand content to meet minimum length requirements',
    };
    return recommendations[metric];
  }
}

export { QualityController };