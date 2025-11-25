# GitLab Commit Monitoring System Design

## Overview

Automated system to monitor multiple GitLab projects for new commits and automatically trace them through the development lifecycle (Commit → MR → Issue → Epic).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Monitor Configuration                    │
│  (Multiple projects, branches, polling intervals)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Feed Monitor Service                      │
│  • Polls GitLab API/RSS at configured intervals             │
│  • Tracks last seen commit per project/branch               │
│  • Detects new commits                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Commit Processor                         │
│  • Receives new commits from monitor                         │
│  • Runs CommitTracer for each new commit                     │
│  • Generates stakeholder updates (if configured)            │
│  • Stores results                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  • In-memory (immediate): Recent traces                     │
│  • SQLite (persistent): Historical data                     │
│  • File system: Exports, reports                            │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### .env Variables

```env
# Monitor Configuration
MONITOR_ENABLED=true
MONITOR_INTERVAL_SECONDS=300  # Poll every 5 minutes
MONITOR_AUTO_GENERATE_UPDATES=true  # Auto-generate stakeholder updates

# Project Configurations (JSON array)
MONITORED_PROJECTS=[
  {
    "id": "23559266",
    "name": "Filevine App",
    "branches": ["master", "develop"],
    "enabled": true
  },
  {
    "id": "filevine/other-project",
    "name": "Other Project",
    "branches": ["main"],
    "enabled": true
  }
]
```

### Alternative: projects.json

For better maintainability, use a separate configuration file:

**config/projects.json**
```json
{
  "projects": [
    {
      "id": "23559266",
      "name": "Filevine App",
      "description": "Main Filevine application",
      "branches": ["master", "develop"],
      "enabled": true,
      "autoGenerateUpdates": true,
      "notifyOn": ["merge", "issue", "epic"],
      "filters": {
        "includeAuthors": [],
        "excludeAuthors": [],
        "includeLabels": [],
        "excludeLabels": []
      }
    }
  ],
  "global": {
    "pollInterval": 300,
    "maxCommitsPerPoll": 20,
    "enableNotifications": false,
    "storageLocation": "./data/monitor"
  }
}
```

## Components

### 1. MonitorConfig

**Location**: `src/monitoring/config.ts`

Handles loading and validating project configurations.

```typescript
interface ProjectConfig {
  id: string | number;
  name: string;
  description?: string;
  branches: string[];
  enabled: boolean;
  autoGenerateUpdates?: boolean;
  notifyOn?: ('merge' | 'issue' | 'epic')[];
  filters?: {
    includeAuthors?: string[];
    excludeAuthors?: string[];
    includeLabels?: string[];
    excludeLabels?: string[];
  };
}

interface MonitorConfig {
  projects: ProjectConfig[];
  global: {
    pollInterval: number;
    maxCommitsPerPoll: number;
    enableNotifications: boolean;
    storageLocation: string;
  };
}
```

### 2. FeedMonitor

**Location**: `src/monitoring/feed-monitor.ts`

Polls GitLab for new commits across all configured projects.

**Features**:
- Uses GitLab Events API (`/projects/:id/events?action=pushed`)
- Falls back to Commits API (`/projects/:id/repository/commits`)
- Tracks last seen commit SHA per project/branch
- Implements exponential backoff on errors
- Supports manual polling and scheduled polling

**Methods**:
- `start()` - Start monitoring all projects
- `stop()` - Stop monitoring
- `pollProject(projectId)` - Poll a specific project
- `getStatus()` - Get current monitor status
- `onNewCommit(callback)` - Register callback for new commits

### 3. CommitProcessor

**Location**: `src/monitoring/commit-processor.ts`

Processes new commits detected by the monitor.

**Features**:
- Queue-based processing (handle bursts)
- Automatic retry on failures
- Concurrent processing with rate limiting
- Optional AI analysis and update generation
- Progress tracking

**Methods**:
- `process(commit)` - Process a single commit
- `processBatch(commits)` - Process multiple commits
- `getQueue()` - View processing queue
- `retry(commitSha)` - Retry a failed commit

### 4. MonitorStorage

**Location**: `src/monitoring/storage.ts`

Manages persistence of monitor state and results.

**Features**:
- SQLite database for persistence
- In-memory cache for recent data
- Schema versioning and migrations
- Export to JSON/CSV

**Tables**:
- `monitored_commits` - All processed commits
- `commit_chains` - Complete traced chains
- `stakeholder_updates` - Generated updates
- `monitor_state` - Last seen commits per project/branch
- `processing_log` - Processing history and errors

### 5. API Endpoints

**New endpoints in** `src/server/index.ts`:

```
GET  /api/monitor/status          - Get monitor status and stats
POST /api/monitor/start            - Start monitoring
POST /api/monitor/stop             - Stop monitoring
GET  /api/monitor/projects         - List configured projects
POST /api/monitor/projects/:id     - Update project configuration
GET  /api/monitor/commits          - Get monitored commits (with filters)
POST /api/monitor/poll/:projectId  - Manually trigger poll for project
GET  /api/monitor/queue            - View processing queue
POST /api/monitor/retry/:sha       - Retry failed commit
GET  /api/monitor/export           - Export monitored data
```

### 6. UI Updates

**New UI section**: "Monitored Commits"

- Real-time feed of new commits
- Filter by project, branch, author, date
- Processing status indicators
- Quick actions (view details, regenerate updates, export)
- Statistics dashboard

