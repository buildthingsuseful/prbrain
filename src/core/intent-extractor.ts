import { IntentExtractionResult, PRContext } from '../types';
import { OpenAIAdapter } from '../adapters/openai';
import { diffParser } from '../utils/diff-parser';
import { tokenizer } from '../utils/tokenizer';
import { logger } from '../utils/logger';
import { MAX_DIFF_TOKENS } from '../config/defaults';

export class IntentExtractor {
  constructor(private openai: OpenAIAdapter) {}

  async extractIntent(context: PRContext): Promise<IntentExtractionResult> {
    logger.info(`Extracting intent for PR #${context.number}: ${context.title}`);

    try {
      // Prepare diff for analysis
      const analyzableDiff = this.prepareDiffForAnalysis(context.diff);
      
      // Extract key changes from diff
      const keyChanges = this.extractKeyChanges(context);
      
      // Get intent analysis from LLM
      const analysis = await this.openai.extractIntent(
        analyzableDiff,
        context.title,
        context.body
      );

      // Calculate scope information
      const scope = this.calculateScope(context);

      const result: IntentExtractionResult = {
        inferredIntent: analysis.intent || this.fallbackIntentFromTitle(context.title),
        summary: analysis.summary || this.createFallbackSummary(context),
        confidence: Math.max(0, Math.min(100, analysis.confidence || 50)),
        keyChanges: (analysis.keyChanges?.length > 0 ? analysis.keyChanges : keyChanges).slice(0, 8),
        scope,
        gaps: analysis.gaps || [],
      };

      logger.info(`Intent extracted with ${result.confidence}% confidence: ${result.inferredIntent}`);
      return result;

    } catch (error) {
      logger.error('Failed to extract intent', error);
      
      // Return fallback result
      return {
        inferredIntent: this.fallbackIntentFromTitle(context.title),
        summary: this.createFallbackSummary(context),
        confidence: 20,
        keyChanges: this.extractKeyChanges(context),
        scope: this.calculateScope(context),
        gaps: ['Intent extraction failed due to API error'],
      };
    }
  }

  private prepareDiffForAnalysis(diff: string): string {
    // Smart truncation to stay within token limits
    const truncatedDiff = tokenizer.truncateDiff(diff, MAX_DIFF_TOKENS);
    
    // Simplify diff by removing noise
    return diffParser.simplifyDiffForAnalysis(truncatedDiff);
  }

  private extractKeyChanges(context: PRContext): string[] {
    const changes: string[] = [];
    
    // Analyze files changed
    const fileTypes = this.categorizeFiles(context.files);
    for (const [type, count] of Object.entries(fileTypes)) {
      if (count > 0) {
        changes.push(`Modified ${count} ${type} file${count > 1 ? 's' : ''}`);
      }
    }

    // Extract function changes from diff
    const functionChanges = diffParser.extractFunctionChanges(context.diff);
    changes.push(...functionChanges.slice(0, 5)); // Limit to top 5

    // Add high-level change patterns
    const patterns = this.detectChangePatterns(context);
    changes.push(...patterns);

    return changes.slice(0, 8); // Limit total changes shown
  }

  private categorizeFiles(files: { filename: string; status: string }[]): Record<string, number> {
    const categories: Record<string, number> = {
      'source code': 0,
      'test': 0,
      'documentation': 0,
      'configuration': 0,
      'other': 0,
    };

    for (const file of files) {
      const filename = file.filename.toLowerCase();
      
      if (this.isTestFile(filename)) {
        categories.test = (categories.test || 0) + 1;
      } else if (this.isDocumentationFile(filename)) {
        categories.documentation = (categories.documentation || 0) + 1;
      } else if (this.isConfigurationFile(filename)) {
        categories.configuration = (categories.configuration || 0) + 1;
      } else if (this.isSourceCodeFile(filename)) {
        categories['source code'] = (categories['source code'] || 0) + 1;
      } else {
        categories.other = (categories.other || 0) + 1;
      }
    }

    return categories;
  }

  private isTestFile(filename: string): boolean {
    return /\.(test|spec)\.|test\/|tests\/|__tests__|spec\//.test(filename);
  }

  private isDocumentationFile(filename: string): boolean {
    return /\.(md|txt|rst)$|readme|changelog|license|docs\//.test(filename);
  }

  private isConfigurationFile(filename: string): boolean {
    return /\.(json|yaml|yml|toml|ini|cfg|conf)$|config|\.env|dockerfile|makefile/.test(filename);
  }

