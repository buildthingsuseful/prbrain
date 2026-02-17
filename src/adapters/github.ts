import * as core from '@actions/core';
import * as github from '@actions/github';
import { PRContext, PRFile, SimilarItem } from '../types';
import { logger } from '../utils/logger';

export class GitHubAdapter {
  private octokit: ReturnType<typeof github.getOctokit>;
  private owner: string;
  private repo: string;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.owner = github.context.repo.owner;
    this.repo = github.context.repo.repo;
  }

  async getPRContext(): Promise<PRContext> {
    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber) {
      throw new Error('No pull request found in context');
    }

    logger.info(`Fetching PR context for #${prNumber}`);

    // Get PR details
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    // Get PR files
    const files = await this.getPRFiles(prNumber);

    // Get PR diff
    const diff = await this.getPRDiff(prNumber);

    // Check if author is first-time contributor
    const isFirstTimeContributor = await this.isFirstTimeContributor(pr.user?.login || '');

    // Check if PR has tests
    const hasTests = this.checkForTests(files);

    return {
      number: prNumber,
      title: pr.title,
      body: pr.body,
      author: pr.user?.login || 'unknown',
      diff,
      files,
      isFirstTimeContributor,
      hasTests,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
    };
  }

  private async getPRFiles(prNumber: number): Promise<PRFile[]> {
    const files: PRFile[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data: pageFiles } = await this.octokit.rest.pulls.listFiles({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        page,
        per_page: 100,
      });

      for (const file of pageFiles) {
        files.push({
          filename: file.filename,
          status: file.status as PRFile['status'],
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch || undefined,
        });
      }

      hasMore = pageFiles.length === 100;
      page++;
    }

    return files;
  }

  private async getPRDiff(prNumber: number): Promise<string> {
    try {
      const { data: diff } = await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        mediaType: {
          format: 'diff',
        },
      });

      return typeof diff === 'string' ? diff : '';
    } catch (error) {
      logger.error('Failed to get PR diff', error);
      return '';
    }
  }

  private async isFirstTimeContributor(username: string): Promise<boolean> {
    if (!username || username === 'unknown') return true;

    try {
      // Check recent commits in the repository
      const { data: commits } = await this.octokit.rest.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        author: username,
        per_page: 1,
      });

      return commits.length === 0;
    } catch {
      // If we can't determine, assume first-time contributor
      return true;
    }
  }

  private checkForTests(files: PRFile[]): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /test\/.*\.(js|ts|py|java|go|rs|php)$/,
      /tests\/.*\.(js|ts|py|java|go|rs|php)$/,
      /__tests__\/.*\.(js|ts)$/,
      /spec\/.*\.(rb|py)$/,
    ];

    return files.some(file => 
      testPatterns.some(pattern => pattern.test(file.filename))
    );
  }

  async findSimilarPRsAndIssues(title: string, body: string | null): Promise<SimilarItem[]> {
    const similar: SimilarItem[] = [];
    const searchQuery = this.createSearchQuery(title, body);

    try {
      // Search for similar PRs
      const { data: prResults } = await this.octokit.rest.search.issuesAndPullRequests({
        q: `${searchQuery} repo:${this.owner}/${this.repo} is:pr`,
        per_page: 10,
        sort: 'updated',
      });

      for (const item of prResults.items) {
        if (item.number !== github.context.payload.pull_request?.number) {
          similar.push({
            type: 'pr',
            number: item.number,
            title: item.title,
            similarity: this.calculateSimilarity(title, item.title),
            status: item.state === 'open' ? 'open' : 
                   item.pull_request?.merged_at ? 'merged' : 'closed',
            url: item.html_url,
          });
        }
      }

      // Search for similar issues
      const { data: issueResults } = await this.octokit.rest.search.issuesAndPullRequests({
        q: `${searchQuery} repo:${this.owner}/${this.repo} is:issue`,
        per_page: 10,
        sort: 'updated',
      });

      for (const item of issueResults.items) {
        similar.push({
          type: 'issue',
          number: item.number,
          title: item.title,
          similarity: this.calculateSimilarity(title, item.title),
          status: item.state as 'open' | 'closed',
          url: item.html_url,
        });
      }

      // Sort by similarity descending
      return similar.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      logger.error('Failed to search for similar items', error);
      return [];
    }
  }

  private createSearchQuery(title: string, body: string | null): string {
    // Extract key terms from title and body
    const text = `${title} ${body || ''}`;
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.isCommonWord(word))
      .slice(0, 5); // Limit to avoid overly complex queries

    return words.join(' ');
  }

  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'add', 'fix', 'update', 'remove', 'change', 'implement', 'create',
      'improve', 'refactor', 'feature', 'bug', 'issue', 'pull', 'request',
      'this', 'that', 'with', 'from', 'have', 'will', 'been', 'were',
    ]);
    return commonWords.has(word);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity based on word overlap
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  async postOrUpdateComment(comment: string): Promise<void> {
    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber) {
      throw new Error('No pull request found in context');
    }

    const marker = '<!-- PRBrain Analysis -->';
    const commentBody = `${marker}\n${comment}`;

    try {
      // Look for existing PRBrain comment
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
      });

      const existingComment = comments.find(c => c.body?.includes(marker));

      if (existingComment) {
        // Update existing comment
        await this.octokit.rest.issues.updateComment({
          owner: this.owner,
          repo: this.repo,
          comment_id: existingComment.id,
          body: commentBody,
        });
        logger.info(`Updated existing comment ${existingComment.id}`);
      } else {
        // Create new comment
        await this.octokit.rest.issues.createComment({
          owner: this.owner,
          repo: this.repo,
          issue_number: prNumber,
          body: commentBody,
        });
        logger.info('Posted new PR comment');
      }
    } catch (error) {
      logger.error('Failed to post/update comment', error);
      throw error;
    }
  }

  async getVisionDocument(path: string): Promise<string | null> {
    try {
      const { data: file } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });

      if ('content' in file && file.content) {
        return Buffer.from(file.content, 'base64').toString('utf8');
      }

      return null;
    } catch (error) {
      // File doesn't exist or not accessible
      logger.debug(`Vision document not found at ${path}`, error);
      return null;
    }
  }

  async addLabels(labels: string[]): Promise<void> {
    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber) {
      return;
    }

    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        labels,
      });
      logger.info(`Added labels: ${labels.join(', ')}`);
    } catch (error) {
      logger.error('Failed to add labels', error);
    }
  }
}