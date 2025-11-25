# Tracing Module

This module implements the logic for tracing commits through the development lifecycle.

## Purpose

- Link commits to their parent merge requests
- Link merge requests to their related issues
- Link issues to their parent epics
- Build complete relationship chains

## Structure

- `commit-tracer.ts` - Main CommitTracer class with chain building logic
- `chain-cache.ts` - In-memory cache for API responses
- `types.ts` - TypeScript type definitions for chains and tracing
- `index.ts` - Module exports

## Flow

```
Commit (SHA)
    ↓ (via getCommitMergeRequests)
Merge Request (IID)
    ↓ (via getMergeRequestClosesIssues)
Issue (IID)
    ↓ (via issue.epic property)
Epic (ID)
    ↓ (via getEpic)
Epic Details
```

## Tracing Strategy

The `CommitTracer` class automates the complete tracing process:

1. **Commit → MR**: Uses GitLab API endpoint `/commits/:sha/merge_requests`
2. **MR → Issue**: Uses `/merge_requests/:iid/closes_issues` endpoint
3. **Issue → Related MRs**: Optionally uses `/issues/:iid/related_merge_requests`
4. **Issue → Epic**: Extracts epic from issue response, fetches full epic details
5. **Caching**: Caches all API responses to reduce redundant requests

## Usage

### Basic Tracing

```typescript
import { CommitTracer } from './tracing';
import { GitLabClient } from './api';

// Create client and tracer
const client = new GitLabClient({
  baseUrl: process.env.GITLAB_URL!,
  token: process.env.GITLAB_TOKEN!,
  projectId: 'my-project',
});

const tracer = new CommitTracer(client);

// Trace a single commit
const chain = await tracer.traceCommit('abc123def456');

console.log('Commit:', chain.commit.title);
console.log('Merge Requests:', chain.mergeRequests.length);
console.log('Issues:', chain.issues.length);
console.log('Epics:', chain.epics.length);

// Check metadata
console.log('API calls made:', chain.metadata.apiCallCount);
console.log('Duration:', chain.metadata.durationMs, 'ms');
console.log('Warnings:', chain.metadata.warnings);
```

### Batch Tracing

```typescript
// Trace multiple commits
const result = await tracer.traceCommits([
  'abc123',
  'def456',
  'ghi789',
]);

console.log('Successfully traced:', result.summary.successCount);
console.log('Failures:', result.summary.failureCount);
console.log('Total API calls:', result.summary.totalApiCalls);

// Access individual chains
for (const chain of result.chains) {
  console.log(`${chain.commit.short_id}: ${chain.issues.length} issues`);
}
```

### Trace Recent Commits

```typescript
// Trace last 10 commits from main branch
const result = await tracer.traceRecentCommits(10, 'my-project', 'main');

console.log('Traced', result.chains.length, 'commits');
```

### With Options

```typescript
const tracer = new CommitTracer(client, {
  includeEpics: true, // Fetch epic details
  followRelatedMRs: true, // Follow all related MRs for issues
  continueOnError: true, // Don't fail on individual errors
  onProgress: (step) => {
    console.log(`[${step.success ? 'OK' : 'FAIL'}] ${step.name}: ${step.result}`);
  },
});
```

### Accessing Chain Data

```typescript
const chain = await tracer.traceCommit('abc123');

// Access commit
console.log('Commit message:', chain.commit.message);
console.log('Author:', chain.commit.author_name);

// Access merge requests
for (const mrLink of chain.mergeRequests) {
  console.log('MR !', mrLink.mergeRequest.iid, ':', mrLink.mergeRequest.title);
  console.log('  Closes', mrLink.closesIssues.length, 'issues');
}

// Access issues
for (const issueLink of chain.issues) {
  console.log('Issue #', issueLink.issue.iid, ':', issueLink.issue.title);
  console.log('  Labels:', issueLink.issue.labels);

  if (issueLink.epic) {
    console.log('  Epic:', issueLink.epic.title);
  }
}

// Access epics
for (const epic of chain.epics) {
  console.log('Epic &', epic.iid, ':', epic.title);
  console.log('  Description:', epic.description?.substring(0, 100));
}
```

### Using Cache

```typescript
import { ChainCache } from './tracing';

const cache = new ChainCache(300); // 5 minute TTL

// Cache is automatically used by CommitTracer if useCache option is true
const tracer = new CommitTracer(client, {
  useCache: true,
  cacheTTL: 300,
});

// Check cache stats
const stats = cache.getStats();
console.log('Cache hit rate:', (stats.hitRate * 100).toFixed(2), '%');
console.log('Cache size:', stats.size, 'entries');

// Clear cache
cache.clearExpired(); // Clear only expired
cache.clearAll(); // Clear everything
```

### Progress Tracking

```typescript
const tracer = new CommitTracer(client, {
  onProgress: (step) => {
    console.log(`[${step.name}]`);
    console.log(`  Started: ${step.startedAt.toISOString()}`);
    console.log(`  Duration: ${step.durationMs}ms`);
    console.log(`  Success: ${step.success}`);
    console.log(`  Result: ${step.result}`);

    if (step.error) {
      console.error(`  Error: ${step.error}`);
    }
  },
});

// Progress callback will be called for each tracing step
const chain = await tracer.traceCommit('abc123');
```

### Error Handling

```typescript
try {
  const chain = await tracer.traceCommit('invalid-sha');
} catch (error) {
  console.error('Tracing failed:', error.message);

  // Check for partial results in batch operations
  const result = await tracer.traceCommits(['abc123', 'invalid', 'def456']);

  console.log('Successes:', result.summary.successCount);
  console.log('Failures:', result.summary.failureCount);

  for (const failure of result.failures) {
    console.error(`Failed to trace ${failure.commitSha}:`, failure.error.message);
  }
}
```

## Chain Structure

A `CommitChain` contains:

- **commit**: The commit object
- **mergeRequests**: Array of `MergeRequestLink` objects
  - Each link includes the MR and the issues it closes
- **issues**: Array of `IssueLink` objects
  - Each link includes the issue, related MRs, and epic
- **epics**: Array of unique epics across all issues
- **metadata**: Tracing metadata
  - `tracedAt`: Timestamp
  - `durationMs`: How long tracing took
  - `apiCallCount`: Number of API calls made
  - `isComplete`: Whether the chain is complete
  - `warnings`: Any warnings encountered
  - `steps`: Detailed step-by-step trace log

## Performance Considerations

- **Caching**: Use the cache to avoid redundant API calls
- **Batch Operations**: Trace multiple commits with `traceCommits()`
- **Options**: Set `includeEpics: false` if you don't need epic details
- **Error Handling**: Use `continueOnError: true` for batch operations
- **Rate Limiting**: The underlying GitLabClient handles rate limiting automatically

## Future Enhancements

- Persistent cache (Redis, file-based)
- Parallel batch processing
- Chain statistics and analytics
- Pattern detection (common issues, epic progress)
