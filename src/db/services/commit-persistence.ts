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
      isMonitored: true,
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
    for (const mr of chain.mergeRequests) {
      await saveMergeRequest({
        iid: mr.iid,
        projectId: mr.project_id.toString(),
        title: mr.title,
        description: mr.description,
        state: mr.state,
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        webUrl: mr.web_url,
        authorName: mr.author?.name,
        createdAt: mr.created_at ? new Date(mr.created_at) : undefined,
        updatedAt: mr.updated_at ? new Date(mr.updated_at) : undefined,
        mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
        closedAt: mr.closed_at ? new Date(mr.closed_at) : undefined,
      });
      mrIds.push(mr.iid);
    }

    // 4. Save all issues and collect their labels
    const issueIds: number[] = [];
    const allLabels: string[] = [];

    for (const issue of chain.issues) {
      await saveIssue({
        iid: issue.iid,
        projectId: issue.project_id.toString(),
        title: issue.title,
        description: issue.description,
        state: issue.state,
        labels: issue.labels,
        webUrl: issue.web_url,
        authorName: issue.author?.name,
        createdAt: issue.created_at ? new Date(issue.created_at) : undefined,
        updatedAt: issue.updated_at ? new Date(issue.updated_at) : undefined,
        closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
      });
      issueIds.push(issue.iid);

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
        groupId: epic.group_id?.toString() || 'unknown',
        iid: epic.iid,
        title: epic.title,
        description: epic.description,
        state: epic.state,
        labels: epic.labels,
        webUrl: epic.web_url,
        authorName: epic.author?.name,
        createdAt: epic.created_at ? new Date(epic.created_at) : undefined,
        updatedAt: epic.updated_at ? new Date(epic.updated_at) : undefined,
        closedAt: epic.closed_at ? new Date(epic.closed_at) : undefined,
      });
      epicIds.push(epic.id);

      // Collect epic labels
      if (epic.labels) {
        allLabels.push(...epic.labels);
      }
    }

    // 6. Extract and save teams
    const teamNames = extractTeamsFromLabels(allLabels);
    const teamIds = await ensureTeamsExist(teamNames);

    console.log(`   Teams identified: ${teamNames.join(', ') || 'none'}`);

    // 7. Save the commit chain (with denormalized arrays)
    const chainId = await saveCommitChain({
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
    if (analysis) {
      // For now, save as a summary analysis
      // We could split this into multiple analysis records if needed
      const analysisContent = JSON.stringify({
        summary: analysis.summary,
        keyChanges: analysis.keyChanges,
        impact: analysis.impact,
        relatedWork: analysis.relatedWork,
        concerns: analysis.concerns,
        recommendations: analysis.recommendations,
      });

      await saveAnalysis({
        commitChainId: chainId,
        commitSha: chain.commit.id,
        analysisType: 'summary',
        content: analysisContent,
        model: analysis.model,
        promptTokens: analysis.usage?.prompt_tokens,
        completionTokens: analysis.usage?.completion_tokens,
        totalTokens: analysis.usage?.total_tokens,
      });
    }

    // 9. Save stakeholder updates if provided
    if (updates) {
      // Save technical update
      if (updates.technicalUpdate) {
        await saveUpdate({
          commitChainId: chainId,
          commitSha: chain.commit.id,
          updateType: 'technical',
          content: updates.technicalUpdate,
        });
      }

      // Save business update
      if (updates.businessUpdate) {
        await saveUpdate({
          commitChainId: chainId,
          commitSha: chain.commit.id,
          updateType: 'business',
          content: updates.businessUpdate,
        });
      }
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
 * Persist only updates for an existing commit chain
 */
export async function persistUpdates(
  commitChainId: number,
  commitSha: string,
  updates: StakeholderUpdate
): Promise<void> {
  console.log(`💾 Persisting updates for ${commitSha.substring(0, 8)}...`);

  try {
    if (updates.technicalUpdate) {
      await saveUpdate({
        commitChainId,
        commitSha,
        updateType: 'technical',
        content: updates.technicalUpdate,
      });
    }

    if (updates.businessUpdate) {
      await saveUpdate({
        commitChainId,
        commitSha,
        updateType: 'business',
        content: updates.businessUpdate,
      });
    }

    console.log(`✅ Persisted updates for ${commitSha.substring(0, 8)}`);
  } catch (error) {
    console.error(`❌ Failed to persist updates for ${commitSha.substring(0, 8)}:`, error);
    throw error;
  }
}
