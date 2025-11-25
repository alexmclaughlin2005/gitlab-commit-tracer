# AI Instructions - GitLab Commit Tracer

## Project Overview

This application monitors GitLab repositories for commits and traces them through the development chain (Commit → Merge Request → Issue → Epic) to provide AI-powered context analysis about the reason for each commit and its impact on the overall project.

## Core Functionality

1. **GitLab API Integration**: Monitor repositories for new commits
2. **Relationship Tracing**: Link commits → MRs → Issues → Epics
3. **Context Analysis**: Use AI to understand:
   - Why the commit was made
   - What problem it solves
   - Its impact on the overall project goals
4. **Data Persistence**: Store relationship chains and analysis results

## Technology Stack

- **Language**: TypeScript/Node.js
- **GitLab API**: REST API v4
- **AI Integration**: OpenAI GPT-5 (via Responses API)
- **Storage**: (To be determined - database choice)

## Project Structure

```
/
├── AI_INSTRUCTIONS.md          # This file - master guide for AI agents
├── README.md                   # User-facing project documentation
├── docs/                       # Detailed documentation
│   ├── architecture.md         # System architecture
│   ├── gitlab-api.md          # GitLab API integration guide
│   └── ai-analysis.md         # AI analysis approach
├── src/                       # Source code
│   ├── api/                   # GitLab API client
│   ├── tracing/               # Commit-to-epic tracing logic
│   ├── analysis/              # AI context analysis
│   ├── storage/               # Data persistence layer
│   └── index.ts               # Main entry point
├── config/                    # Configuration files
└── tests/                     # Test suite

```

## Documentation Standards

### Critical Rules for AI Agents

1. **Always Update Documentation**: Any code changes MUST be accompanied by corresponding documentation updates
2. **README First**: Each directory with code must have a README.md explaining its purpose and contents
3. **Keep AI_INSTRUCTIONS.md Current**: This file is the source of truth - update it when architecture or core decisions change
4. **Document Decisions**: When making technical decisions, document the reasoning in relevant docs/ files
5. **Code Comments**: All non-trivial functions must have JSDoc comments explaining purpose, parameters, and return values

### Documentation Structure

