export interface PRAnalysisResult {
  aiDetection: AIDetectionResult;
  intentExtraction: IntentExtractionResult;
  deduplication: DeduplicationResult;
  visionAlignment: VisionAlignmentResult;
  qualityScore: QualityScoreResult;
}

export interface AIDetectionResult {
  isAIGenerated: boolean;
  confidence: number;
  signals: AISignal[];
  reasoning: string;
}

export interface AISignal {
  type: 'code_style' | 'comment_style' | 'structure' | 'naming' | 'complexity';
  indicator: string;
  score: number;
  description: string;
}

export interface IntentExtractionResult {
  inferredIntent: string;
  summary: string;
  confidence: number;
  keyChanges: string[];
  scope: ScopeInfo;
  gaps: string[];
}

export interface ScopeInfo {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  description: string;
}

export interface DeduplicationResult {
  similarItems: SimilarItem[];
  isDuplicate: boolean;
  duplicateThreshold: number;
}

export interface SimilarItem {
  type: 'pr' | 'issue';
  number: number;
  title: string;
  similarity: number;
  status: 'open' | 'closed' | 'merged' | 'draft';
  url: string;
}

export interface VisionAlignmentResult {
  isAligned: boolean;
  score: number;
  alignment: VisionAlignment[];
  visionFound: boolean;
  visionPath?: string;
}

export interface VisionAlignment {
  principle: string;
  alignment: 'aligned' | 'neutral' | 'misaligned';
  reasoning: string;
}

export interface QualityScoreResult {
  overallScore: number;
  maxScore: number;
  factors: QualityFactor[];
  summary: string[];
}

export interface QualityFactor {
  name: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'warning' | 'fail';
  description: string;
}

export interface PRBrainConfig {
  model: string;
  similarity_threshold: number;
  vision_doc: string;
  quality: QualityConfig;
  labels: LabelConfig;
  ignore: IgnoreConfig;
}

export interface QualityConfig {
  require_tests: boolean;
  max_files_changed: number;
  max_lines_changed: number;
}

export interface LabelConfig {
  ai_generated: string;
  duplicate: string;
  vision_misaligned: string;
}

export interface IgnoreConfig {
  paths: string[];
  authors: string[];
}

export interface PRContext {
  number: number;
  title: string;
  body: string | null;
  author: string;
  diff: string;
  files: PRFile[];
  isFirstTimeContributor: boolean;
  hasTests: boolean;
  baseBranch: string;
  headBranch: string;
}

export interface PRFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | undefined;
}

export interface EmbeddingData {
  id: string;
  type: 'pr' | 'issue';
  number: number;
  title: string;
  body: string;
  embedding: number[];
  createdAt: string;
}

export interface StoredEmbeddings {
  version: string;
  embeddings: EmbeddingData[];
  lastUpdated: string;
}

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  lineNumber: number;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}