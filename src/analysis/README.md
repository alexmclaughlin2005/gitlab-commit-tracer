# Analysis Module

This module provides AI-powered analysis of commit chains to understand context, reasoning, and impact.

## Purpose

- Analyze commit chains using AI (GPT-5 by default)
- Extract reasoning behind code changes
- Assess impact on epic/project goals
- Identify alignment with issues and epics
- Provide confidence scores for analyses

## Structure

- `commit-analyzer.ts` - Main CommitAnalyzer class
- `openai-provider.ts` - OpenAI GPT-5 provider implementation
- `types.ts` - TypeScript type definitions
- `index.ts` - Module exports

## Quick Start

### Basic Usage

```typescript
import { CommitAnalyzer } from './analysis';
import { CommitTracer } from './tracing';
import { GitLabClient } from './api';

// Set up the pipeline
const client = new GitLabClient({
  baseUrl: process.env.GITLAB_URL!,
  token: process.env.GITLAB_TOKEN!,
  projectId: 'my-project',
});

const tracer = new CommitTracer(client);
const analyzer = new CommitAnalyzer();

// Trace and analyze a commit
const chain = await tracer.traceCommit('abc123def456');
const analysis = await analyzer.analyzeCommit(chain);

console.log('Reason:', analysis.analysis.reason);
console.log('Approach:', analysis.analysis.approach);
console.log('Impact:', analysis.analysis.impact);
console.log('Alignment:', analysis.analysis.alignment);
console.log('Confidence:', analysis.analysis.confidence);
```

### Batch Analysis

```typescript
// Trace multiple commits
const batchResult = await tracer.traceCommits(['abc123', 'def456', 'ghi789']);

// Analyze all chains
const analysisResult = await analyzer.analyzeCommits(batchResult.chains);

console.log('Summary:', analyzer.generateSummary(analysisResult));
```

## Configuration

### Environment Variables

```bash
# Required
export OPENAI_API_KEY="your_openai_api_key"

# Optional (for GitLab)
export GITLAB_URL="https://gitlab.com"
export GITLAB_TOKEN="your_gitlab_token"
export GITLAB_PROJECT_ID="your-project"
```

### Custom Options

```typescript
import { CommitAnalyzer, OpenAIProvider } from './analysis';

const provider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
  model: 'gpt-5', // or 'gpt-5-nano' for faster/cheaper
  temperature: 0.3,
  maxTokens: 1000,
});

const analyzer = new CommitAnalyzer(provider);
```

## Analysis Output

### Structure

```typescript
{
  reason: "Users were experiencing frequent session timeouts...",
  approach: "Increased JWT token expiration from 1 hour to 4 hours...",
  impact: "Directly addresses the 'Reduce login friction' objective...",
  alignment: "aligned", // or "partially-aligned" or "misaligned"
  alignmentNotes: "Commit directly solves the issue and contributes to epic goals",
  confidence: 0.95, // 0.0 - 1.0
  metadata: {
    analyzedAt: Date,
    durationMs: 2340,
    provider: "openai",
    model: "gpt-5",
    tokensUsed: 1543,
    costUsd: 0.01543
  }
}
```

### Interpretation

**Confidence Levels:**
- `>= 0.8`: High confidence - analysis is reliable
- `0.5 - 0.8`: Medium confidence - may want to review
- `< 0.5`: Low confidence - human review recommended

**Alignment:**
- `aligned`: Commit clearly addresses the issue and epic goals
- `partially-aligned`: Some alignment but not complete
- `misaligned`: Commit doesn't seem to match issue/epic context

## Advanced Features

### Filtering Results

```typescript
const result = await analyzer.analyzeCommits(chains);

// Get commits needing review
const needsReview = analyzer.getAnalysesNeedingReview(result.analyses, 0.7);

// Get misaligned commits
const misaligned = analyzer.getAnalysesByAlignment(result.analyses, 'misaligned');
```

### Custom AI Provider

```typescript
import type { AIProvider, AnalysisContext, AnalysisResult } from './analysis';

class CustomProvider implements AIProvider {
  public readonly name = 'custom';

  async analyze(context: AnalysisContext): Promise<AnalysisResult> {
    // Your custom analysis logic
    return { /* ... */ };
  }
}

const analyzer = new CommitAnalyzer(new CustomProvider());
```

## Performance

**Typical Performance:**
- Single commit analysis: 2-5 seconds
- Batch of 10 commits: 20-50 seconds (sequential)

**Estimated Costs (GPT-5):**
- Simple commit: ~$0.005-0.008
- Complex commit with epic: ~$0.01-0.015
- Batch of 100 commits: ~$0.50-1.50
