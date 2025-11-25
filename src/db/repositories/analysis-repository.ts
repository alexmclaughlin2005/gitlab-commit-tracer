/**
 * Repository for managing AI analyses in the database
 */

import { db } from '../connection';
import { analyses } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

export interface SaveAnalysisParams {
  commitChainId: number;
  commitSha: string;
  analysisType: 'technical' | 'business' | 'summary' | 'impact';
  content: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
}

/**
 * Save an analysis result
 */
export async function saveAnalysis(params: SaveAnalysisParams) {
  const result = await db
    .insert(analyses)
    .values({
      commitChainId: params.commitChainId,
      commitSha: params.commitSha,
      analysisType: params.analysisType,
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
 * Get all analyses for a commit
 */
export async function getAnalysesByCommit(commitSha: string) {
  return db
    .select()
    .from(analyses)
    .where(eq(analyses.commitSha, commitSha))
    .orderBy(desc(analyses.createdAt));
}

/**
 * Get a specific analysis by commit and type
 */
export async function getAnalysisByCommitAndType(
  commitSha: string,
  analysisType: 'technical' | 'business' | 'summary' | 'impact'
) {
  const result = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.commitSha, commitSha), eq(analyses.analysisType, analysisType)))
    .orderBy(desc(analyses.createdAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all analyses for a commit chain
 */
export async function getAnalysesByChain(commitChainId: number) {
  return db
    .select()
    .from(analyses)
    .where(eq(analyses.commitChainId, commitChainId))
    .orderBy(desc(analyses.createdAt));
}

/**
 * Delete an analysis
 */
export async function deleteAnalysis(id: number): Promise<boolean> {
  const result = await db
    .delete(analyses)
    .where(eq(analyses.id, id))
    .returning({ id: analyses.id });
  return result.length > 0;
}

/**
 * Get recent analyses across all commits
 */
export async function getRecentAnalyses(limit: number = 50) {
  return db.select().from(analyses).orderBy(desc(analyses.createdAt)).limit(limit);
}
