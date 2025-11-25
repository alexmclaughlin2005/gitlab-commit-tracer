# Database Layer

This directory contains the database persistence layer using PostgreSQL and Drizzle ORM.

## Files

- **`connection.ts`** - Database connection pool and Drizzle instance
- **`schema.ts`** - Drizzle schema definitions for all tables
- **`repositories/`** - Repository classes for data access

## Database Commands

```bash
# Generate migration files from schema changes
npm run db:generate

# Push schema to database (apply migrations)
npm run db:push

# Open Drizzle Studio (visual database browser)
npm run db:studio
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string from Railway

Optional:
- `DATABASE_POOL_MIN` - Minimum connections in pool (default: 2)
- `DATABASE_POOL_MAX` - Maximum connections in pool (default: 10)

## Schema Overview

### Core Tables
- `projects` - Monitored GitLab projects
- `teams` - Extracted from issue labels (team::*)
- `epics` - GitLab epics
- `issues` - GitLab issues
- `merge_requests` - GitLab merge requests
- `commits` - Git commits

### Relationship Tables
- `commit_chains` - Denormalized commit relationships for fast queries
- `commit_merge_requests` - Normalized commit→MR links
- `merge_request_issues` - Normalized MR→Issue links

### Analysis Tables
- `analyses` - AI analysis results
- `stakeholder_updates` - Generated technical/business updates

## Usage Example

```typescript
import { db } from './db/connection';
import { commits } from './db/schema';
import { eq } from 'drizzle-orm';

// Query commits
const recentCommits = await db.select()
  .from(commits)
  .orderBy(commits.discoveredAt)
  .limit(10);

// Insert commit
await db.insert(commits).values({
  sha: 'abc123',
  projectId: 'my-project',
  title: 'Fix bug',
  // ...
});

// Update commit
await db.update(commits)
  .set({ title: 'Updated title' })
  .where(eq(commits.sha, 'abc123'));
```

## Migrations

Migrations are stored in the `/drizzle` directory and managed by Drizzle Kit.

### First-time Setup

1. Set `DATABASE_URL` in Railway environment variables
2. Generate migrations: `npm run db:generate`
3. Push to database: `npm run db:push`

### After Schema Changes

1. Modify `schema.ts`
2. Generate migration: `npm run db:generate`
3. Review migration in `/drizzle` directory
4. Apply migration: `npm run db:push`

## Repository Pattern

Repositories provide a clean interface for data access:

```typescript
import { commitRepository } from './db/repositories';

// Save commit with full chain
await commitRepository.saveCommitWithChain(commit, chain);

// Get commit with relations
const commitData = await commitRepository.getCommitWithChain('abc123');

// Query by team
const teamCommits = await commitRepository.getCommitsByTeam('backend', {
  limit: 20,
  offset: 0,
});
```

## Performance

- **Indexes**: Created on all foreign keys and commonly queried fields
- **Arrays**: Using PostgreSQL arrays for denormalized relationships
- **Connection Pooling**: Reuses database connections efficiently
- **Prepared Statements**: Drizzle uses prepared statements automatically

## See Also

- [Database Schema Documentation](../../docs/database-schema.md)
- [Implementation Plan](../../docs/database-implementation-plan.md)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
