import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

import { PRAnalysisResult, PRBrainConfig } from './types';
import { DEFAULT_CONFIG } from './config/defaults';
import { PRBrainConfigSchema } from './config/schema';
import { logger } from './utils/logger';

// Core modules
import { IntentExtractor } from './core/intent-extractor';
import { AIDetector } from './core/ai-detector';
import { Deduplicator } from './core/dedup';
import { VisionChecker } from './core/vision-checker';
import { QualityScorer } from './core/quality-scorer';
import { CommentFormatter } from './core/comment-formatter';

// Adapters
import { GitHubAdapter } from './adapters/github';
import { OpenAIAdapter } from './adapters/openai';
import { StorageAdapter } from './adapters/storage';

async function run(): Promise<void> {
  try {
    logger.info('PRBrain starting analysis...');

    // Get inputs
    const openaiApiKey = core.getInput('openai-api-key', { required: true });
    const githubToken = core.getInput('github-token', { required: true });
    const configPath = core.getInput('config-path') || '.prbrain.yml';

    // Validate we're in a pull request context
    if (github.context.eventName !== 'pull_request') {
      core.warning('PRBrain is designed to run on pull_request events only');
      return;
    }

    // Load configuration
    const config = await loadConfig(configPath);
    logger.info(`Configuration loaded: model=${config.model}, threshold=${config.similarity_threshold}`);

    // Initialize adapters
    const githubAdapter = new GitHubAdapter(githubToken);
    const openaiAdapter = new OpenAIAdapter(openaiApiKey, config.model);
    const storageAdapter = new StorageAdapter();

    // Initialize core modules
    const intentExtractor = new IntentExtractor(openaiAdapter);
    const aiDetector = new AIDetector(openaiAdapter);
    const deduplicator = new Deduplicator(openaiAdapter, githubAdapter, storageAdapter, config.similarity_threshold);
    const visionChecker = new VisionChecker(openaiAdapter, githubAdapter, config.vision_doc);
    const qualityScorer = new QualityScorer(openaiAdapter, config.quality);
    const commentFormatter = new CommentFormatter();

    // Get PR context
    const prContext = await githubAdapter.getPRContext();
    logger.info(`Analyzing PR #${prContext.number}: "${prContext.title}" by ${prContext.author}`);

    // Check if we should ignore this PR
    if (shouldIgnorePR(prContext, config)) {
      logger.info('PR ignored based on configuration');
      return;
    }

    // Run analysis (parallel where possible)
    logger.info('Running PR analysis...');
    const analysisResults = await runAnalysis({
      prContext,
      intentExtractor,
      aiDetector,
      deduplicator,
      visionChecker,
      qualityScorer,
    });

    // Format and post comment
    const comment = commentFormatter.formatAnalysis(analysisResults);
    await githubAdapter.postOrUpdateComment(comment);

    // Add labels if configured
    await addLabels(analysisResults, config, githubAdapter);

    // Set outputs
    core.setOutput('ai-generated', analysisResults.aiDetection.isAIGenerated);
    core.setOutput('confidence', analysisResults.aiDetection.confidence);
    core.setOutput('quality-score', analysisResults.qualityScore.overallScore);
    core.setOutput('is-duplicate', analysisResults.deduplication.isDuplicate);
    core.setOutput('vision-aligned', analysisResults.visionAlignment.isAligned);

    logger.info('PRBrain analysis completed successfully');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('PRBrain analysis failed', error);
    core.setFailed(errorMessage);
    
    // Try to post error comment if possible
    try {
      const githubToken = core.getInput('github-token');
      if (githubToken) {
        const githubAdapter = new GitHubAdapter(githubToken);
        const commentFormatter = new CommentFormatter();
        const errorComment = commentFormatter.formatError(error as Error);
        await githubAdapter.postOrUpdateComment(errorComment);
      }
    } catch (commentError) {
      logger.error('Failed to post error comment', commentError);
    }
  }
}

async function loadConfig(configPath: string): Promise<PRBrainConfig> {
  try {
    logger.info(`Loading configuration from ${configPath}`);
    const configContent = await fs.readFile(configPath, 'utf8');
    const rawConfig = yaml.parse(configContent);
    
    // Validate and parse with Zod
    const config = PRBrainConfigSchema.parse(rawConfig);
    logger.info('Configuration validated successfully');
    
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info('No configuration file found, using defaults');
      return DEFAULT_CONFIG;
    } else {
      logger.warning(`Invalid configuration file, using defaults. Error: ${error}`);
      return DEFAULT_CONFIG;
    }
  }
}

function shouldIgnorePR(prContext: any, config: PRBrainConfig): boolean {
  // Check ignored authors
  if (config.ignore.authors.includes(prContext.author)) {
    logger.info(`Ignoring PR from author: ${prContext.author}`);
    return true;
  }

  // Check ignored paths
  const hasOnlyIgnoredFiles = prContext.files.every((file: any) =>
    config.ignore.paths.some(pattern =>
      new RegExp(pattern.replace(/\*/g, '.*')).test(file.filename)
    )
  );

  if (hasOnlyIgnoredFiles && prContext.files.length > 0) {
    logger.info('Ignoring PR with only ignored file paths');
    return true;
  }

  return false;
}

interface AnalysisModules {
  prContext: any;
  intentExtractor: IntentExtractor;
  aiDetector: AIDetector;
  deduplicator: Deduplicator;
  visionChecker: VisionChecker;
  qualityScorer: QualityScorer;
}

