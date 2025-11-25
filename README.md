# GitLab Commit Tracer

An intelligent application that monitors GitLab repositories, traces commits through their development lifecycle (Commit → Merge Request → Issue → Epic), and uses AI to provide contextual analysis of why changes were made and their impact on the overall project.

## Overview

This tool helps development teams understand the complete story behind every commit by:

- **Monitoring** GitLab repositories for new commits
- **Tracing** the relationship chain from commits to merge requests, issues, and epics
- **Analyzing** the context using AI to understand the purpose and impact of changes
- **Reporting** insights about development patterns and project progress

## Features

### Implemented (Phase 1) ✅
- **Project Structure**: Full TypeScript project with proper configuration
- **Documentation Framework**: Comprehensive docs for AI-led development
- **GitLab API Client**: Complete REST API v4 integration
  - Personal Access Token authentication
  - Rate limiting with exponential backoff
  - Automatic retry on failures
  - Pagination support
  - Full TypeScript type definitions
- **API Methods**: All core endpoints implemented
  - Commits: List, get single, find associated MRs
  - Merge Requests: List, get single, get commits, get closing issues
  - Issues: List, get single, get related MRs
  - Epics: List, get single (Premium/Ultimate)

### Implemented (Phase 2) ✅
- **CommitTracer**: Automatic relationship chain building
  - Single commit tracing with full chain traversal
  - Batch commit tracing with summary statistics
  - Recent commits tracing from any branch
- **Chain Building**: Complete Commit → MR → Issue → Epic traversal
- **Caching**: In-memory cache for optimized API usage
- **Progress Tracking**: Real-time progress callbacks for long operations
- **Error Handling**: Graceful error handling with detailed warnings
- **Chain Metadata**: Detailed tracing statistics, timing, and step-by-step logs

### Implemented (Phase 3) ✅
- **AI-Powered Analysis**: OpenAI GPT-5 integration
  - Analyzes commit reason, approach, and impact
  - Assesses alignment with issues and epics
  - Confidence scoring for analysis quality
  - Cost tracking and token usage monitoring
- **Stakeholder Updates**: Dual-audience update generation
  - Technical updates for developers, PMs, architects
  - Business updates for marketing, sales, support, GTM, executives
  - Automatic context-aware formatting
- **Batch Analysis**: Analyze multiple commits efficiently
- **Advanced Filtering**: Filter by alignment, confidence, and review needs
- **Pluggable Providers**: Support for multiple AI providers
- **Summary Reports**: Human-readable analysis summaries

### Planned (Phase 4)
- Historical data storage and querying
- Real-time commit monitoring
- Webhook support for real-time updates
- Dashboard for visualizing commit chains and insights

## Project Status

**Current Phase**: Phase 3 - AI Analysis ✅ COMPLETED
**Next Phase**: Phase 4 - Real-time Monitoring & Storage
**Status**: Active Development

See [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) for detailed project information and development phases.

## Prerequisites

- Node.js 18+
- npm or yarn
- GitLab API access token
- OpenAI API key (for AI analysis)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd "Product Updates from GitLab"

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API tokens
```

## Configuration

Create a `.env` file in the root directory:

```env
# GitLab Configuration
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=your_gitlab_token_here
GITLAB_PROJECT_ID=your-project-id-or-path

# OpenAI Configuration (for AI analysis)
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

### Web Dashboard (Recommended)

The easiest way to use the GitLab Commit Tracer is through the web dashboard:

```bash
# Start the web server
npm run dev:server

# Open browser to http://localhost:3000
```

The dashboard provides:
- Visual commit chain exploration
- Single commit tracing
- Batch tracing of recent commits
- Interactive relationship visualization
- Real-time connection status

See [UI_SETUP.md](UI_SETUP.md) for detailed UI documentation.

### Command Line

You can also use the tracing functionality programmatically:

```bash
# Run the tracing example
npm run dev examples/tracing-example.ts

# Run the AI analysis example
npm run dev examples/analysis-example.ts

# Run the stakeholder updates example
npm run dev examples/stakeholder-updates-example.ts
```

