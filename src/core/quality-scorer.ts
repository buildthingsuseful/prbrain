import { QualityScoreResult, QualityFactor, PRContext, QualityConfig } from '../types';
import { OpenAIAdapter } from '../adapters/openai';
import { diffParser } from '../utils/diff-parser';
import { logger } from '../utils/logger';

export class QualityScorer {
  constructor(
    private openai: OpenAIAdapter,
    private config: QualityConfig
  ) {}

  async scoreQuality(context: PRContext): Promise<QualityScoreResult> {
    logger.info(`Scoring quality for PR #${context.number}`);

    try {
      // Run both heuristic and AI-based scoring
      const heuristicFactors = this.calculateHeuristicFactors(context);
      
      // Get AI analysis for more nuanced scoring
      const aiAnalysis = await this.openai.scoreQuality({
        diff: context.diff,
        title: context.title,
        filesChanged: context.files.length,
        linesChanged: context.files.reduce((sum, f) => sum + f.additions + f.deletions, 0),
        hasTests: context.hasTests,
        isFirstTimeContributor: context.isFirstTimeContributor,
      });

      // Combine heuristic and AI factors
      const allFactors = [...heuristicFactors, ...(aiAnalysis.factors || [])];
      
      // Remove duplicates and merge similar factors
      const mergedFactors = this.mergeFactors(allFactors);

      // Calculate overall score
      const totalScore = mergedFactors.reduce((sum, factor) => sum + factor.score, 0);
      const maxScore = mergedFactors.reduce((sum, factor) => sum + factor.maxScore, 0);
      const overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 10) : 5;

      // Generate summary points
      const summary = this.generateSummary(mergedFactors, context);

      const result: QualityScoreResult = {
        overallScore: Math.max(0, Math.min(10, overallScore)),
        maxScore: 10,
        factors: mergedFactors.sort((a, b) => b.score - a.score), // Sort by score descending
        summary,
      };

      logger.info(`Quality score: ${result.overallScore}/10 based on ${result.factors.length} factors`);
      return result;

    } catch (error) {
      logger.error('Quality scoring failed', error);
      
      // Fallback to heuristic-only scoring
      const heuristicFactors = this.calculateHeuristicFactors(context);
      const totalScore = heuristicFactors.reduce((sum, factor) => sum + factor.score, 0);
      const maxScore = heuristicFactors.reduce((sum, factor) => sum + factor.maxScore, 0);
      const overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 10) : 5;

