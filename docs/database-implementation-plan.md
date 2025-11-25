# Database Implementation Plan

## Overview

This document outlines the step-by-step plan to add PostgreSQL persistence to the GitLab Commit Tracer application.

## Phase 1: Database Setup (Railway)

### Step 1.1: Create PostgreSQL Database on Railway
1. Go to Railway dashboard
2. Click "New" → "Database" → "Add PostgreSQL"
3. Note the connection details:
   - `DATABASE_URL` (connection string)
   - Host, Port, Database, Username, Password
4. Add to Railway environment variables

### Step 1.2: Update Environment Configuration
Add to `.env.example` and Railway environment:
```env
# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

## Phase 2: Install Dependencies

Install required packages:
```bash
npm install pg              # PostgreSQL client
npm install drizzle-orm     # Type-safe ORM
npm install drizzle-kit     # Migration tool

# Dev dependencies
npm install -D @types/pg
```

### Why Drizzle ORM?
- Type-safe SQL queries
- Excellent TypeScript support
- Lightweight (no heavy runtime)
- Easy migrations
- Works well with existing code

## Phase 3: Database Layer Implementation

### Step 3.1: Create Database Connection
**File**: `src/db/connection.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
  min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
});

export const db = drizzle(pool);
export { pool };
```

### Step 3.2: Define Database Schema
**File**: `src/db/schema.ts`

Define all tables using Drizzle schema definitions matching the design in `database-schema.md`.

### Step 3.3: Create Migration Files
**File**: `drizzle.config.ts` (root)

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

Generate initial migration:
```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

### Step 3.4: Create Repository Layer
**Files**:
- `src/db/repositories/commit-repository.ts`
- `src/db/repositories/chain-repository.ts`
- `src/db/repositories/analysis-repository.ts`
- `src/db/repositories/team-repository.ts`
- `src/db/repositories/epic-repository.ts`

Each repository handles CRUD operations for its entity.

## Phase 4: Integration with Existing Code

### Step 4.1: Update Monitoring System
**File**: `src/server/index.ts`

Modify the `commitProcessed` event handler to persist data:

```typescript
commitProcessor.on('commitProcessed', (event: any, chain?: CommitChain) => {
  if (event.success && chain) {
    // Store existing in-memory data
    const existing = monitoredCommits.get(event.commit.sha);
    if (existing) {
      existing.chain = chain;
    }

    // PERSIST TO DATABASE
    (async () => {
      try {
        await commitRepository.saveCommitWithChain(event.commit, chain);
        console.log(`💾 Persisted commit ${event.commit.sha.substring(0, 8)} to database`);
      } catch (error) {
        console.error(`Failed to persist commit:`, error);
      }
    })();

    // Continue with AI analysis...
  }
});
```

### Step 4.2: Update AI Analysis Storage
After generating stakeholder updates, persist analysis and updates:

```typescript
const analysisResult = await analyzer.analyzeCommitWithUpdates(chain);

// Store in memory (existing)
existing.analysis = analysisResult.analysis;
existing.updates = analysisResult.updates;

// PERSIST TO DATABASE
await analysisRepository.saveAnalysis(event.commit.sha, analysisResult.analysis);
await updatesRepository.saveUpdates(event.commit.sha, analysisResult.updates);
```

### Step 4.3: Create Helper Functions
**File**: `src/db/helpers.ts`

```typescript
/**
 * Extract team name from labels
 * Pattern: team::backend → "backend"
 */
export function extractTeamFromLabels(labels: string[]): string | null {
  const teamLabel = labels.find(l => l.toLowerCase().startsWith('team::'));
  return teamLabel ? teamLabel.substring(6) : null;
}

/**
 * Ensure team exists in database, create if needed
 */
export async function ensureTeam(teamName: string): Promise<number> {
  // Check if exists, create if not, return ID
}

/**
 * Extract all unique teams from a commit chain
 */
export function extractTeamsFromChain(chain: CommitChain): string[] {
  const teams = new Set<string>();
  for (const issueLink of chain.issues) {
    const team = extractTeamFromLabels(issueLink.issue.labels);
    if (team) teams.add(team);
  }
  return Array.from(teams);
}
```

## Phase 5: API Endpoints for Historical Data

### Step 5.1: Team-Based Queries
**File**: `src/server/index.ts` (add endpoints)

