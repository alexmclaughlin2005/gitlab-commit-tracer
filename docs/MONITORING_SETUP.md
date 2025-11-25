# GitLab Commit Monitoring - Setup Guide

## Overview

The monitoring system automatically polls GitLab projects for new commits and traces them through the development lifecycle. This guide covers the initial setup for monitoring multiple projects.

## What We've Built So Far

### ✅ Completed Components

1. **Design Document** ([MONITORING_DESIGN.md](./MONITORING_DESIGN.md))
   - Complete architecture design
   - Data flow diagrams
   - Storage schema
   - Implementation phases

2. **Type System** ([src/monitoring/types.ts](../src/monitoring/types.ts))
   - `ProjectConfig` - Configuration for each monitored project
   - `MonitorConfig` - Complete monitoring configuration
   - `MonitorState` - Runtime state tracking
   - `DetectedCommit` - New commits found
   - `QueuedCommit` - Commits in processing queue
   - `MonitorStats` - System statistics

3. **Configuration System** ([src/monitoring/config.ts](../src/monitoring/config.ts))
   - `MonitorConfigLoader` class
   - JSON configuration file support
   - Validation and error handling
   - CRUD operations for projects
   - Hot-reload capability

4. **Configuration Files**
   - [config/projects.example.json](../config/projects.example.json) - Template
   - [config/projects.json](../config/projects.json) - Active configuration

## Configuration Structure

### Example: Single Project

```json
{
  "projects": [
    {
      "id": "23559266",
      "name": "Filevine App",
      "description": "Main Filevine application",
      "branches": ["master"],
      "enabled": true,
      "autoGenerateUpdates": false,
      "filters": {
        "excludeAuthors": []
      }
    }
  ],
  "global": {
    "pollIntervalSeconds": 300,
    "maxCommitsPerPoll": 20,
    "enableNotifications": false,
    "storageLocation": "./data/monitor"
  }
}
```

### Example: Multiple Projects

```json
{
  "projects": [
    {
      "id": "23559266",
      "name": "Filevine App",
      "branches": ["master", "develop"],
      "enabled": true,
      "autoGenerateUpdates": true
    },
    {
      "id": "filevine/mobile-app",
      "name": "Mobile App",
      "branches": ["main"],
      "enabled": true,
      "autoGenerateUpdates": false
    },
    {
      "id": "12345678",
      "name": "Backend API",
      "branches": ["production"],
      "enabled": false,
      "filters": {
        "excludeAuthors": ["dependabot", "renovate"]
      }
    }
  ],
  "global": {
    "pollIntervalSeconds": 180,
    "maxCommitsPerPoll": 50,
    "enableNotifications": false,
    "storageLocation": "./data/monitor"
  }
}
```

## Configuration Fields

### Project Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string\|number | ✓ | GitLab project ID or path (e.g., "23559266" or "namespace/project") |
| `name` | string | ✓ | Human-readable project name |
| `description` | string | ✗ | Optional project description |
| `branches` | string[] | ✓ | List of branches to monitor (e.g., ["master", "main"]) |
| `enabled` | boolean | ✓ | Whether to actively monitor this project |
| `autoGenerateUpdates` | boolean | ✗ | Auto-generate stakeholder updates (default: false) |
| `filters.includeAuthors` | string[] | ✗ | Only process commits from these authors |
| `filters.excludeAuthors` | string[] | ✗ | Skip commits from these authors (e.g., bots) |
| `filters.includeLabels` | string[] | ✗ | Only process commits with these labels |
| `filters.excludeLabels` | string[] | ✗ | Skip commits with these labels |

### Global Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pollIntervalSeconds` | number | ✓ | How often to check for new commits (minimum: 60) |
| `maxCommitsPerPoll` | number | ✓ | Max commits to fetch per poll (1-100) |
| `enableNotifications` | boolean | ✗ | Enable notifications (future feature, default: false) |
| `storageLocation` | string | ✗ | Where to store monitor data (default: "./data/monitor") |

## Setting Up Monitoring

### Step 1: Configure Projects

Edit [config/projects.json](../config/projects.json):

```json
{
  "projects": [
    {
      "id": "YOUR_PROJECT_ID",
      "name": "Your Project Name",
      "branches": ["master"],
      "enabled": true
    }
  ],
  "global": {
    "pollIntervalSeconds": 300,
    "maxCommitsPerPoll": 20,
    "enableNotifications": false,
    "storageLocation": "./data/monitor"
  }
}
```

### Step 2: Find Your Project ID

You can use either:
- **Numeric ID**: Found in project settings or URL
- **Path**: Full project path like `namespace/group/project`

To find your project ID:

```bash
# Using the API
curl -H "PRIVATE-TOKEN: your_token" \
  "https://gitlab.com/api/v4/projects/namespace%2Fproject"
```

Or visit your project page and look in the sidebar under "Project ID".

### Step 3: Configure Branches

Add all branches you want to monitor:

```json
"branches": ["master", "develop", "staging", "production"]
```

### Step 4: Set Polling Interval

Choose based on your needs:

- **300 seconds (5 minutes)**: Good for active development
- **600 seconds (10 minutes)**: Good for moderate activity
- **1800 seconds (30 minutes)**: Good for less active projects

**Note**: Shorter intervals = more API calls. GitLab has rate limits (300 requests/minute).

### Step 5: Configure Filters (Optional)

Exclude bot commits:

