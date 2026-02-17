# PRBrain

```
██████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗███╗   ██╗
██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║
██████╔╝██████╔╝██████╔╝██████╔╝███████║██║██╔██╗ ██║
██╔═══╝ ██╔══██╗██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║
██║     ██║  ██║██████╔╝██║  ██║██║  ██║██║██║ ╚████║
╚═╝     ╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
```

**AI-powered PR analysis for smarter code review**

PRBrain automatically analyzes pull requests using advanced AI to provide intelligent insights, quality scoring, duplicate detection, and comprehensive code review assistance.

## 🚀 Quick Start

Get PRBrain running on your repository in 3 easy steps:

### 1. Add the Workflow File

Create `.github/workflows/prbrain.yml` in your repository:

```yaml
name: PRBrain Analysis
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  prbrain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: PRBrain Analysis
        uses: your-org/prbrain-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

### 2. Set OpenAI API Key

Add your OpenAI API key as a repository secret:
- Go to Settings → Secrets and variables → Actions
- Add new secret: `OPENAI_API_KEY`
- Paste your OpenAI API key

### 3. Open a Pull Request

Create and open any pull request. PRBrain will automatically analyze it and post intelligent comments!

## ✨ Features

### 🎯 Quality Scoring
PRBrain evaluates PR quality across multiple dimensions:

```markdown
## 📊 PRBrain Analysis

**Quality Score: 8/10**

✅ **Strong**: Test Coverage, Documentation  
⚠️ **Needs work**: Change Scope  

### Quality Factors
- **Test Coverage** (2/2): ✅ Includes comprehensive tests
- **Change Scope** (1/2): ⚠️ Large change (127 files, 2,341 lines)
- **Code Structure** (2/2): ✅ Well-structured, clean code
- **Documentation** (2/2): ✅ Updated README and added examples
- **Complexity** (1/1): ✅ Appropriate complexity for the scope

### Summary
- ✅ Excellent PR quality with comprehensive testing
- 🎯 **Intent**: Add comprehensive rate limiting system
- 🔍 **Confidence**: 94% - Clear implementation of rate limiting middleware
```

### 🔍 AI-Powered Analysis
- **Intent Detection**: Understands what your PR is trying to accomplish
- **Code Quality Assessment**: Evaluates structure, complexity, and best practices  
- **AI Generation Detection**: Identifies potentially AI-generated code
- **Duplicate Detection**: Finds similar PRs to prevent redundant work

### 🚦 Smart Insights
- **Test Coverage Analysis**: Ensures adequate testing
- **Documentation Checks**: Verifies docs are updated
- **Complexity Assessment**: Identifies over-engineered solutions
- **First-time Contributor Support**: Extra guidance for new contributors

### Example PR Comment Output

```markdown
## 🧠 PRBrain Analysis

**Quality Score: 9/10** | **Intent Confidence: 87%**

### 🎯 Intent Analysis
**Primary Goal**: Implement JWT authentication middleware

**Key Changes**:
- Added JWT token validation middleware
- Updated user authentication flow  
- Enhanced security with token expiration
- Added comprehensive test suite

### 📊 Quality Assessment
- **Test Coverage**: ✅ Excellent (12 new tests)
- **Documentation**: ✅ Updated API docs and README
- **Code Structure**: ✅ Clean, well-organized implementation
- **Change Scope**: ✅ Focused, appropriate size
- **Complexity**: ⚠️ Consider simplifying token refresh logic

### 🔍 Code Intelligence
- **AI Detection**: Human-written (confidence: 23%)
- **Duplicates**: No similar PRs found
- **Risk Level**: Low - well-tested, incremental change

### 💡 Recommendations
1. Consider adding rate limiting to token endpoints
2. Excellent test coverage - great work! 🎉
3. Documentation is comprehensive and helpful
```

## ⚙️ Configuration

Create `.prbrain.yml` in your repository root to customize behavior:

```yaml
# Quality scoring configuration
quality:
  require_tests: true              # Require tests for code changes
  max_files_changed: 50           # Maximum files in a single PR
  max_lines_changed: 1000         # Maximum lines in a single PR

# AI analysis settings
ai:
  intent_analysis: true           # Enable intent detection
  duplicate_detection: true      # Enable duplicate PR detection
  ai_generation_detection: true  # Detect AI-generated code

# Comment behavior
comments:
  quality_threshold: 6            # Minimum score to post positive feedback
  always_comment: false          # Post comments on all PRs
  include_recommendations: true  # Include improvement suggestions

# LLM provider settings  
llm:
  provider: "openai"             # openai, anthropic, local
  model: "gpt-4"                 # Model to use for analysis
  temperature: 0.1               # Creativity vs consistency (0.0-1.0)
  max_tokens: 2000              # Maximum response length

# File patterns to analyze
files:
  include:
    - "src/**/*.{js,ts,py,java,go}"
    - "lib/**/*.{js,ts}"
  exclude:  
    - "**/*.test.js"
    - "dist/**"
    - "node_modules/**"

# Custom rules
rules:
  - name: "No console.log in production"
    pattern: "console\\.log"
    severity: "warning"
    message: "Remove console.log statements before merging"
    
  - name: "Prefer const over let"
    pattern: "^\\s*let\\s"
    severity: "suggestion"
    message: "Consider using 'const' if the variable doesn't change"
```

## 🏢 Pricing & Business Tiers

### 🆓 Free for Open Source
- Unlimited public repositories
- All AI-powered analysis features
- Community support
- MIT licensed

### 🚀 Enterprise (Coming Soon)
- Private repositories
- Advanced analytics dashboard
- Custom rules and workflows
- Priority support
- SSO integration
- On-premise deployment options

[Contact us for Enterprise pricing →](mailto:enterprise@prbrain.dev)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/prbrain.git
cd prbrain

# Install dependencies  
npm install

# Run tests
npm test

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Project Structure
- `src/core/` - Core analysis engines
- `src/adapters/` - External API integrations
- `src/utils/` - Utility functions
- `test/` - Comprehensive test suite
- `docs/` - Documentation

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [Enterprise Features](docs/ENTERPRISE.md)
- [API Documentation](docs/API.md)

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Testing**: Vitest
- **AI**: OpenAI GPT-4, Anthropic Claude
- **Packaging**: @vercel/ncc
- **CI/CD**: GitHub Actions

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with ❤️ by developers who believe in intelligent, automated code review.

---

**Ready to supercharge your code review process?** [Get started now](#quick-start) or [star this repo](https://github.com/your-org/prbrain) to follow our journey! ⭐