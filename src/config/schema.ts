import { z } from 'zod';

export const QualityConfigSchema = z.object({
  require_tests: z.boolean().default(true),
  max_files_changed: z.number().positive().default(50),
  max_lines_changed: z.number().positive().default(1000),
});

export const LabelConfigSchema = z.object({
  ai_generated: z.string().default('🤖 ai-generated'),
  duplicate: z.string().default('duplicate'),
  vision_misaligned: z.string().default('⚠️ scope-creep'),
});

export const IgnoreConfigSchema = z.object({
  paths: z.array(z.string()).default(['*.lock', '*.generated.*', 'package-lock.json', 'yarn.lock']),
  authors: z.array(z.string()).default(['dependabot[bot]', 'renovate[bot]']),
});

export const PRBrainConfigSchema = z.object({
  model: z.string().default('gpt-4o-mini'),
  similarity_threshold: z.number().min(0).max(1).default(0.80),
  vision_doc: z.string().default('VISION.md'),
  quality: QualityConfigSchema.default({}),
  labels: LabelConfigSchema.default({}),
  ignore: IgnoreConfigSchema.default({}),
});

export type PRBrainConfig = z.infer<typeof PRBrainConfigSchema>;
export type QualityConfig = z.infer<typeof QualityConfigSchema>;
export type LabelConfig = z.infer<typeof LabelConfigSchema>;
export type IgnoreConfig = z.infer<typeof IgnoreConfigSchema>;