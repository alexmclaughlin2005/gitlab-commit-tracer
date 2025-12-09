/**
 * Repository for managing commits in the database
 */

import { db } from '../connection';
import { commits, commitChains } from '../schema';
import { eq, desc, and, inArray, gte, lte, sql } from 'drizzle-orm';

export interface SaveCommitParams {
  sha: string;
  projectId: string;
  shortId?: string;
  title: string;
  message?: string;
  authorName?: string;
  authorEmail?: string;
  authoredDate?: Date;
  committedDate?: Date;
  webUrl?: string;
}

export interface SaveCommitChainParams {
  commitSha: string;
  projectId: string;
  mergeRequestIds?: number[];
  issueIds?: number[];
  epicIds?: number[];
  teamIds?: number[];
  isComplete?: boolean;
  apiCallCount?: number;
  durationMs?: number;
  warnings?: string[];
}

export interface CommitSearchFilters {
  projectId?: string;
  authorEmail?: string;
  teamIds?: number[];
  epicIds?: number[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Save or update a commit in the database
 */
export async function saveCommit(params: SaveCommitParams): Promise<void> {
  await db
    .insert(commits)
    .values({
      sha: params.sha,
      projectId: params.projectId,
      shortId: params.shortId,
      title: params.title,
      message: params.message,
      authorName: params.authorName,
      authorEmail: params.authorEmail,
      authoredDate: params.authoredDate,
      committedDate: params.committedDate,
      webUrl: params.webUrl,
    })
    .onConflictDoUpdate({
      target: commits.sha,
      set: {
        title: params.title,
        message: params.message,
        authorName: params.authorName,
        authorEmail: params.authorEmail,
        authoredDate: params.authoredDate,
        committedDate: params.committedDate,
        webUrl: params.webUrl,
      },
    });
}

/**
 * Save or update a commit chain in the database
 */
export async function saveCommitChain(params: SaveCommitChainParams): Promise<number> {
  const result = await db
    .insert(commitChains)
    .values({
      commitSha: params.commitSha,
      projectId: params.projectId,
      mergeRequestIds: params.mergeRequestIds || [],
      issueIds: params.issueIds || [],
      epicIds: params.epicIds || [],
      teamIds: params.teamIds || [],
      isComplete: params.isComplete ?? false,
      apiCallCount: params.apiCallCount,
      durationMs: params.durationMs,
      warnings: params.warnings || [],
    })
    .onConflictDoUpdate({
      target: commitChains.commitSha,
      set: {
        mergeRequestIds: params.mergeRequestIds || [],
        issueIds: params.issueIds || [],
        epicIds: params.epicIds || [],
        teamIds: params.teamIds || [],
        isComplete: params.isComplete ?? false,
        apiCallCount: params.apiCallCount,
        durationMs: params.durationMs,
        warnings: params.warnings || [],
      },
    })
    .returning({ id: commitChains.id });

  return result[0].id;
}

/**
 * Get a commit by SHA
 */
export async function getCommitBySha(sha: string) {
  const result = await db.select().from(commits).where(eq(commits.sha, sha)).limit(1);
  return result[0] || null;
}

/**
 * Get a commit chain by commit SHA
 */
export async function getCommitChainBySha(sha: string) {
  const result = await db
    .select()
    .from(commitChains)
    .where(eq(commitChains.commitSha, sha))
    .limit(1);
  return result[0] || null;
}

/**
 * Get commits by team ID
 */
export async function getCommitsByTeam(
  teamId: number,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 50, offset = 0 } = options;

  // Query commit chains that include this team
  const chains = await db
    .select()
    .from(commitChains)
    .where(sql`${teamId} = ANY(${commitChains.teamIds})`)
    .orderBy(desc(commitChains.tracedAt))
    .limit(limit)
    .offset(offset);

  // Get all commits for these chains
  const commitShas = chains.map((chain) => chain.commitSha);
  if (commitShas.length === 0) {
    return [];
  }

  const commitsList = await db
    .select()
    .from(commits)
    .where(inArray(commits.sha, commitShas))
    .orderBy(desc(commits.authoredDate));

  return commitsList;
}

/**
 * Get commits by epic ID
 */
export async function getCommitsByEpic(
  epicId: number,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 50, offset = 0 } = options;

