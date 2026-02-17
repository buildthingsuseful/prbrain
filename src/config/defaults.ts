import { PRBrainConfig } from './schema';

export const DEFAULT_CONFIG: PRBrainConfig = {
  model: 'gpt-4o-mini',
  similarity_threshold: 0.80,
  vision_doc: 'VISION.md',
  quality: {
    require_tests: true,
    max_files_changed: 50,
    max_lines_changed: 1000,
  },
  labels: {
    ai_generated: '🤖 ai-generated',
    duplicate: 'duplicate',
    vision_misaligned: '⚠️ scope-creep',
  },
  ignore: {
    paths: ['*.lock', '*.generated.*', 'package-lock.json', 'yarn.lock'],
    authors: ['dependabot[bot]', 'renovate[bot]'],
  },
};

export const MAX_DIFF_TOKENS = 8000;
export const MAX_VISION_TOKENS = 4000;
export const COMMENT_MARKER = '<!-- PRBrain Analysis -->';
export const EMBEDDING_VERSION = '1.0';
export const SUPPORTED_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
] as const;