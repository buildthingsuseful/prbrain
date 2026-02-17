import { describe, it, expect } from 'vitest';
import { DiffParser } from '../src/utils/diff-parser';

describe('DiffParser', () => {
  let diffParser: DiffParser;

  beforeEach(() => {
    diffParser = new DiffParser();
  });

  const sampleDiff = `diff --git a/src/server.js b/src/server.js
index 1234567..abcdefg 100644
--- a/src/server.js
+++ b/src/server.js
@@ -1,10 +1,15 @@
 const express = require('express');
 const app = express();
+const rateLimit = require('express-rate-limit');
 
+// Add rate limiting
+const limiter = rateLimit({
+  windowMs: 15 * 60 * 1000, // 15 minutes
+  max: 100 // limit each IP to 100 requests per windowMs
+});
+
+app.use(limiter);
 app.use(express.json());
 
 app.get('/', (req, res) => {
-  res.json({ 
-    message: 'Hello World' 
-  });
+  res.json({ message: 'Hello World' });
 });
 
 app.listen(3000, () => {`;

  describe('parseDiff', () => {
    it('should parse basic diff correctly', () => {
      const chunks = diffParser.parseDiff(sampleDiff);

      expect(chunks).toHaveLength(1);
      
      const chunk = chunks[0]!;
      expect(chunk.oldStart).toBe(1);
      expect(chunk.oldLines).toBe(10);
      expect(chunk.newStart).toBe(1);
      expect(chunk.newLines).toBe(15);
      
      expect(chunk.lines.length).toBeGreaterThan(0);
      
      // Check for added lines
      const addedLines = chunk.lines.filter(l => l.type === 'added');
      expect(addedLines.length).toBeGreaterThan(0);
      expect(addedLines.some(l => l.content.includes('rateLimit'))).toBe(true);
      
      // Check for removed lines
      const removedLines = chunk.lines.filter(l => l.type === 'removed');
      expect(removedLines.length).toBeGreaterThan(0);
      expect(removedLines.some(l => l.content.includes('message: \'Hello World\''))).toBe(true);
    });

    it('should handle multiple chunks', () => {
      const multiChunkDiff = `diff --git a/file1.js b/file1.js
index 1234567..abcdefg 100644
--- a/file1.js
+++ b/file1.js
@@ -1,3 +1,4 @@
 line1
+added line
 line2
 line3
@@ -10,5 +11,6 @@
 line10
 line11
+another added line
 line12
 line13
 line14`;

      const chunks = diffParser.parseDiff(multiChunkDiff);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.oldStart).toBe(1);
      expect(chunks[0]!.newStart).toBe(1);
      expect(chunks[1]!.oldStart).toBe(10);
      expect(chunks[1]!.newStart).toBe(11);
    });

    it('should handle empty diff', () => {
      const chunks = diffParser.parseDiff('');
      expect(chunks).toHaveLength(0);
    });

    it('should skip file headers', () => {
      const diffWithHeaders = `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,3 +1,4 @@
 existing line
+new line
 another existing line`;

      const chunks = diffParser.parseDiff(diffWithHeaders);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.lines).toHaveLength(3);
      expect(chunks[0]!.lines[0]!.type).toBe('context');
      expect(chunks[0]!.lines[1]!.type).toBe('added');
      expect(chunks[0]!.lines[2]!.type).toBe('context');
    });
  });

  describe('extractChangedLines', () => {
    it('should extract added and removed lines', () => {
      const { added, removed } = diffParser.extractChangedLines(sampleDiff);

      expect(added.length).toBeGreaterThan(0);
      expect(removed.length).toBeGreaterThan(0);

      expect(added.some(line => line.includes('rateLimit'))).toBe(true);
      expect(added.some(line => line.includes('Add rate limiting'))).toBe(true);
      
      expect(removed.some(line => line.includes('message: \'Hello World\''))).toBe(true);
    });

    it('should handle diff with only additions', () => {
      const addOnlyDiff = `diff --git a/new.js b/new.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new.js
@@ -0,0 +1,3 @@
+const newFile = true;
+console.log('This is a new file');
+module.exports = newFile;`;

      const { added, removed } = diffParser.extractChangedLines(addOnlyDiff);

      expect(added).toHaveLength(3);
      expect(removed).toHaveLength(0);
      expect(added[0]).toContain('newFile');
    });

    it('should handle diff with only deletions', () => {
      const deleteOnlyDiff = `diff --git a/old.js b/old.js
deleted file mode 100644
index 1234567..0000000
--- a/old.js
+++ /dev/null
@@ -1,3 +0,0 @@
-const oldFile = true;
-console.log('This file will be deleted');
-module.exports = oldFile;`;

      const { added, removed } = diffParser.extractChangedLines(deleteOnlyDiff);

      expect(added).toHaveLength(0);
      expect(removed).toHaveLength(3);
      expect(removed[0]).toContain('oldFile');
    });
  });

  describe('getDiffStats', () => {
    it('should calculate correct stats', () => {
      const stats = diffParser.getDiffStats(sampleDiff);

      expect(stats.additions).toBeGreaterThan(0);
      expect(stats.deletions).toBeGreaterThan(0);
      expect(stats.changes).toBe(stats.additions + stats.deletions);
    });

    it('should handle empty diff', () => {
      const stats = diffParser.getDiffStats('');

      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(0);
      expect(stats.changes).toBe(0);
    });
  });

  describe('extractFunctionChanges', () => {
    it('should detect JavaScript function changes', () => {
      const jsFunctionDiff = `diff --git a/functions.js b/functions.js
index 1234567..abcdefg 100644
--- a/functions.js
+++ b/functions.js
@@ -1,10 +1,15 @@
+function newFunction() {
+  return 'new';
+}
+
 function existingFunction() {
-  return 'old';
+  return 'updated';
 }
 
+const arrowFunction = () => {
+  console.log('arrow function added');
+};
+
 async function asyncFunction() {
   return await somePromise();
 }`;

      const changes = diffParser.extractFunctionChanges(jsFunctionDiff);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(c => c.includes('newFunction'))).toBe(true);
      expect(changes.some(c => c.includes('arrowFunction'))).toBe(true);
    });

    it('should detect Python function changes', () => {
      const pythonDiff = `diff --git a/functions.py b/functions.py
index 1234567..abcdefg 100644
--- a/functions.py
+++ b/functions.py
@@ -1,5 +1,8 @@
+def new_function():
+    return "new"
+
 def existing_function():
-    return "old"
+    return "updated"
 
 async def async_function():
     return await some_promise()`;

      const changes = diffParser.extractFunctionChanges(pythonDiff, 'python');

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(c => c.includes('new_function'))).toBe(true);
    });

    it('should limit results to prevent overwhelming output', () => {
      const manyFunctionsDiff = Array.from({ length: 20 }, (_, i) => 
        `+function func${i}() { return ${i}; }`
      ).join('\n');

      const fullDiff = `diff --git a/many.js b/many.js
index 1234567..abcdefg 100644
--- a/many.js
+++ b/many.js
@@ -1,5 +1,25 @@
${manyFunctionsDiff}`;

      const changes = diffParser.extractFunctionChanges(fullDiff);

      expect(changes.length).toBeLessThanOrEqual(10);
    });

    it('should handle diffs without functions', () => {
      const noFunctionDiff = `diff --git a/data.json b/data.json
index 1234567..abcdefg 100644
--- a/data.json
+++ b/data.json
@@ -1,3 +1,4 @@
 {
   "name": "test",
+  "version": "1.0.0",
   "description": "test file"
 }`;

      const changes = diffParser.extractFunctionChanges(noFunctionDiff);

      expect(changes).toHaveLength(0);
    });
  });

  describe('simplifyDiffForAnalysis', () => {
    it('should remove file headers but keep meaningful content', () => {
      const simplified = diffParser.simplifyDiffForAnalysis(sampleDiff);

      expect(simplified).not.toContain('diff --git');
      expect(simplified).not.toContain('index ');
      expect(simplified).not.toContain('---');
      expect(simplified).not.toContain('+++');

      expect(simplified).toContain('@@');
      expect(simplified).toContain('+const rateLimit');
      expect(simplified).toContain('-    message: \'Hello World\'');
    });

    it('should keep non-empty context lines', () => {
      const diffWithContext = `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,5 +1,6 @@
 const express = require('express');
 
+const newImport = require('new-module');
 
 function test() {`;

      const simplified = diffParser.simplifyDiffForAnalysis(diffWithContext);

      expect(simplified).toContain('const express = require(\'express\');');
      expect(simplified).toContain('+const newImport');
      expect(simplified).not.toContain('diff --git');
    });

    it('should handle empty lines appropriately', () => {
      const diffWithEmptyLines = `diff --git a/test.js b/test.js
@@ -1,3 +1,4 @@
 line1
 
+added line
 line3`;

      const simplified = diffParser.simplifyDiffForAnalysis(diffWithEmptyLines);

      expect(simplified).toContain('line1');
      expect(simplified).toContain('+added line');
      expect(simplified).toContain('line3');
    });
  });
});