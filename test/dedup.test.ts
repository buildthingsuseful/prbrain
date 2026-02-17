import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Deduplicator } from '../src/core/dedup';
import { OpenAIAdapter } from '../src/adapters/openai';
import { GitHubAdapter } from '../src/adapters/github';
import { StorageAdapter } from '../src/adapters/storage';
import { PRContext, EmbeddingData, SimilarItem } from '../src/types';

// Mock all adapters
vi.mock('../src/adapters/openai');
vi.mock('../src/adapters/github');
vi.mock('../src/adapters/storage');

describe('Deduplicator', () => {
  let deduplicator: Deduplicator;
  let mockOpenAI: vi.Mocked<OpenAIAdapter>;
  let mockGitHub: vi.Mocked<GitHubAdapter>;
  let mockStorage: vi.Mocked<StorageAdapter>;

  beforeEach(() => {
    mockOpenAI = {
      generateEmbedding: vi.fn(),
      generateCompletion: vi.fn(),
      extractIntent: vi.fn(),
      detectAIGeneration: vi.fn(),
      checkVisionAlignment: vi.fn(),
      scoreQuality: vi.fn(),
    } as any;

    mockGitHub = {
      getPRContext: vi.fn(),
      findSimilarPRsAndIssues: vi.fn(),
      postOrUpdateComment: vi.fn(),
      getVisionDocument: vi.fn(),
      addLabels: vi.fn(),
    } as any;

    mockStorage = {
      addEmbedding: vi.fn(),
      findSimilarEmbeddings: vi.fn(),
      loadEmbeddings: vi.fn(),
      saveEmbeddings: vi.fn(),
      getStats: vi.fn(),
      cleanup: vi.fn(),
    } as any;

    // Mock static methods
    (StorageAdapter as any).createEmbeddingId = vi.fn((type: string, number: number) => `${type}:${number}`);
    (StorageAdapter as any).createEmbeddingText = vi.fn((title: string, body: string) => `${title}\n\n${body}`);

    deduplicator = new Deduplicator(mockOpenAI, mockGitHub, mockStorage, 0.8);
  });

  const mockPRContext: PRContext = {
    number: 123,
    title: 'Add rate limiting to API endpoints',
    body: 'This PR adds rate limiting middleware to prevent API abuse and improve security',
    author: 'developer',
    diff: 'mock diff content',
    files: [
      {
        filename: 'src/middleware/rate-limit.js',
        status: 'added',
        additions: 25,
        deletions: 0,
        changes: 25,
      },
    ],
    isFirstTimeContributor: false,
    hasTests: true,
    baseBranch: 'main',
    headBranch: 'feature/rate-limiting',
  };

  describe('findDuplicates', () => {
    it('should find no duplicates for unique PR', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      mockOpenAI.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { input: 100, output: 0, total: 100 },
      });

      mockStorage.findSimilarEmbeddings.mockResolvedValue([]);
      mockGitHub.findSimilarPRsAndIssues.mockResolvedValue([]);

      const result = await deduplicator.findDuplicates(mockPRContext);

      expect(result.isDuplicate).toBe(false);
      expect(result.similarItems).toHaveLength(0);
      expect(result.duplicateThreshold).toBe(0.8);

      expect(mockStorage.addEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pr:123',
          type: 'pr',
          number: 123,
          title: mockPRContext.title,
          body: mockPRContext.body,
          embedding: mockEmbedding,
        })
      );
    });

    it('should detect duplicate with high similarity', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const similarPR: EmbeddingData & { similarity: number } = {
        id: 'pr:120',
        type: 'pr',
        number: 120,
        title: 'Add rate limiting middleware',
        body: 'Rate limiting implementation',
        embedding: [0.11, 0.21, 0.31, 0.41, 0.51],
        createdAt: '2023-01-01T00:00:00Z',
        similarity: 0.95,
      };

      mockOpenAI.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { input: 100, output: 0, total: 100 },
      });

      mockStorage.findSimilarEmbeddings.mockResolvedValue([similarPR]);
      mockGitHub.findSimilarPRsAndIssues.mockResolvedValue([]);

      const result = await deduplicator.findDuplicates(mockPRContext);

      expect(result.isDuplicate).toBe(true);
      expect(result.similarItems).toHaveLength(1);
      expect(result.similarItems[0]?.similarity).toBe(0.95);
      expect(result.similarItems[0]?.type).toBe('pr');
      expect(result.similarItems[0]?.number).toBe(120);
    });

    it('should combine vector and text similarity results', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      // Vector similarity result
      const vectorSimilar: EmbeddingData & { similarity: number } = {
        id: 'pr:120',
        type: 'pr',
        number: 120,
        title: 'API rate limiting',
        body: 'Rate limiting for APIs',
        embedding: [0.11, 0.21, 0.31, 0.41, 0.51],
        createdAt: '2023-01-01T00:00:00Z',
        similarity: 0.85,
      };

      // Text similarity result (same PR)
      const textSimilar: SimilarItem = {
        type: 'pr',
        number: 120,
        title: 'API rate limiting',
        similarity: 0.75,
        status: 'merged',
        url: 'https://github.com/repo/pull/120',
      };

      mockOpenAI.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { input: 100, output: 0, total: 100 },
      });

      mockStorage.findSimilarEmbeddings.mockResolvedValue([vectorSimilar]);
      mockGitHub.findSimilarPRsAndIssues.mockResolvedValue([textSimilar]);

      const result = await deduplicator.findDuplicates(mockPRContext);

      expect(result.similarItems).toHaveLength(1);
      // Should use the higher similarity score (vector: 0.85)
      expect(result.similarItems[0]?.similarity).toBeGreaterThan(0.8);
      // Should use GitHub API data for status and URL
      expect(result.similarItems[0]?.status).toBe('merged');
      expect(result.similarItems[0]?.url).toBe('https://github.com/repo/pull/120');
    });

    it('should filter results by similarity threshold', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      const similarItems: (EmbeddingData & { similarity: number })[] = [
        {
          id: 'pr:120',
          type: 'pr',
          number: 120,
          title: 'Rate limiting',
          body: 'Rate limit implementation',
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          createdAt: '2023-01-01T00:00:00Z',
          similarity: 0.85, // Above threshold
        },
        {
          id: 'pr:121',
          type: 'pr',
          number: 121,
          title: 'API changes',
          body: 'Some API changes',
          embedding: [0.3, 0.4, 0.5, 0.6, 0.7],
          createdAt: '2023-01-01T00:00:00Z',
          similarity: 0.65, // Below threshold
        },
      ];

      mockOpenAI.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { input: 100, output: 0, total: 100 },
      });

      mockStorage.findSimilarEmbeddings.mockResolvedValue(similarItems);
      mockGitHub.findSimilarPRsAndIssues.mockResolvedValue([]);

      const result = await deduplicator.findDuplicates(mockPRContext);

      // Should only include the item above threshold
      expect(result.similarItems).toHaveLength(1);
      expect(result.similarItems[0]?.number).toBe(120);
      expect(result.similarItems[0]?.similarity).toBe(0.85);
    });

    it('should exclude current PR from results', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      // Include the current PR in similar results (should be filtered out)
      const similarItems: (EmbeddingData & { similarity: number })[] = [
        {
          id: 'pr:123', // Same as current PR
          type: 'pr',
          number: 123,
          title: mockPRContext.title,
          body: mockPRContext.body!,
          embedding: mockEmbedding,
          createdAt: '2023-01-01T00:00:00Z',
          similarity: 1.0,
        },
        {
          id: 'pr:120',
          type: 'pr',
          number: 120,
          title: 'Different PR',
          body: 'Different content',
          embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
          createdAt: '2023-01-01T00:00:00Z',
          similarity: 0.85,
        },
      ];

      mockOpenAI.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { input: 100, output: 0, total: 100 },
      });

      mockStorage.findSimilarEmbeddings.mockResolvedValue(similarItems);
      mockGitHub.findSimilarPRsAndIssues.mockResolvedValue([]);

      const result = await deduplicator.findDuplicates(mockPRContext);

      // Should only include the different PR, not the current one
      expect(result.similarItems).toHaveLength(1);
      expect(result.similarItems[0]?.number).toBe(120);
    });

    it('should handle API failures gracefully', async () => {
      mockOpenAI.generateEmbedding.mockRejectedValue(new Error('OpenAI API error'));
      
      // Fallback to GitHub search
      const textSimilar: SimilarItem = {
        type: 'pr',
        number: 120,
        title: 'Similar PR',
        similarity: 0.85,
        status: 'open',
        url: 'https://github.com/repo/pull/120',
      };

      mockGitHub.findSimilarPRsAndIssues.mockResolvedValue([textSimilar]);

      const result = await deduplicator.findDuplicates(mockPRContext);

      expect(result.similarItems).toHaveLength(1);
      expect(result.similarItems[0]?.number).toBe(120);
    });

    it('should handle complete failure gracefully', async () => {
      mockOpenAI.generateEmbedding.mockRejectedValue(new Error('OpenAI API error'));
      mockGitHub.findSimilarPRsAndIssues.mockRejectedValue(new Error('GitHub API error'));

      const result = await deduplicator.findDuplicates(mockPRContext);

      expect(result.similarItems).toHaveLength(0);
      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateThreshold).toBe(0.8);
    });

    it('should limit results to reasonable number', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      // Create many similar items
      const manyItems = Array.from({ length: 15 }, (_, i) => ({
        id: `pr:${i + 200}`,
        type: 'pr' as const,
        number: i + 200,
        title: `Similar PR ${i}`,
        body: `Similar content ${i}`,
        embedding: [0.1 + i * 0.01, 0.2 + i * 0.01, 0.3, 0.4, 0.5],
        createdAt: '2023-01-01T00:00:00Z',
        similarity: 0.9 - i * 0.01, // Decreasing similarity
      }));

      mockOpenAI.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { input: 100, output: 0, total: 100 },
      });

      mockStorage.findSimilarEmbeddings.mockResolvedValue(manyItems);
      mockGitHub.findSimilarPRsAndIssues.mockResolvedValue([]);

      const result = await deduplicator.findDuplicates(mockPRContext);

      // Should limit to top 10 results
      expect(result.similarItems.length).toBeLessThanOrEqual(10);
      
      // Should be sorted by similarity (highest first)
      for (let i = 0; i < result.similarItems.length - 1; i++) {
        expect(result.similarItems[i]!.similarity).toBeGreaterThanOrEqual(
          result.similarItems[i + 1]!.similarity
        );
      }
    });
  });

  describe('calculateTextSimilarity', () => {
    it('should calculate similarity between similar texts', () => {
      const text1 = 'Add rate limiting to API endpoints';
      const text2 = 'Add rate limiting middleware to API';
      
      const similarity = Deduplicator.calculateTextSimilarity(text1, text2);
      
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1.0);
    });

    it('should return high similarity for identical texts', () => {
      const text1 = 'Identical text content';
      const text2 = 'Identical text content';
      
      const similarity = Deduplicator.calculateTextSimilarity(text1, text2);
      
      expect(similarity).toBe(1.0);
    });

    it('should return low similarity for different texts', () => {
      const text1 = 'Add rate limiting to API';
      const text2 = 'Fix database connection pool';
      
      const similarity = Deduplicator.calculateTextSimilarity(text1, text2);
      
      expect(similarity).toBeLessThan(0.3);
    });

    it('should handle empty strings', () => {
      const similarity1 = Deduplicator.calculateTextSimilarity('', 'some text');
      const similarity2 = Deduplicator.calculateTextSimilarity('some text', '');
      const similarity3 = Deduplicator.calculateTextSimilarity('', '');
      
      expect(similarity1).toBe(0);
      expect(similarity2).toBe(0);
      expect(similarity3).toBe(0);
    });

    it('should be case insensitive', () => {
      const text1 = 'Add Rate Limiting';
      const text2 = 'add rate limiting';
      
      const similarity = Deduplicator.calculateTextSimilarity(text1, text2);
      
      expect(similarity).toBe(1.0);
    });

    it('should handle punctuation differences', () => {
      const text1 = 'Add rate-limiting to API endpoints!';
      const text2 = 'Add rate limiting to API endpoints';
      
      const similarity = Deduplicator.calculateTextSimilarity(text1, text2);
      
      expect(similarity).toBeGreaterThan(0.8);
    });
  });
});