# GitLab Commit Tracer

An intelligent application that automatically monitors GitLab repositories, traces commits through their development lifecycle (Commit → Merge Request → Issue → Epic), and uses AI to generate stakeholder updates for both technical and business audiences.

## Overview

This tool helps development teams communicate progress effectively by:

- **Monitoring** GitLab repositories automatically for new commits (5-minute polling)
- **Tracing** the complete relationship chain from commits to merge requests, issues, and epics
- **Analyzing** the context using AI to understand the purpose and impact of changes
- **Generating** stakeholder updates automatically for technical and business audiences
- **Delivering** insights through a real-time web dashboard

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
- **AI-Powered Analysis**: OpenAI GPT-4o integration
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

### Implemented (Phase 4) ✅
- **Automatic Monitoring**: Real-time commit detection
  - 5-minute polling interval for new commits
  - Multi-project support with configurable settings
  - Queue-based processing (3 concurrent slots)
  - Automatic AI analysis for all detected commits
  - Fire-and-forget parallel processing
- **Web Dashboard**: Full-featured UI
  - Real-time monitoring status and controls
  - Monitored commits feed with automatic updates
  - Manual commit tracing interface
  - Visual relationship chain exploration
  - One-click stakeholder update generation
- **Production Deployment**: Split architecture
  - Backend on Railway with continuous monitoring
  - Frontend on Vercel for static hosting
  - CORS-enabled API with environment-based configuration
  - Automatic redeployment on git push

### Planned (Phase 5)
- Historical data storage with Supabase
- Advanced analytics and reporting
- Webhook support for real-time updates
- Multi-tenant support for multiple organizations

## Project Status

**Current Phase**: Phase 4 - Monitoring & Deployment ✅ COMPLETED
**Next Phase**: Phase 5 - Persistent Storage & Analytics
**Status**: Production Deployed

**Live Deployment**:
- Backend: Railway (https://web-production-7418.up.railway.app)
- Frontend: Vercel (https://gitlab-commit-tracer.vercel.app)

See [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) for detailed project information and development phases.
See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions and configuration.

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

### Production Dashboard

Access the live application at: **https://gitlab-commit-tracer.vercel.app**

The dashboard provides:
- **Automatic Monitoring**: Start/stop monitoring with real-time status
- **Monitored Commits Feed**: Auto-refreshing feed of detected commits
- **Manual Tracing**: Trace individual commits or recent batches
- **Stakeholder Updates**: One-click generation of business updates
- **Visual Chain Exploration**: See MR → Issue → Epic relationships
- **Real-time Status**: Connection status and queue metrics

### Local Development

To run the application locally:

```bash
# Start the backend server
npm run dev:server

# Open browser to http://localhost:3005
# The UI is served at the root path
```

### Monitoring Configuration

Configure monitored projects in `config/projects.json`:

```json
{
  "projects": [
    {
      "id": "your-project-id",
      "name": "Your Project",
      "enabled": true,
      "branches": ["main", "develop"],
      "pollInterval": 300000,
      "filters": {
        "excludeAuthors": ["bot@example.com"]
      }
    }
  ]
}
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for production configuration.

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
GitLab Repository (5-min poll)
    ↓
FeedMonitor (Detect new commits)
    ↓
CommitProcessor Queue (3 concurrent slots)
    ↓
CommitTracer (Build MR → Issue → Epic chain)
    ↓
AI Analyzer (Generate stakeholder updates in parallel)
    ↓
Web Dashboard (Real-time feed display)
```

### Deployment Architecture

```
Frontend (Vercel) → Backend API (Railway) → GitLab API
                                         → OpenAI API
```

**Backend** (Railway):
- Express server on port 3005
- Continuous monitoring with FeedMonitor
- Queue-based commit processing
- RESTful API endpoints for UI

**Frontend** (Vercel):
- Static HTML/CSS/JS served globally
- Real-time status polling (30-second intervals)
- Auto-refresh of monitored commits feed

## Documentation

- [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) - Master guide for AI agents working on this project
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide (Railway + Vercel)
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
│   ├── analysis/     # AI context analysis (OpenAI integration)
│   ├── monitoring/   # FeedMonitor & CommitProcessor
│   ├── server/       # Express REST API server
│   └── index.ts      # CLI entry point
├── ui/
│   └── public/       # Static web dashboard
├── config/           # Project configuration (projects.json)
├── docs/             # Documentation
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

**Phase 2: Tracing** ✅
- [x] Commit tracer implementation
- [x] Relationship chain building
- [x] MR → Issue → Epic traversal
- [x] Caching layer
- [x] Batch tracing with summary statistics

**Phase 3: AI Analysis** ✅
- [x] OpenAI provider integration (GPT-4o)
- [x] Context extraction and analysis
- [x] Impact and alignment assessment
- [x] Stakeholder update generation
- [x] Dual-audience updates (technical + business)

**Phase 4: Monitoring & Deployment** ✅
- [x] Real-time monitoring with FeedMonitor
- [x] Queue-based commit processing
- [x] Web dashboard UI
- [x] Production deployment (Railway + Vercel)
- [x] Automatic AI analysis for monitored commits
- [x] Parallel processing optimization

**Phase 5: Enhancement** (Next)
- [ ] Persistent storage with Supabase
- [ ] Historical commit analytics
- [ ] Webhook support for real-time updates
- [ ] Advanced reporting and insights
- [ ] Multi-tenant support

## Support

(Support information to be added)
