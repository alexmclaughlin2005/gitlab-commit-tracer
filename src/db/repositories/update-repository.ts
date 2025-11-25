/**
 * Repository for managing stakeholder updates in the database
 */

import { db } from '../connection';
import { stakeholderUpdates } from '../schema';
import { eq, desc, and, inArray, gte, lte, sql } from 'drizzle-orm';

export interface SaveUpdateParams {
  commitSha: string;
  analysisId?: number;
  technicalUpdate: string;
  businessUpdate: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  costUsd?: number;
  durationMs?: number;
}

export interface UpdateSearchFilters {
  commitSha?: string;
  teamIds?: number[];
  epicIds?: number[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Save a stakeholder update (upsert - insert or update if exists)
 */
export async function saveUpdate(params: SaveUpdateParams) {
  const result = await db
    .insert(stakeholderUpdates)
    .values({
      commitSha: params.commitSha,
      analysisId: params.analysisId,
      technicalUpdate: params.technicalUpdate,
      businessUpdate: params.businessUpdate,
      provider: params.provider,
      model: params.model,
      tokensUsed: params.tokensUsed,
      costUsd: params.costUsd ? params.costUsd.toString() : undefined,
      durationMs: params.durationMs,
    })
    .onConflictDoUpdate({
      target: stakeholderUpdates.commitSha,
      set: {
        analysisId: params.analysisId,
        technicalUpdate: params.technicalUpdate,
        businessUpdate: params.businessUpdate,
        provider: params.provider,
        model: params.model,
        tokensUsed: params.tokensUsed,
        costUsd: params.costUsd ? params.costUsd.toString() : undefined,
        durationMs: params.durationMs,
        generatedAt: new Date(),
      },
    })
    .returning();

  return result[0];
}

/**
 * Get update for a commit
 */
export async function getUpdateByCommit(commitSha: string) {
  const result = await db
    .select()
    .from(stakeholderUpdates)
    .where(eq(stakeholderUpdates.commitSha, commitSha))
    .orderBy(desc(stakeholderUpdates.generatedAt))
    .limit(1);

  return result[0] || null;
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

  if (filters.startDate) {
    conditions.push(gte(stakeholderUpdates.generatedAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(stakeholderUpdates.generatedAt, filters.endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // If filtering by team or epic, we need to join with commit_chains
  if (filters.teamIds && filters.teamIds.length > 0) {
    // Import here to avoid circular dependency
    const { commitChains } = await import('../schema');

    const chains = await db
      .select({ commitSha: commitChains.commitSha })
      .from(commitChains)
      .where(
        sql`${commitChains.teamIds} && ARRAY[${sql.raw(filters.teamIds.join(','))}]::integer[]`
      );

    const commitShas = chains.map((c) => c.commitSha);
    if (commitShas.length > 0) {
      query = query.where(inArray(stakeholderUpdates.commitSha, commitShas));
    } else {
      return [];
    }
  }

  if (filters.epicIds && filters.epicIds.length > 0) {
    // Import here to avoid circular dependency
    const { commitChains } = await import('../schema');

    const chains = await db
      .select({ commitSha: commitChains.commitSha })
      .from(commitChains)
      .where(
        sql`${commitChains.epicIds} && ARRAY[${sql.raw(filters.epicIds.join(','))}]::integer[]`
      );

    const commitShas = chains.map((c) => c.commitSha);
    if (commitShas.length > 0) {
      query = query.where(inArray(stakeholderUpdates.commitSha, commitShas));
    } else {
      return [];
    }
  }

  const results = await query
    .orderBy(desc(stakeholderUpdates.generatedAt))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Get recent updates across all commits
 */
export async function getRecentUpdates(limit: number = 50) {
  return db
    .select()
    .from(stakeholderUpdates)
    .orderBy(desc(stakeholderUpdates.generatedAt))
    .limit(limit);
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
