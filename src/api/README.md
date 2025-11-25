# API Module

This module handles all interactions with the GitLab API.

## Purpose

- Establish and manage connections to GitLab API
- Fetch commits, merge requests, issues, and epics
- Handle authentication and rate limiting
- Provide typed interfaces for GitLab data structures

## Structure

- `gitlab-client.ts` - Main GitLab API client class with authentication and rate limiting
- `types.ts` - TypeScript interfaces for all GitLab API responses
- `index.ts` - Module exports

## Usage

### Basic Setup

```typescript
import { GitLabClient } from './api';

// Create client instance
const client = new GitLabClient({
  baseUrl: 'https://gitlab.com',
  token: process.env.GITLAB_TOKEN,
  projectId: 'namespace/project-name', // Optional default project
});

// Test connection
const isConnected = await client.testConnection();
console.log('Connected:', isConnected);
```

### Fetching Commits

```typescript
// List recent commits
const commits = await client.listCommits('my-project', {
  per_page: 10,
  ref_name: 'main',
});

console.log(`Found ${commits.data.length} commits`);
commits.data.forEach(commit => {
  console.log(`${commit.short_id}: ${commit.title}`);
});

// Get specific commit
const commit = await client.getCommit('abc123def456', 'my-project');
console.log(`Commit by ${commit.author_name}: ${commit.message}`);

// Find merge requests for a commit
const mrs = await client.getCommitMergeRequests('abc123def456', 'my-project');
console.log(`Commit introduced in ${mrs.length} merge request(s)`);
```

### Fetching Merge Requests

```typescript
// List merge requests
const mrs = await client.listMergeRequests('my-project', {
  state: 'merged',
  per_page: 20,
});

// Get specific merge request
const mr = await client.getMergeRequest(42, 'my-project');
console.log(`MR !${mr.iid}: ${mr.title}`);

// Get issues closed by MR
const issues = await client.getMergeRequestClosesIssues(42, 'my-project');
console.log(`This MR closes ${issues.length} issue(s)`);
```

### Fetching Issues

```typescript
// List issues
const issues = await client.listIssues('my-project', {
  state: 'opened',
  labels: 'bug,critical',
});

// Get specific issue
const issue = await client.getIssue(123, 'my-project');
console.log(`Issue #${issue.iid}: ${issue.title}`);

// Check for epic (Premium/Ultimate only)
if (issue.epic) {
  console.log(`Part of epic: ${issue.epic.title}`);
}

// Get related merge requests
const relatedMRs = await client.getIssueRelatedMergeRequests(123, 'my-project');
```

### Fetching Epics (Premium/Ultimate)

```typescript
// Get specific epic
const epic = await client.getEpic('my-group', 5);
console.log(`Epic &${epic.iid}: ${epic.title}`);

// List epics
const epics = await client.listEpics('my-group', {
  state: 'opened',
});
```

### Rate Limiting & Statistics

```typescript
// Check rate limit status
const rateLimit = client.getRateLimitInfo();
console.log('Rate limit remaining:', rateLimit.remaining);

// Get usage statistics
const stats = client.getStats();
console.log('Requests made:', stats.requestCount);
```

### Error Handling

```typescript
try {
  const commit = await client.getCommit('invalid-sha');
} catch (error) {
  if (error.status === 404) {
    console.error('Commit not found');
  } else if (error.status === 401) {
    console.error('Authentication failed');
  } else {
    console.error('API error:', error.message);
  }
}
```

## GitLab API Resources

This module will interact with the following GitLab API endpoints:

- `/projects/:id/repository/commits` - Fetch commits
- `/projects/:id/merge_requests` - Fetch merge requests
- `/projects/:id/issues` - Fetch issues
- `/groups/:id/epics` - Fetch epics (requires GitLab Premium)

## Authentication

Uses GitLab Personal Access Token with required scopes:
- `api` - Full API access
- `read_repository` - Read repository data