      return {
        overallScore: Math.max(0, Math.min(10, overallScore)),
        maxScore: 10,
        factors: heuristicFactors,
        summary: this.generateSummary(heuristicFactors, context),
      };
    }
  }

  private calculateHeuristicFactors(context: PRContext): QualityFactor[] {
    const factors: QualityFactor[] = [];

    // 1. Test Coverage Factor
    factors.push(this.scoreTestCoverage(context));

    // 2. Change Scope Factor
    factors.push(this.scoreChangeScope(context));

    // 3. Code Structure Factor
    factors.push(this.scoreCodeStructure(context));

    // 4. Documentation Factor
    factors.push(this.scoreDocumentation(context));

    // 5. Contributor Experience Factor
    factors.push(this.scoreContributorExperience(context));

    // 6. Change Complexity Factor
    factors.push(this.scoreComplexity(context));

    return factors;
  }

  private scoreTestCoverage(context: PRContext): QualityFactor {
    const maxScore = 2;
    let score = 0;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let description = 'No tests found';

    if (context.hasTests) {
      score = maxScore;
      status = 'pass';
      description = 'Includes tests';
    } else if (!this.config.require_tests) {
      score = maxScore;
      status = 'pass';
      description = 'Tests not required by configuration';
    } else {
      // Check if this is a documentation-only or config-only change
      const hasOnlyDocOrConfig = context.files.every(file => 
        this.isDocumentationFile(file.filename) || 
        this.isConfigurationFile(file.filename)
      );

      if (hasOnlyDocOrConfig) {
        score = maxScore;
        status = 'pass';
        description = 'Documentation/config change - tests not needed';
      } else {
        score = 0;
        status = 'fail';
        description = 'Missing tests for code changes';
      }
    }

    return {
      name: 'Test Coverage',
      score,
      maxScore,
      status,
      description,
    };
  }

  private scoreChangeScope(context: PRContext): QualityFactor {
    const maxScore = 2;
    const filesChanged = context.files.length;
    const linesChanged = context.files.reduce((sum, f) => sum + f.additions + f.deletions, 0);

    let score = maxScore;
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let description = 'Appropriate scope';

    if (filesChanged > this.config.max_files_changed) {
      score = 0;
      status = 'fail';
      description = `Too many files changed (${filesChanged} > ${this.config.max_files_changed})`;
    } else if (linesChanged > this.config.max_lines_changed) {
      score = 0;
      status = 'fail';
      description = `Too many lines changed (${linesChanged} > ${this.config.max_lines_changed})`;
    } else if (filesChanged > this.config.max_files_changed / 2) {
      score = 1;
      status = 'warning';
      description = `Large change (${filesChanged} files, ${linesChanged} lines)`;
    } else if (linesChanged > this.config.max_lines_changed / 2) {
      score = 1;
      status = 'warning';
      description = `Substantial change (${linesChanged} lines across ${filesChanged} files)`;
    } else {
      description = `Reasonable scope (${filesChanged} files, ${linesChanged} lines)`;
    }

    return {
      name: 'Change Scope',
      score,
      maxScore,
      status,
      description,
    };
  }

  private scoreCodeStructure(context: PRContext): QualityFactor {
    const maxScore = 2;
    let score = maxScore;
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let description = 'Well-structured changes';

    // Analyze diff for structural issues
    const { added, removed } = diffParser.extractChangedLines(context.diff);
    const totalLines = added.length + removed.length;

    if (totalLines === 0) {
      return {
        name: 'Code Structure',
        score: 1,
        maxScore,
        status: 'warning',
        description: 'No code changes to analyze',
      };
    }

    // Check for potential issues
    const issues: string[] = [];

    // Check for excessive debugging/console statements
    const debugLines = added.filter(line => 
      /console\.|print\(|debugger|var_dump|echo.*debug/i.test(line)
    );
    if (debugLines.length > 3) {
      issues.push('multiple debugging statements');
      score -= 0.5;
    }

    // Check for TODO/FIXME comments
    const todoLines = added.filter(line => 
      /TODO|FIXME|HACK|XXX/i.test(line)
    );
    if (todoLines.length > 2) {
      issues.push('multiple TODO/FIXME comments');
      score -= 0.5;
    }

    // Check for very long lines (code style issue)
    const longLines = added.filter(line => line.length > 120);
    if (longLines.length > totalLines * 0.1) {
      issues.push('many long lines');
      score -= 0.5;
    }

    // Set status based on score
    if (score >= maxScore) {
      status = 'pass';
    } else if (score >= maxScore / 2) {
      status = 'warning';
      description = `Generally good structure, but has: ${issues.join(', ')}`;
    } else {
      status = 'fail';
      description = `Structural issues: ${issues.join(', ')}`;
    }

    return {
      name: 'Code Structure',
      score: Math.max(0, score),
      maxScore,
      status,
      description,
    };
  }

  private scoreDocumentation(context: PRContext): QualityFactor {
    const maxScore = 2;
    let score = 0;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let description = 'No documentation updates';

    // Check if documentation files were modified
    const hasDocChanges = context.files.some(file => 
      this.isDocumentationFile(file.filename)
    );

    // Check if PR description is comprehensive
    const hasGoodDescription = context.body && context.body.length > 50;

    // Check for code that likely needs documentation
    const hasSignificantCodeChanges = context.files.some(file => 
      this.isSourceCodeFile(file.filename) && file.additions > 20
    );

    if (hasDocChanges) {
      score += 1;
      description = 'Documentation updated';
    }

    if (hasGoodDescription) {
      score += 1;
      if (hasDocChanges) {
        description = 'Good PR description and documentation updated';
      } else {
        description = 'Good PR description provided';
      }
    }

    // Adjust expectations based on change type
    if (!hasSignificantCodeChanges) {
      // Small changes don't necessarily need doc updates
      if (score >= 1) {
        score = maxScore;
        status = 'pass';
      } else {
        score = maxScore - 0.5;
        status = 'warning';
        description = 'Minor change - basic documentation acceptable';
      }
    } else {
      // Significant code changes should have documentation
      if (score >= 2) {
        status = 'pass';
      } else if (score >= 1) {
        status = 'warning';
        description += ' - consider updating related documentation';
      } else {
        status = 'fail';
        description = 'Significant code changes need documentation';
      }
    }

    return {
      name: 'Documentation',
      score: Math.max(0, Math.min(maxScore, score)),
      maxScore,
      status,
      description,
    };
  }

  private scoreContributorExperience(context: PRContext): QualityFactor {
    const maxScore = 1;
    let score = maxScore;
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let description = 'Experienced contributor';

    if (context.isFirstTimeContributor) {
      // Be more lenient with first-time contributors
      score = maxScore;
      status = 'pass';
      description = 'First-time contributor - welcome!';
    }

    return {
      name: 'Contributor Experience',
      score,
      maxScore,
      status,
      description,
    };
  }

  private scoreComplexity(context: PRContext): QualityFactor {
    const maxScore = 1;
    const stats = diffParser.getDiffStats(context.diff);
    
    let score = maxScore;
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let description = 'Appropriate complexity';

    // Calculate complexity ratio (additions vs deletions)
    const complexityRatio = stats.deletions > 0 ? 
      stats.additions / stats.deletions : 
      stats.additions;

    if (complexityRatio > 5 && stats.additions > 100) {
      // Mostly additions with very few deletions - might indicate complexity
      score = 0.5;
      status = 'warning';
      description = 'High complexity - mostly new code';
    } else if (stats.additions > 500) {
      // Very large additions
      score = 0.3;
      status = 'warning';
      description = 'Very large code addition';
    } else if (stats.changes < 10) {
      // Very small changes
      description = 'Simple change';
    }

    return {
      name: 'Complexity',
      score,
      maxScore,
      status,
      description,
    };
  }

  private mergeFactors(factors: QualityFactor[]): QualityFactor[] {
    const factorMap = new Map<string, QualityFactor>();

    for (const factor of factors) {
      const existing = factorMap.get(factor.name);
      
      if (existing) {
        // Merge factors with same name - take the better score
        if (factor.score > existing.score) {
          factorMap.set(factor.name, factor);
        }
      } else {
        factorMap.set(factor.name, factor);
      }
    }

    return Array.from(factorMap.values());
  }

  private generateSummary(factors: QualityFactor[], context: PRContext): string[] {
    const summary: string[] = [];
    const passCount = factors.filter(f => f.status === 'pass').length;
    const warningCount = factors.filter(f => f.status === 'warning').length;
    const failCount = factors.filter(f => f.status === 'fail').length;

    // Overall assessment
    if (failCount === 0 && warningCount === 0) {
      summary.push('✅ Excellent PR quality');
    } else if (failCount === 0) {
      summary.push('✅ Good PR quality with minor areas for improvement');
    } else if (failCount === 1) {
      summary.push('⚠️ Generally good but needs attention in one area');
    } else {
      summary.push('❌ Multiple areas need improvement');
    }

    // Specific highlights
    const passFactors = factors.filter(f => f.status === 'pass');
    if (passFactors.length > 0) {
      const topPass = passFactors.slice(0, 2).map(f => f.name).join(' and ');
      summary.push(`✅ Strong: ${topPass}`);
    }

    const failFactors = factors.filter(f => f.status === 'fail');
    if (failFactors.length > 0) {
      const topFail = failFactors.slice(0, 2).map(f => f.name).join(' and ');
      summary.push(`❌ Needs work: ${topFail}`);
    }

    // Contributor context
    if (context.isFirstTimeContributor && failCount > 0) {
      summary.push('👋 Great first contribution - small improvements suggested');
    }

    return summary;
  }

  private isDocumentationFile(filename: string): boolean {
    return /\.(md|txt|rst)$|readme|changelog|license|docs\//i.test(filename);
  }

  private isConfigurationFile(filename: string): boolean {
    return /\.(json|yaml|yml|toml|ini|cfg|conf)$|config|\.env|dockerfile|makefile/i.test(filename);
  }

  private isSourceCodeFile(filename: string): boolean {
    return /\.(js|ts|py|java|go|rs|cpp|c|h|php|rb|swift|kt|scala|cs)$/i.test(filename);
  }
}