async function runAnalysis(modules: AnalysisModules): Promise<PRAnalysisResult> {
  const { prContext, intentExtractor, aiDetector, deduplicator, visionChecker, qualityScorer } = modules;
  
  const results: Partial<PRAnalysisResult> = {};
  const errors: string[] = [];

  // Run analyses in parallel where possible
  try {
    const [intentResult, aiResult, dedupResult] = await Promise.allSettled([
      logger.group('Intent Extraction', () => intentExtractor.extractIntent(prContext)),
      logger.group('AI Detection', () => aiDetector.detectAIGeneration(prContext)),
      logger.group('Deduplication', () => deduplicator.findDuplicates(prContext)),
    ]);

    // Process intent extraction result
    if (intentResult.status === 'fulfilled') {
      results.intentExtraction = intentResult.value;
    } else {
      errors.push(`Intent extraction failed: ${intentResult.reason}`);
      logger.error('Intent extraction failed', intentResult.reason);
    }

    // Process AI detection result
    if (aiResult.status === 'fulfilled') {
      results.aiDetection = aiResult.value;
    } else {
      errors.push(`AI detection failed: ${aiResult.reason}`);
      logger.error('AI detection failed', aiResult.reason);
    }

    // Process deduplication result
    if (dedupResult.status === 'fulfilled') {
      results.deduplication = dedupResult.value;
    } else {
      errors.push(`Deduplication failed: ${dedupResult.reason}`);
      logger.error('Deduplication failed', dedupResult.reason);
    }

    // Run vision and quality checks (these can run in parallel too)
    const [visionResult, qualityResult] = await Promise.allSettled([
      logger.group('Vision Alignment', () => visionChecker.checkAlignment(prContext)),
      logger.group('Quality Scoring', () => qualityScorer.scoreQuality(prContext)),
    ]);

    // Process vision alignment result
    if (visionResult.status === 'fulfilled') {
      results.visionAlignment = visionResult.value;
    } else {
      errors.push(`Vision alignment failed: ${visionResult.reason}`);
      logger.error('Vision alignment failed', visionResult.reason);
    }

    // Process quality scoring result
    if (qualityResult.status === 'fulfilled') {
      results.qualityScore = qualityResult.value;
    } else {
      errors.push(`Quality scoring failed: ${qualityResult.reason}`);
      logger.error('Quality scoring failed', qualityResult.reason);
    }

  } catch (error) {
    logger.error('Analysis pipeline failed', error);
    errors.push(`Pipeline error: ${error}`);
  }

  // Provide fallbacks for missing results
  if (!results.intentExtraction) {
    results.intentExtraction = createFallbackIntentExtraction(prContext);
  }

  if (!results.aiDetection) {
    results.aiDetection = createFallbackAIDetection();
  }

  if (!results.deduplication) {
    results.deduplication = createFallbackDeduplication();
  }

  if (!results.visionAlignment) {
    results.visionAlignment = createFallbackVisionAlignment();
  }

  if (!results.qualityScore) {
    results.qualityScore = createFallbackQualityScore();
  }

  // Log any errors that occurred
  if (errors.length > 0) {
    logger.warning(`Analysis completed with ${errors.length} errors`);
    core.warning(`PRBrain encountered ${errors.length} errors during analysis`);
  }

  return results as PRAnalysisResult;
}

async function addLabels(results: PRAnalysisResult, config: PRBrainConfig, githubAdapter: GitHubAdapter): Promise<void> {
  const labelsToAdd: string[] = [];

  try {
    // Add AI-generated label
    if (results.aiDetection.isAIGenerated) {
      labelsToAdd.push(config.labels.ai_generated);
    }

    // Add duplicate label
    if (results.deduplication.isDuplicate) {
      labelsToAdd.push(config.labels.duplicate);
    }

    // Add vision misalignment label
    if (results.visionAlignment.visionFound && !results.visionAlignment.isAligned) {
      labelsToAdd.push(config.labels.vision_misaligned);
    }

    if (labelsToAdd.length > 0) {
      await githubAdapter.addLabels(labelsToAdd);
    }
  } catch (error) {
    logger.error('Failed to add labels', error);
    // Don't fail the entire action if labeling fails
  }
}

// Fallback functions for when analysis fails
function createFallbackIntentExtraction(prContext: any) {
  return {
    inferredIntent: `Changes related to: ${prContext.title}`,
    summary: 'Analysis unavailable',
    confidence: 0,
    keyChanges: [`${prContext.files.length} files modified`],
    scope: {
      filesChanged: prContext.files.length,
      linesAdded: prContext.files.reduce((sum: number, f: any) => sum + f.additions, 0),
      linesDeleted: prContext.files.reduce((sum: number, f: any) => sum + f.deletions, 0),
      description: `${prContext.files.length} files changed`,
    },
    gaps: ['Analysis failed'],
  };
}

function createFallbackAIDetection() {
  return {
    isAIGenerated: false,
    confidence: 0,
    signals: [],
    reasoning: 'Analysis unavailable',
  };
}

function createFallbackDeduplication() {
  return {
    similarItems: [],
    isDuplicate: false,
    duplicateThreshold: 0.8,
  };
}

function createFallbackVisionAlignment() {
  return {
    isAligned: true,
    score: 50,
    alignment: [],
    visionFound: false,
  };
}

function createFallbackQualityScore() {
  return {
    overallScore: 5,
    maxScore: 10,
    factors: [
      {
        name: 'Analysis Failed',
        score: 0,
        maxScore: 1,
        status: 'fail' as const,
        description: 'Unable to analyze PR quality',
      },
    ],
    summary: ['Analysis unavailable due to technical error'],
  };
}

// Run the action
if (require.main === module) {
  run();
}

export { run };