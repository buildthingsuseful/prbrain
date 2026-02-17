import { AIDetectionResult, AISignal, PRContext } from '../types';
import { OpenAIAdapter } from '../adapters/openai';
import { diffParser } from '../utils/diff-parser';
import { tokenizer } from '../utils/tokenizer';
import { logger } from '../utils/logger';
import { MAX_DIFF_TOKENS } from '../config/defaults';

export class AIDetector {
  constructor(private openai: OpenAIAdapter) {}

  async detectAIGeneration(context: PRContext): Promise<AIDetectionResult> {
    logger.info(`Analyzing AI generation for PR #${context.number}`);

    try {
      // Prepare diff for analysis
      const analyzableDiff = this.prepareDiffForAnalysis(context.diff);
      
      // Run both heuristic and LLM analysis
      const heuristicSignals = this.analyzeHeuristicSignals(context);
      const llmAnalysis = await this.openai.detectAIGeneration(
        analyzableDiff,
        context.title,
        context.body
      );

      // Combine signals
      const allSignals = [...heuristicSignals, ...(llmAnalysis.signals || []).map(s => ({
        type: s.type as AISignal['type'],
        indicator: s.indicator,
        score: s.score,
        description: s.description,
      }))];
      
      // Calculate overall confidence (weighted average)
      const heuristicConfidence = this.calculateHeuristicConfidence(heuristicSignals);
      const llmConfidence = llmAnalysis.confidence || 50;
      const combinedConfidence = Math.round((heuristicConfidence * 0.3 + llmConfidence * 0.7));
      
      // Determine if AI generated based on confidence threshold
      const isAIGenerated = combinedConfidence >= 70 || 
                            allSignals.filter(s => s.score >= 0.7).length >= 3;

      const result: AIDetectionResult = {
        isAIGenerated,
        confidence: combinedConfidence,
        signals: allSignals.sort((a, b) => b.score - a.score).slice(0, 10), // Top 10 signals
        reasoning: llmAnalysis.reasoning || this.createFallbackReasoning(allSignals),
      };

      logger.info(`AI detection: ${isAIGenerated ? 'LIKELY' : 'UNLIKELY'} (${combinedConfidence}% confidence)`);
      return result;

    } catch (error) {
      logger.error('AI detection failed', error);
      
      // Fallback to heuristic-only analysis
      const heuristicSignals = this.analyzeHeuristicSignals(context);
      const heuristicConfidence = this.calculateHeuristicConfidence(heuristicSignals);
      
      return {
        isAIGenerated: heuristicConfidence >= 70,
        confidence: heuristicConfidence,
        signals: heuristicSignals,
        reasoning: 'Analysis based on code patterns only (LLM analysis unavailable)',
      };
    }
  }

  private prepareDiffForAnalysis(diff: string): string {
    return tokenizer.truncateDiff(diff, MAX_DIFF_TOKENS);
  }

  private analyzeHeuristicSignals(context: PRContext): AISignal[] {
    const signals: AISignal[] = [];
    const { added } = diffParser.extractChangedLines(context.diff);
    
    // Analyze various code patterns
    signals.push(...this.analyzeNamingPatterns(added));
    signals.push(...this.analyzeCommentPatterns(added));
    signals.push(...this.analyzeStructuralPatterns(added));
    signals.push(...this.analyzeComplexityPatterns(added, context));
    signals.push(...this.analyzeStylePatterns(added));

    return signals;
  }