### Programmatic Usage

**Basic Tracing:**

```typescript
import { GitLabClient } from './src/api';
import { CommitTracer } from './src/tracing';

const client = new GitLabClient({
  baseUrl: process.env.GITLAB_URL!,
  token: process.env.GITLAB_TOKEN!,
  projectId: 'my-project',
});

const tracer = new CommitTracer(client);
const chain = await tracer.traceCommit('abc123');

console.log(`Found ${chain.mergeRequests.length} MRs`);
console.log(`Found ${chain.issues.length} issues`);
console.log(`Found ${chain.epics.length} epics`);
```

**With AI Analysis:**

```typescript
import { GitLabClient } from './src/api';
import { CommitTracer } from './src/tracing';
import { CommitAnalyzer } from './src/analysis';

const client = new GitLabClient({
  baseUrl: process.env.GITLAB_URL!,
  token: process.env.GITLAB_TOKEN!,
  projectId: 'my-project',
});

const tracer = new CommitTracer(client);
const analyzer = new CommitAnalyzer();

// Trace and analyze
const chain = await tracer.traceCommit('abc123');
const analysis = await analyzer.analyzeCommit(chain);

console.log('Reason:', analysis.analysis.reason);
console.log('Approach:', analysis.analysis.approach);
console.log('Impact:', analysis.analysis.impact);
console.log('Alignment:', analysis.analysis.alignment);
console.log('Confidence:', analysis.analysis.confidence);
```

**With Stakeholder Updates:**

```typescript
// Generate dual-audience updates
const analysisWithUpdates = await analyzer.analyzeCommitWithUpdates(chain);

// Technical update (for developers, PMs, architects)
console.log('Technical Update:', analysisWithUpdates.updates.technicalUpdate);

// Business update (for marketing, sales, support, executives)
console.log('Business Update:', analysisWithUpdates.updates.businessUpdate);
```

See [examples/analysis-example.ts](examples/analysis-example.ts) and [examples/stakeholder-updates-example.ts](examples/stakeholder-updates-example.ts) for complete examples.

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architectural information.

### High-Level Flow

```
GitLab Repository
    ↓
Commit Detection
    ↓
Relationship Tracing (MR → Issue → Epic)
    ↓
AI Context Analysis
    ↓
Storage & Reporting
```

## Documentation

- [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) - Master guide for AI agents working on this project
- [docs/architecture.md](docs/architecture.md) - System architecture details
- [docs/gitlab-api.md](docs/gitlab-api.md) - GitLab API integration guide
- [docs/ai-analysis.md](docs/ai-analysis.md) - AI analysis approach

## Development

### Project Structure

```
/
├── src/
│   ├── api/          # GitLab API client
│   ├── tracing/      # Commit-to-epic tracing logic
│   ├── analysis/     # AI context analysis
│   ├── storage/      # Data persistence layer
│   └── index.ts      # Main entry point
├── docs/             # Documentation
├── config/           # Configuration files
└── tests/            # Test suite
```

### Contributing

This is an AI-led project with specific documentation requirements:

1. All code changes must include documentation updates
2. Follow the standards defined in [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md)
3. Update relevant READMEs when changing structure
4. Add JSDoc comments to all functions

## License

(License to be determined)

## Roadmap

**Phase 1: Foundation** ✅
- [x] Project structure and documentation
- [x] GitLab API client implementation
- [x] TypeScript type definitions
- [x] Authentication and rate limiting
- [x] Error handling and retry logic

**Phase 2: Tracing** (Current)
- [ ] Commit tracer implementation
- [ ] Relationship chain building
- [ ] MR → Issue → Epic traversal
- [ ] Caching layer

**Phase 3: AI Analysis**
- [ ] AI provider integration
- [ ] Context extraction
- [ ] Impact analysis
- [ ] Storage layer

**Phase 4: Enhancement**
- [ ] Real-time monitoring
- [ ] Webhook support
- [ ] Dashboard/UI
- [ ] Reporting features

## Support

(Support information to be added)