## Implementation Phases

### Phase 1: Basic Monitoring ✓
- [x] Configuration loader
- [x] Simple in-memory tracking
- [x] Poll single project
- [x] Process and store commits

### Phase 2: Multi-Project Support
- [ ] Support multiple projects
- [ ] Per-project configuration
- [ ] Branch filtering
- [ ] Better state management

### Phase 3: Advanced Features
- [ ] SQLite persistence
- [ ] Auto-generate updates
- [ ] Filtering and notifications
- [ ] Export functionality

### Phase 4: Production Ready
- [ ] Error recovery and retry
- [ ] Performance optimization
- [ ] Monitoring dashboard
- [ ] WebSocket real-time updates

## Data Flow

### New Commit Detection

```
1. Timer triggers poll (every 5 minutes)
2. FeedMonitor fetches recent commits for each project/branch
3. Compare with last seen commit SHA
4. Identify new commits
5. Emit "newCommit" event for each
```

### Commit Processing

```
1. CommitProcessor receives new commit
2. Add to processing queue
3. Run CommitTracer to build chain
4. Store chain in database
5. If configured, generate stakeholder updates
6. Store updates in database
7. Update monitor state (last seen commit)
8. Emit "commitProcessed" event
```

## Storage Schema

### SQLite Tables

```sql
-- Monitor state
CREATE TABLE monitor_state (
  id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  last_commit_sha TEXT,
  last_polled_at DATETIME,
  UNIQUE(project_id, branch)
);

-- Monitored commits
CREATE TABLE monitored_commits (
  id INTEGER PRIMARY KEY,
  sha TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  title TEXT,
  author_name TEXT,
  author_email TEXT,
  committed_at DATETIME,
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT
);

-- Commit chains
CREATE TABLE commit_chains (
  id INTEGER PRIMARY KEY,
  commit_sha TEXT UNIQUE NOT NULL,
  chain_json TEXT NOT NULL,  -- Full CommitChain as JSON
  traced_at DATETIME,
  mr_count INTEGER,
  issue_count INTEGER,
  epic_count INTEGER,
  FOREIGN KEY (commit_sha) REFERENCES monitored_commits(sha)
);

-- Stakeholder updates
CREATE TABLE stakeholder_updates (
  id INTEGER PRIMARY KEY,
  commit_sha TEXT UNIQUE NOT NULL,
  technical_update TEXT,
  business_update TEXT,
  generated_at DATETIME,
  model TEXT,
  tokens_used INTEGER,
  cost_usd REAL,
  FOREIGN KEY (commit_sha) REFERENCES monitored_commits(sha)
);
```

## Error Handling

### Polling Errors
- Log error with context
- Exponential backoff (1m, 2m, 4m, 8m, max 15m)
- Alert after 5 consecutive failures
- Continue monitoring other projects

### Processing Errors
- Mark commit as "processing_error"
- Store error message
- Retry up to 3 times with delay
- Allow manual retry via API

### API Rate Limiting
- Respect GitLab rate limits (300 req/min)
- Implement request queuing
- Add delays between requests
- Use ETag caching when possible

## Security Considerations

1. **Authentication**: API token must have read-only access
2. **Configuration**: Validate all project IDs and branches
3. **Storage**: Encrypt sensitive data in database
4. **Rate Limiting**: Prevent monitor from overwhelming GitLab API
5. **Access Control**: Require authentication to control monitor

## Performance Optimization

1. **Caching**: Cache recent API responses (ETags)
2. **Batching**: Process multiple commits in batches
3. **Concurrency**: Process multiple projects in parallel
4. **Indexing**: Database indexes on frequently queried fields
5. **Pruning**: Archive old data periodically

## Configuration Examples

### Single Project, Single Branch
```json
{
  "projects": [
    {
      "id": "23559266",
      "name": "Filevine App",
      "branches": ["master"],
      "enabled": true
    }
  ]
}
```

### Multiple Projects, Multiple Branches
```json
{
  "projects": [
    {
      "id": "23559266",
      "name": "Filevine App",
      "branches": ["master", "develop", "staging"],
      "enabled": true
    },
    {
      "id": "filevine/mobile-app",
      "name": "Mobile App",
      "branches": ["main"],
      "enabled": true
    }
  ]
}
```

### Advanced Filtering
```json
{
  "projects": [
    {
      "id": "23559266",
      "name": "Filevine App",
      "branches": ["master"],
      "enabled": true,
      "filters": {
        "excludeAuthors": ["dependabot", "renovate-bot"],
        "includeLabels": ["feature", "bugfix"]
      }
    }
  ]
}
```

## Next Steps

1. Create `config/projects.json` configuration file
2. Implement `MonitorConfig` loader
3. Implement `FeedMonitor` with basic polling
4. Implement `CommitProcessor` with queue
5. Add SQLite storage layer
6. Add API endpoints for monitor control
7. Update UI to show monitored commits
8. Add WebSocket support for real-time updates

## Future Enhancements

- **Webhooks**: Use GitLab webhooks instead of polling
- **Notifications**: Email, Slack, Teams integration
- **Analytics**: Commit velocity, epic progress tracking
- **Reports**: Weekly/monthly stakeholder reports
- **ML**: Pattern detection, anomaly detection
- **Multi-tenant**: Support multiple GitLab instances
