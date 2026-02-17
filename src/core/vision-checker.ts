import { VisionAlignmentResult, VisionAlignment, PRContext } from '../types';
import { OpenAIAdapter } from '../adapters/openai';
import { GitHubAdapter } from '../adapters/github';
import { tokenizer } from '../utils/tokenizer';
import { logger } from '../utils/logger';
import { MAX_VISION_TOKENS } from '../config/defaults';

export class VisionChecker {
  constructor(
    private openai: OpenAIAdapter,
    private github: GitHubAdapter,
    private visionDocPath: string = 'VISION.md'
  ) {}

  async checkAlignment(context: PRContext): Promise<VisionAlignmentResult> {
    logger.info(`Checking vision alignment for PR #${context.number}`);

    try {
      // Try to fetch the vision document
      const visionContent = await this.github.getVisionDocument(this.visionDocPath);
      
      if (!visionContent) {
        logger.info(`No vision document found at ${this.visionDocPath}`);
        return this.createNoVisionResult();
      }

      // Prepare content for analysis
      const analyzableVision = this.prepareVisionForAnalysis(visionContent);
      const analyzableDiff = this.prepareDiffForAnalysis(context.diff);

      // Analyze alignment with AI
      const analysis = await this.openai.checkVisionAlignment(
        analyzableDiff,
        context.title,
        analyzableVision
      );

      // Calculate overall alignment
      const alignedCount = analysis.alignments?.filter(a => a.alignment === 'aligned').length || 0;
      const misalignedCount = analysis.alignments?.filter(a => a.alignment === 'misaligned').length || 0;
      const totalCount = analysis.alignments?.length || 0;

      let isAligned = true;
      let score = analysis.score || 50;

      if (totalCount > 0) {
        // If there are explicit misalignments, mark as not aligned
        if (misalignedCount > 0 && misalignedCount >= alignedCount) {
          isAligned = false;
          score = Math.min(score, 40);
        } else if (alignedCount === 0 && totalCount > 2) {
          // No positive alignments but multiple principles mentioned
          isAligned = false;
          score = Math.min(score, 30);
        }
      } else {
        // No specific alignments found, run fallback analysis
        const fallbackAnalysis = this.performFallbackAnalysis(context, visionContent);
        isAligned = fallbackAnalysis.isAligned;
        score = fallbackAnalysis.score;
      }

      const result: VisionAlignmentResult = {
        isAligned,
        score: Math.max(0, Math.min(100, score)),
        alignment: analysis.alignments || [],
        visionFound: true,
        visionPath: this.visionDocPath,
      };

      logger.info(
        `Vision alignment: ${isAligned ? 'ALIGNED' : 'MISALIGNED'} (score: ${result.score})`
      );

      return result;

    } catch (error) {
      logger.error('Vision alignment check failed', error);
      return this.createErrorResult();
    }
  }

  private prepareVisionForAnalysis(visionContent: string): string {
    // Clean up the vision content and truncate if needed
    const cleaned = visionContent
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
      .replace(/`(.*?)`/g, '$1') // Remove code formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links, keep text
      .trim();

    return tokenizer.truncateToTokenLimit(cleaned, MAX_VISION_TOKENS);
  }

  private prepareDiffForAnalysis(diff: string): string {
    // Focus on the meaningful changes for vision analysis
    return tokenizer.truncateDiff(diff, MAX_VISION_TOKENS);
  }

  private createNoVisionResult(): VisionAlignmentResult {
    return {
      isAligned: true, // Neutral - can't be misaligned if no vision exists
      score: 50,
      alignment: [],
      visionFound: false,
    };
  }

  private createErrorResult(): VisionAlignmentResult {
    return {
      isAligned: true, // Neutral on error
      score: 50,
      alignment: [
        {
          principle: 'Vision Analysis',
          alignment: 'neutral',
          reasoning: 'Unable to analyze vision alignment due to technical error',
        },
      ],
      visionFound: false,
    };
  }

