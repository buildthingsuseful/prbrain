import { TokenUsage } from '../types';

/**
 * Simple token estimation for OpenAI models
 * Uses rough approximation: 1 token ≈ 4 characters for English text
 */
export class Tokenizer {
  private readonly CHARS_PER_TOKEN = 4;
  private readonly CODE_CHARS_PER_TOKEN = 3; // Code is generally denser

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string, isCode = false): number {
    if (!text) return 0;
    
    const charsPerToken = isCode ? this.CODE_CHARS_PER_TOKEN : this.CHARS_PER_TOKEN;
    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Truncate text to fit within token limit
   */
  truncateToTokenLimit(text: string, maxTokens: number, isCode = false): string {
    const estimatedTokens = this.estimateTokens(text, isCode);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const charsPerToken = isCode ? this.CODE_CHARS_PER_TOKEN : this.CHARS_PER_TOKEN;
    const maxChars = maxTokens * charsPerToken;
    
    if (maxChars <= 100) {
      return text.slice(0, maxChars);
    }

    // Try to truncate at word boundaries
    const truncated = text.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const cutoff = Math.max(lastSpace, lastNewline);
    if (cutoff > maxChars * 0.8) {
      return truncated.slice(0, cutoff) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Smart diff truncation that preserves important context
   */
  truncateDiff(diff: string, maxTokens: number): string {
    const lines = diff.split('\n');
    const estimatedTokens = this.estimateTokens(diff, true);
    
    if (estimatedTokens <= maxTokens) {
      return diff;
    }

    // Prioritize changed lines (+ and -)
    const changedLines: string[] = [];
    const contextLines: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('+') || line.startsWith('-')) {
        changedLines.push(line);
      } else {
        contextLines.push(line);
      }
    }

    // Start with all changed lines
    let result = changedLines.join('\n');
    let currentTokens = this.estimateTokens(result, true);
    
    // Add context lines if we have room
    const remainingTokens = maxTokens - currentTokens;
    if (remainingTokens > 100) {
      const contextToAdd = this.truncateToTokenLimit(
        contextLines.join('\n'), 
        remainingTokens, 
        true
      );
      
      if (contextToAdd) {
        result = result + '\n' + contextToAdd;
      }
    }

    return result;
  }

  /**
   * Create token usage tracking object
   */
  createUsageTracker(): TokenUsageTracker {
    return new TokenUsageTracker();
  }
}

export class TokenUsageTracker {
  private inputTokens = 0;
  private outputTokens = 0;

  addInput(tokens: number): void {
    this.inputTokens += tokens;
  }

  addOutput(tokens: number): void {
    this.outputTokens += tokens;
  }

  addUsage(usage: Partial<TokenUsage>): void {
    if (usage.input) this.inputTokens += usage.input;
    if (usage.output) this.outputTokens += usage.output;
  }

  getUsage(): TokenUsage {
    return {
      input: this.inputTokens,
      output: this.outputTokens,
      total: this.inputTokens + this.outputTokens,
    };
  }

  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
  }
}

export const tokenizer = new Tokenizer();