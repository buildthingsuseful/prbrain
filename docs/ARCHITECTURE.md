# PRBrain Architecture

This document provides a comprehensive technical overview of PRBrain's architecture, data flow, and module design.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          GitHub Action                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   GitHub Events     │────│         PRBrain Core           │ │
│  │  (PR opened/sync)   │    │      (Analysis Engine)         │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                         │
                                         │ Analysis Request
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRBrain Core System                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Context    │  │  Analysis    │  │   Comment    │         │
│  │  Extractor   │──│   Engine     │──│  Generator   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                Analysis Modules                          │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │  │
│  │  │   Quality   │ │   Intent    │ │    AI Detection     │ │  │
│  │  │   Scorer    │ │  Extractor  │ │      Module         │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │  │
│  │  │ Deduplicator│ │  Diff       │ │     Vision          │ │  │
│  │  │   Module    │ │  Parser     │ │    Alignment        │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  External Adapters                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │  │
│  │  │   OpenAI    │ │   GitHub    │ │      Storage        │ │  │
│  │  │   Adapter   │ │   Adapter   │ │      Adapter        │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                         │
                                         │ Generated Comments
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   OpenAI    │    │   GitHub    │    │    Local Storage   │  │
│  │     API     │    │     API     │    │   (Embeddings)     │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Diagram

```
PR Event (GitHub)
        │
        │ 1. Webhook/Action Trigger
        ▼
┌───────────────────┐
│  Context          │ 2. Fetch PR Data
│  Extractor        │────────────────────┐
└───────────────────┘                    │
        │                                │
        │ 3. PR Context                  │ GitHub API
        ▼                                │
┌───────────────────┐                    │
│  Analysis Engine  │◄───────────────────┘
│  (Orchestrator)   │
└───────────────────┘
        │
        │ 4. Distribute Analysis Tasks
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Parallel Analysis Modules                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Quality   │  │   Intent    │  │   AI Detection      │ │
│  │   Scorer    │  │  Extractor  │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│        │               │                     │            │
│        │ 5a. LLM       │ 5b. LLM            │ 5c. LLM     │
│        │ Analysis      │ Analysis           │ Analysis    │
│        ▼               ▼                     ▼            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  OpenAI     │  │   OpenAI    │  │      OpenAI         │ │
│  │  Adapter    │  │   Adapter   │  │      Adapter        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │                 │                     │
        │ 6a. Results     │ 6b. Results         │ 6c. Results
        ▼                 ▼                     ▼
┌───────────────────────────────────────────────────────────────┐
│                 Analysis Aggregator                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Combined Results                            │  │
│  │  • Quality Score: 8/10                                  │  │
│  │  • Intent: "Add authentication middleware"              │  │
│  │  • AI Generated: Unlikely (23% confidence)              │  │
│  │  • Duplicates: None found                               │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
        │
        │ 7. Aggregated Analysis
        ▼
┌───────────────────┐
│  Comment          │ 8. Generate Markdown
│  Generator        │──────────────────────┐
└───────────────────┘                      │
        │                                  │ Template
        │ 9. Formatted Comment             │ System
        ▼                                  │
┌───────────────────┐                      │
│  GitHub Adapter   │◄─────────────────────┘
└───────────────────┘
        │
        │ 10. Post Comment
        ▼
GitHub PR Comment
```

## 🧩 Module Descriptions

### Core Modules

#### 1. Context Extractor
**Purpose**: Fetches and normalizes PR data from GitHub
**Location**: `src/core/context-extractor.ts`

**Responsibilities**:
- Extract PR metadata (title, body, author, files changed)
- Parse diff content
- Identify file types and change patterns
- Determine if contributor is first-time
- Check for test files in the PR

**Key Methods**:
```typescript
async extractPRContext(prNumber: number): Promise<PRContext>
private identifyFileTypes(files: GitHubFile[]): FileAnalysis
private detectTestFiles(files: GitHubFile[]): boolean
```

#### 2. Analysis Engine (Orchestrator)
**Purpose**: Coordinates all analysis modules and aggregates results
**Location**: `src/core/analysis-engine.ts`

**Responsibilities**:
- Orchestrate parallel analysis tasks
- Manage analysis configuration
- Handle errors and fallbacks
- Aggregate results from all modules
- Generate final analysis report

**Key Methods**:
```typescript
async analyzePR(context: PRContext): Promise<AnalysisResult>
private runAnalysisModules(context: PRContext): Promise<ModuleResults[]>
private aggregateResults(results: ModuleResults[]): AnalysisResult
```

