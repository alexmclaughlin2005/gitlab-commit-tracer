# Database Schema Design

## Overview

This document describes the PostgreSQL database schema for persisting commit traces, analyses, and stakeholder updates with organization by teams and epics.

## Core Entities

### 1. Projects
Stores GitLab projects being monitored.

```sql
CREATE TABLE projects (
  id VARCHAR(255) PRIMARY KEY,           -- GitLab project ID or path
  name VARCHAR(255) NOT NULL,            -- Project display name
  gitlab_url TEXT NOT NULL,              -- Full GitLab project URL
  enabled BOOLEAN DEFAULT true,
  config JSONB,                          -- Project configuration (branches, filters, etc.)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_enabled ON projects(enabled);
```

### 2. Teams
Extracted from issue labels (team::* pattern).

```sql
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,     -- Team name (extracted from label)
  display_name VARCHAR(255),             -- Optional display name
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teams_name ON teams(name);
```

### 3. Epics
Stores epic information from GitLab.

```sql
CREATE TABLE epics (
  id INTEGER PRIMARY KEY,                -- GitLab epic ID
  group_id INTEGER NOT NULL,             -- GitLab group ID
  iid INTEGER NOT NULL,                  -- Epic IID within group
  title TEXT NOT NULL,
  description TEXT,
  state VARCHAR(50),
  web_url TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  closed_at TIMESTAMP,

  UNIQUE(group_id, iid)
);

CREATE INDEX idx_epics_group ON epics(group_id);
CREATE INDEX idx_epics_state ON epics(state);
```

### 4. Issues
Stores GitLab issue information.

```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY,                -- GitLab issue ID
  iid INTEGER NOT NULL,                  -- Issue IID within project
  project_id VARCHAR(255) NOT NULL REFERENCES projects(id),
  epic_id INTEGER REFERENCES epics(id),
  team_id INTEGER REFERENCES teams(id),  -- Extracted from labels
  title TEXT NOT NULL,
  description TEXT,
  state VARCHAR(50),
  labels TEXT[],                         -- Array of label names
  web_url TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  closed_at TIMESTAMP,

  UNIQUE(project_id, iid)
);

CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_epic ON issues(epic_id);
CREATE INDEX idx_issues_team ON issues(team_id);
CREATE INDEX idx_issues_state ON issues(state);
CREATE INDEX idx_issues_labels ON issues USING GIN(labels);
```

### 5. Merge Requests
Stores GitLab merge request information.

```sql
CREATE TABLE merge_requests (
  id INTEGER PRIMARY KEY,                -- GitLab MR ID
  iid INTEGER NOT NULL,                  -- MR IID within project
  project_id VARCHAR(255) NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  state VARCHAR(50),
  merged_at TIMESTAMP,
  web_url TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  UNIQUE(project_id, iid)
);

CREATE INDEX idx_mrs_project ON merge_requests(project_id);
CREATE INDEX idx_mrs_state ON merge_requests(state);
CREATE INDEX idx_mrs_merged_at ON merge_requests(merged_at);
```

### 6. Commits
Stores commit information.

```sql
CREATE TABLE commits (
  sha VARCHAR(40) PRIMARY KEY,           -- Git commit SHA
  project_id VARCHAR(255) NOT NULL REFERENCES projects(id),
  short_id VARCHAR(12),
  title TEXT NOT NULL,
  message TEXT,
  author_name VARCHAR(255),
  author_email VARCHAR(255),
  authored_date TIMESTAMP,
  committed_date TIMESTAMP,
  web_url TEXT,
  discovered_at TIMESTAMP DEFAULT NOW(), -- When we first detected this commit

  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_commits_project ON commits(project_id);
CREATE INDEX idx_commits_authored ON commits(authored_date DESC);
CREATE INDEX idx_commits_discovered ON commits(discovered_at DESC);
CREATE INDEX idx_commits_author ON commits(author_email);
```

### 7. Commit Chains
Stores the traced relationships (denormalized for fast queries).

```sql
CREATE TABLE commit_chains (
  id SERIAL PRIMARY KEY,
  commit_sha VARCHAR(40) NOT NULL REFERENCES commits(sha),
  project_id VARCHAR(255) NOT NULL REFERENCES projects(id),

  -- Traced relationships (arrays for quick access)
  merge_request_ids INTEGER[],          -- MR IDs linked to this commit
  issue_ids INTEGER[],                   -- Issue IDs linked to this commit
  epic_ids INTEGER[],                    -- Epic IDs linked to this commit
  team_ids INTEGER[],                    -- Team IDs extracted from issues

  -- Chain metadata
  is_complete BOOLEAN DEFAULT false,
  api_call_count INTEGER,
  duration_ms INTEGER,
  warnings TEXT[],

  traced_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(commit_sha)
);

CREATE INDEX idx_chains_commit ON commit_chains(commit_sha);
CREATE INDEX idx_chains_project ON commit_chains(project_id);
CREATE INDEX idx_chains_traced ON commit_chains(traced_at DESC);
CREATE INDEX idx_chains_teams ON commit_chains USING GIN(team_ids);
CREATE INDEX idx_chains_epics ON commit_chains USING GIN(epic_ids);
```