```json
"filters": {
  "excludeAuthors": [
    "dependabot",
    "renovate-bot",
    "github-actions"
  ]
}
```

## What's Next

### To Implement (Remaining Components)

1. **Feed Monitor Service** ([src/monitoring/feed-monitor.ts](../src/monitoring/feed-monitor.ts))
   - Poll GitLab API for new commits
   - Track last seen commit per project/branch
   - Detect and emit new commit events
   - Handle errors and retries

2. **Commit Processor** ([src/monitoring/commit-processor.ts](../src/monitoring/commit-processor.ts))
   - Queue-based processing
   - Run CommitTracer for each commit
   - Optional: Generate stakeholder updates
   - Store results

3. **Storage Layer** ([src/monitoring/storage.ts](../src/monitoring/storage.ts))
   - SQLite database for persistence
   - Store monitored commits
   - Store traced chains
   - Store stakeholder updates
   - Track monitor state

4. **API Endpoints** ([src/server/index.ts](../src/server/index.ts))
   - `GET /api/monitor/status` - Get monitor status
   - `POST /api/monitor/start` - Start monitoring
   - `POST /api/monitor/stop` - Stop monitoring
   - `GET /api/monitor/commits` - List monitored commits
   - `POST /api/monitor/poll/:projectId` - Manual poll
   - And more...

5. **UI Updates** ([ui/public/index.html](../ui/public/index.html))
   - Monitored commits feed
   - Monitor control panel
   - Statistics dashboard
   - Real-time updates (WebSocket)

## Usage Examples

### Using MonitorConfigLoader

```typescript
import { MonitorConfigLoader } from './monitoring/config';

// Load configuration
const loader = new MonitorConfigLoader();
const config = loader.load();

console.log('Monitoring', config.projects.length, 'projects');

// Get enabled projects only
const enabled = loader.getEnabledProjects();
console.log('Enabled:', enabled.length);

// Get specific project
const project = loader.getProject('23559266');
if (project) {
  console.log('Project:', project.name);
  console.log('Branches:', project.branches);
}

// Update project
loader.updateProject('23559266', {
  enabled: false,
  branches: ['master', 'develop'],
});

// Add new project
loader.addProject({
  id: 'new-project',
  name: 'New Project',
  branches: ['main'],
  enabled: true,
});

// Reload configuration
const updated = loader.reload();
```

## Validation Rules

The configuration loader validates:

1. **Required Fields**: All required fields must be present
2. **Type Checking**: Fields must be correct types
3. **Poll Interval**: Must be at least 60 seconds
4. **Max Commits**: Must be between 1 and 100
5. **Branches**: Must have at least one branch
6. **Duplicate IDs**: Project IDs must be unique

## Error Messages

Common errors and solutions:

### "Configuration file not found"

**Solution**: Create `config/projects.json` by copying `config/projects.example.json`

```bash
cp config/projects.example.json config/projects.json
```

### "Missing required field 'id'"

**Solution**: Ensure each project has an `id` field:

```json
{
  "id": "23559266",
  "name": "My Project",
  ...
}
```

### "pollIntervalSeconds must be at least 60 seconds"

**Solution**: Set poll interval to at least 60:

```json
{
  "global": {
    "pollIntervalSeconds": 300,
    ...
  }
}
```

## Best Practices

### 1. Start Small

Begin with one project and one branch:

```json
{
  "projects": [{
    "id": "23559266",
    "name": "Main Project",
    "branches": ["master"],
    "enabled": true
  }]
}
```

### 2. Use Reasonable Poll Intervals

- Don't poll too frequently (API rate limits)
- 5 minutes (300s) is a good starting point
- Adjust based on commit frequency

### 3. Exclude Bot Commits

Save API calls and processing time:

```json
"filters": {
  "excludeAuthors": ["dependabot", "renovate", "bot"]
}
```

### 4. Disable Unused Projects

Instead of deleting, set `enabled: false`:

```json
{
  "id": "old-project",
  "enabled": false
}
```

### 5. Monitor Key Branches Only

Don't monitor every branch:

```json
"branches": ["master", "production"]
```

## File Locations

```
project-root/
├── config/
│   ├── projects.json          # Your configuration
│   └── projects.example.json  # Template
├── src/
│   └── monitoring/
│       ├── types.ts            # Type definitions
│       ├── config.ts           # Configuration loader
│       ├── feed-monitor.ts     # (TODO) Monitor service
│       ├── commit-processor.ts # (TODO) Processor
│       └── storage.ts          # (TODO) Database
├── data/
│   └── monitor/               # Generated: Monitor data
│       └── monitor.db         # SQLite database
└── docs/
    ├── MONITORING_DESIGN.md   # Architecture design
    └── MONITORING_SETUP.md    # This file
```

## Next Steps

To continue implementation:

1. **Implement FeedMonitor**: Create the polling service
2. **Implement CommitProcessor**: Create the processing queue
3. **Implement Storage**: Add SQLite database
4. **Add API Endpoints**: Expose monitor control
5. **Update UI**: Add monitoring dashboard

See [MONITORING_DESIGN.md](./MONITORING_DESIGN.md) for complete architecture details.

## Questions?

- See design document: [MONITORING_DESIGN.md](./MONITORING_DESIGN.md)
- Check type definitions: [src/monitoring/types.ts](../src/monitoring/types.ts)
- Review configuration loader: [src/monitoring/config.ts](../src/monitoring/config.ts)

---

**Status**: Configuration system complete ✅
**Next**: Implement Feed Monitor Service
