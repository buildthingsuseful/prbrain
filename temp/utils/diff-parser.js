"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffParser = exports.DiffParser = void 0;
class DiffParser {
    /**
     * Parse unified diff format into structured chunks
     */
    parseDiff(diff) {
        if (!diff)
            return [];
        const lines = diff.split('\n');
        const chunks = [];
        let currentChunk = null;
        for (const line of lines) {
            // Check for chunk header (@@)
            const chunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
            if (chunkMatch) {
                // Save previous chunk if exists
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                // Create new chunk
                const oldStart = parseInt(chunkMatch[1], 10);
                const oldLines = parseInt(chunkMatch[2] || '1', 10);
                const newStart = parseInt(chunkMatch[3], 10);
                const newLines = parseInt(chunkMatch[4] || '1', 10);
                currentChunk = {
                    oldStart,
                    oldLines,
                    newStart,
                    newLines,
                    lines: [],
                };
                continue;
            }
            // Skip file headers and other metadata
            if (line.startsWith('diff --git') ||
                line.startsWith('index ') ||
                line.startsWith('---') ||
                line.startsWith('+++')) {
                continue;
            }
            // Parse diff line
            if (currentChunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
                const type = line.startsWith('+') ? 'added' :
                    line.startsWith('-') ? 'removed' : 'context';
                const content = line.slice(1); // Remove the +/- prefix
                const lineNumber = type === 'added' ?
                    currentChunk.newStart + currentChunk.lines.filter(l => l.type !== 'removed').length :
                    currentChunk.oldStart + currentChunk.lines.filter(l => l.type !== 'added').length;
                currentChunk.lines.push({
                    type,
                    content,
                    lineNumber,
                });
            }
        }
        // Don't forget the last chunk
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        return chunks;
    }
    /**
     * Extract only the changed lines (additions and deletions)
     */
    extractChangedLines(diff) {
        const chunks = this.parseDiff(diff);
        const added = [];
        const removed = [];
        for (const chunk of chunks) {
            for (const line of chunk.lines) {
                if (line.type === 'added') {
                    added.push(line.content);
                }
                else if (line.type === 'removed') {
                    removed.push(line.content);
                }
            }
        }
        return { added, removed };
    }
    /**
     * Get diff statistics
     */
    getDiffStats(diff) {
        const chunks = this.parseDiff(diff);
        let additions = 0;
        let deletions = 0;
        for (const chunk of chunks) {
            for (const line of chunk.lines) {
                if (line.type === 'added') {
                    additions++;
                }
                else if (line.type === 'removed') {
                    deletions++;
                }
            }
        }
        return {
            additions,
            deletions,
            changes: additions + deletions,
        };
    }
    /**
     * Extract function/method changes from diff
     */
    extractFunctionChanges(diff, language) {
        const changes = [];
        const chunks = this.parseDiff(diff);
        for (const chunk of chunks) {
            let currentFunction = '';
            for (const line of chunk.lines) {
                if (line.type !== 'context') {
                    // Try to identify function/method definitions
                    const functionMatch = this.detectFunctionDefinition(line.content, language);
                    if (functionMatch) {
                        currentFunction = functionMatch;
                        changes.push(`${line.type === 'added' ? 'Added' : 'Modified'} function: ${functionMatch}`);
                    }
                    else if (currentFunction && line.content.trim()) {
                        // We're inside a function
                        if (line.type === 'added') {
                            changes.push(`Added to ${currentFunction}: ${line.content.trim()}`);
                        }
                        else if (line.type === 'removed') {
                            changes.push(`Removed from ${currentFunction}: ${line.content.trim()}`);
                        }
                    }
                }
            }
        }
        return changes.slice(0, 10); // Limit to prevent overwhelming output
    }
    detectFunctionDefinition(line, language) {
        const trimmedLine = line.trim();
        // Common patterns for function definitions
        const patterns = [
            // JavaScript/TypeScript
            /(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*[=:]?\s*(?:\([^)]*\)|async\s+\([^)]*\))\s*(?:=>|{)/,
            /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/, // method definitions
            // Python
            /def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/,
            // Java/C#/C++
            /(?:public|private|protected|static|\s)*\s*(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?{/,
            // Go
            /func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)(?:\s*[^{]+)?\s*{/,
            // Rust
            /(?:pub\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*->\s*[^{]+)?\s*{/,
        ];
        for (const pattern of patterns) {
            const match = trimmedLine.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    /**
     * Simplify diff for analysis by removing noise
     */
    simplifyDiffForAnalysis(diff) {
        const lines = diff.split('\n');
        const relevantLines = [];
        for (const line of lines) {
            // Skip file headers and metadata
            if (line.startsWith('diff --git') ||
                line.startsWith('index ') ||
                line.startsWith('---') ||
                line.startsWith('+++')) {
                continue;
            }
            // Keep chunk headers for context
            if (line.startsWith('@@')) {
                relevantLines.push(line);
                continue;
            }
            // Keep changed lines and minimal context
            if (line.startsWith('+') || line.startsWith('-')) {
                relevantLines.push(line);
            }
            else if (line.startsWith(' ') && line.trim()) {
                // Only keep non-empty context lines
                relevantLines.push(line);
            }
        }
        return relevantLines.join('\n');
    }
}
exports.DiffParser = DiffParser;
exports.diffParser = new DiffParser();
