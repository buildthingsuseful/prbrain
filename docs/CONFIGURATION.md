# PRBrain Configuration Reference

This document provides comprehensive documentation for all PRBrain configuration options through the `.prbrain.yml` file.

## 📁 Configuration File Location

Place your `.prbrain.yml` file in the root of your repository:

```
your-repo/
├── .github/
├── src/
├── .prbrain.yml    ← Configuration file
└── README.md
```

## 🚀 Quick Start Configuration

### Minimal Configuration
```yaml
# .prbrain.yml - Minimal setup
quality:
  require_tests: true

llm:
  provider: "openai"
  model: "gpt-4"
```

### Recommended Configuration
```yaml
# .prbrain.yml - Recommended for most projects
quality:
  require_tests: true
  max_files_changed: 50
  max_lines_changed: 1000

ai:
  intent_analysis: true
  duplicate_detection: true
  ai_generation_detection: true

comments:
  quality_threshold: 6
  always_comment: false
  include_recommendations: true

llm:
  provider: "openai"
  model: "gpt-4"
  temperature: 0.1
  max_tokens: 2000

files:
  include:
    - "src/**/*.{js,ts,py,java,go}"
    - "lib/**/*.{js,ts}"
  exclude:
    - "**/*.test.js"
    - "dist/**"
    - "node_modules/**"
```

## ⚙️ Configuration Sections

### 🎯 Quality Configuration

Controls PR quality assessment behavior.

```yaml
quality:
  require_tests: true              # Require tests for code changes
  max_files_changed: 50           # Maximum files in a single PR
  max_lines_changed: 1000         # Maximum lines in a single PR
  allow_doc_only_without_tests: true  # Allow doc-only PRs without tests
  first_time_contributor_bonus: 1  # Extra points for first-time contributors
  complexity_threshold: 5         # Complexity scoring sensitivity (1-10)
  
  # Custom quality factors (advanced)
  factors:
    test_coverage:
      weight: 2.0                 # Importance multiplier (default: 1.0)
      enabled: true
    documentation:
      weight: 1.5
      enabled: true
    change_scope:
      weight: 2.0
      enabled: true
    code_structure:
      weight: 1.8
      enabled: true
    complexity:
      weight: 1.2
      enabled: true
```

#### Quality Options Explained

| Option | Default | Description |
|--------|---------|-------------|
| `require_tests` | `true` | Fail quality check if no tests are added for code changes |
| `max_files_changed` | `50` | Maximum number of files that can be changed in one PR |
| `max_lines_changed` | `1000` | Maximum total lines (additions + deletions) |
| `allow_doc_only_without_tests` | `true` | Skip test requirements for documentation-only PRs |
| `first_time_contributor_bonus` | `1` | Extra quality points for first-time contributors |
| `complexity_threshold` | `5` | Sensitivity for complexity detection (1=lenient, 10=strict) |

### 🤖 AI Analysis Configuration

Controls AI-powered analysis features.

```yaml
ai:
  intent_analysis: true           # Enable PR intent detection
  duplicate_detection: true      # Enable duplicate PR detection  
  ai_generation_detection: true  # Detect AI-generated code
  vision_alignment: false        # Check alignment with project vision
  confidence_threshold: 70       # Minimum confidence for AI insights (0-100)
  
  # Intent analysis settings
  intent:
    extract_key_changes: true    # Extract specific changes made
    max_key_changes: 8          # Limit key changes to avoid overwhelming
    include_scope_analysis: true # Analyze change scope and impact
    
  # Duplicate detection settings  
  deduplication:
    similarity_threshold: 0.8    # Similarity threshold for duplicates (0.0-1.0)
    max_similar_items: 10       # Maximum similar items to report
    enable_vector_search: true  # Use embedding-based similarity
    enable_text_search: true    # Use GitHub text-based search
    
  # AI generation detection
  ai_detection:
    heuristic_weight: 0.3       # Weight of heuristic vs LLM analysis (0.0-1.0)
    min_confidence_to_report: 60 # Minimum confidence to report AI generation
    check_naming_patterns: true # Analyze variable naming patterns
    check_comment_style: true   # Analyze comment patterns
    check_code_structure: true  # Analyze structural patterns
```

#### AI Analysis Options

| Option | Default | Description |
|--------|---------|-------------|
| `intent_analysis` | `true` | Enable automatic intent extraction from PR content |
| `duplicate_detection` | `true` | Search for similar existing PRs |
| `ai_generation_detection` | `true` | Analyze code for AI generation patterns |
| `confidence_threshold` | `70` | Minimum confidence (0-100) to include AI insights |

### 💬 Comment Configuration

