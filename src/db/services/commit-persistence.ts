/**
 * Service for persisting commits, chains, and analyses to the database
 */

import type { CommitChain } from '../../tracing/types';
import type { AnalysisResult, StakeholderUpdate } from '../../analysis/types';
import {
  saveCommit,
  saveCommitChain,
  saveProject,
  saveIssue,
  saveMergeRequest,
  saveEpic,
  saveAnalysis,
  saveUpdate,
} from '../repositories';
import { extractTeamsFromLabels, ensureTeamsExist } from '../helpers/team-extraction';

export interface PersistCommitChainParams {
  commitSha: string;
  projectId: string;
  chain: CommitChain;
  analysis?: AnalysisResult;
  updates?: StakeholderUpdate;
}

/**
 * Persist a complete commit chain with all related entities
 */
export async function persistCommitChain(params: PersistCommitChainParams): Promise<void> {
  const { commitSha, projectId, chain, analysis, updates } = params;

  console.log(`💾 Persisting commit chain for ${commitSha.substring(0, 8)}...`);

  try {
    // 1. Save the project (if not already exists)
    await saveProject({
      id: projectId,
      name: `Project ${projectId}`,
      enabled: true,
    });

    // 2. Save the main commit
    await saveCommit({
      sha: chain.commit.id,
      projectId,
      shortId: chain.commit.short_id,
      title: chain.commit.title,
      message: chain.commit.message,
      authorName: chain.commit.author_name,
      authorEmail: chain.commit.author_email,
      authoredDate: new Date(chain.commit.authored_date),
      committedDate: new Date(chain.commit.committed_date),
      webUrl: chain.commit.web_url,
    });

    // 3. Save all merge requests
    const mrIds: number[] = [];
    for (const mrLink of chain.mergeRequests) {
      const mr = mrLink.mergeRequest;
      await saveMergeRequest({
        id: mr.id,
        iid: mr.iid,
        projectId: mr.project_id.toString(),
        title: mr.title,
        description: mr.description || undefined,
        state: mr.state,
        webUrl: mr.web_url,
        createdAt: mr.created_at ? new Date(mr.created_at) : undefined,
        updatedAt: mr.updated_at ? new Date(mr.updated_at) : undefined,
        mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
      });
      mrIds.push(mr.id);
    }

    // 4. Save all issues and collect their labels
    const issueIds: number[] = [];
    const allLabels: string[] = [];

    for (const issueLink of chain.issues) {
      const issue = issueLink.issue;
      await saveIssue({
        id: issue.id,
        iid: issue.iid,
        projectId: issue.project_id.toString(),
        epicId: issueLink.epic?.id,
        teamId: undefined, // Will be set later after extracting teams
        title: issue.title,
        description: issue.description || undefined,
        state: issue.state,
        labels: issue.labels,
        webUrl: issue.web_url,
        createdAt: issue.created_at ? new Date(issue.created_at) : undefined,
        updatedAt: issue.updated_at ? new Date(issue.updated_at) : undefined,
        closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
      });
      issueIds.push(issue.id);

      // Collect labels
      if (issue.labels) {
        allLabels.push(...issue.labels);
      }
    }

    // 5. Save all epics
    const epicIds: number[] = [];
    for (const epic of chain.epics) {
      await saveEpic({
        id: epic.id,
        groupId: epic.group_id || 0,
        iid: epic.iid,
        title: epic.title,
        description: epic.description || undefined,
        state: epic.state,
        webUrl: epic.web_url,
        createdAt: epic.created_at ? new Date(epic.created_at) : undefined,
        updatedAt: epic.updated_at ? new Date(epic.updated_at) : undefined,
        closedAt: epic.closed_at ? new Date(epic.closed_at) : undefined,
      });
      epicIds.push(epic.id);
    }

    // 6. Extract and save teams
    const teamNames = extractTeamsFromLabels(allLabels);
    const teamIds = await ensureTeamsExist(teamNames);

    console.log(`   Teams identified: ${teamNames.join(', ') || 'none'}`);

    // 7. Save the commit chain (with denormalized arrays)
    await saveCommitChain({
      commitSha: chain.commit.id,
      projectId,
      mergeRequestIds: mrIds,
      issueIds,
      epicIds,
      teamIds,
      isComplete: chain.metadata.isComplete,
      apiCallCount: chain.metadata.apiCallCount,
      durationMs: chain.metadata.durationMs,
      warnings: chain.metadata.warnings,
    });

    // 8. Save analysis if provided
    let analysisId: number | undefined;
    if (analysis) {
      const savedAnalysis = await saveAnalysis({
        commitSha: chain.commit.id,
        reason: analysis.reason,
        approach: analysis.approach,
        impact: analysis.impact,
        alignment: analysis.alignment,
        alignmentNotes: analysis.alignmentNotes,
        confidence: analysis.confidence,
        provider: analysis.metadata.provider,
        model: analysis.metadata.model,
        tokensUsed: analysis.metadata.tokensUsed,
        costUsd: analysis.metadata.costUsd,
        durationMs: analysis.metadata.durationMs,
      });
      analysisId = savedAnalysis.id;
    }

    // 9. Save stakeholder updates if provided
    if (updates && (updates.technicalUpdate || updates.businessUpdate)) {
      await saveUpdate({
        commitSha: chain.commit.id,
        analysisId,
        technicalUpdate: updates.technicalUpdate || '',
        businessUpdate: updates.businessUpdate || '',
        provider: 'anthropic',
        model: undefined,
        tokensUsed: undefined,
        costUsd: 0,
        durationMs: undefined,
      });
    }

    console.log(`✅ Persisted commit chain for ${commitSha.substring(0, 8)}`);
    console.log(
      `   ${mrIds.length} MRs, ${issueIds.length} issues, ${epicIds.length} epics, ${teamIds.length} teams`
    );
  } catch (error) {
    console.error(`❌ Failed to persist commit chain for ${commitSha.substring(0, 8)}:`, error);
    throw error;
  }
}

/**
 * Persist only updates for an existing commit
 */
export async function persistUpdates(
  commitSha: string,
  updates: StakeholderUpdate,
  analysisId?: number
): Promise<void> {
  console.log(`💾 Persisting updates for ${commitSha.substring(0, 8)}...`);

  try {
    if (updates.technicalUpdate || updates.businessUpdate) {
      await saveUpdate({
        commitSha,
        analysisId,
        technicalUpdate: updates.technicalUpdate || '',
        businessUpdate: updates.businessUpdate || '',
        provider: 'anthropic',
        model: undefined,
        tokensUsed: undefined,
        costUsd: 0,
        durationMs: undefined,
      });
    }

    console.log(`✅ Persisted updates for ${commitSha.substring(0, 8)}`);
  } catch (error) {
    console.error(`❌ Failed to persist updates for ${commitSha.substring(0, 8)}:`, error);
    throw error;
  }
}