  private analyzeNamingPatterns(addedLines: string[]): AISignal[] {
    const signals: AISignal[] = [];
    const codeLines = addedLines.filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    
    // Check for overly verbose variable names
    const verboseNamePattern = /\b[a-zA-Z]{15,}\b/;
    const verboseNames = codeLines.filter(line => verboseNamePattern.test(line));
    if (verboseNames.length / codeLines.length > 0.1) {
      signals.push({
        type: 'naming',
        indicator: 'Overly verbose variable names',
        score: Math.min(0.8, verboseNames.length / codeLines.length * 4),
        description: `${verboseNames.length} lines with very long identifiers (>15 chars)`,
      });
    }

    // Check for generic variable names common in AI code
    const genericPatterns = [
      /\bresult[A-Z]\w*/,
      /\btemp[A-Z]\w*/,
      /\bhelper[A-Z]\w*/,
      /\butility[A-Z]\w*/,
      /\bhandler[A-Z]\w*/,
    ];
    
    let genericCount = 0;
    for (const pattern of genericPatterns) {
      genericCount += codeLines.filter(line => pattern.test(line)).length;
    }
    
    if (genericCount > 0) {
      signals.push({
        type: 'naming',
        indicator: 'Generic AI-style naming',
        score: Math.min(0.7, genericCount / codeLines.length * 3),
        description: `${genericCount} instances of generic naming patterns`,
      });
    }

    return signals;
  }