  private performFallbackAnalysis(context: PRContext, visionContent: string): {
    isAligned: boolean;
    score: number;
  } {
    // Simple keyword-based analysis when LLM analysis fails
    const visionKeywords = this.extractKeywords(visionContent);
    const prKeywords = this.extractKeywords(`${context.title} ${context.body || ''}`);
    
    // Calculate keyword overlap
    const overlap = visionKeywords.filter(keyword => 
      prKeywords.some(prKeyword => 
        prKeyword.includes(keyword) || keyword.includes(prKeyword)
      )
    );

    const overlapRatio = visionKeywords.length > 0 ? overlap.length / visionKeywords.length : 0;

    // Simple scoring based on overlap
    let score = 50 + (overlapRatio * 30); // 50-80 range based on keyword overlap
    
    // Check for obvious misalignment keywords
    const misalignmentKeywords = ['deprecated', 'legacy', 'remove', 'delete', 'disable'];
    const hasMisalignmentIndicators = misalignmentKeywords.some(keyword =>
      context.title.toLowerCase().includes(keyword)
    );

    if (hasMisalignmentIndicators) {
      score -= 20;
    }

    return {
      isAligned: score >= 40,
      score: Math.max(0, Math.min(100, Math.round(score))),
    };
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.isCommonWord(word))
      .slice(0, 20); // Limit to most relevant keywords
  }

  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'that', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come',
      'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take',
      'than', 'them', 'well', 'were', 'what', 'would', 'year', 'years',
      'also', 'back', 'could', 'first', 'get', 'go', 'had', 'has', 'her',
      'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way',
      'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use',
    ]);
    return commonWords.has(word);
  }

  /**
   * Create a vision alignment report with detailed analysis
   */
  createAlignmentReport(result: VisionAlignmentResult): string {
    if (!result.visionFound) {
      return 'No vision document found - unable to check alignment.';
    }

    const alignedItems = result.alignment.filter(a => a.alignment === 'aligned');
    const neutralItems = result.alignment.filter(a => a.alignment === 'neutral');
    const misalignedItems = result.alignment.filter(a => a.alignment === 'misaligned');

    let report = `**Vision Alignment Score: ${result.score}/100**\n\n`;

    if (alignedItems.length > 0) {
      report += '**✅ Aligned Principles:**\n';
      for (const item of alignedItems) {
        report += `- ${item.principle}: ${item.reasoning}\n`;
      }
      report += '\n';
    }

    if (misalignedItems.length > 0) {
      report += '**❌ Misaligned Principles:**\n';
      for (const item of misalignedItems) {
        report += `- ${item.principle}: ${item.reasoning}\n`;
      }
      report += '\n';
    }

    if (neutralItems.length > 0) {
      report += '**⚪ Neutral/Unclear:**\n';
      for (const item of neutralItems) {
        report += `- ${item.principle}: ${item.reasoning}\n`;
      }
      report += '\n';
    }

    if (result.alignment.length === 0) {
      report += 'No specific vision principles could be evaluated against this PR.\n';
    }

    return report.trim();
  }

  /**
   * Suggest improvements based on vision misalignment
   */
  suggestImprovements(result: VisionAlignmentResult): string[] {
    const suggestions: string[] = [];

    if (!result.visionFound) {
      suggestions.push('Consider adding a VISION.md file to help guide PR reviews');
      return suggestions;
    }

    if (!result.isAligned) {
      suggestions.push('Review the project vision document before making changes');
      
      const misalignedItems = result.alignment.filter(a => a.alignment === 'misaligned');
      for (const item of misalignedItems) {
        suggestions.push(`Address misalignment with: ${item.principle}`);
      }
    }

    if (result.score < 30) {
      suggestions.push('This PR significantly diverges from project principles');
      suggestions.push('Consider breaking this into smaller, more focused changes');
    } else if (result.score < 50) {
      suggestions.push('Consider how this change supports the project\'s long-term goals');
    }

    return suggestions;
  }

  /**
   * Check if a PR should be flagged for vision review
   */
  shouldFlagForReview(result: VisionAlignmentResult): boolean {
    if (!result.visionFound) {
      return false; // Can't flag if no vision exists
    }

    // Flag if explicitly misaligned
    if (!result.isAligned) {
      return true;
    }

    // Flag if score is very low
    if (result.score < 30) {
      return true;
    }

    // Flag if there are multiple misaligned principles
    const misalignedCount = result.alignment.filter(a => a.alignment === 'misaligned').length;
    if (misalignedCount >= 2) {
      return true;
    }

    return false;
  }

  /**
   * Get vision document summary for context
   */
  async getVisionSummary(): Promise<string | null> {
    try {
      const visionContent = await this.github.getVisionDocument(this.visionDocPath);
      if (!visionContent) {
        return null;
      }

      // Extract first few lines or first section as summary
      const lines = visionContent.split('\n').filter(line => line.trim());
      const summary = lines
        .slice(0, 5)
        .join(' ')
        .replace(/^#+\s*/, '')
        .trim();

      return summary.length > 200 ? summary.substring(0, 197) + '...' : summary;
    } catch (error) {
      logger.error('Failed to get vision summary', error);
      return null;
    }
  }
}