### 8. Relationships (Junction Tables)

```sql
-- Commit → Merge Request
CREATE TABLE commit_merge_requests (
  commit_sha VARCHAR(40) NOT NULL REFERENCES commits(sha),
  merge_request_id INTEGER NOT NULL REFERENCES merge_requests(id),
  PRIMARY KEY (commit_sha, merge_request_id)
);

-- Merge Request → Issue (closes relationships)
CREATE TABLE merge_request_issues (
  merge_request_id INTEGER NOT NULL REFERENCES merge_requests(id),
  issue_id INTEGER NOT NULL REFERENCES issues(id),
  PRIMARY KEY (merge_request_id, issue_id)
);

CREATE INDEX idx_mr_issues_mr ON merge_request_issues(merge_request_id);
CREATE INDEX idx_mr_issues_issue ON merge_request_issues(issue_id);
```

### 9. AI Analyses
Stores AI analysis results for commits.

```sql
CREATE TABLE analyses (
  id SERIAL PRIMARY KEY,
  commit_sha VARCHAR(40) NOT NULL REFERENCES commits(sha),

  -- Analysis results
  reason TEXT NOT NULL,
  approach TEXT NOT NULL,
  impact TEXT NOT NULL,
  alignment VARCHAR(50) NOT NULL,        -- aligned, partially-aligned, misaligned
  alignment_notes TEXT,
  confidence DECIMAL(3,2),               -- 0.00 to 1.00

  -- Metadata
  provider VARCHAR(50),                  -- openai, anthropic, etc.
  model VARCHAR(100),                    -- gpt-4o, claude-3-5-sonnet, etc.
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  duration_ms INTEGER,
  analyzed_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(commit_sha)
);

CREATE INDEX idx_analyses_commit ON analyses(commit_sha);
CREATE INDEX idx_analyses_alignment ON analyses(alignment);
CREATE INDEX idx_analyses_confidence ON analyses(confidence);
CREATE INDEX idx_analyses_analyzed ON analyses(analyzed_at DESC);
```

### 10. Stakeholder Updates
Stores generated updates for different audiences.

```sql
CREATE TABLE stakeholder_updates (
  id SERIAL PRIMARY KEY,
  commit_sha VARCHAR(40) NOT NULL REFERENCES commits(sha),
  analysis_id INTEGER REFERENCES analyses(id),

  -- Updates
  technical_update TEXT NOT NULL,
  business_update TEXT NOT NULL,

  -- Metadata
  provider VARCHAR(50),
  model VARCHAR(100),
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  duration_ms INTEGER,
  generated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(commit_sha)
);

CREATE INDEX idx_updates_commit ON stakeholder_updates(commit_sha);
CREATE INDEX idx_updates_generated ON stakeholder_updates(generated_at DESC);
```

## Views for Common Queries

### Commits by Team (Materialized View)

```sql
CREATE MATERIALIZED VIEW commits_by_team AS
SELECT
  t.id as team_id,
  t.name as team_name,
  c.sha,
  c.title,
  c.author_name,
  c.committed_date,
  c.discovered_at,
  su.business_update,
  a.confidence,
  cc.epic_ids
FROM commits c
JOIN commit_chains cc ON c.sha = cc.commit_sha
CROSS JOIN LATERAL unnest(cc.team_ids) AS team_id_unnested
JOIN teams t ON t.id = team_id_unnested
LEFT JOIN stakeholder_updates su ON c.sha = su.commit_sha
LEFT JOIN analyses a ON c.sha = a.commit_sha
ORDER BY c.discovered_at DESC;

CREATE INDEX idx_commits_by_team_team ON commits_by_team(team_id);
CREATE INDEX idx_commits_by_team_discovered ON commits_by_team(discovered_at DESC);

-- Refresh strategy: Manual or scheduled
-- REFRESH MATERIALIZED VIEW CONCURRENTLY commits_by_team;
```

### Commits by Epic (Materialized View)