```typescript
// GET /api/teams
// Returns list of all teams with commit counts

// GET /api/teams/:teamName/commits
// Returns commits for a specific team with pagination
// Query params: limit, offset, since, until

// GET /api/teams/:teamName/stats
// Returns statistics for a team (commits, epics, alignment)
```

### Step 5.2: Epic-Based Queries

```typescript
// GET /api/epics
// Returns list of all epics with commit counts

// GET /api/epics/:epicId/commits
// Returns commits for a specific epic with pagination

// GET /api/epics/:epicId/stats
// Returns statistics for an epic
```

### Step 5.3: Search and Filter

```typescript
// GET /api/commits/search
// Search commits by text, author, date range, team, epic
// Query params: q, author, team, epic, since, until, limit, offset
```

## Phase 6: UI Implementation

### Step 6.1: Navigation
Update `ui/public/index.html` to add navigation tabs:
- Dashboard (existing monitoring view)
- By Team (new)
- By Epic (new)

### Step 6.2: Team View Page
**Section**: Team-based view

Display:
- List of all teams (sidebar or dropdown)
- Selected team's commits with business updates
- Timeline view by date
- Filter by date range
- Search within team

### Step 6.3: Epic View Page
**Section**: Epic-based view

Display:
- List of all epics (grouped by state: open/closed)
- Selected epic's commits with business updates
- Progress indicators (# commits, alignment stats)
- Related teams

### Step 6.4: Commit Detail Modal
Clicking any commit shows full detail:
- Technical and business updates
- Full chain visualization
- MRs, Issues, Epics linked
- Teams involved
- Analysis confidence

## Phase 7: Data Migration & Backfill

### Step 7.1: Backfill Script
**File**: `scripts/backfill-database.ts`

Migrate existing in-memory data to database:
```typescript
// Read current monitoredCommits Map
// For each commit:
//   - Save commit, chain, analysis, updates
//   - Extract and save teams
//   - Link all relationships
```

### Step 7.2: Materialized View Refresh
Set up periodic refresh (Railway cron or in-app):
```typescript
// Every 5 minutes:
await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY commits_by_team`);
await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY commits_by_epic`);
```

## Phase 8: Testing & Deployment

### Step 8.1: Local Testing
1. Start local PostgreSQL (Docker recommended)
2. Run migrations
3. Test data persistence
4. Test queries and views

### Step 8.2: Railway Deployment
1. Push database configuration
2. Run migrations on Railway database
3. Deploy updated application
4. Monitor logs for database errors

### Step 8.3: Verification
- Verify commits are being persisted
- Check team/epic views load correctly
- Test pagination and filtering
- Verify materialized views are refreshing

## Implementation Order

### Sprint 1: Foundation (Day 1-2)
1. ✅ Design schema (DONE)
2. Set up Railway PostgreSQL
3. Install dependencies
4. Create connection and schema files
5. Generate and run migrations

### Sprint 2: Persistence (Day 3-4)
6. Create repository layer
7. Integrate with monitoring system
8. Test data persistence
9. Backfill existing data

### Sprint 3: APIs (Day 5)
10. Create team-based API endpoints
11. Create epic-based API endpoints
12. Test queries and performance

### Sprint 4: UI (Day 6-7)
13. Add navigation tabs
14. Build team view page
15. Build epic view page
16. Add filtering and search

### Sprint 5: Polish (Day 8)
17. Performance optimization
18. Error handling
19. Documentation updates
20. Deploy to production

## Risk Mitigation

### Database Connection Failures
- Use connection pooling
- Implement retry logic
- Fall back to in-memory if database unavailable
- Log all database errors

### Migration Issues
- Test migrations locally first
- Keep old code working during migration
- Gradual rollout (database writes first, reads later)

### Performance
- Use indexes strategically
- Implement pagination everywhere
- Use materialized views for expensive queries
- Monitor query performance

## Success Metrics

- [ ] All new commits are persisted to database
- [ ] Team view shows commits organized by team
- [ ] Epic view shows commits organized by epic
- [ ] Query response time < 500ms for paginated views
- [ ] Zero data loss during migration
- [ ] UI responsive with historical data

## Next Steps

After completing this implementation, we can add:
1. Analytics dashboard (trends, metrics)
2. Email notifications for teams
3. Slack integration for updates
4. Export functionality (CSV, PDF)
5. Advanced search with full-text search
