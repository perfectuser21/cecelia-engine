/**
 * Content Generator - Generates AI content based on configuration
 */

import { Content, ContentStatus, GenerationConfig, ContentMetadata } from './types';

export class ContentGenerator {
  private idCounter = 0;

  /**
   * Generate a single piece of content
   */
  async generate(config: GenerationConfig): Promise<Content> {
    const startTime = Date.now();

    // Simulate AI content generation
    const content = await this.simulateGeneration(config);

    const duration = Date.now() - startTime;

    // Add generation metadata
    content.metadata.generationParams = {
      ...config,
      duration
    };

    return content;
  }

  /**
   * Generate multiple pieces of content
   */
  async generateBatch(configs: GenerationConfig[]): Promise<Content[]> {
    const results = await Promise.all(
      configs.map(config => this.generate(config))
    );

    return results;
  }

  /**
   * Simulate AI content generation
   */
  private async simulateGeneration(config: GenerationConfig): Promise<Content> {
    // Simulate processing delay
    await this.delay(100 + Math.random() * 200);

    const id = `content-${++this.idCounter}`;
    const now = new Date();

    // Generate content based on configuration
    const title = this.generateTitle(config);
    const body = this.generateBody(config);
    const wordCount = body.split(/\s+/).length;

    const metadata: ContentMetadata = {
      category: config.category || 'general',
      wordCount,
      language: 'zh-CN',
      aiModel: config.model || 'default-model',
      author: 'AI Content Generator'
    };

    return {
      id,
      title,
      body,
      metadata,
      status: ContentStatus.COMPLETED,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Generate a title based on configuration
   */
  private generateTitle(config: GenerationConfig): string {
    const baseTitle = config.prompt
      ? `基于"${config.prompt.substring(0, 30)}..."的内容`
      : '自动生成的内容';

    return `${baseTitle} - ${this.idCounter}`;
  }

  /**
   * Generate body content based on configuration
   */
  private generateBody(config: GenerationConfig): string {
    const prompt = config.prompt || '默认内容主题';
    const style = config.style || '信息性';
    const maxTokens = config.maxTokens || 500;

    // Simulate content generation with varied content to avoid repetition detection
    const paragraphs = [];
    const numParagraphs = Math.max(3, Math.min(10, Math.floor(maxTokens / 100)));

    // Generate varied paragraphs with different content patterns
    const templates = [
      `基于主题"${prompt}"的深入分析表明，该领域正在经历快速发展。通过${style}的方式展现，我们可以看到多个重要趋势正在形成。技术进步带来了新的机遇，同时也提出了挑战。行业专家认为，这些变化将对未来产生深远影响。`,
      `在探讨"${prompt}"这一话题时，我们发现了几个关键要素。首先是技术创新的推动作用，其次是市场需求的变化。${style}的表达方式帮助我们更好地理解这些复杂的关系。数据显示，相关领域正在快速增长。`,
      `深入研究"${prompt}"揭示了重要的发展模式。通过${style}分析方法，我们识别出了主要的驱动因素。这些因素相互作用，形成了当前的发展格局。未来的发展方向将取决于多个变量的相互影响。`,
      `关于"${prompt}"的最新研究提供了新的视角。采用${style}的方法论，研究人员发现了之前被忽视的关联。这些发现对理论和实践都有重要意义。进一步的研究将帮助我们更好地理解这一领域。`,
      `"${prompt}"领域的实践经验表明，成功的关键在于适应性。${style}的分析框架帮助我们识别最佳实践。案例研究显示，灵活的策略能够带来更好的结果。这些经验对其他领域也有借鉴意义。`,
      `从历史角度看"${prompt}"的演变，我们可以看到清晰的发展轨迹。${style}的叙述方式让复杂的历史变得易于理解。每个阶段都有其独特的特征和挑战。了解这些历史可以帮助我们预测未来。`,
      `当前"${prompt}"面临的主要挑战包括技术、政策和社会因素。通过${style}的分析，我们可以更好地理解这些挑战的本质。解决方案需要多方协作和创新思维。成功的案例为我们提供了宝贵的经验。`,
      `"${prompt}"的未来发展将受到多种因素的影响。${style}的预测模型显示了几种可能的情景。每种情景都有其概率和影响。准备应对不同情景是明智的策略。`,
      `实施"${prompt}"相关策略需要考虑多个维度。${style}的框架提供了系统的方法。关键成功因素包括资源、能力和时机。持续的监控和调整是必不可少的。`,
      `总结"${prompt}"的核心要点，我们可以得出几个重要结论。${style}的总结方式突出了关键信息。这些结论对决策者和实践者都有指导意义。未来的发展将验证这些结论的准确性。`
    ];

    // Select paragraphs ensuring variety
    for (let i = 0; i < numParagraphs; i++) {
      const templateIndex = i % templates.length;
      paragraphs.push(templates[templateIndex]);
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Utility function to create delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate generation configuration
   */
  validateConfig(config: GenerationConfig): boolean {
    if (config.maxTokens && config.maxTokens < 10) {
      return false;
    }

    if (config.temperature !== undefined &&
        (config.temperature < 0 || config.temperature > 2)) {
      return false;
    }

    if (config.topP !== undefined &&
        (config.topP < 0 || config.topP > 1)) {
      return false;
    }

    return true;
  }
}