```sql
CREATE MATERIALIZED VIEW commits_by_epic AS
SELECT
  e.id as epic_id,
  e.title as epic_title,
  e.state as epic_state,
  c.sha,
  c.title,
  c.author_name,
  c.committed_date,
  c.discovered_at,
  su.business_update,
  a.confidence,
  cc.team_ids
FROM commits c
JOIN commit_chains cc ON c.sha = cc.commit_sha
CROSS JOIN LATERAL unnest(cc.epic_ids) AS epic_id_unnested
JOIN epics e ON e.id = epic_id_unnested
LEFT JOIN stakeholder_updates su ON c.sha = su.commit_sha
LEFT JOIN analyses a ON c.sha = a.commit_sha
ORDER BY c.discovered_at DESC;

CREATE INDEX idx_commits_by_epic_epic ON commits_by_epic(epic_id);
CREATE INDEX idx_commits_by_epic_discovered ON commits_by_epic(discovered_at DESC);
```

## Key Design Decisions

### 1. Denormalization in commit_chains
The `commit_chains` table stores arrays of IDs for quick access to all related entities without joins. This enables:
- Fast "show all commits for team X" queries
- Fast "show all commits for epic Y" queries
- Simple filtering by multiple teams/epics

### 2. Separate Relationship Tables
Junction tables (`commit_merge_requests`, `merge_request_issues`) maintain normalized relationships for data integrity and detailed queries.

### 3. Materialized Views
Pre-computed views for common access patterns (by team, by epic) improve query performance for the UI.

### 4. Team Extraction
Teams are extracted from GitLab labels matching the pattern `team::*` and stored as a separate entity for better organization.

### 5. Timestamps
All entities track creation/update times for audit trails and time-based queries.

## Query Examples

### Get all commits for a team

```sql
SELECT * FROM commits_by_team
WHERE team_name = 'backend'
ORDER BY discovered_at DESC
LIMIT 20;
```

### Get all commits for an epic

```sql
SELECT * FROM commits_by_epic
WHERE epic_id = 123
ORDER BY discovered_at DESC;
```

### Get commit with full chain

```sql
SELECT
  c.*,
  cc.*,
  a.*,
  su.*,
  array_agg(DISTINCT t.name) as teams,
  array_agg(DISTINCT e.title) as epics
FROM commits c
LEFT JOIN commit_chains cc ON c.sha = cc.commit_sha
LEFT JOIN analyses a ON c.sha = a.commit_sha
LEFT JOIN stakeholder_updates su ON c.sha = su.commit_sha
LEFT JOIN LATERAL unnest(cc.team_ids) AS team_id ON true
LEFT JOIN teams t ON t.id = team_id
LEFT JOIN LATERAL unnest(cc.epic_ids) AS epic_id ON true
LEFT JOIN epics e ON e.id = epic_id
WHERE c.sha = 'abc123'
GROUP BY c.sha, cc.id, a.id, su.id;
```

### Get recent commits with updates

```sql
SELECT
  c.sha,
  c.title,
  c.author_name,
  c.committed_date,
  su.business_update,
  a.confidence,
  array_agg(DISTINCT t.name) as teams
FROM commits c
JOIN stakeholder_updates su ON c.sha = su.commit_sha
LEFT JOIN analyses a ON c.sha = a.commit_sha
LEFT JOIN commit_chains cc ON c.sha = cc.commit_sha
LEFT JOIN LATERAL unnest(cc.team_ids) AS team_id ON true
LEFT JOIN teams t ON t.id = team_id
WHERE c.discovered_at > NOW() - INTERVAL '7 days'
GROUP BY c.sha, c.title, c.author_name, c.committed_date, su.business_update, a.confidence
ORDER BY c.discovered_at DESC;
```

## Migration Strategy

1. Create initial schema with all tables
2. Create indexes for performance
3. Create materialized views
4. Set up refresh strategy (cron job or trigger-based)
5. Backfill existing in-memory data if needed
6. Switch application to use database instead of in-memory storage

## Performance Considerations

1. **Indexes**: Created on all foreign keys and commonly queried fields
2. **Arrays**: Using PostgreSQL arrays for denormalized relationships (fast access)
3. **Materialized Views**: Pre-computed for team/epic views (refresh every 5-10 minutes)
4. **Partitioning**: Future consideration for `commits` table if volume grows (partition by month)
5. **Connection Pooling**: Use pg-pool for efficient connection management

## Future Enhancements

1. **Full-text search**: Add GIN indexes on text fields for search
2. **Analytics tables**: Aggregate statistics by team, epic, time period
3. **Audit logs**: Track all changes to entities
4. **Soft deletes**: Add `deleted_at` fields instead of hard deletes
5. **Data retention**: Archive old commits after configurable period