  private analyzeCommentPatterns(addedLines: string[]): AISignal[] {
    const signals: AISignal[] = [];
    const comments = addedLines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#');
    });

    if (comments.length === 0) return signals;

    // Check for overly explanatory comments
    const verboseComments = comments.filter(comment => comment.trim().length > 60);
    if (verboseComments.length / comments.length > 0.3) {
      signals.push({
        type: 'comment_style',
        indicator: 'Overly explanatory comments',
        score: 0.6,
        description: `${verboseComments.length}/${comments.length} comments are very detailed`,
      });
    }

    // Check for AI-like comment phrases
    const aiPhrases = [
      'initialize the',
      'set up the',
      'create an instance of',
      'ensure that',
      'make sure',
      'validate the input',
      'handle the error',
      'return the result',
    ];

    let aiPhraseCount = 0;
    for (const phrase of aiPhrases) {
      aiPhraseCount += comments.filter(comment => 
        comment.toLowerCase().includes(phrase)
      ).length;
    }

    if (aiPhraseCount > 0) {
      signals.push({
        type: 'comment_style',
        indicator: 'AI-like comment phrasing',
        score: Math.min(0.8, aiPhraseCount / comments.length * 2),
        description: `${aiPhraseCount} AI-typical comment phrases found`,
      });
    }

    return signals;
  }

  private analyzeStructuralPatterns(addedLines: string[]): AISignal[] {
    const signals: AISignal[] = [];
    const codeLines = addedLines.filter(line => line.trim() && !this.isComment(line));
    
    // Check for excessive defensive programming
    const defensivePatterns = [
      /if\s*\(\s*\w+\s*===?\s*null\s*\|\|\s*\w+\s*===?\s*undefined\s*\)/,
      /if\s*\(\s*!\w+\s*\)/,
      /throw new Error\(/,
      /\.hasOwnProperty\(/,
      /Array\.isArray\(/,
      /typeof\s+\w+\s*===?\s*['"]string['"]]/,
    ];

    let defensiveCount = 0;
    for (const pattern of defensivePatterns) {
      defensiveCount += codeLines.filter(line => pattern.test(line)).length;
    }

    if (defensiveCount / codeLines.length > 0.15) {
      signals.push({
        type: 'structure',
        indicator: 'Excessive defensive programming',
        score: 0.7,
        description: `${defensiveCount} defensive programming patterns in ${codeLines.length} lines`,
      });
    }

    // Check for methodical, step-by-step approach
    const stepPatterns = [
      /step\s*\d+/i,
      /first[,\s]/i,
      /second[,\s]/i,
      /then[,\s]/i,
      /finally[,\s]/i,
      /next[,\s]/i,
    ];

    let stepCount = 0;
    for (const pattern of stepPatterns) {
      stepCount += addedLines.filter(line => pattern.test(line)).length;
    }

    if (stepCount > 2) {
      signals.push({
        type: 'structure',
        indicator: 'Methodical step-by-step approach',
        score: 0.6,
        description: `${stepCount} step-wise indicators found`,
      });
    }

    return signals;
  }

  private analyzeComplexityPatterns(addedLines: string[], context: PRContext): AISignal[] {
    const signals: AISignal[] = [];
    
    // Check for over-engineering simple tasks
    const linesPerFile = context.files.length > 0 ? 
      context.files.reduce((sum, f) => sum + f.additions, 0) / context.files.length : 0;

    if (linesPerFile > 100) {
      const simpleTaskIndicators = [
        'add',
        'simple',
        'basic',
        'minor',
        'quick',
        'small',
      ];

      const titleLower = context.title.toLowerCase();
      const hasSimpleIndicator = simpleTaskIndicators.some(indicator => 
        titleLower.includes(indicator)
      );

      if (hasSimpleIndicator) {
        signals.push({
          type: 'complexity',
          indicator: 'Over-engineering simple task',
          score: 0.7,
          description: `Simple task but ${Math.round(linesPerFile)} lines per file`,
        });
      }
    }

    // Check for comprehensive error handling that might be excessive
    const errorHandlingLines = addedLines.filter(line => 
      /try\s*{|catch\s*\(|throw\s+new|\.catch\(/.test(line)
    );

    if (errorHandlingLines.length / addedLines.length > 0.1) {
      signals.push({
        type: 'complexity',
        indicator: 'Comprehensive error handling',
        score: 0.5,
        description: `${errorHandlingLines.length} error handling patterns`,
      });
    }

    return signals;
  }

  private analyzeStylePatterns(addedLines: string[]): AISignal[] {
    const signals: AISignal[] = [];
    const codeLines = addedLines.filter(line => line.trim() && !this.isComment(line));

    if (codeLines.length === 0) return signals;

    // Check for perfect formatting consistency
    const indentationPattern = /^(\s*)/;
    const indentations = codeLines.map(line => {
      const match = line.match(indentationPattern);
      return match ? match[1]!.length : 0;
    });

    // Check if indentation is perfectly consistent (multiple of 2 or 4)
    const perfectIndentation = indentations.every(indent => 
      indent === 0 || indent % 2 === 0 || indent % 4 === 0
    );

    if (perfectIndentation && codeLines.length > 10) {
      signals.push({
        type: 'code_style',
        indicator: 'Perfect formatting consistency',
        score: 0.4,
        description: 'All indentation follows perfect spacing rules',
      });
    }

    // Check for consistent semicolon usage (if applicable)
    const jsLines = codeLines.filter(line => /[;}]\s*$/.test(line.trim()));
    if (jsLines.length > 5 && jsLines.length === codeLines.filter(line => 
      !line.includes('{') && !line.includes('if') && !line.includes('for') && line.trim().endsWith(';')
    ).length) {
      signals.push({
        type: 'code_style',
        indicator: 'Perfect semicolon consistency',
        score: 0.3,
        description: 'All statements properly terminated with semicolons',
      });
    }

    return signals;
  }

  private isComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || 
           trimmed.startsWith('*') || 
           trimmed.startsWith('#') ||
           trimmed.startsWith('<!--');
  }

  private calculateHeuristicConfidence(signals: AISignal[]): number {
    if (signals.length === 0) return 10;

    // Weight signals by type
    const typeWeights = {
      naming: 1.2,
      comment_style: 1.0,
      structure: 1.1,
      complexity: 0.9,
      code_style: 0.8,
    };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const weight = typeWeights[signal.type as keyof typeof typeWeights] || 1.0;
      weightedScore += signal.score * weight;
      totalWeight += weight;
    }

    const averageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return Math.round(Math.min(90, Math.max(10, averageScore * 100)));
  }

  private createFallbackReasoning(signals: AISignal[]): string {
    if (signals.length === 0) {
      return 'No clear AI generation signals detected in the code patterns.';
    }

    const topSignals = signals
      .filter(s => s.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (topSignals.length === 0) {
      return 'Code patterns appear to be consistent with human-written code.';
    }

    const reasons = topSignals.map(s => s.indicator.toLowerCase()).join(', ');
    return `AI generation suspected based on: ${reasons}. These patterns are commonly observed in LLM-generated code.`;
  }
}