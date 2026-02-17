import { DeduplicationResult, PRContext, EmbeddingData, SimilarItem } from '../types';
import { OpenAIAdapter } from '../adapters/openai';
import { GitHubAdapter } from '../adapters/github';
import { StorageAdapter } from '../adapters/storage';
import { logger } from '../utils/logger';

export class Deduplicator {
  constructor(
    private openai: OpenAIAdapter,
    private github: GitHubAdapter,
    private storage: StorageAdapter,
    private similarityThreshold: number = 0.8
  ) {}

  async findDuplicates(context: PRContext): Promise<DeduplicationResult> {
    logger.info(`Checking for duplicates of PR #${context.number}`);

    try {
      // Create embedding for current PR
      const currentEmbedding = await this.createPREmbedding(context);
      
      // Store the current PR embedding for future comparisons
      await this.storage.addEmbedding(currentEmbedding);

      // Find similar items using vector similarity
      const vectorSimilar = await this.storage.findSimilarEmbeddings(
        currentEmbedding.embedding,
        this.similarityThreshold * 0.7, // Slightly lower threshold for vector search
        20
      );

      // Find similar items using GitHub search (text-based)
      const textSimilar = await this.github.findSimilarPRsAndIssues(
        context.title,
        context.body
      );

      // Combine and deduplicate results
      const combinedSimilar = this.combineAndRankSimilarItems(
        vectorSimilar,
        textSimilar,
        context.number
      );

      // Filter by final similarity threshold
      const similarItems = combinedSimilar
        .filter(item => item.similarity >= this.similarityThreshold)
        .slice(0, 10); // Limit to top 10

      // Determine if this is a duplicate
      const isDuplicate = similarItems.length > 0 && similarItems[0]!.similarity >= 0.9;

      const result: DeduplicationResult = {
        similarItems,
        isDuplicate,
        duplicateThreshold: this.similarityThreshold,
      };

      logger.info(
        `Found ${similarItems.length} similar items, ` +
        `duplicate: ${isDuplicate ? 'YES' : 'NO'}`
      );

      return result;

    } catch (error) {
      logger.error('Deduplication failed', error);
      
      // Fallback to text-only search
      try {
        const textSimilar = await this.github.findSimilarPRsAndIssues(
          context.title,
          context.body
        );

        const similarItems = textSimilar
          .filter(item => item.similarity >= this.similarityThreshold)
          .slice(0, 5);

        return {
          similarItems,
          isDuplicate: similarItems.length > 0 && similarItems[0]!.similarity >= 0.9,
          duplicateThreshold: this.similarityThreshold,
        };
      } catch (fallbackError) {
        logger.error('Fallback deduplication also failed', fallbackError);
        
        return {
          similarItems: [],
          isDuplicate: false,
          duplicateThreshold: this.similarityThreshold,
        };
      }
    }
  }

  private async createPREmbedding(context: PRContext): Promise<EmbeddingData> {
    // Create text representation of the PR
    const prText = StorageAdapter.createEmbeddingText(
      context.title,
      context.body || ''
    );

    // Generate embedding
    const { embedding } = await this.openai.generateEmbedding(prText);

    return {
      id: StorageAdapter.createEmbeddingId('pr', context.number),
      type: 'pr',
      number: context.number,
      title: context.title,
      body: context.body || '',
      embedding,
      createdAt: new Date().toISOString(),
    };
  }

  private combineAndRankSimilarItems(
    vectorSimilar: Array<EmbeddingData & { similarity: number }>,
    textSimilar: SimilarItem[],
    currentPRNumber: number
  ): SimilarItem[] {
    const combined = new Map<string, SimilarItem>();

    // Process vector similarity results
    for (const item of vectorSimilar) {
      // Skip the current PR itself
      if (item.number === currentPRNumber && item.type === 'pr') {
        continue;
      }

      const key = `${item.type}:${item.number}`;
      combined.set(key, {
        type: item.type,
        number: item.number,
        title: item.title,
        similarity: item.similarity,
        status: 'open', // We'll try to determine this below
        url: this.createItemUrl(item.type, item.number),
      });
    }

    // Process text similarity results and merge with vector results
    for (const item of textSimilar) {
      // Skip the current PR itself
      if (item.number === currentPRNumber && item.type === 'pr') {
        continue;
      }

      const key = `${item.type}:${item.number}`;
      const existing = combined.get(key);

      if (existing) {
        // Combine similarities using weighted average
        // Vector similarity is generally more reliable, so weight it higher
        const combinedSimilarity = existing.similarity * 0.7 + item.similarity * 0.3;
        existing.similarity = Math.max(existing.similarity, combinedSimilarity);
        existing.status = item.status; // Use GitHub API status which is more accurate
        existing.url = item.url; // Use GitHub API URL which is more accurate
      } else {
        combined.set(key, item);
      }
    }

    // Convert to array and sort by similarity
    return Array.from(combined.values())
      .sort((a, b) => b.similarity - a.similarity);
  }

