# 🧠 PRBrain

**AI-powered PR analysis for smarter code review**

Free and open source. Built to help developers everywhere. 🌍

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🚀 Quick Start

Get PRBrain running on your repository in 3 easy steps:

### 1. Add the Workflow File

Create `.github/workflows/prbrain.yml` in your repository:

```yaml
name: PRBrain
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write
  issues: read

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: buildthingsuseful/prbrain@main
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Set OpenAI API Key

Add your OpenAI API key as a repository secret:
- Go to **Settings → Secrets and variables → Actions**
- Click **New repository secret**
- Name: `OPENAI_API_KEY`
- Paste your OpenAI API key

### 3. Open a Pull Request

That's it! PRBrain will automatically analyze every PR and post a comment.

## ✨ What PRBrain Does

Every time a PR is opened, PRBrain analyzes it and posts a comment like this:

```markdown
## 🧠 PRBrain Analysis

🤖 **AI-Generated:** High confidence (72%)
*Signals: methodical approach, generic comments, perfect formatting*

📝 **Inferred Intent:** "Add rate limiting to API endpoints"
🎯 **Summary:** Adds middleware-based rate limiting to all public API routes
📊 **Scope:** 4 files changed | +180 -12 | Medium change
⚠️ **Gaps:** No tests, hardcoded rate limits, no distributed support

### 🔄 Similar PRs/Issues
- #234 "API rate limiting" (92% similar) — OPEN
- #189 "Throttle requests" (78% similar) — CLOSED

### 📐 Vision Alignment
✅ Aligned with project goals

### 📊 Quality Score: 7/10
- ✅ Reasonable scope
- ✅ Well-structured changes
- ⚠️ No docs update
- ❌ Missing tests
```

### Features

- **🎯 Intent Extraction** — Reverse-engineers the likely prompt/goal from the diff
- **🤖 AI Detection** — Identifies AI-generated PRs with confidence scores
- **🔄 Duplicate Detection** — Finds similar open PRs and issues via embeddings
- **📐 Vision Alignment** — Checks PR against your project's `VISION.md`
- **📊 Quality Scoring** — Scores PRs on tests, size, structure, docs, and complexity

## ⚙️ Configuration

Optionally create `.prbrain.yml` in your repository root:

```yaml
# LLM model (default: gpt-4o-mini)
model: gpt-4o-mini

# Similarity threshold for duplicate detection (0.0 - 1.0)
similarity_threshold: 0.80

# Path to your project vision document
vision_doc: VISION.md

# Quality scoring settings
quality:
  require_tests: true
  max_files_changed: 50
  max_lines_changed: 1000

# Auto-apply labels
labels:
  ai_generated: "🤖 ai-generated"
  duplicate: "duplicate"
  vision_misaligned: "⚠️ scope-creep"

# Ignore patterns
ignore:
  paths: ["*.lock", "*.generated.*"]
  authors: ["dependabot[bot]", "renovate[bot]"]
```

See [Configuration Reference](docs/CONFIGURATION.md) for all options.

## 📐 Vision Alignment

Add a `VISION.md` to your repo root describing your project's goals and principles. PRBrain will check every PR against it and flag scope creep. See [VISION.md](VISION.md) for an example template.

## 🛠️ Development

```bash
git clone https://github.com/buildthingsuseful/prbrain.git
cd prbrain
npm install
npm test          # Run tests (vitest)
npx tsc --noEmit  # Type check
npm run build     # Bundle with ncc
```

### Project Structure
- `src/core/` — Analysis engines (intent, AI detection, dedup, quality, vision)
- `src/adapters/` — GitHub API, OpenAI, vector storage
- `src/utils/` — Diff parser, tokenizer, logger
- `test/` — Test suite with fixtures

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Configuration Reference](docs/CONFIGURATION.md)

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ to help open source maintainers manage the flood of AI-generated PRs.