- **AI_INSTRUCTIONS.md**: High-level overview, rules, and quick reference for new AI agents
- **README.md**: User-facing setup, usage, and contribution guidelines
- **docs/**: In-depth technical documentation organized by topic
- **Directory READMEs**: Purpose and structure of each code directory
- **Code Comments**: Inline documentation for complex logic

### Update Workflow

When making changes:
1. Write/modify code
2. Update inline comments if needed
3. Update directory README if structure changed
4. Update docs/ files if architecture/approach changed
5. Update AI_INSTRUCTIONS.md if core functionality changed
6. Update main README.md if user-facing changes made

## Development Phases

### Phase 1: Foundation ✅ COMPLETED
- [x] Project structure setup
- [x] Documentation framework
- [x] GitLab API client implementation
  - [x] Authentication with Personal Access Tokens
  - [x] Rate limiting with exponential backoff
  - [x] Error handling and retry logic
  - [x] Pagination support
  - [x] TypeScript types for all API responses
- [x] API methods implemented:
  - [x] Commits: list, get single, get MRs for commit
  - [x] Merge Requests: list, get single, get commits, get closing issues
  - [x] Issues: list, get single, get related MRs
  - [x] Epics: list, get single (Premium/Ultimate)

**Key Files Implemented**:
- `src/api/types.ts` - Complete TypeScript definitions
- `src/api/gitlab-client.ts` - Full-featured API client (600+ lines)
- `src/api/index.ts` - Module exports
- `src/api/README.md` - Usage documentation

### Phase 2: Tracing ✅ COMPLETED
- [x] Implement CommitTracer class
- [x] MR relationship linking (Commit → MR)
- [x] Issue relationship linking (MR → Issue)
- [x] Epic relationship linking (Issue → Epic)
- [x] Complete chain traversal algorithm
- [x] Chain caching and optimization
- [x] Batch tracing support
- [x] Progress tracking callbacks
- [x] Error handling and warnings
- [x] Chain metadata and statistics

**Key Files Implemented**:
- `src/tracing/types.ts` - Complete type definitions for chains
- `src/tracing/commit-tracer.ts` - CommitTracer class (400+ lines)
- `src/tracing/chain-cache.ts` - In-memory cache implementation
- `src/tracing/index.ts` - Module exports
- `src/tracing/README.md` - Comprehensive usage documentation
- `examples/tracing-example.ts` - Working example

### Phase 3: AI Analysis ✅ COMPLETED
- [x] AI provider selection (OpenAI GPT-5)
- [x] OpenAI Responses API integration
- [x] Context extraction from GitLab data
- [x] Prompt engineering for analysis
- [x] Impact analysis implementation
- [x] Confidence scoring and alignment detection
- [x] Batch analysis support
- [x] Cost tracking and reporting
- [x] Pluggable provider interface

**Key Files Implemented**:
- `src/analysis/types.ts` - Complete type definitions for analysis
- `src/analysis/openai-provider.ts` - OpenAI GPT-5 provider (200+ lines)
- `src/analysis/commit-analyzer.ts` - CommitAnalyzer class (300+ lines)
- `src/analysis/index.ts` - Module exports
- `src/analysis/README.md` - Comprehensive usage documentation
- `examples/analysis-example.ts` - Working examples

### Phase 4: Enhancement
- [ ] Real-time monitoring loop
- [ ] Webhook support
- [ ] Dashboard/reporting
- [ ] Configuration management

## Quick Reference for New AI Agents

### First Steps When Resuming Work
1. Read this file (AI_INSTRUCTIONS.md)
2. Review README.md for current project state
3. Check docs/ for architectural context
4. Review recent git commits to understand latest changes

### Before Making Changes
1. Understand the current phase (see Development Phases above)
2. Review relevant documentation
3. Plan changes with consideration for documentation updates

### After Making Changes
1. Test the changes
2. Update all relevant documentation
3. Ensure code has appropriate comments
4. Verify documentation is consistent across all files

## GitLab API Information

**Documentation**: See `docs/gitlab-api.md` for complete API reference

**Key Endpoints Implemented**:
- Commits API: List, get single, find MRs for commit
- Merge Requests API: List, get single, get commits, get closing issues
- Issues API: List, get single, get related MRs
- Epics API: List, get single (deprecated in GitLab 17.0)

**Authentication**: Personal Access Token via `PRIVATE-TOKEN` header

**Rate Limiting**: Built-in exponential backoff and request pacing

## Implementation Notes

### GitLab API Client

The `GitLabClient` class (`src/api/gitlab-client.ts`) provides a complete interface to GitLab's REST API v4 with the following features:

1. **Authentication**: Automatic token injection in all requests
2. **Rate Limiting**:
   - Minimum 100ms between requests (max 600 req/min)
   - Respects `Retry-After` headers
   - Tracks rate limit info from response headers
3. **Error Handling**:
   - Retries on 5xx errors and 429 (rate limit)
   - Exponential backoff with configurable retry count
   - Standardized error transformation
4. **Pagination**: Automatic extraction of pagination headers
5. **URL Encoding**: Handles namespaced paths correctly

### Usage Example

```typescript
import { GitLabClient } from './api';

const client = new GitLabClient({
  baseUrl: process.env.GITLAB_URL,
  token: process.env.GITLAB_TOKEN,
  projectId: process.env.GITLAB_PROJECT_ID,
});

// Find MRs for a commit
const commit = await client.getCommit('abc123');
const mrs = await client.getCommitMergeRequests('abc123');

// Trace to issues
for (const mr of mrs) {
  const issues = await client.getMergeRequestClosesIssues(mr.iid);

  // Check for epics
  for (const issue of issues) {
    if (issue.epic) {
      const epic = await client.getEpic(issue.epic.group_id, issue.epic.iid);
      console.log(`Epic: ${epic.title}`);
    }
  }
}
```

## Current Status

**Phase**: Phase 3 - AI Analysis ✅ COMPLETED
**Last Updated**: 2025-11-24
**Status**: AI-powered commit analysis fully implemented using OpenAI GPT-5

**Capabilities**:
- Complete pipeline: GitLab API → Tracing → AI Analysis
- OpenAI GPT-5 integration via Responses API
- Analyzes: reason, approach, impact, alignment
- Confidence scoring and cost tracking
- Batch processing and filtering
- Pluggable provider architecture

**Next Steps**:
- Implement Phase 4 - Real-time monitoring and webhooks
- Add persistent storage for analysis results
- Build visualization dashboard
