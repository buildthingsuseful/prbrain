# Contributing to PRBrain

Thanks for wanting to help! PRBrain is free and open source, and we welcome contributions of all kinds.

## Ways to Contribute

- 🐛 **Report bugs** — [Open an issue](https://github.com/buildthingsuseful/prbrain/issues/new?template=bug_report.md)
- 💡 **Suggest features** — [Open an issue](https://github.com/buildthingsuseful/prbrain/issues/new?template=feature_request.md)
- 🔧 **Fix bugs or add features** — Fork, branch, PR
- 📝 **Improve docs** — Typos, clarity, examples
- 🧪 **Add tests** — More coverage is always welcome

## Getting Started

```bash
git clone https://github.com/buildthingsuseful/prbrain.git
cd prbrain
npm install
```

### Run Tests
```bash
npx vitest run
```

### Type Check
```bash
npx tsc --noEmit
```

### Build
```bash
npx @vercel/ncc build src/index.ts -o dist --license licenses.txt
```

## Making a Pull Request

1. **Fork** the repo
2. **Create a branch** from `main`: `git checkout -b my-fix`
3. **Make your changes** — keep them focused
4. **Run tests** — all 58 must pass
5. **Commit** with a clear message
6. **Push** and open a PR against `main`

### PR Guidelines

- Keep PRs small and focused — one thing per PR
- Add tests for new features or bug fixes
- Update docs if you change behavior
- PRBrain will analyze your PR automatically 🧠

### What Makes a Good PR

- Clear title that explains *what*, not *how*
- Description explaining *why* the change is needed
- Tests that cover the change
- No unrelated changes mixed in

## Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Descriptive variable names
- Comments for *why*, not *what*

## Project Structure

```
src/
├── index.ts              # GitHub Action entrypoint
├── core/                 # Analysis engines
│   ├── intent-extractor  # Reverse-engineers PR intent
│   ├── ai-detector       # Detects AI-generated code
│   ├── dedup             # Finds duplicate PRs/issues
│   ├── vision-checker    # Checks alignment with VISION.md
│   ├── quality-scorer    # Scores PR quality
│   └── comment-formatter # Formats the GitHub comment
├── adapters/             # External integrations
│   ├── github            # GitHub API
│   ├── openai            # OpenAI API
│   └── storage           # Vector storage
├── config/               # Configuration schema
├── types/                # TypeScript types
└── utils/                # Diff parser, tokenizer, logger
```

## Good First Issues

Look for issues tagged [`good first issue`](https://github.com/buildthingsuseful/prbrain/labels/good%20first%20issue) — these are great starting points.

## Questions?

Open an issue or start a discussion. No question is too small.

---

Thanks for helping make PR review better for everyone! 🙌