Controls how and when PRBrain posts comments on PRs.

```yaml
comments:
  always_comment: false          # Post comments on all PRs regardless of score
  quality_threshold: 6           # Minimum quality score to post positive feedback
  include_recommendations: true  # Include improvement suggestions
  include_summary: true          # Include executive summary
  include_technical_details: false # Include detailed technical analysis
  
  # Comment formatting
  format:
    style: "standard"            # "standard", "compact", "detailed"
    include_emoji: true          # Use emojis in comments
    include_score_badge: true    # Show quality score prominently  
    include_confidence: true     # Show AI confidence levels
    max_length: 4000            # Maximum comment length (GitHub limit: 65536)
    
  # Conditional commenting
  conditions:
    only_on_failing_quality: false    # Only comment when quality < threshold
    skip_if_draft: true               # Skip draft PRs
    skip_if_wip: true                # Skip PRs with "WIP" in title
    require_files_changed: true      # Only comment if files actually changed
    
  # Comment sections (enable/disable parts)
  sections:
    quality_score: true          # Show overall quality assessment
    intent_analysis: true        # Show intent extraction results
    recommendations: true       # Show improvement suggestions  
    ai_detection: false         # Show AI generation analysis
    duplicate_check: true       # Show duplicate detection results
    technical_details: false    # Show detailed technical breakdown
```

#### Comment Behavior Options

| Option | Default | Description |
|--------|---------|-------------|
| `always_comment` | `false` | Post comments even on high-quality PRs |
| `quality_threshold` | `6` | Minimum score (0-10) to post positive feedback |
| `include_recommendations` | `true` | Include actionable improvement suggestions |
| `style` | `"standard"` | Comment format: standard, compact, or detailed |

### 🧠 LLM Provider Configuration

Configure the Language Model provider and behavior.

```yaml
llm:
  provider: "openai"             # LLM provider: "openai", "anthropic", "local"
  model: "gpt-4"                # Model to use for analysis
  temperature: 0.1              # Creativity vs consistency (0.0-1.0)
  max_tokens: 2000              # Maximum response length
  timeout: 30                   # Request timeout in seconds
  
  # Provider-specific settings
  openai:
    api_base: "https://api.openai.com/v1"  # API endpoint (for Azure OpenAI)
    organization: ""              # OpenAI organization ID (optional)
    embedding_model: "text-embedding-ada-002"  # Embedding model
    
  anthropic:
    model: "claude-3-sonnet-20240229"  # Claude model version
    max_tokens: 4000               # Claude supports longer responses
    
  local:
    api_base: "http://localhost:1234/v1"  # Local API endpoint (Ollama, etc.)
    model: "llama2:7b"            # Local model name
    
  # Advanced settings
  advanced:
    retry_attempts: 3             # Number of retries for failed requests
    retry_delay: 1000            # Delay between retries (milliseconds)
    rate_limit_delay: 100        # Delay between requests (milliseconds)
    parallel_requests: 3         # Maximum concurrent API requests
```

#### LLM Provider Options

| Provider | Models Available | Best For |
|----------|------------------|----------|
| `openai` | gpt-4, gpt-3.5-turbo | Most accurate analysis, good balance |
| `anthropic` | claude-3-sonnet, claude-3-haiku | Long context, detailed analysis |
| `local` | llama2, codellama, custom | Privacy, cost control, offline use |

### 📁 File Configuration

Control which files PRBrain analyzes.

```yaml
files:
  # Include patterns (glob format)
  include:
    - "src/**/*.{js,ts,jsx,tsx}"   # JavaScript/TypeScript source
    - "lib/**/*.{js,ts}"           # Library files
    - "packages/*/src/**/*.{js,ts}" # Monorepo packages
    - "*.{py,java,go,rs,cpp,c,h}"  # Other languages in root
    - "**/*.{md,rst,txt}"          # Documentation files
    
  # Exclude patterns (takes precedence over include)
  exclude:
    - "**/*.test.{js,ts}"          # Test files
    - "**/*.spec.{js,ts}"          # Spec files  
    - "**/__tests__/**"            # Test directories
    - "dist/**"                    # Build output
    - "build/**"                   # Build directories
    - "node_modules/**"            # Dependencies
    - "vendor/**"                  # Vendor files
    - "**/*.generated.{js,ts}"     # Generated files
    - "**/*.min.js"                # Minified files
    - ".next/**"                   # Next.js build
    - ".nuxt/**"                   # Nuxt.js build
    
  # File size limits
  max_file_size: 50000            # Maximum file size in bytes (50KB)
  max_total_size: 500000          # Maximum total diff size (500KB)
  
  # Language-specific settings
  languages:
    javascript:
      extensions: [".js", ".jsx", ".mjs"]
      ignore_patterns: ["*.min.js", "*.bundle.js"]
    typescript:  
      extensions: [".ts", ".tsx", ".d.ts"]
      ignore_patterns: ["*.d.ts"]
    python:
      extensions: [".py", ".pyi"]
      ignore_patterns: ["__pycache__/**"]
```

