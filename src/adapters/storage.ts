import * as fs from 'fs/promises';
import * as path from 'path';
import { EmbeddingData, StoredEmbeddings } from '../types';
import { logger } from '../utils/logger';
import { EMBEDDING_VERSION } from '../config/defaults';

export class StorageAdapter {
  private embeddingsPath: string;

  constructor(repoPath: string = '.') {
    this.embeddingsPath = path.join(repoPath, '.prbrain', 'embeddings.json');
  }

  async loadEmbeddings(): Promise<StoredEmbeddings> {
    try {
      const data = await fs.readFile(this.embeddingsPath, 'utf8');
      const embeddings: StoredEmbeddings = JSON.parse(data);
      
      // Validate version compatibility
      if (embeddings.version !== EMBEDDING_VERSION) {
        logger.warning(`Embedding version mismatch. Expected ${EMBEDDING_VERSION}, got ${embeddings.version}. Creating fresh embeddings.`);
        return this.createEmptyEmbeddings();
      }
      
      logger.debug(`Loaded ${embeddings.embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No existing embeddings found, creating new store');
        return this.createEmptyEmbeddings();
      }
      
      logger.error('Failed to load embeddings', error);
      return this.createEmptyEmbeddings();
    }
  }

  async saveEmbeddings(embeddings: StoredEmbeddings): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.embeddingsPath), { recursive: true });
      
      // Update timestamp
      embeddings.lastUpdated = new Date().toISOString();
      
      // Write with pretty formatting for readability
      const data = JSON.stringify(embeddings, null, 2);
      await fs.writeFile(this.embeddingsPath, data, 'utf8');
      
      logger.info(`Saved ${embeddings.embeddings.length} embeddings to ${this.embeddingsPath}`);
    } catch (error) {
      logger.error('Failed to save embeddings', error);
      throw error;
    }
  }

  async addEmbedding(embedding: EmbeddingData): Promise<void> {
    const embeddings = await this.loadEmbeddings();
    
    // Remove existing embedding with same ID if it exists
    embeddings.embeddings = embeddings.embeddings.filter(e => e.id !== embedding.id);
    
    // Add new embedding
    embeddings.embeddings.push(embedding);
    
    // Sort by creation date (newest first)
    embeddings.embeddings.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Limit total embeddings to prevent unbounded growth
    const MAX_EMBEDDINGS = 1000;
    if (embeddings.embeddings.length > MAX_EMBEDDINGS) {
      embeddings.embeddings = embeddings.embeddings.slice(0, MAX_EMBEDDINGS);
      logger.info(`Trimmed embeddings to ${MAX_EMBEDDINGS} entries`);
    }
    
    await this.saveEmbeddings(embeddings);
  }

  async findSimilarEmbeddings(
    queryEmbedding: number[], 
    threshold: number = 0.8, 
    limit: number = 10
  ): Promise<Array<EmbeddingData & { similarity: number }>> {
    const embeddings = await this.loadEmbeddings();
    const similarities: Array<EmbeddingData & { similarity: number }> = [];
    
    for (const embedding of embeddings.embeddings) {
      const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding.embedding);
      
      if (similarity >= threshold) {
        similarities.push({
          ...embedding,
          similarity,
        });
      }
    }
    
    // Sort by similarity descending and limit results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length for cosine similarity');
    }
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      
      dotProduct += aVal * bVal;
      magnitudeA += aVal * aVal;
      magnitudeB += bVal * bVal;
    }
    
    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private createEmptyEmbeddings(): StoredEmbeddings {
    return {
      version: EMBEDDING_VERSION,
      embeddings: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  async getStats(): Promise<{
    totalEmbeddings: number;
    oldestEmbedding?: string;
    newestEmbedding?: string;
    byType: Record<string, number>;
  }> {
    const embeddings = await this.loadEmbeddings();
    
    const byType: Record<string, number> = {};
    let oldest: string | undefined;
    let newest: string | undefined;
    
    for (const embedding of embeddings.embeddings) {
      // Count by type
      byType[embedding.type] = (byType[embedding.type] || 0) + 1;
      
      // Track oldest and newest
      if (!oldest || embedding.createdAt < oldest) {
        oldest = embedding.createdAt;
      }
      if (!newest || embedding.createdAt > newest) {
        newest = embedding.createdAt;
      }
    }
    
    const stats: {
      totalEmbeddings: number;
      oldestEmbedding?: string;
      newestEmbedding?: string;
      byType: Record<string, number>;
    } = {
      totalEmbeddings: embeddings.embeddings.length,
      byType,
    };

    if (oldest) {
      stats.oldestEmbedding = oldest;
    }

    if (newest) {
      stats.newestEmbedding = newest;
    }

    return stats;
  }

  async cleanup(olderThanDays: number = 90): Promise<number> {
    const embeddings = await this.loadEmbeddings();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const originalCount = embeddings.embeddings.length;
    embeddings.embeddings = embeddings.embeddings.filter(
      e => new Date(e.createdAt) > cutoffDate
    );
    
    const removedCount = originalCount - embeddings.embeddings.length;
    
    if (removedCount > 0) {
      await this.saveEmbeddings(embeddings);
      logger.info(`Cleaned up ${removedCount} old embeddings`);
    }
    
    return removedCount;
  }

  /**
   * Create embedding ID from PR/issue data
   */
  static createEmbeddingId(type: 'pr' | 'issue', number: number): string {
    return `${type}:${number}`;
  }

  /**
   * Create text for embedding from PR/issue data
   */
  static createEmbeddingText(title: string, body: string | null): string {
    const cleanBody = (body || '')
      .replace(/```[\s\S]*?```/g, '[code]') // Replace code blocks
      .replace(/`[^`]+`/g, '[code]') // Replace inline code
      .replace(/https?:\/\/[^\s]+/g, '[url]') // Replace URLs
      .replace(/#\d+/g, '[issue]') // Replace issue references
      .replace(/@\w+/g, '[user]') // Replace user mentions
      .trim();
    
    return `${title}\n\n${cleanBody}`.substring(0, 8000); // Limit length for embedding
  }
}