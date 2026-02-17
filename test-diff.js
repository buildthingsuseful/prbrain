const fs = require('fs');
const path = require('path');

// Import directly from source
const filePath = path.join(__dirname, 'src/utils/diff-parser.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Extract the class from TypeScript (quick & dirty)
eval(content.replace('import { DiffChunk, DiffLine } from \'../types\';', '').replace('export class', 'class').replace('export const diffParser = new DiffParser();', ''));

const parser = new DiffParser();

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

const simplified = parser.simplifyDiffForAnalysis(sampleDiff);
console.log('SIMPLIFIED OUTPUT:');
console.log(simplified);
console.log('---END---');
console.log('Contains target string:', simplified.includes('-  message: \'Hello World\''));

// Let's also check what's in the removed lines
const { added, removed } = parser.extractChangedLines(sampleDiff);
console.log('REMOVED LINES:');
removed.forEach((line, i) => console.log(i + ':', JSON.stringify(line)));