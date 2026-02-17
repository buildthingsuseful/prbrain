import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIDetector } from '../src/core/ai-detector';
import { OpenAIAdapter } from '../src/adapters/openai';
import { PRContext } from '../src/types';

// Mock the OpenAI adapter
vi.mock('../src/adapters/openai');

describe('AIDetector', () => {
  let aiDetector: AIDetector;
  let mockOpenAI: vi.Mocked<OpenAIAdapter>;

  beforeEach(() => {
    mockOpenAI = {
      detectAIGeneration: vi.fn(),
      generateCompletion: vi.fn(),
      generateEmbedding: vi.fn(),
      extractIntent: vi.fn(),
      checkVisionAlignment: vi.fn(),
      scoreQuality: vi.fn(),
    } as any;

    aiDetector = new AIDetector(mockOpenAI);
  });

  const mockHumanPRContext: PRContext = {
    number: 123,
    title: 'Fix bug in user auth',
    body: 'Fixed that annoying login issue. Should work now.',
    author: 'developer',
    diff: `diff --git a/auth.js b/auth.js
index 1234567..abcdefg 100644
--- a/auth.js
+++ b/auth.js
@@ -10,7 +10,7 @@ function validateUser(token) {
   if (!token) {
-    return false;
+    return { error: 'Token required' };
   }
   
   return jwt.verify(token);
 }`,
    files: [
      {
        filename: 'auth.js',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
      },
    ],
    isFirstTimeContributor: false,
    hasTests: true,
    baseBranch: 'main',
    headBranch: 'bugfix/auth',
  };

  const mockAIPRContext: PRContext = {
    number: 124,
    title: 'Implement comprehensive data validation utility with robust error handling',
    body: 'This pull request implements a comprehensive data validation utility that provides extensive error handling capabilities and ensures data integrity throughout the application lifecycle.',
    author: 'developer',
    diff: `diff --git a/utils/dataValidator.ts b/utils/dataValidator.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/utils/dataValidator.ts
@@ -0,0 +1,45 @@
+/**
+ * Comprehensive data validation utility class that implements robust validation
+ * mechanisms with detailed error reporting and extensive type checking capabilities.
+ * This validator ensures data integrity across the entire application ecosystem.
+ */
+export class ComprehensiveDataValidator {
+  private readonly validationRulesConfiguration: ValidationConfiguration;
+  private readonly errorHandlingStrategy: ErrorHandlingStrategy;
+
+  /**
+   * Initialize the comprehensive data validator with configuration
+   * @param configurationParameters - The validation configuration parameters
+   */
+  constructor(configurationParameters: ValidationConfiguration) {
+    // Ensure that the configuration parameters are not null or undefined
+    if (!configurationParameters || typeof configurationParameters !== 'object') {
+      throw new ValidationError('Configuration parameters must be a valid object');
+    }
+    
+    // Initialize the validation rules configuration with the provided parameters
+    this.validationRulesConfiguration = this.initializeValidationConfiguration(configurationParameters);
+    
+    // Set up the error handling strategy for comprehensive error management
+    this.errorHandlingStrategy = this.setupErrorHandlingStrategy();
+  }
+
+  /**
+   * Validates the provided data input against the configured validation rules
+   * @param dataInput - The data input to be validated
+   * @returns ValidationResult - The comprehensive validation result
+   * @throws ValidationError - When validation fails or encounters an error
+   */
+  public async validateDataInput(dataInput: unknown): Promise<ValidationResult> {
+    try {
+      // First, ensure that the data input is not null or undefined
+      if (dataInput === null || dataInput === undefined) {
+        throw new ValidationError('Data input cannot be null or undefined');
+      }
+
+      // Initialize the validation result object
+      const validationResultObject: ValidationResult = {
+        isValid: false,
+        errorMessages: [],
+        validatedData: null
+      };`,
    files: [
      {
        filename: 'utils/dataValidator.ts',
        status: 'added',
        additions: 45,
        deletions: 0,
        changes: 45,
      },
    ],
    isFirstTimeContributor: false,
    hasTests: true,
    baseBranch: 'main',
    headBranch: 'feature/data-validation',
  };

  describe('detectAIGeneration', () => {
    it('should detect human-written code correctly', async () => {
      const mockLLMResponse = {
        isAIGenerated: false,
        confidence: 25,
        signals: [],
        reasoning: 'Code appears to be human-written with natural patterns',
      };

      mockOpenAI.detectAIGeneration.mockResolvedValue(mockLLMResponse);

      const result = await aiDetector.detectAIGeneration(mockHumanPRContext);

      expect(result.isAIGenerated).toBe(false);
      expect(result.confidence).toBeLessThan(70);
      expect(result.reasoning).toContain('human');
    });

    it('should detect AI-generated code with high confidence', async () => {
      const mockLLMResponse = {
        isAIGenerated: true,
        confidence: 88,
        signals: [
          {
            type: 'comment_style',
            indicator: 'Overly explanatory comments',
            score: 0.8,
            description: 'Very detailed JSDoc comments typical of AI',
          },
          {
            type: 'naming',
            indicator: 'Verbose variable names',
            score: 0.7,
            description: 'Variables like "validationRulesConfiguration"',
          },
        ],
        reasoning: 'Multiple AI patterns detected including verbose naming and excessive documentation',
      };

      mockOpenAI.detectAIGeneration.mockResolvedValue(mockLLMResponse);

      const result = await aiDetector.detectAIGeneration(mockAIPRContext);

      expect(result.isAIGenerated).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should handle LLM API failure with heuristic fallback', async () => {
      mockOpenAI.detectAIGeneration.mockRejectedValue(new Error('OpenAI API error'));

      const result = await aiDetector.detectAIGeneration(mockAIPRContext);

      // Should still provide analysis based on heuristics
      expect(result).toHaveProperty('isAIGenerated');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('signals');
      expect(result.reasoning).toContain('code patterns');
    });

    it('should identify verbose variable names as AI signal', async () => {
      const verboseCodeContext = {
        ...mockHumanPRContext,
        diff: `diff --git a/src/verbose.js b/src/verbose.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/verbose.js
@@ -0,0 +1,3 @@
+const comprehensiveDataValidationUtilityInstance = new DataValidator();
+const configurationParametersForValidation = getConfig();
+const errorHandlingStrategyImplementation = setupErrorHandling();`,
      };

      mockOpenAI.detectAIGeneration.mockResolvedValue({
        isAIGenerated: false,
        confidence: 30,
        signals: [],
        reasoning: 'Some patterns detected',
      });

      const result = await aiDetector.detectAIGeneration(verboseCodeContext);

      const namingSignals = result.signals.filter(s => s.type === 'naming');
      expect(namingSignals.length).toBeGreaterThan(0);
      expect(namingSignals.some(s => s.indicator.includes('verbose'))).toBe(true);
    });

    it('should detect AI-like comment patterns', async () => {
      const aiCommentContext = {
        ...mockHumanPRContext,
        diff: `diff --git a/src/aicomments.js b/src/aicomments.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/aicomments.js
@@ -0,0 +1,11 @@
+// Initialize the comprehensive data processing system to ensure that
+// all incoming data is properly validated and sanitized according to
+// the established security protocols and business logic requirements
+// This implementation guarantees data integrity throughout the process
+function processData(input) {
+  // First, we need to ensure that the input parameter is not null or undefined
+  if (!input) {
+    // Handle the error case by throwing a descriptive error message
+    throw new Error('Input parameter cannot be null or undefined');
+  }
+}`,
      };

      mockOpenAI.detectAIGeneration.mockResolvedValue({
        isAIGenerated: true,
        confidence: 75,
        signals: [],
        reasoning: 'AI patterns in comments',
      });

      const result = await aiDetector.detectAIGeneration(aiCommentContext);

      const commentSignals = result.signals.filter(s => s.type === 'comment_style');
      expect(commentSignals.length).toBeGreaterThan(0);
    });

    it('should detect excessive defensive programming', async () => {
      const defensiveCodeContext = {
        ...mockHumanPRContext,
        diff: `diff --git a/src/defensive.js b/src/defensive.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/defensive.js
@@ -0,0 +1,9 @@
+function process(data) {
+  if (data === null || data === undefined) throw new Error('Data is null');
+  if (!Array.isArray(data)) throw new Error('Data must be array');
+  if (typeof data !== 'object') throw new Error('Invalid type');
+  if (!data.hasOwnProperty('id')) throw new Error('Missing id');
+  if (typeof data.id !== 'string') throw new Error('Invalid id type');
+  
+  return data;
+}`,
      };

      mockOpenAI.detectAIGeneration.mockResolvedValue({
        isAIGenerated: false,
        confidence: 40,
        signals: [],
        reasoning: 'Some defensive patterns',
      });

      const result = await aiDetector.detectAIGeneration(defensiveCodeContext);

      const structuralSignals = result.signals.filter(s => s.type === 'structure');
      expect(structuralSignals.some(s => s.indicator.includes('defensive'))).toBe(true);
    });

    it('should combine LLM and heuristic signals properly', async () => {
      const mockLLMSignals = [
        {
          type: 'complexity',
          indicator: 'Over-complex implementation',
          score: 0.6,
          description: 'Implementation seems overly complex for the task',
        },
      ];

      mockOpenAI.detectAIGeneration.mockResolvedValue({
        isAIGenerated: true,
        confidence: 70,
        signals: mockLLMSignals,
        reasoning: 'LLM detected AI patterns',
      });

      const result = await aiDetector.detectAIGeneration(mockAIPRContext);

      // Should have both LLM signals and heuristic signals
      expect(result.signals.length).toBeGreaterThan(1);
      expect(result.signals.some(s => s.type === 'complexity')).toBe(true);
    });

    it('should handle edge case with no code changes', async () => {
      const noCodeContext = {
        ...mockHumanPRContext,
        diff: `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,3 @@
 # Project
 
-Old description
+New description`,
      };

      mockOpenAI.detectAIGeneration.mockResolvedValue({
        isAIGenerated: false,
        confidence: 20,
        signals: [],
        reasoning: 'No significant code patterns to analyze',
      });

      const result = await aiDetector.detectAIGeneration(noCodeContext);

      expect(result.confidence).toBeLessThan(50);
      expect(result.isAIGenerated).toBe(false);
    });

    it('should assign appropriate confidence thresholds', async () => {
      // Test high confidence AI detection
      mockOpenAI.detectAIGeneration.mockResolvedValue({
        isAIGenerated: true,
        confidence: 95,
        signals: [
          { type: 'naming', indicator: 'Test', score: 0.9, description: 'Test' },
          { type: 'comment_style', indicator: 'Test', score: 0.8, description: 'Test' },
          { type: 'structure', indicator: 'Test', score: 0.8, description: 'Test' },
        ],
        reasoning: 'Very high confidence',
      });

      const result = await aiDetector.detectAIGeneration(mockAIPRContext);
      expect(result.isAIGenerated).toBe(true);

      // Test low confidence should not trigger AI detection
      mockOpenAI.detectAIGeneration.mockResolvedValue({
        isAIGenerated: false,
        confidence: 30,
        signals: [],
        reasoning: 'Low confidence',
      });

      const result2 = await aiDetector.detectAIGeneration(mockHumanPRContext);
      expect(result2.isAIGenerated).toBe(false);
    });
  });
});