#### 3. Quality Scorer
**Purpose**: Evaluates PR quality across multiple dimensions
**Location**: `src/core/quality-scorer.ts`

**Analysis Factors**:
- **Test Coverage**: Presence and adequacy of tests
- **Change Scope**: Size and focus of the PR
- **Code Structure**: Organization and patterns
- **Documentation**: Updates to docs and comments
- **Complexity**: Appropriate complexity for the task
- **Contributor Experience**: Adjustments for first-time contributors

**Scoring Algorithm**:
1. Calculate heuristic factors (local analysis)
2. Get AI assessment from LLM
3. Merge and weight factors
4. Generate 0-10 overall score

#### 4. Intent Extractor
**Purpose**: Determines what the PR is trying to accomplish
**Location**: `src/core/intent-extractor.ts`

**Analysis Process**:
1. **Heuristic Analysis**: Pattern matching on files and changes
2. **LLM Analysis**: Deep understanding of changes and context
3. **Confidence Scoring**: How certain we are about the intent
4. **Key Changes**: Specific modifications made

**Output Example**:
```typescript
{
  inferredIntent: "Add JWT authentication middleware",
  confidence: 87,
  keyChanges: [
    "Added JWT validation middleware",
    "Updated authentication flow",
    "Enhanced security with token expiration"
  ],
  scope: {
    filesChanged: 8,
    linesAdded: 156,
    linesDeleted: 23
  }
}
```

#### 5. AI Detection Module
**Purpose**: Identifies potentially AI-generated code
**Location**: `src/core/ai-detector.ts`

**Detection Signals**:
- **Naming Patterns**: Overly verbose or generic variable names
- **Comment Style**: AI-typical explanatory comments
- **Structure**: Excessive defensive programming
- **Complexity**: Over-engineering simple tasks
- **Code Style**: Perfect formatting consistency

**Analysis Method**:
1. Extract heuristic signals from code patterns
2. Use LLM for contextual analysis
3. Weight and combine confidence scores
4. Generate reasoning for the assessment

#### 6. Deduplicator
**Purpose**: Finds similar PRs to prevent duplicate work
**Location**: `src/core/dedup.ts`

**Detection Strategy**:
1. **Vector Similarity**: Generate embeddings for PR content
2. **Text Similarity**: GitHub search for similar titles/descriptions
3. **Hybrid Ranking**: Combine both approaches
4. **Threshold Filtering**: Only report high-confidence duplicates

**Storage**: Local embedding cache for vector similarity

### Adapter Layer

#### OpenAI Adapter
**Purpose**: Interfaces with OpenAI's API for LLM analysis
**Location**: `src/adapters/openai.ts`

**Capabilities**:
- Text completion for analysis
- Embedding generation for similarity
- Error handling and rate limiting
- Token usage optimization

#### GitHub Adapter  
**Purpose**: Interfaces with GitHub's API
**Location**: `src/adapters/github.ts`

**Capabilities**:
- Fetch PR data and diffs
- Post and update comments
- Search for similar PRs
- Handle GitHub API rate limits

#### Storage Adapter
**Purpose**: Manages local embedding storage
**Location**: `src/adapters/storage.ts`

**Capabilities**:
- Store and retrieve embeddings
- Vector similarity search
- Cleanup old embeddings
- JSON-based persistence

### Utility Modules

#### Diff Parser
**Purpose**: Parses and analyzes unified diff format
**Location**: `src/utils/diff-parser.ts`

**Functions**:
- Parse diff into structured chunks
- Extract added/removed lines
- Identify function changes
- Calculate diff statistics
- Simplify diffs for AI analysis

#### Tokenizer
**Purpose**: Manages token limits for LLM APIs
**Location**: `src/utils/tokenizer.ts`

**Functions**:
- Count tokens in text
- Truncate content to fit limits
- Optimize content for analysis
- Handle different encoding formats

## 🔄 LLM Provider Abstraction

PRBrain uses an adapter pattern to support multiple LLM providers:

```typescript
interface LLMProvider {
  generateCompletion(prompt: string, options?: LLMOptions): Promise<CompletionResult>
  generateEmbedding(text: string): Promise<EmbeddingResult>
  extractIntent(diff: string, title: string, body?: string): Promise<IntentResult>
  scoreQuality(context: QualityContext): Promise<QualityResult>
  detectAIGeneration(diff: string, title: string, body?: string): Promise<AIDetectionResult>
  checkVisionAlignment(context: PRContext, vision?: string): Promise<VisionAlignmentResult>
}
```

