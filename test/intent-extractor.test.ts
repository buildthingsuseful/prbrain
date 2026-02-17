import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentExtractor } from '../src/core/intent-extractor';
import { OpenAIAdapter } from '../src/adapters/openai';
import { PRContext } from '../src/types';

// Mock the OpenAI adapter
vi.mock('../src/adapters/openai');

describe('IntentExtractor', () => {
  let intentExtractor: IntentExtractor;
  let mockOpenAI: vi.Mocked<OpenAIAdapter>;

  beforeEach(() => {
    mockOpenAI = {
      extractIntent: vi.fn(),
      generateCompletion: vi.fn(),
      generateEmbedding: vi.fn(),
      detectAIGeneration: vi.fn(),
      checkVisionAlignment: vi.fn(),
      scoreQuality: vi.fn(),
    } as any;

    intentExtractor = new IntentExtractor(mockOpenAI);
  });

  const mockPRContext: PRContext = {
    number: 123,
    title: 'Add rate limiting to API endpoints',
    body: 'This PR adds rate limiting middleware to prevent abuse',
    author: 'testuser',
    diff: `diff --git a/src/server.js b/src/server.js
index 1234567..abcdefg 100644
--- a/src/server.js
+++ b/src/server.js
@@ -1,5 +1,10 @@
 const express = require('express');
+const rateLimit = require('express-rate-limit');
+
 const app = express();
 
+const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
+app.use(limiter);
+
 app.listen(3000);`,
    files: [
      {
        filename: 'src/server.js',
        status: 'modified',
        additions: 5,
        deletions: 0,
        changes: 5,
      },
      {
        filename: 'package.json',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
      },
    ],
    isFirstTimeContributor: false,
    hasTests: false,
    baseBranch: 'main',
    headBranch: 'feature/rate-limiting',
  };

  describe('extractIntent', () => {
    it('should extract intent successfully with AI analysis', async () => {
      const mockAIResponse = {
        intent: 'Add rate limiting middleware to API endpoints',
        summary: 'Implements express-rate-limit to prevent API abuse',
        confidence: 85,
        keyChanges: ['Added rate limiting middleware', 'Updated dependencies'],
        gaps: [],
      };

      mockOpenAI.extractIntent.mockResolvedValue(mockAIResponse);

      const result = await intentExtractor.extractIntent(mockPRContext);

      expect(result).toEqual({
        inferredIntent: 'Add rate limiting middleware to API endpoints',
        summary: 'Implements express-rate-limit to prevent API abuse',
        confidence: 85,
        keyChanges: ['Added rate limiting middleware', 'Updated dependencies'],
        scope: {
          filesChanged: 2,
          linesAdded: 6,
          linesDeleted: 0,
          description: '2 files changed | 6 lines added | Small change',
        },
        gaps: [],
      });

      expect(mockOpenAI.extractIntent).toHaveBeenCalledWith(
        expect.stringContaining('const express = require(\'express\');'),
        'Add rate limiting to API endpoints',
        'This PR adds rate limiting middleware to prevent abuse'
      );
    });

    it('should handle AI analysis failure with fallback', async () => {
      mockOpenAI.extractIntent.mockRejectedValue(new Error('API error'));

      const result = await intentExtractor.extractIntent(mockPRContext);

      expect(result.inferredIntent).toBe('Add new functionality');
      expect(result.confidence).toBe(20);
      expect(result.gaps).toContain('Intent extraction failed due to API error');
      expect(result.scope.filesChanged).toBe(2);
    });

    it('should generate appropriate fallback intent from title', async () => {
      const bugFixContext = {
        ...mockPRContext,
        title: 'Fix memory leak in database connection pool',
      };

      mockOpenAI.extractIntent.mockRejectedValue(new Error('API error'));

      const result = await intentExtractor.extractIntent(bugFixContext);

      expect(result.inferredIntent).toBe('Fix a bug or issue');
    });

    it('should calculate scope correctly', async () => {
      const largeChangeContext: PRContext = {
        ...mockPRContext,
        files: Array.from({ length: 15 }, (_, i) => ({
          filename: `file${i}.js`,
          status: 'modified' as const,
          additions: 20,
          deletions: 5,
          changes: 25,
        })),
      };

      mockOpenAI.extractIntent.mockRejectedValue(new Error('API error'));

      const result = await intentExtractor.extractIntent(largeChangeContext);

      expect(result.scope.filesChanged).toBe(15);
      expect(result.scope.linesAdded).toBe(300);
      expect(result.scope.linesDeleted).toBe(75);
      expect(result.scope.description).toContain('Large change');
    });

    it('should extract key changes from different file types', async () => {
      const mixedFilesContext: PRContext = {
        ...mockPRContext,
        files: [
          { filename: 'src/app.js', status: 'modified', additions: 10, deletions: 2, changes: 12 },
          { filename: 'test/app.test.js', status: 'added', additions: 50, deletions: 0, changes: 50 },
          { filename: 'README.md', status: 'modified', additions: 5, deletions: 1, changes: 6 },
          { filename: 'package.json', status: 'modified', additions: 2, deletions: 0, changes: 2 },
        ],
      };

      mockOpenAI.extractIntent.mockResolvedValue({
        intent: 'Test intent',
        summary: 'Test summary',
        confidence: 80,
        keyChanges: [],
        gaps: [],
      });

      const result = await intentExtractor.extractIntent(mixedFilesContext);

      // Should identify different file types in key changes
      const keyChangesText = result.keyChanges.join(' ');
      expect(keyChangesText).toContain('source code');
      expect(keyChangesText).toContain('test');
      expect(keyChangesText).toContain('documentation');
      expect(keyChangesText).toContain('configuration');
    });

    it('should handle empty or malformed diff gracefully', async () => {
      const emptyDiffContext = {
        ...mockPRContext,
        diff: '',
      };

      mockOpenAI.extractIntent.mockResolvedValue({
        intent: 'Unknown intent',
        summary: 'No changes detected',
        confidence: 10,
        keyChanges: [],
        gaps: ['No diff available'],
      });

      const result = await intentExtractor.extractIntent(emptyDiffContext);

      expect(result.confidence).toBe(10);
      expect(result.keyChanges.length).toBeGreaterThan(0); // Should still have fallback key changes
    });

    it('should limit key changes to avoid overwhelming output', async () => {
      const manyChangesContext = {
        ...mockPRContext,
        diff: Array.from({ length: 50 }, (_, i) => 
          `+function change${i}() { return ${i}; }`
        ).join('\n'),
      };

      mockOpenAI.extractIntent.mockResolvedValue({
        intent: 'Many changes',
        summary: 'Lots of functions added',
        confidence: 70,
        keyChanges: Array.from({ length: 20 }, (_, i) => `Change ${i}`),
        gaps: [],
      });

      const result = await intentExtractor.extractIntent(manyChangesContext);

      expect(result.keyChanges.length).toBeLessThanOrEqual(8);
    });
  });
});