  private createItemUrl(type: 'pr' | 'issue', number: number): string {
    // This is a fallback URL construction
    // In practice, the GitHub API provides the actual URL
    const baseUrl = 'https://github.com'; // Would need actual repo info
    return `${baseUrl}/pull/${number}`;
  }

  /**
   * Update stored embeddings with current repository items
   * This should be called periodically to keep the embedding store up to date
   */
  async updateEmbeddingStore(): Promise<{
    added: number;
    updated: number;
    errors: number;
  }> {
    logger.info('Updating embedding store with recent repository items');
    
    let added = 0;
    let updated = 0;
    let errors = 0;

    try {
      // This would need to be implemented to fetch recent PRs and issues
      // from the GitHub API and create embeddings for them
      // For now, we just return the current state
      
      const stats = await this.storage.getStats();
      logger.info(`Current embedding store: ${stats.totalEmbeddings} embeddings`);
      
      return { added, updated, errors };
    } catch (error) {
      logger.error('Failed to update embedding store', error);
      return { added, updated, errors: 1 };
    }
  }

  /**
   * Clean up old embeddings to prevent unbounded growth
   */
  async cleanupOldEmbeddings(olderThanDays: number = 90): Promise<number> {
    logger.info(`Cleaning up embeddings older than ${olderThanDays} days`);
    
    try {
      return await this.storage.cleanup(olderThanDays);
    } catch (error) {
      logger.error('Failed to cleanup old embeddings', error);
      return 0;
    }
  }

  /**
   * Calculate similarity between two text strings using simple methods
   * This is a fallback when embeddings are not available
   */
  static calculateTextSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalize = (text: string) => text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);

    if (!normalized1 || !normalized2) return 0;

    // Use Jaccard similarity on word level
    const words1 = new Set(normalized1.split(' '));
    const words2 = new Set(normalized2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    // Also calculate character-level similarity for short texts
    const charSimilarity = this.calculateCharacterSimilarity(normalized1, normalized2);
    
    // Combine both similarities with weights
    return jaccardSimilarity * 0.7 + charSimilarity * 0.3;
  }

  private static calculateCharacterSimilarity(text1: string, text2: string): number {
    // Simple character-based similarity using longest common subsequence approach
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length >= text2.length ? text1 : text2;
    
    if (shorter.length === 0) return 0;
    
    // Count matching characters in sequence
    let matches = 0;
    let j = 0;
    
    for (let i = 0; i < shorter.length && j < longer.length; i++) {
      const char = shorter[i];
      if (char === undefined) continue;
      const found = longer.indexOf(char, j);
      if (found !== -1) {
        matches++;
        j = found + 1;
      }
    }
    
    return matches / longer.length;
  }

  /**
   * Get statistics about the deduplication process
   */
  async getDeduplicationStats(): Promise<{
    totalEmbeddings: number;
    averageSimilarityChecks: number;
    duplicatesFound: number;
    lastUpdate: string;
  }> {
    try {
      const storageStats = await this.storage.getStats();
      
      return {
        totalEmbeddings: storageStats.totalEmbeddings,
        averageSimilarityChecks: 10, // This would be calculated from actual usage
        duplicatesFound: 0, // This would be tracked over time
        lastUpdate: storageStats.newestEmbedding || 'Never',
      };
    } catch (error) {
      logger.error('Failed to get deduplication stats', error);
      return {
        totalEmbeddings: 0,
        averageSimilarityChecks: 0,
        duplicatesFound: 0,
        lastUpdate: 'Error',
      };
    }
  }
}