#### File Pattern Examples

```yaml
# Common patterns
include:
  # Frontend projects
  - "src/**/*.{js,ts,jsx,tsx,vue,svelte}"
  - "components/**/*.{js,ts,jsx,tsx}"
  
  # Backend projects
  - "src/**/*.{js,ts,py,java,go,rs,php}"
  - "lib/**/*.{js,ts,py}"
  
  # Full-stack projects
  - "frontend/src/**/*.{js,ts,jsx,tsx}"
  - "backend/src/**/*.{js,ts,py,java}"
  - "shared/**/*.{js,ts}"
  
  # Documentation
  - "docs/**/*.{md,rst}"
  - "*.md"
  
exclude:
  # Common exclusions
  - "**/node_modules/**"
  - "**/dist/**" 
  - "**/build/**"
  - "**/*.min.{js,css}"
  - "**/__tests__/**"
  - "**/*.test.{js,ts,py}"
  - "coverage/**"
  - ".cache/**"
```

### 📝 Custom Rules Configuration

Define project-specific analysis rules.

```yaml
rules:
  - name: "No console.log in production"
    pattern: "console\\.log"
    severity: "warning"                # "error", "warning", "suggestion"
    message: "Remove console.log statements before merging"
    enabled: true
    files:
      include: ["src/**/*.{js,ts}"]
      exclude: ["**/*.test.{js,ts}"]
    
  - name: "Prefer const over let"
    pattern: "^\\s*let\\s"
    severity: "suggestion"
    message: "Consider using 'const' if the variable doesn't change"
    enabled: true
    
  - name: "Missing error handling"
    pattern: "await\\s+[^\\s]+\\([^)]*\\)\\s*(?!\\.(catch|then))"
    severity: "warning"
    message: "Consider adding error handling for async operations"
    enabled: true
    
  - name: "Use semantic versioning in package.json"
    pattern: '"version":\\s*"[^0-9]'
    severity: "error"
    message: "Version must follow semantic versioning (x.y.z)"
    files:
      include: ["package.json"]
    
  - name: "Require JSDoc for public functions"
    pattern: "export\\s+(function|class)\\s+\\w+[^/\\*]*\\{"
    severity: "suggestion"  
    message: "Consider adding JSDoc documentation for exported functions/classes"
    enabled: false                     # Disabled by default
```

#### Rule Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `name` | ✅ | Human-readable rule name |
| `pattern` | ✅ | Regular expression or string pattern to match |
| `severity` | ✅ | Rule severity: error, warning, suggestion |
| `message` | ✅ | Message shown when rule triggers |
| `enabled` | ❌ | Whether rule is active (default: true) |
| `files.include` | ❌ | File patterns to check (default: all included files) |
| `files.exclude` | ❌ | File patterns to skip |

## 🌐 Environment-Specific Configuration

### Development Environment
```yaml
# .prbrain.dev.yml
quality:
  require_tests: false            # More lenient during development
  max_files_changed: 100
  
comments:
  always_comment: true           # Get feedback on all PRs
  include_technical_details: true
  
llm:
  temperature: 0.2               # Slightly more creative responses
```

### Production Environment  
```yaml
# .prbrain.prod.yml
quality:
  require_tests: true            # Strict test requirements
  max_files_changed: 25         # Smaller PRs for production
  
comments:
  quality_threshold: 8          # Higher bar for positive feedback
  include_recommendations: true
  
llm:
  temperature: 0.0              # Most consistent responses
```

## 🎛️ Advanced Configuration

### Team-Specific Settings
```yaml
# For different team workflows
teams:
  frontend:
    files:
      include: ["src/components/**", "src/pages/**"]
    quality:
      require_tests: true
    rules:
      - name: "React component naming"
        pattern: "export\\s+(?:default\\s+)?(?:function|const)\\s+[a-z]"
        severity: "warning"
        message: "React components should use PascalCase"
        
  backend:
    files:
      include: ["src/api/**", "src/services/**"]  
    quality:
      require_tests: true
      max_complexity: 8
    rules:
      - name: "API endpoint documentation"
        pattern: "app\\.(get|post|put|delete)\\s*\\([^,]+,[^/\\*]"
        severity: "suggestion"
        message: "Consider adding OpenAPI documentation for endpoints"
```