  // Query commit chains that include this epic
  const chains = await db
    .select()
    .from(commitChains)
    .where(sql`${epicId} = ANY(${commitChains.epicIds})`)
    .orderBy(desc(commitChains.tracedAt))
    .limit(limit)
    .offset(offset);

  // Get all commits for these chains
  const commitShas = chains.map((chain) => chain.commitSha);
  if (commitShas.length === 0) {
    return [];
  }

  const commitsList = await db
    .select()
    .from(commits)
    .where(inArray(commits.sha, commitShas))
    .orderBy(desc(commits.authoredDate));

  return commitsList;
}

/**
 * Search commits with filters
 */
export async function searchCommits(filters: CommitSearchFilters) {
  const { limit = 50, offset = 0 } = filters;

  let query = db.select().from(commits).$dynamic();

  // Apply filters
  const conditions = [];

  if (filters.projectId) {
    conditions.push(eq(commits.projectId, filters.projectId));
  }

  if (filters.authorEmail) {
    conditions.push(eq(commits.authorEmail, filters.authorEmail));
  }

  if (filters.startDate) {
    conditions.push(gte(commits.authoredDate, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(commits.authoredDate, filters.endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // If filtering by team or epic, we need to join with commit_chains
  if (filters.teamIds && filters.teamIds.length > 0) {
    const chains = await db
      .select({ commitSha: commitChains.commitSha })
      .from(commitChains)
      .where(
        sql`${commitChains.teamIds} && ARRAY[${sql.raw(filters.teamIds.join(','))}]::integer[]`
      );

    const commitShas = chains.map((c) => c.commitSha);
    if (commitShas.length > 0) {
      query = query.where(inArray(commits.sha, commitShas));
    } else {
      return [];
    }
  }

  if (filters.epicIds && filters.epicIds.length > 0) {
    const chains = await db
      .select({ commitSha: commitChains.commitSha })
      .from(commitChains)
      .where(
        sql`${commitChains.epicIds} && ARRAY[${sql.raw(filters.epicIds.join(','))}]::integer[]`
      );

    const commitShas = chains.map((c) => c.commitSha);
    if (commitShas.length > 0) {
      query = query.where(inArray(commits.sha, commitShas));
    } else {
      return [];
    }
  }

  const results = await query
    .orderBy(desc(commits.authoredDate))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Get recent commits across all projects
 */
export async function getRecentCommits(limit: number = 50) {
  return db
    .select()
    .from(commits)
    .orderBy(desc(commits.discoveredAt))
    .limit(limit);
}

/**
 * Get complete commit chain with all related entities (MRs, Issues, Epics, Analysis, Updates)
 * This reconstructs the CommitChain type from persisted data
 */
export async function getCompleteCommitChain(sha: string) {
  // Import necessary types and repositories
  const { mergeRequests, issues, epics, analyses, stakeholderUpdates } = await import('../schema');
  const { inArray } = await import('drizzle-orm');

  // 1. Get the commit
  const commit = await getCommitBySha(sha);
  if (!commit) {
    return null;
  }

  // 2. Get the commit chain metadata
  const chain = await getCommitChainBySha(sha);
  if (!chain) {
    return null;
  }

  // 3. Get all related merge requests
  const mrs =
    chain.mergeRequestIds && chain.mergeRequestIds.length > 0
      ? await db.select().from(mergeRequests).where(inArray(mergeRequests.id, chain.mergeRequestIds))
      : [];

  // 4. Get all related issues
  const issuesList =
    chain.issueIds && chain.issueIds.length > 0
      ? await db.select().from(issues).where(inArray(issues.id, chain.issueIds))
      : [];

  // 5. Get all related epics
  const epicsList =
    chain.epicIds && chain.epicIds.length > 0
      ? await db.select().from(epics).where(inArray(epics.id, chain.epicIds))
      : [];

  // 6. Get analysis and updates if they exist
  const analysis = await db
    .select()
    .from(analyses)
    .where(eq(analyses.commitSha, sha))
    .limit(1)
    .then((res) => res[0] || null);

  const updates = await db
    .select()
    .from(stakeholderUpdates)
    .where(eq(stakeholderUpdates.commitSha, sha))
    .limit(1)
    .then((res) => res[0] || null);

  return {
    commit,
    chain,
    mergeRequests: mrs,
    issues: issuesList,
    epics: epicsList,
    analysis,
    updates,
  };
}
