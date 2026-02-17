import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QualityScorer } from '../src/core/quality-scorer';
import { OpenAIAdapter } from '../src/adapters/openai';
import { PRContext, QualityConfig } from '../src/types';

// Mock the OpenAI adapter
vi.mock('../src/adapters/openai');

describe('QualityScorer', () => {
  let qualityScorer: QualityScorer;
  let mockOpenAI: vi.Mocked<OpenAIAdapter>;
  let mockConfig: QualityConfig;

  beforeEach(() => {
    mockOpenAI = {
      scoreQuality: vi.fn(),
      generateCompletion: vi.fn(),
      generateEmbedding: vi.fn(),
      extractIntent: vi.fn(),
      detectAIGeneration: vi.fn(),
      checkVisionAlignment: vi.fn(),
    } as any;

    mockConfig = {
      require_tests: true,
      max_files_changed: 50,
      max_lines_changed: 1000,
    };

    qualityScorer = new QualityScorer(mockOpenAI, mockConfig);
  });

  const createMockPRContext = (overrides: Partial<PRContext> = {}): PRContext => ({
    number: 123,
    title: 'Add new feature',
    body: 'This PR adds a new feature with proper implementation',
    author: 'developer',
    diff: `diff --git a/src/feature.js b/src/feature.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/feature.js
@@ -0,0 +1,20 @@
+function newFeature() {
+  return 'feature';
+}`,
    files: [
      {
        filename: 'src/feature.js',
        status: 'added',
        additions: 20,
        deletions: 0,
        changes: 20,
      },
    ],
    isFirstTimeContributor: false,
    hasTests: true,
    baseBranch: 'main',
    headBranch: 'feature/new-feature',
    ...overrides,
  });

  describe('scoreQuality', () => {
    it('should score high-quality PR correctly', async () => {
      const mockPRContext = createMockPRContext({
        hasTests: true,
        files: [
          { filename: 'src/feature.js', status: 'added', additions: 25, deletions: 0, changes: 25 },
          { filename: 'test/feature.test.js', status: 'added', additions: 15, deletions: 0, changes: 15 },
          { filename: 'README.md', status: 'modified', additions: 3, deletions: 1, changes: 4 },
        ],
      });

      const mockAIResponse = {
        overallScore: 8,
        maxScore: 10,
        factors: [
          {
            name: 'Code Quality',
            score: 3,
            maxScore: 3,
            status: 'pass' as const,
            description: 'Clean, well-structured code',
          },
        ],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(mockPRContext);

      expect(result.overallScore).toBeGreaterThanOrEqual(7);
      expect(result.factors.some(f => f.name === 'Test Coverage' && f.status === 'pass')).toBe(true);
      expect(result.factors.some(f => f.name === 'Documentation' && f.status === 'pass')).toBe(true);
      expect(result.factors.some(f => f.name === 'Change Scope' && f.status === 'pass')).toBe(true);
    });

    it('should penalize PR without tests when required', async () => {
      const mockPRContext = createMockPRContext({
        hasTests: false,
        files: [
          { filename: 'src/feature.js', status: 'added', additions: 30, deletions: 0, changes: 30 },
        ],
      });

      const mockAIResponse = {
        overallScore: 6,
        maxScore: 10,
        factors: [],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(mockPRContext);

      const testFactor = result.factors.find(f => f.name === 'Test Coverage');
      expect(testFactor?.status).toBe('fail');
      expect(testFactor?.description).toContain('Missing tests');
    });

    it('should allow PR without tests when not required', async () => {
      const permissiveConfig: QualityConfig = {
        ...mockConfig,
        require_tests: false,
      };

      const permissiveScorer = new QualityScorer(mockOpenAI, permissiveConfig);

      const mockPRContext = createMockPRContext({
        hasTests: false,
        files: [
          { filename: 'docs/README.md', status: 'modified', additions: 5, deletions: 2, changes: 7 },
        ],
      });

      const mockAIResponse = {
        overallScore: 7,
        maxScore: 10,
        factors: [],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await permissiveScorer.scoreQuality(mockPRContext);

      const testFactor = result.factors.find(f => f.name === 'Test Coverage');
      expect(testFactor?.status).toBe('pass');
    });

    it('should penalize PRs that are too large', async () => {
      const largePRContext = createMockPRContext({
        files: Array.from({ length: 60 }, (_, i) => ({
          filename: `src/file${i}.js`,
          status: 'modified' as const,
          additions: 20,
          deletions: 5,
          changes: 25,
        })),
      });

      const mockAIResponse = {
        overallScore: 4,
        maxScore: 10,
        factors: [],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(largePRContext);

      const scopeFactor = result.factors.find(f => f.name === 'Change Scope');
      expect(scopeFactor?.status).toBe('fail');
      expect(scopeFactor?.description).toContain('Too many files');
    });

    it('should handle documentation-only changes appropriately', async () => {
      const docOnlyContext = createMockPRContext({
        hasTests: false,
        files: [
          { filename: 'README.md', status: 'modified', additions: 10, deletions: 3, changes: 13 },
          { filename: 'docs/guide.md', status: 'added', additions: 50, deletions: 0, changes: 50 },
        ],
      });

      const mockAIResponse = {
        overallScore: 8,
        maxScore: 10,
        factors: [],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(docOnlyContext);

      const testFactor = result.factors.find(f => f.name === 'Test Coverage');
      expect(testFactor?.status).toBe('pass');
      expect(testFactor?.description).toContain('Documentation');

      const docFactor = result.factors.find(f => f.name === 'Documentation');
      expect(docFactor?.status).toBe('pass');
    });

    it('should be lenient with first-time contributors', async () => {
      const firstTimeContext = createMockPRContext({
        isFirstTimeContributor: true,
        hasTests: false,
      });

      const mockAIResponse = {
        overallScore: 6,
        maxScore: 10,
        factors: [],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(firstTimeContext);

      const contributorFactor = result.factors.find(f => f.name === 'Contributor Experience');
      expect(contributorFactor?.status).toBe('pass');
      expect(contributorFactor?.description).toContain('First-time contributor');

      expect(result.summary.some(s => s.includes('first contribution'))).toBe(true);
    });

    it('should detect code structure issues', async () => {
      const problematicContext = createMockPRContext({
        diff: `diff --git a/src/problematic.js b/src/problematic.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/problematic.js
@@ -0,0 +1,8 @@
+console.log('debug info');
+console.log('more debug');
+console.log('even more debug');
+console.log('way too much debugging');
+// TODO: fix this later
+// FIXME: this is broken
+// HACK: temporary solution
+const veryveryverylongvariablenamethatshouldnotexist = 'too long';`,
      });

      const mockAIResponse = {
        overallScore: 5,
        maxScore: 10,
        factors: [],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(problematicContext);

      const structureFactor = result.factors.find(f => f.name === 'Code Structure');
      expect(structureFactor?.status).not.toBe('pass');
      expect(structureFactor?.description).toMatch(/debugging|TODO|long lines/);
    });

    it('should handle API failure with heuristic fallback', async () => {
      const mockPRContext = createMockPRContext();

      mockOpenAI.scoreQuality.mockRejectedValue(new Error('OpenAI API error'));

      const result = await qualityScorer.scoreQuality(mockPRContext);

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('factors');
      expect(result.factors.length).toBeGreaterThan(0);
      
      // Should have heuristic factors even without AI
      expect(result.factors.some(f => f.name === 'Test Coverage')).toBe(true);
      expect(result.factors.some(f => f.name === 'Change Scope')).toBe(true);
    });

    it('should score complexity appropriately', async () => {
      const simpleContext = createMockPRContext({
        files: [
          { filename: 'README.md', status: 'modified', additions: 2, deletions: 1, changes: 3 },
        ],
      });

      const mockAIResponse = {
        overallScore: 8,
        maxScore: 10,
        factors: [],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(simpleContext);

      const complexityFactor = result.factors.find(f => f.name === 'Complexity');
      expect(complexityFactor?.description).toContain('Simple change');

      // Test high complexity
      const complexDiff = `diff --git a/src/complex.js b/src/complex.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/complex.js
@@ -0,0 +1,800 @@
${Array.from({ length: 800 }, (_, i) => `+line ${i + 1}`).join('\n')}`;

      const complexContext = createMockPRContext({
        diff: complexDiff,
        files: [
          { filename: 'src/complex.js', status: 'added', additions: 800, deletions: 0, changes: 800 },
        ],
      });

      const result2 = await qualityScorer.scoreQuality(complexContext);
      const complexityFactor2 = result2.factors.find(f => f.name === 'Complexity');
      expect(complexityFactor2?.status).toBe('warning');
    });

    it('should generate appropriate summary', async () => {
      const excellentContext = createMockPRContext({
        hasTests: true,
        body: 'Comprehensive description of the changes made',
        files: [
          { filename: 'src/feature.js', status: 'added', additions: 25, deletions: 0, changes: 25 },
          { filename: 'test/feature.test.js', status: 'added', additions: 20, deletions: 0, changes: 20 },
          { filename: 'README.md', status: 'modified', additions: 3, deletions: 0, changes: 3 },
        ],
      });

      const mockAIResponse = {
        overallScore: 9,
        maxScore: 10,
        factors: [
          { name: 'Test', score: 2, maxScore: 2, status: 'pass' as const, description: 'Good tests' },
        ],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(excellentContext);

      expect(result.summary.some(s => s.includes('Excellent') || s.includes('Good'))).toBe(true);
      expect(result.overallScore).toBeGreaterThanOrEqual(8);
    });

    it('should merge duplicate factors correctly', async () => {
      const mockPRContext = createMockPRContext();

      const mockAIResponse = {
        overallScore: 7,
        maxScore: 10,
        factors: [
          {
            name: 'Test Coverage',
            score: 1,
            maxScore: 2,
            status: 'warning' as const,
            description: 'AI says tests are limited',
          },
        ],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(mockAIResponse);

      const result = await qualityScorer.scoreQuality(mockPRContext);

      // Should have only one Test Coverage factor (merged)
      const testFactors = result.factors.filter(f => f.name === 'Test Coverage');
      expect(testFactors).toHaveLength(1);
      
      // Should take the better score (heuristic gives pass for hasTests=true)
      expect(testFactors[0]?.score).toBe(2);
      expect(testFactors[0]?.status).toBe('pass');
    });

    it('should limit overall score to valid range', async () => {
      const mockPRContext = createMockPRContext();

      // Test extremely high score gets capped
      const highMockResponse = {
        overallScore: 15,
        maxScore: 10,
        factors: [
          { name: 'Perfect', score: 10, maxScore: 5, status: 'pass' as const, description: 'Too good' },
        ],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(highMockResponse);

      const result = await qualityScorer.scoreQuality(mockPRContext);
      expect(result.overallScore).toBeLessThanOrEqual(10);

      // Test extremely low score gets floored
      const lowMockResponse = {
        overallScore: -5,
        maxScore: 10,
        factors: [
          { name: 'Terrible', score: -2, maxScore: 5, status: 'fail' as const, description: 'Too bad' },
        ],
      };

      mockOpenAI.scoreQuality.mockResolvedValue(lowMockResponse);

      const result2 = await qualityScorer.scoreQuality(mockPRContext);
      expect(result2.overallScore).toBeGreaterThanOrEqual(0);
    });
  });
});