### Monorepo Configuration
```yaml
# Configuration for monorepo projects
packages:
  - name: "frontend"
    path: "packages/frontend"
    config:
      files:
        include: ["src/**/*.{ts,tsx}"]
      quality:
        require_tests: true
        
  - name: "backend"  
    path: "packages/backend"
    config:
      files:
        include: ["src/**/*.{ts,js}"]
      quality:
        require_tests: true
        max_complexity: 6
        
  # Shared configuration
  shared:
    llm:
      provider: "openai"
      model: "gpt-4"
    comments:
      quality_threshold: 7
```

## 🔧 Configuration Validation

PRBrain validates your configuration file and provides helpful error messages:

### Valid Configuration
```yaml
# ✅ This will work
quality:
  require_tests: true
  max_files_changed: 50
```

### Invalid Configuration
```yaml
# ❌ This will cause errors
quality:
  require_tests: "yes"           # Error: should be boolean
  max_files_changed: -1         # Error: should be positive integer
  invalid_option: true          # Error: unknown option
```

### Validation Error Examples
```
❌ Configuration Error in .prbrain.yml:

quality.require_tests: Expected boolean, received string
quality.max_files_changed: Expected positive integer, received -1
quality.invalid_option: Unknown configuration option

💡 Suggestion: Check the documentation at docs/CONFIGURATION.md
```

## 📊 Configuration Examples by Project Type

### React/Frontend Project
```yaml
files:
  include:
    - "src/**/*.{ts,tsx,js,jsx}"
    - "components/**/*.{ts,tsx}"
  exclude:
    - "**/*.test.{ts,tsx,js,jsx}"
    - "**/*.stories.{ts,tsx,js,jsx}"
    - "build/**"
    - "public/**"

quality:
  require_tests: true
  max_files_changed: 30

rules:
  - name: "React hooks dependency array"
    pattern: "useEffect\\([^,]+,\\s*\\[\\s*\\]\\s*\\)"
    severity: "warning"
    message: "Empty dependency array - consider if this effect should run only once"
```

### Node.js/Backend Project
```yaml
files:
  include:
    - "src/**/*.{js,ts}"
    - "lib/**/*.{js,ts}"
    - "routes/**/*.{js,ts}"
  exclude:
    - "**/*.test.{js,ts}"
    - "**/*.spec.{js,ts}"
    - "node_modules/**"
    - "coverage/**"

quality:
  require_tests: true
  max_lines_changed: 800

rules:
  - name: "Async error handling"
    pattern: "async\\s+function[^{]*\\{[^}]*(?!try)"
    severity: "suggestion"
    message: "Consider wrapping async functions in try-catch blocks"
```

### Python Project
```yaml
files:
  include:
    - "src/**/*.py"
    - "*.py"
  exclude:
    - "**/__pycache__/**"
    - "**/test_*.py"
    - "**/*_test.py"
    - "venv/**"
    - ".env/**"

quality:
  require_tests: true
  max_files_changed: 40

rules:
  - name: "Python type hints"
    pattern: "def\\s+\\w+\\s*\\([^)]*\\)\\s*(?!->):"
    severity: "suggestion"
    message: "Consider adding type hints to function signatures"
```

## 🚀 Migration Guide

### Migrating from v1 to v2
```yaml
# Old v1 configuration
analysis:
  enableQualityCheck: true       # ❌ Removed
  enableDuplicateCheck: true     # ❌ Removed
  
# New v2 configuration  
quality:                         # ✅ New structure
  require_tests: true
ai:                             # ✅ New structure
  duplicate_detection: true
```

### Configuration Schema Versions
PRBrain automatically detects and migrates older configuration formats. To use the latest features, update to the current schema:

```yaml
# Add schema version for best compatibility
schema_version: "2.0"

# Rest of configuration...
quality:
  require_tests: true
```

---

## 🆘 Troubleshooting Configuration

### Common Issues

**❌ Configuration not loading**
- Ensure `.prbrain.yml` is in repository root
- Check YAML syntax with a validator
- Verify file permissions

**❌ Rules not triggering**  
- Check `files.include` patterns match your files
- Verify regex patterns are correct
- Ensure `enabled: true` is set

**❌ LLM provider errors**
- Verify API keys are configured in repository secrets
- Check provider-specific model names
- Ensure rate limits are not exceeded

### Getting Help

1. **Validate Configuration**: Use online YAML validators
2. **Check Logs**: Review GitHub Action logs for detailed errors  
3. **Test Patterns**: Use regex testing tools for custom rules
4. **Community Support**: Ask questions in GitHub Discussions

---

This configuration reference covers all available options in PRBrain. Start with the recommended configuration and customize based on your project's specific needs.