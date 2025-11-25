# Getting Started with GitLab Commit Tracer

This guide will help you quickly set up and test the GitLab API client.

## Prerequisites

1. **Node.js 18+** installed on your system
2. **GitLab Account** with access to a repository
3. **GitLab Personal Access Token** with API access

## Step 1: Create GitLab Personal Access Token

1. Go to GitLab → **Settings** → **Access Tokens**
   - GitLab.com: https://gitlab.com/-/user_settings/personal_access_tokens
   - Self-hosted: `https://your-gitlab.com/-/user_settings/personal_access_tokens`

2. Create a new token with these scopes:
   - ✅ `api` - Full API access
   - ✅ `read_repository` - Read repository data

3. Copy the token (you won't see it again!)

## Step 2: Install Dependencies

```bash
cd "Product Updates from GitLab"
npm install
```

This will install:
- `axios` - HTTP client for API requests
- `dotenv` - Environment variable management
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution for development

## Step 3: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your GitLab details:
```bash
# Your GitLab instance URL
GITLAB_URL=https://gitlab.com

# Your personal access token (from Step 1)
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx

# Your project (namespace/project-name or project ID)
GITLAB_PROJECT_ID=your-username/your-project

# Optional: AI configuration (for future phases)
# AI_API_KEY=
# AI_MODEL=gpt-4
```

**Finding Your Project ID/Path**:
- **Project Path**: In your project URL: `gitlab.com/namespace/project-name`
  - Example: `gitlab-org/gitlab`
- **Project ID**: In project Settings → General (numeric ID)
  - Example: `278964`

## Step 4: Test the Connection

Run the basic usage example:

```bash
npm run dev examples/basic-usage.ts
```

You should see output like:
```
=== GitLab Commit Tracer - Basic Usage Example ===

Testing connection to GitLab...
✓ Connected successfully

Fetching recent commits...
Found 5 commits:
  - abc123de: Fix authentication timeout
    Author: John Doe
    Date: 2025-11-24T10:30:00Z
    Stats: +15 -3

...
```

## Step 5: Try the API Client in Your Own Code

Create a new file `test-client.ts`:

```typescript
import { GitLabClient } from './src/api';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  // Initialize client
  const client = new GitLabClient({
    baseUrl: process.env.GITLAB_URL!,
    token: process.env.GITLAB_TOKEN!,
    projectId: process.env.GITLAB_PROJECT_ID,
  });

  // Test connection
  console.log('Testing connection...');
  const isConnected = await client.testConnection();
  console.log('Connected:', isConnected);

  // Fetch recent commits
  console.log('\nFetching commits...');
  const commits = await client.listCommits(undefined, { per_page: 3 });
  commits.data.forEach((c) => {
    console.log(`- ${c.short_id}: ${c.title}`);
  });

  // Get API stats
  console.log('\nAPI Stats:');
  const stats = client.getStats();
  console.log('Requests made:', stats.requestCount);
}

test().catch(console.error);
```

Run it:
```bash
npm run dev test-client.ts
```

## Common Issues & Solutions

### Issue: "401 Unauthorized"
**Solution**: Check your `GITLAB_TOKEN` in `.env`. Make sure:
- Token is valid and not expired
- Token has `api` scope enabled
- No extra spaces in the `.env` file

### Issue: "404 Not Found"
**Solution**: Check your `GITLAB_PROJECT_ID` in `.env`. Try:
- Using the full path: `namespace/project-name`
- URL-encoding if path has special characters
- Using the numeric project ID instead

### Issue: "Connection test failed"
**Solution**:
- Verify `GITLAB_URL` is correct (https://gitlab.com or your self-hosted URL)
- Check if you can access GitLab in your browser
- Ensure you're not behind a proxy that blocks API access

### Issue: "Cannot find module 'dotenv'"
**Solution**: Run `npm install` to install dependencies

### Issue: TypeScript errors
**Solution**: Run `npm run build` to compile TypeScript first, or use `npm run dev` which uses `tsx`

## API Client Usage Patterns

### Pattern 1: Fetch and Display Commits

```typescript
const commits = await client.listCommits(undefined, {
  per_page: 10,
  ref_name: 'main', // or 'master', or any branch
  since: '2025-11-01T00:00:00Z',
});

for (const commit of commits.data) {
  console.log(`${commit.short_id}: ${commit.title}`);
  console.log(`  By: ${commit.author_name} at ${commit.created_at}`);
}
```

### Pattern 2: Trace a Commit to Its MR

```typescript
const commitSha = 'abc123def456';

// Get commit details
const commit = await client.getCommit(commitSha);
console.log(`Commit: ${commit.title}`);

// Find MRs that introduced this commit
const mrs = await client.getCommitMergeRequests(commitSha);
if (mrs.length > 0) {
  console.log(`Introduced in MR !${mrs[0].iid}: ${mrs[0].title}`);
}
```

### Pattern 3: Find Issues Closed by an MR

```typescript
const mrIid = 42; // Merge Request internal ID

const mr = await client.getMergeRequest(mrIid);
console.log(`MR: ${mr.title}`);

const issues = await client.getMergeRequestClosesIssues(mrIid);
console.log(`Closes ${issues.length} issue(s):`);
for (const issue of issues) {
  console.log(`  - #${issue.iid}: ${issue.title}`);
}
```

### Pattern 4: Full Chain Traversal

```typescript
// Start with a commit SHA
const commitSha = 'abc123';

// Step 1: Get MRs
const mrs = await client.getCommitMergeRequests(commitSha);

// Step 2: For each MR, get issues
for (const mr of mrs) {
  const issues = await client.getMergeRequestClosesIssues(mr.iid);

  // Step 3: For each issue, check for epic
  for (const issue of issues) {
    if (issue.epic) {
      // Step 4: Get epic details
      const epic = await client.getEpic(
        issue.epic.group_id,
        issue.epic.iid
      );

      console.log('Chain:');
      console.log(`  Commit: ${commitSha}`);
      console.log(`  → MR !${mr.iid}: ${mr.title}`);
      console.log(`  → Issue #${issue.iid}: ${issue.title}`);
      console.log(`  → Epic &${epic.iid}: ${epic.title}`);
    }
  }
}
```

### Pattern 5: Error Handling

```typescript
try {
  const commit = await client.getCommit('invalid-sha');
} catch (error: any) {
  if (error.status === 404) {
    console.error('Commit not found');
  } else if (error.status === 401) {
    console.error('Authentication failed - check your token');
  } else if (error.status === 403) {
    console.error('Permission denied - token may need more scopes');
  } else if (error.status === 429) {
    console.error('Rate limit exceeded - wait and retry');
  } else {
    console.error('API error:', error.message);
  }
}
```

## Next Steps

Once you've verified the API client works:

1. **Explore the API**: Try different methods in `GitLabClient`
   - See [src/api/README.md](src/api/README.md) for full API documentation

2. **Read the Documentation**:
   - [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) - Project overview
   - [docs/architecture.md](docs/architecture.md) - System architecture
   - [docs/gitlab-api.md](docs/gitlab-api.md) - API details

3. **Start Phase 2**: Implement the tracing module
   - See [src/tracing/README.md](src/tracing/README.md) for the plan

4. **Write Tests**: Add unit and integration tests
   - Use the `tests/` directory

## API Rate Limits

GitLab has rate limits:
- **Authenticated requests**: 2000/minute (varies by instance)
- **Unauthenticated**: 10/minute per IP

The client automatically:
- Paces requests (min 100ms between calls)
- Retries on rate limit errors
- Respects `Retry-After` headers

Check current rate limit:
```typescript
const rateLimit = client.getRateLimitInfo();
console.log('Remaining:', rateLimit.remaining);
console.log('Resets at:', rateLimit.reset);
```

## Getting Help

- **GitLab API Docs**: https://docs.gitlab.com/ee/api/
- **Project Issues**: See the issues in your GitLab repository
- **Code Comments**: The source code has extensive JSDoc comments

## Troubleshooting Script

Create `troubleshoot.ts` to diagnose issues:

```typescript
import { GitLabClient } from './src/api';
import dotenv from 'dotenv';

dotenv.config();

console.log('Environment Check:');
console.log('- GITLAB_URL:', process.env.GITLAB_URL || '❌ NOT SET');
console.log('- GITLAB_TOKEN:', process.env.GITLAB_TOKEN ? '✓ SET' : '❌ NOT SET');
console.log('- GITLAB_PROJECT_ID:', process.env.GITLAB_PROJECT_ID || '❌ NOT SET');

async function diagnose() {
  try {
    const client = new GitLabClient({
      baseUrl: process.env.GITLAB_URL!,
      token: process.env.GITLAB_TOKEN!,
    });

    console.log('\nTesting connection...');
    const connected = await client.testConnection();
    if (connected) {
      console.log('✓ Connection successful!');

      if (process.env.GITLAB_PROJECT_ID) {
        console.log('\nTesting project access...');
        const commits = await client.listCommits(undefined, { per_page: 1 });
        console.log(`✓ Can access project (${commits.data.length} commit found)`);
      }
    } else {
      console.log('❌ Connection failed');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error('   Status:', error.status);
    }
  }
}

diagnose();
```

Run: `npm run dev troubleshoot.ts`

---

**Ready to code?** Start exploring the API client and begin building the tracing module!
