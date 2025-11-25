/**
 * Repository for managing AI analyses in the database
 */

import { db } from '../connection';
import { analyses } from '../schema';
import { eq, desc } from 'drizzle-orm';

export interface SaveAnalysisParams {
  commitSha: string;
  reason: string;
  approach: string;
  impact: string;
  alignment: string;
  alignmentNotes?: string;
  confidence?: number;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  costUsd?: number;
  durationMs?: number;
}

/**
 * Save an analysis result (upsert - insert or update if exists)
 */
export async function saveAnalysis(params: SaveAnalysisParams) {
  const result = await db
    .insert(analyses)
    .values({
      commitSha: params.commitSha,
      reason: params.reason,
      approach: params.approach,
      impact: params.impact,
      alignment: params.alignment,
      alignmentNotes: params.alignmentNotes,
      confidence: params.confidence ? params.confidence.toString() : undefined,
      provider: params.provider,
      model: params.model,
      tokensUsed: params.tokensUsed,
      costUsd: params.costUsd ? params.costUsd.toString() : undefined,
      durationMs: params.durationMs,
    })
    .onConflictDoUpdate({
      target: analyses.commitSha,
      set: {
        reason: params.reason,
        approach: params.approach,
        impact: params.impact,
        alignment: params.alignment,
        alignmentNotes: params.alignmentNotes,
        confidence: params.confidence ? params.confidence.toString() : undefined,
        provider: params.provider,
        model: params.model,
        tokensUsed: params.tokensUsed,
        costUsd: params.costUsd ? params.costUsd.toString() : undefined,
        durationMs: params.durationMs,
        analyzedAt: new Date(),
      },
    })
    .returning();

  return result[0];
}

/**
 * Get analysis for a commit
 */
export async function getAnalysisByCommit(commitSha: string) {
  const result = await db
    .select()
    .from(analyses)
    .where(eq(analyses.commitSha, commitSha))
    .orderBy(desc(analyses.analyzedAt))
    .limit(1);

  return result[0] || null;
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
  return db.select().from(analyses).orderBy(desc(analyses.analyzedAt)).limit(limit);
}
