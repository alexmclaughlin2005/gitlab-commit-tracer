# Architecture

## System Overview

The GitLab Commit Tracer is designed as a modular TypeScript application that monitors GitLab repositories, traces commits through their development lifecycle, and provides AI-powered contextual analysis.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     GitLab Commit Tracer                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│   API Layer  │      │Storage Layer │     │  AI Analysis │
│              │      │              │     │              │
│ - GitLab API │      │ - Database   │     │ - AI Client  │
│ - Rate Limit │      │ - Models     │     │ - Context    │
│ - Auth       │      │ - Query      │     │ - Impact     │
└──────┬───────┘      └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       └──────────┬──────────┴──────────┬──────────┘
                  │                     │
                  ▼                     ▼
          ┌──────────────┐      ┌──────────────┐
          │Tracing Layer │      │    Output    │
          │              │      │              │
          │ - Chain Build│      │ - Reports    │
          │ - Relations  │      │ - Logging    │
          └──────────────┘      └──────────────┘
```

## Core Components

### 1. API Layer (`src/api/`)

**Responsibility**: Interface with GitLab API

**Key Functions**:
- Authenticate with GitLab using personal access tokens
- Fetch commits, merge requests, issues, and epics
- Handle rate limiting and pagination
- Provide strongly-typed data structures

**Dependencies**: `axios`, `dotenv`

### 2. Tracing Layer (`src/tracing/`)

**Responsibility**: Build relationship chains

**Key Functions**:
- Find merge requests containing specific commits
- Identify issues linked to merge requests
- Trace issues to their parent epics
- Construct complete Commit → MR → Issue → Epic chains

**Dependencies**: API Layer

### 3. Analysis Layer (`src/analysis/`)

**Responsibility**: AI-powered context understanding

**Key Functions**:
- Gather context from entire relationship chain
- Prompt AI with structured questions
- Parse and validate AI responses
- Generate impact assessments

**Dependencies**: AI Provider API (OpenAI/Anthropic/etc.), Tracing Layer

### 4. Storage Layer (`src/storage/`)

**Responsibility**: Data persistence

**Key Functions**:
- Store commits, MRs, issues, epics
- Store relationship mappings
- Store analysis results
- Provide query interface for historical data

**Dependencies**: Database driver (TBD)

## Data Flow

### Primary Flow

1. **Monitor**: Periodically query GitLab API for new commits
2. **Trace**: For each new commit, build the relationship chain
3. **Analyze**: Send chain context to AI for analysis
4. **Store**: Persist commit, relationships, and analysis
5. **Report**: Output results (console, file, dashboard, etc.)

### Detailed Flow

```
┌─────────────┐
│ New Commit  │
│  Detected   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Fetch Commit Details                    │
│ - Message, author, timestamp            │
│ - Changed files                         │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Find Parent Merge Request               │
│ - Search by commit SHA                  │
│ - Get MR title, description, discussion │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Find Related Issue(s)                   │
│ - Parse "Closes #123" from MR           │
│ - Use GitLab linked issues API          │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Find Parent Epic                        │
│ - Get epic from issue relationship      │
│ - Fetch epic details                    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ AI Context Analysis                     │
│ - Compile full context                  │
│ - Send to AI with structured prompt     │
│ - Parse response                        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Store Results                           │
│ - Save relationships                    │
│ - Save analysis                         │
│ - Update indexes                        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Output                                  │
│ - Log results                           │
│ - Update dashboard (future)             │
└─────────────────────────────────────────┘
```

## Design Decisions

### TypeScript
- Provides type safety for GitLab API responses
- Better IDE support and refactoring
- Catches errors at compile time

### Modular Architecture
- Separation of concerns
- Easy to test individual components
- Allows swapping implementations (e.g., different AI providers)

### Relationship Chain Approach
- Provides complete context for AI analysis
- Enables understanding of "why" behind commits
- Supports impact assessment on high-level goals

## Scalability Considerations

### Current Phase (MVP)
- Single project monitoring
- Sequential processing
- Local storage

### Future Enhancements
- Multi-project support
- Parallel processing with worker pools
- Webhook-based real-time monitoring
- Cloud database for team access
- Caching layer for frequently accessed data

## Error Handling Strategy

1. **API Errors**: Retry with exponential backoff
2. **Rate Limiting**: Respect GitLab rate limits, queue requests
3. **Missing Data**: Log warnings, continue with available data
4. **AI Errors**: Retry once, mark as "analysis failed" if persistent
5. **Storage Errors**: Critical - log and alert

## Security Considerations

- API tokens stored in environment variables only
- No tokens in logs or error messages
- Validate all external data before processing
- Sanitize AI prompts to prevent injection

## Testing Strategy

- Unit tests for each module
- Integration tests for API interactions
- Mock GitLab API responses for testing
- Test relationship chain building with fixtures
- Validate AI prompt/response parsing

## Performance Targets

- Process commit in < 10 seconds (API + trace + analysis)
- Support monitoring up to 100 commits/hour
- Query historical data in < 1 second
- Storage growth: ~1MB per 1000 commits analyzed

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **HTTP Client**: Axios
- **AI Provider**: TBD (OpenAI/Anthropic)
- **Database**: TBD (SQLite/PostgreSQL)
- **Testing**: Jest
- **Linting**: ESLint + Prettier

## Future Considerations

- Web dashboard for visualization
- Slack/email notifications
- Custom analysis rules
- Team collaboration features
- Export functionality (CSV, JSON)
- Integration with project management tools
