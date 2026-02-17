# Contributing to PRBrain

Thank you for your interest in contributing to PRBrain! 🎉 This guide will help you get started with contributing to our AI-powered PR analysis tool.

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Git

### Setup Development Environment

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR-USERNAME/prbrain.git
cd prbrain

# 2. Install dependencies
npm install

# 3. Run tests to ensure everything works
npm test

# 4. Start development mode (if applicable)
npm run dev
```

## 📋 How to Contribute

### 1. 🐛 Reporting Bugs

Before creating a bug report, please:
- Check if the bug has already been reported in [Issues](https://github.com/your-org/prbrain/issues)
- Try to reproduce the issue with the latest version

**Create a bug report with:**
- Clear, descriptive title
- Steps to reproduce the bug
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Relevant error messages or logs

**Template:**
```markdown
**Bug Description**
A clear description of what the bug is.

**To Reproduce**
1. Step 1
2. Step 2
3. See error

**Expected Behavior**
What should have happened.

**Environment**
- OS: [e.g., macOS 13.0]
- Node: [e.g., 18.17.0]
- PRBrain version: [e.g., 1.2.0]
```

### 2. 💡 Feature Requests

We welcome feature suggestions! Please:
- Check existing feature requests first
- Provide clear use cases and benefits
- Consider if it fits PRBrain's core mission

**Template:**
```markdown
**Feature Description**
A clear description of the feature you'd like to see.

**Use Case**
Why would this be useful? What problem does it solve?

**Proposed Solution**
How do you envision this working?

**Alternatives**
Any alternative solutions you've considered?
```

### 3. 🔧 Code Contributions

#### Types of Contributions We Need
- **Bug fixes**: Resolve reported issues
- **New features**: Implement planned enhancements  
- **Documentation**: Improve guides and API docs
- **Tests**: Increase test coverage
- **Performance**: Optimize existing functionality
- **Refactoring**: Improve code quality and structure

#### Development Workflow

1. **Create an Issue** (for new features/major changes)
2. **Fork the Repository**
3. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

4. **Make Your Changes**
   - Follow our coding standards (see below)
   - Add/update tests as needed
   - Update documentation if required

5. **Test Your Changes**
   ```bash
   # Run the full test suite
   npm test
   
   # Check for TypeScript errors
   npm run type-check
   
   # Run linting
   npm run lint
   
   # Build to ensure it compiles
   npm run build
   ```

6. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add intelligent code complexity analysis"
   ```
   
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new features
   - `fix:` bug fixes
   - `docs:` documentation changes
   - `test:` adding or updating tests
   - `refactor:` code refactoring
   - `perf:` performance improvements

7. **Push and Create Pull Request**
   ```bash
   git push origin your-branch-name
   ```

#### Pull Request Guidelines

**Before submitting:**
- [ ] Tests pass locally (`npm test`)
- [ ] Code follows our style guide
- [ ] Documentation is updated (if needed)
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with `main`

**PR Description should include:**
- What changes were made and why
- Links to related issues
- Screenshots (for UI changes)
- Testing notes for reviewers

**Example PR Template:**
```markdown
## Description
Brief description of what this PR does.

## Related Issues
Fixes #123
Related to #456

## Changes Made
- Added X feature
- Fixed Y bug  
- Updated Z documentation

## Testing
- [ ] All tests pass
- [ ] Manually tested [describe scenarios]
- [ ] Added new tests for [feature/fix]

## Screenshots (if applicable)
[Add screenshots for UI changes]
```

## 📝 Coding Standards

### TypeScript Guidelines
- Use TypeScript for all new code
- Enable strict mode settings
- Prefer explicit types over `any`
- Use meaningful variable and function names

### Code Style
- Use Prettier for formatting (config in `.prettierrc`)
- Use ESLint for code quality (config in `.eslintrc`)
- Follow existing patterns in the codebase

### File Organization
```
src/
├── core/           # Core analysis engines
├── adapters/       # External service integrations
├── utils/          # Utility functions  
├── types/          # TypeScript type definitions
└── config/         # Configuration constants

test/               # Test files (mirror src structure)
docs/               # Documentation
```

### Testing Standards
- Write tests for all new functionality
- Aim for high test coverage (>90%)
- Use descriptive test names
- Group related tests with `describe` blocks
- Mock external dependencies

**Test Structure:**
```typescript
describe('FeatureName', () => {
  describe('methodName', () => {
    it('should handle normal case correctly', () => {
      // Arrange
      const input = createTestInput();
      
      // Act  
      const result = methodName(input);
      
      // Assert
      expect(result).toBe(expectedOutput);
    });
    
    it('should handle edge case gracefully', () => {
      // Test edge cases
    });
  });
});
```

## 🏗️ Architecture Guidelines

### Core Principles
- **Single Responsibility**: Each module has one clear purpose
- **Dependency Injection**: Use dependency injection for testability
- **Error Handling**: Always handle errors gracefully
- **Async/Await**: Prefer async/await over Promises chains

### Adding New Analysis Features
When adding new AI-powered analysis:

1. **Create Core Analyzer**: Add to `src/core/`
2. **Define Types**: Update `src/types/`
3. **Add Configuration**: Update config schema
4. **Write Tests**: Comprehensive test coverage
5. **Update Documentation**: Add to relevant docs

**Example Structure:**
```typescript
// src/core/new-analyzer.ts
export class NewAnalyzer {
  constructor(private llmAdapter: LLMAdapter) {}
  
  async analyze(context: PRContext): Promise<AnalysisResult> {
    // Implementation
  }
}

// src/types/index.ts  
export interface AnalysisResult {
  // Type definitions
}

// test/new-analyzer.test.ts
describe('NewAnalyzer', () => {
  // Comprehensive tests
});
```

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the code, not the person

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **Pull Request Discussions**: Code review and implementation details
- **GitHub Discussions**: General questions and community chat

### Getting Help
- Check existing documentation first
- Search closed issues for solutions
- Ask questions in GitHub Discussions
- Be specific about your problem and environment

## 🎯 Areas Where We Need Help

### High Priority
- [ ] **Performance Optimization**: Make analysis faster for large PRs
- [ ] **Additional LLM Providers**: Add support for Claude, local models
- [ ] **Documentation**: Improve API documentation and guides
- [ ] **Test Coverage**: Increase coverage in adapter modules

### Medium Priority  
- [ ] **UI Improvements**: Better PR comment formatting
- [ ] **Configuration Validation**: Better error messages for invalid config
- [ ] **Localization**: Support for non-English repositories
- [ ] **Caching**: Implement intelligent caching for repeated analysis

### Good First Issues
Look for issues labeled `good first issue` - these are perfect for new contributors!

## 📚 Resources

### Learning Materials
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Testing with Vitest](https://vitest.dev/guide/)

### PRBrain-Specific
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [API Documentation](docs/API.md)

## 🏆 Recognition

We believe in recognizing contributions! Contributors will be:
- Added to our Contributors list
- Mentioned in release notes
- Invited to our contributor Discord (coming soon)
- Eligible for contributor swag (coming soon)

---

## Questions?

Don't hesitate to ask! We're here to help:
- Open a [GitHub Discussion](https://github.com/your-org/prbrain/discussions)
- Comment on relevant issues
- Reach out to maintainers

**Thank you for making PRBrain better for everyone!** 🚀