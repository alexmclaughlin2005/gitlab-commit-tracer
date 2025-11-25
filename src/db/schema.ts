/**
 * Drizzle ORM Schema Definitions
 *
 * This file defines all database tables using Drizzle's type-safe schema builder.
 * See docs/database-schema.md for detailed schema documentation.
 */

import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  serial,
  jsonb,
  decimal,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Core Entity Tables
// ============================================================================

/**
 * Projects table - GitLab projects being monitored
 */
export const projects = pgTable('projects', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  gitlabUrl: text('gitlab_url').notNull(),
  enabled: boolean('enabled').default(true),
  config: jsonb('config'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  enabledIdx: index('idx_projects_enabled').on(table.enabled),
}));

/**
 * Teams table - Extracted from issue labels (team::* pattern)
 */
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  nameIdx: index('idx_teams_name').on(table.name),
}));

/**
 * Epics table - GitLab epic information
 */
export const epics = pgTable('epics', {
  id: integer('id').primaryKey(),
  groupId: integer('group_id').notNull(),
  iid: integer('iid').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  state: varchar('state', { length: 50 }),
  webUrl: text('web_url'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  closedAt: timestamp('closed_at'),
}, (table) => ({
  groupIidUnique: uniqueIndex('idx_epics_group_iid').on(table.groupId, table.iid),
  groupIdx: index('idx_epics_group').on(table.groupId),
  stateIdx: index('idx_epics_state').on(table.state),
}));

/**
 * Issues table - GitLab issue information
 */
export const issues = pgTable('issues', {
  id: integer('id').primaryKey(),
  iid: integer('iid').notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id),
  epicId: integer('epic_id').references(() => epics.id),
  teamId: integer('team_id').references(() => teams.id),
  title: text('title').notNull(),
  description: text('description'),
  state: varchar('state', { length: 50 }),
  labels: text('labels').array(),
  webUrl: text('web_url'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  closedAt: timestamp('closed_at'),
}, (table) => ({
  projectIidUnique: uniqueIndex('idx_issues_project_iid').on(table.projectId, table.iid),
  projectIdx: index('idx_issues_project').on(table.projectId),
  epicIdx: index('idx_issues_epic').on(table.epicId),
  teamIdx: index('idx_issues_team').on(table.teamId),
  stateIdx: index('idx_issues_state').on(table.state),
}));

/**
 * Merge Requests table - GitLab MR information
 */
export const mergeRequests = pgTable('merge_requests', {
  id: integer('id').primaryKey(),
  iid: integer('iid').notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id),
  title: text('title').notNull(),
  description: text('description'),
  state: varchar('state', { length: 50 }),
  mergedAt: timestamp('merged_at'),
  webUrl: text('web_url'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
}, (table) => ({
  projectIidUnique: uniqueIndex('idx_mrs_project_iid').on(table.projectId, table.iid),
  projectIdx: index('idx_mrs_project').on(table.projectId),
  stateIdx: index('idx_mrs_state').on(table.state),
  mergedAtIdx: index('idx_mrs_merged_at').on(table.mergedAt),
}));

/**
 * Commits table - Git commit information
 */
export const commits = pgTable('commits', {
  sha: varchar('sha', { length: 40 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id),
  shortId: varchar('short_id', { length: 12 }),
  title: text('title').notNull(),
  message: text('message'),
  authorName: varchar('author_name', { length: 255 }),
  authorEmail: varchar('author_email', { length: 255 }),
  authoredDate: timestamp('authored_date'),
  committedDate: timestamp('committed_date'),
  webUrl: text('web_url'),
  discoveredAt: timestamp('discovered_at').defaultNow(),
}, (table) => ({
  projectIdx: index('idx_commits_project').on(table.projectId),
  authoredIdx: index('idx_commits_authored').on(table.authoredDate),
  discoveredIdx: index('idx_commits_discovered').on(table.discoveredAt),
  authorIdx: index('idx_commits_author').on(table.authorEmail),
}));

/**
 * Commit Chains table - Traced relationships (denormalized for fast queries)
 */
export const commitChains = pgTable('commit_chains', {
  id: serial('id').primaryKey(),
  commitSha: varchar('commit_sha', { length: 40 }).notNull().references(() => commits.sha).unique(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id),

  // Denormalized arrays for fast access
  mergeRequestIds: integer('merge_request_ids').array(),
  issueIds: integer('issue_ids').array(),
  epicIds: integer('epic_ids').array(),
  teamIds: integer('team_ids').array(),

  // Chain metadata
  isComplete: boolean('is_complete').default(false),
  apiCallCount: integer('api_call_count'),
  durationMs: integer('duration_ms'),
  warnings: text('warnings').array(),

  tracedAt: timestamp('traced_at').defaultNow(),
}, (table) => ({
  commitIdx: index('idx_chains_commit').on(table.commitSha),
  projectIdx: index('idx_chains_project').on(table.projectId),
  tracedIdx: index('idx_chains_traced').on(table.tracedAt),
}));

// ============================================================================
// Junction Tables (Normalized Relationships)
// ============================================================================

/**
 * Commit → Merge Request relationships
 */
export const commitMergeRequests = pgTable('commit_merge_requests', {
  commitSha: varchar('commit_sha', { length: 40 }).notNull().references(() => commits.sha),
  mergeRequestId: integer('merge_request_id').notNull().references(() => mergeRequests.id),
}, (table) => ({
  pk: uniqueIndex('pk_commit_merge_requests').on(table.commitSha, table.mergeRequestId),
}));

/**
 * Merge Request → Issue relationships (closes)
 */
export const mergeRequestIssues = pgTable('merge_request_issues', {
  mergeRequestId: integer('merge_request_id').notNull().references(() => mergeRequests.id),
  issueId: integer('issue_id').notNull().references(() => issues.id),
}, (table) => ({
  pk: uniqueIndex('pk_merge_request_issues').on(table.mergeRequestId, table.issueId),
  mrIdx: index('idx_mr_issues_mr').on(table.mergeRequestId),
  issueIdx: index('idx_mr_issues_issue').on(table.issueId),
}));

// ============================================================================
// AI Analysis Tables
// ============================================================================

/**
 * Analyses table - AI analysis results for commits
 */
export const analyses = pgTable('analyses', {
  id: serial('id').primaryKey(),
  commitSha: varchar('commit_sha', { length: 40 }).notNull().references(() => commits.sha).unique(),

  // Analysis results
  reason: text('reason').notNull(),
  approach: text('approach').notNull(),
  impact: text('impact').notNull(),
  alignment: varchar('alignment', { length: 50 }).notNull(),
  alignmentNotes: text('alignment_notes'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),

  // Metadata
  provider: varchar('provider', { length: 50 }),
  model: varchar('model', { length: 100 }),
  tokensUsed: integer('tokens_used'),
  costUsd: decimal('cost_usd', { precision: 10, scale: 6 }),
  durationMs: integer('duration_ms'),
  analyzedAt: timestamp('analyzed_at').defaultNow(),
}, (table) => ({
  commitIdx: index('idx_analyses_commit').on(table.commitSha),
  alignmentIdx: index('idx_analyses_alignment').on(table.alignment),
  confidenceIdx: index('idx_analyses_confidence').on(table.confidence),
  analyzedIdx: index('idx_analyses_analyzed').on(table.analyzedAt),
}));

/**
 * Stakeholder Updates table - Generated updates for different audiences
 */
export const stakeholderUpdates = pgTable('stakeholder_updates', {
  id: serial('id').primaryKey(),
  commitSha: varchar('commit_sha', { length: 40 }).notNull().references(() => commits.sha).unique(),
  analysisId: integer('analysis_id').references(() => analyses.id),

  // Updates
  technicalUpdate: text('technical_update').notNull(),
  businessUpdate: text('business_update').notNull(),

  // Metadata
  provider: varchar('provider', { length: 50 }),
  model: varchar('model', { length: 100 }),
  tokensUsed: integer('tokens_used'),
  costUsd: decimal('cost_usd', { precision: 10, scale: 6 }),
  durationMs: integer('duration_ms'),
  generatedAt: timestamp('generated_at').defaultNow(),
}, (table) => ({
  commitIdx: index('idx_updates_commit').on(table.commitSha),
  generatedIdx: index('idx_updates_generated').on(table.generatedAt),
}));

// ============================================================================
// Drizzle Relations (for joins)
// ============================================================================

export const projectsRelations = relations(projects, ({ many }) => ({
  commits: many(commits),
  issues: many(issues),
  mergeRequests: many(mergeRequests),
}));

export const commitsRelations = relations(commits, ({ one, many }) => ({
  project: one(projects, {
    fields: [commits.projectId],
    references: [projects.id],
  }),
  chain: one(commitChains, {
    fields: [commits.sha],
    references: [commitChains.commitSha],
  }),
  analysis: one(analyses, {
    fields: [commits.sha],
    references: [analyses.commitSha],
  }),
  updates: one(stakeholderUpdates, {
    fields: [commits.sha],
    references: [stakeholderUpdates.commitSha],
  }),
  commitMergeRequests: many(commitMergeRequests),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  epic: one(epics, {
    fields: [issues.epicId],
    references: [epics.id],
  }),
  team: one(teams, {
    fields: [issues.teamId],
    references: [teams.id],
  }),
  mergeRequestIssues: many(mergeRequestIssues),
}));

export const mergeRequestsRelations = relations(mergeRequests, ({ one, many }) => ({
  project: one(projects, {
    fields: [mergeRequests.projectId],
    references: [projects.id],
  }),
  commitMergeRequests: many(commitMergeRequests),
  mergeRequestIssues: many(mergeRequestIssues),
}));
