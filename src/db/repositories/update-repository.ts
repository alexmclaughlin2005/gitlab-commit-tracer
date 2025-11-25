/**
 * Repository for managing stakeholder updates in the database
 */

import { db } from '../connection';
import { stakeholderUpdates } from '../schema';
import { eq, desc, and, inArray, gte, lte, sql } from 'drizzle-orm';

export interface SaveUpdateParams {
  commitChainId: number;
  commitSha: string;
  updateType: 'technical' | 'business';
  content: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
}

export interface UpdateSearchFilters {
  commitSha?: string;
  updateType?: 'technical' | 'business';
  teamIds?: number[];
  epicIds?: number[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Save a stakeholder update
 */
export async function saveUpdate(params: SaveUpdateParams) {
  const result = await db
    .insert(stakeholderUpdates)
    .values({
      commitChainId: params.commitChainId,
      commitSha: params.commitSha,
      updateType: params.updateType,
      content: params.content,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      durationMs: params.durationMs,
    })
    .returning();

  return result[0];
}

/**
 * Get all updates for a commit
 */
export async function getUpdatesByCommit(commitSha: string) {
  return db
    .select()
    .from(stakeholderUpdates)
    .where(eq(stakeholderUpdates.commitSha, commitSha))
    .orderBy(desc(stakeholderUpdates.createdAt));
}

/**
 * Get a specific update by commit and type
 */
export async function getUpdateByCommitAndType(
  commitSha: string,
  updateType: 'technical' | 'business'
) {
  const result = await db
    .select()
    .from(stakeholderUpdates)
    .where(
      and(
        eq(stakeholderUpdates.commitSha, commitSha),
        eq(stakeholderUpdates.updateType, updateType)
      )
    )
    .orderBy(desc(stakeholderUpdates.createdAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all updates for a commit chain
 */
export async function getUpdatesByChain(commitChainId: number) {
  return db
    .select()
    .from(stakeholderUpdates)
    .where(eq(stakeholderUpdates.commitChainId, commitChainId))
    .orderBy(desc(stakeholderUpdates.createdAt));
}

/**
 * Search updates with filters
 */
export async function searchUpdates(filters: UpdateSearchFilters) {
  const { limit = 50, offset = 0 } = filters;

  let query = db.select().from(stakeholderUpdates).$dynamic();

  // Apply direct filters
  const conditions = [];

  if (filters.commitSha) {
    conditions.push(eq(stakeholderUpdates.commitSha, filters.commitSha));
  }

  if (filters.updateType) {
    conditions.push(eq(stakeholderUpdates.updateType, filters.updateType));
  }

  if (filters.startDate) {
    conditions.push(gte(stakeholderUpdates.createdAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(stakeholderUpdates.createdAt, filters.endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // If filtering by team or epic, we need to join with commit_chains
  if (filters.teamIds && filters.teamIds.length > 0) {
    // Import here to avoid circular dependency
    const { commitChains } = await import('../schema');

    const chains = await db
      .select({ id: commitChains.id })
      .from(commitChains)
      .where(
        sql`${commitChains.teamIds} && ARRAY[${sql.raw(filters.teamIds.join(','))}]::integer[]`
      );

    const chainIds = chains.map((c) => c.id);
    if (chainIds.length > 0) {
      query = query.where(inArray(stakeholderUpdates.commitChainId, chainIds));
    } else {
      return [];
    }
  }

  if (filters.epicIds && filters.epicIds.length > 0) {
    // Import here to avoid circular dependency
    const { commitChains } = await import('../schema');

    const chains = await db
      .select({ id: commitChains.id })
      .from(commitChains)
      .where(
        sql`${commitChains.epicIds} && ARRAY[${sql.raw(filters.epicIds.join(','))}]::integer[]`
      );

    const chainIds = chains.map((c) => c.id);
    if (chainIds.length > 0) {
      query = query.where(inArray(stakeholderUpdates.commitChainId, chainIds));
    } else {
      return [];
    }
  }

  const results = await query
    .orderBy(desc(stakeholderUpdates.createdAt))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Get recent updates across all commits
 */
export async function getRecentUpdates(
  limit: number = 50,
  updateType?: 'technical' | 'business'
) {
  let query = db.select().from(stakeholderUpdates).$dynamic();

  if (updateType) {
    query = query.where(eq(stakeholderUpdates.updateType, updateType));
  }

  return query.orderBy(desc(stakeholderUpdates.createdAt)).limit(limit);
}

/**
 * Delete an update
 */
export async function deleteUpdate(id: number): Promise<boolean> {
  const result = await db
    .delete(stakeholderUpdates)
    .where(eq(stakeholderUpdates.id, id))
    .returning({ id: stakeholderUpdates.id });
  return result.length > 0;
}