  private isSourceCodeFile(filename: string): boolean {
    return /\.(js|ts|py|java|go|rs|cpp|c|h|php|rb|swift|kt|scala|cs)$/.test(filename);
  }

  private detectChangePatterns(context: PRContext): string[] {
    const patterns: string[] = [];
    const { added, removed } = diffParser.extractChangedLines(context.diff);

    // Detect common patterns
    if (added.some(line => line.includes('test') || line.includes('spec'))) {
      patterns.push('Added tests');
    }

    if (added.some(line => line.includes('import') || line.includes('require'))) {
      patterns.push('Added dependencies');
    }

    if (added.some(line => line.includes('error') || line.includes('catch') || line.includes('try'))) {
      patterns.push('Enhanced error handling');
    }

    if (added.some(line => line.includes('log') || line.includes('debug') || line.includes('console'))) {
      patterns.push('Added logging');
    }

    const addedLines = added.length;
    const removedLines = removed.length;
    
    if (removedLines > addedLines * 2) {
      patterns.push('Major code removal/cleanup');
    } else if (addedLines > removedLines * 2) {
      patterns.push('Major code addition');
    } else if (addedLines > 0 && removedLines > 0) {
      patterns.push('Code refactoring');
    }

    return patterns;
  }

  private calculateScope(context: PRContext): {
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    description: string;
  } {
    const filesChanged = context.files.length;
    const linesAdded = context.files.reduce((sum, file) => sum + file.additions, 0);
    const linesDeleted = context.files.reduce((sum, file) => sum + file.deletions, 0);
    const totalChanges = linesAdded + linesDeleted;

    let description = `${filesChanged} file${filesChanged !== 1 ? 's' : ''} changed`;
    
    if (linesAdded > 0 && linesDeleted > 0) {
      description += ` | +${linesAdded} -${linesDeleted}`;
    } else if (linesAdded > 0) {
      description += ` | +${linesAdded}`;
    } else if (linesDeleted > 0) {
      description += ` | -${linesDeleted}`;
    }

    // Add change category
    if (totalChanges < 50) {
      description += ' | Small change';
    } else if (totalChanges < 200) {
      description += ' | Medium change';
    } else {
      description += ' | Large change';
    }

    return {
      filesChanged,
      linesAdded,
      linesDeleted,
      description,
    };
  }

  private fallbackIntentFromTitle(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    // Common patterns in PR titles
    if (lowerTitle.includes('fix') || lowerTitle.includes('bug')) {
      return 'Fix a bug or issue';
    }
    if (lowerTitle.includes('add') || lowerTitle.includes('implement')) {
      return 'Add new functionality';
    }
    if (lowerTitle.includes('update') || lowerTitle.includes('upgrade')) {
      return 'Update existing functionality or dependencies';
    }
    if (lowerTitle.includes('refactor') || lowerTitle.includes('improve')) {
      return 'Refactor and improve code quality';
    }
    if (lowerTitle.includes('remove') || lowerTitle.includes('delete')) {
      return 'Remove unused or deprecated code';
    }
    if (lowerTitle.includes('doc') || lowerTitle.includes('readme')) {
      return 'Update documentation';
    }
    if (lowerTitle.includes('test')) {
      return 'Add or update tests';
    }
    
    return `Make changes related to: ${title}`;
  }

  private createFallbackSummary(context: PRContext): string {
    const scope = this.calculateScope(context);
    const mainFileTypes = this.getMostChangedFileTypes(context.files);
    
    let summary = `This PR modifies ${scope.filesChanged} file${scope.filesChanged !== 1 ? 's' : ''}`;
    
    if (mainFileTypes.length > 0) {
      summary += `, primarily affecting ${mainFileTypes.join(' and ')} files`;
    }
    
    summary += `. ${scope.description}`;
    
    return summary;
  }

  private getMostChangedFileTypes(files: { filename: string; changes: number }[]): string[] {
    const typeChanges: Record<string, number> = {};
    
    for (const file of files) {
      const filename = file.filename.toLowerCase();
      let type = 'other';
      
      if (this.isSourceCodeFile(filename)) {
        type = 'source code';
      } else if (this.isTestFile(filename)) {
        type = 'test';
      } else if (this.isDocumentationFile(filename)) {
        type = 'documentation';
      } else if (this.isConfigurationFile(filename)) {
        type = 'configuration';
      }
      
      typeChanges[type] = (typeChanges[type] || 0) + file.changes;
    }
    
    return Object.entries(typeChanges)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([type]) => type);
  }
}