### Current Implementation
- **OpenAI Adapter**: GPT-4 for analysis, text-embedding-ada-002 for embeddings

### Planned Providers
- **Anthropic Adapter**: Claude for analysis
- **Local Model Adapter**: Ollama/LocalAI support
- **Azure OpenAI**: Enterprise OpenAI deployment
- **Google PaLM**: Google's LLM services

## 🛠️ Configuration System

Configuration is managed through `.prbrain.yml` files with schema validation:

```
Config Loading Priority:
1. Repository `.prbrain.yml`
2. Organization `.prbrain.yml` 
3. Default configuration
```

**Configuration Schema**:
```typescript
interface PRBrainConfig {
  quality: QualityConfig
  ai: AIConfig  
  comments: CommentConfig
  llm: LLMConfig
  files: FileConfig
  rules: CustomRule[]
}
```

## 🧪 Testing Architecture

### Test Structure
```
test/
├── unit/              # Unit tests for individual modules
│   ├── core/          # Core module tests
│   ├── adapters/      # Adapter tests with mocks
│   └── utils/         # Utility function tests
├── integration/       # Integration tests
│   ├── api/           # External API integration
│   └── workflows/     # End-to-end workflows
└── fixtures/          # Test data and mocks
    ├── diffs/         # Sample diff files
    ├── prs/           # Sample PR contexts
    └── responses/     # Mock API responses
```

### Testing Strategy
- **Unit Tests**: Each module tested in isolation with mocks
- **Integration Tests**: Test adapter integrations with real/sandbox APIs
- **Contract Tests**: Verify adapter interfaces remain consistent
- **Performance Tests**: Ensure analysis completes within time limits

## 🔒 Security Considerations

### API Key Management
- Secrets stored in GitHub repository secrets
- No API keys logged or exposed in outputs
- Rotation procedures documented

### Data Privacy
- PR content sent to LLM providers (configurable)
- Local embedding storage (not shared externally)
- Anonymization options for sensitive repositories

### Rate Limiting
- Respect API rate limits for all external services
- Implement exponential backoff
- Graceful degradation when limits hit

## 📈 Performance Characteristics

### Analysis Speed
- **Small PRs** (<50 lines): 10-20 seconds
- **Medium PRs** (50-500 lines): 20-45 seconds  
- **Large PRs** (500+ lines): 45-90 seconds

### Bottlenecks
- **LLM API Latency**: 2-5 seconds per API call
- **GitHub API**: Rate limited to 5000 requests/hour
- **Embedding Generation**: ~500ms per PR for similarity

### Optimization Strategies
- Parallel module execution
- Smart diff truncation
- Embedding caching
- Result memoization

## 🔄 Extension Points

### Adding New Analysis Modules
1. Implement `AnalysisModule` interface
2. Register in `AnalysisEngine`
3. Add configuration schema
4. Create comprehensive tests
5. Update documentation

### Custom LLM Providers
1. Implement `LLMProvider` interface
2. Add provider configuration
3. Handle provider-specific errors
4. Add integration tests

### Custom Rules Engine
Future extension point for organization-specific analysis rules:
```typescript
interface CustomRule {
  name: string
  pattern: string | RegExp
  severity: 'error' | 'warning' | 'suggestion'
  message: string
  enabled: boolean
}
```

## 📚 Dependencies

### Production Dependencies
- **@octokit/rest**: GitHub API client
- **openai**: OpenAI API client  
- **yaml**: Configuration parsing
- **zod**: Schema validation

### Development Dependencies
- **vitest**: Testing framework
- **@types/node**: TypeScript types
- **eslint**: Code linting
- **prettier**: Code formatting

## 🚀 Deployment Architecture

### GitHub Action Runtime
- Runs on `ubuntu-latest`
- Node.js 18+ runtime
- Access to repository files and GitHub API
- Limited to 6-hour execution time

### Resource Requirements
- **Memory**: 512MB typical, 1GB for large PRs
- **CPU**: Single-threaded, parallel API calls
- **Storage**: <50MB for embeddings cache
- **Network**: High bandwidth for API calls

---

This architecture enables PRBrain to provide fast, accurate, and extensible AI-powered PR analysis while maintaining reliability and security standards.