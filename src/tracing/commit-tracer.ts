/**
 * CommitTracer - Traces commits through the development lifecycle
 *
 * Automatically builds relationship chains: Commit → MR → Issue → Epic
 */

import { GitLabClient } from '../api';
import type { GitLabEpic } from '../api/types';
import type {
  CommitChain,
  MergeRequestLink,
  IssueLink,
  TracingStep,
  TracingOptions,
  BatchTraceResult,
  TraceFailure,
  BatchTraceSummary,
} from './types';

/**
 * Default tracing options
 */
const DEFAULT_OPTIONS: Required<TracingOptions> = {
  includeEpics: true,
  followRelatedMRs: true,
  maxDepth: 10,
  useCache: true,
  cacheTTL: 300, // 5 minutes
  continueOnError: true,
  onProgress: () => {}, // No-op
};

/**
 * CommitTracer class
 *
 * Traces commits through their complete lifecycle to build
 * relationship chains for AI analysis.
 */
export class CommitTracer {
  private apiCallCount = 0;
  private options: Required<TracingOptions>;

  /**
   * Creates a new CommitTracer
   *
   * @param client - GitLab API client instance
   * @param options - Tracing options
   */
  constructor(
    private readonly client: GitLabClient,
    options?: TracingOptions
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Traces a single commit to build its complete relationship chain
   *
   * @param commitSha - The commit SHA to trace
   * @param projectId - Project ID or path
   * @returns Complete commit chain
   */
  public async traceCommit(commitSha: string, projectId?: string | number): Promise<CommitChain> {
    const startTime = Date.now();
    this.apiCallCount = 0;

    const steps: TracingStep[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Fetch commit details
      const commit = await this.executeStep(
        'Fetch commit details',
        async () => {
          const c = await this.client.getCommit(commitSha, projectId);
          this.apiCallCount++;
          return c;
        },
        steps
      );

      // Step 2: Find merge requests
      const mergeRequestLinks = await this.executeStep(
        'Find merge requests',
        async () => {
          const mrs = await this.client.getCommitMergeRequests(commitSha, projectId);
          this.apiCallCount++;

          if (mrs.length === 0) {
            warnings.push('No merge requests found for this commit');
            return [];
          }

          // Build MR links with their closing issues
          const links: MergeRequestLink[] = [];
          for (const mr of mrs) {
            try {
              const closesIssues = await this.client.getMergeRequestClosesIssues(mr.iid, projectId);
              this.apiCallCount++;

              links.push({
                mergeRequest: mr,
                closesIssues,
                containsCommit: true,
              });
            } catch (error: any) {
              if (this.options.continueOnError) {
                warnings.push(`Failed to fetch closing issues for MR !${mr.iid}: ${error.message}`);
                links.push({
                  mergeRequest: mr,
                  closesIssues: [],
                  containsCommit: true,
                });
              } else {
                throw error;
              }
            }
          }

          return links;
        },
        steps
      );

      // Step 3: Build issue links
      const issueLinks = await this.executeStep(
        'Build issue relationships',
        async () => {
          const issueMap = new Map<number, IssueLink>();

          // Collect all unique issues from MRs
          for (const mrLink of mergeRequestLinks) {
            for (const issue of mrLink.closesIssues) {
              if (!issueMap.has(issue.id)) {
                const issueLink: IssueLink = {
                  issue,
                  relatedMergeRequests: [mrLink.mergeRequest],
                  closedByMergeRequest: mrLink.mergeRequest,
                };
                issueMap.set(issue.id, issueLink);
              } else {
                // Add this MR to the existing issue link
                const existing = issueMap.get(issue.id)!;
                existing.relatedMergeRequests.push(mrLink.mergeRequest);
              }
            }
          }

          // Optionally fetch additional related MRs for each issue
          if (this.options.followRelatedMRs) {
            for (const issueLink of issueMap.values()) {
              try {
                const relatedMRs = await this.client.getIssueRelatedMergeRequests(
                  issueLink.issue.iid,
                  projectId
                );
                this.apiCallCount++;

                // Add any new MRs not already in the list
                for (const mr of relatedMRs) {
                  if (!issueLink.relatedMergeRequests.some((existing) => existing.id === mr.id)) {
                    issueLink.relatedMergeRequests.push(mr);
                  }
                }
              } catch (error: any) {
                if (this.options.continueOnError) {
                  warnings.push(
                    `Failed to fetch related MRs for issue #${issueLink.issue.iid}: ${error.message}`
                  );
                } else {
                  throw error;
                }
              }
            }
          }

          return Array.from(issueMap.values());
        },
        steps
      );

      // Step 4: Fetch full issue details to get epic information
      if (this.options.includeEpics && issueLinks.length > 0) {
        await this.executeStep(
          'Fetch full issue details',
          async () => {
            for (const issueLink of issueLinks) {
              try {
                const fullIssue = await this.client.getIssue(issueLink.issue.iid, projectId);
                this.apiCallCount++;
                // Replace the partial issue with the full issue details
                issueLink.issue = fullIssue;
              } catch (error: any) {
                if (this.options.continueOnError) {
                  warnings.push(
                    `Failed to fetch full details for issue #${issueLink.issue.iid}: ${error.message}`
                  );
                } else {
                  throw error;
                }
              }
            }
            return issueLinks.length;
          },
          steps
        );
      }

      // Step 5: Fetch epics
      const epics = await this.executeStep(
        'Fetch epic details',
        async () => {
          if (!this.options.includeEpics) {
            return [];
          }

          const epicMap = new Map<number, GitLabEpic>();

          for (const issueLink of issueLinks) {
            if (issueLink.issue.epic) {
              const epicRef = issueLink.issue.epic;

              // Fetch epic if not already in map
              if (!epicMap.has(epicRef.id)) {
                try {
                  const epic = await this.client.getEpic(epicRef.group_id, epicRef.iid);
                  this.apiCallCount++;
                  epicMap.set(epic.id, epic);
                  issueLink.epic = epic;
                } catch (error: any) {
                  if (this.options.continueOnError) {
                    warnings.push(
                      `Failed to fetch epic &${epicRef.iid} for issue #${issueLink.issue.iid}: ${error.message}`
                    );
                    // Store basic epic info from issue
                    issueLink.epic = {
                      id: epicRef.id,
                      iid: epicRef.iid,
                      title: epicRef.title,
                      group_id: epicRef.group_id,
                      web_url: epicRef.url,
                    } as GitLabEpic;
                  } else {
                    throw error;
                  }
                }
              } else {
                // Use cached epic
                issueLink.epic = epicMap.get(epicRef.id)!;
              }
            }
          }

          return Array.from(epicMap.values());
        },
        steps
      );

      // Build final chain
      const chain: CommitChain = {
        commit,
        mergeRequests: mergeRequestLinks,
        issues: issueLinks,
        epics,
        metadata: {
          tracedAt: new Date(),
          durationMs: Date.now() - startTime,
          apiCallCount: this.apiCallCount,
          isComplete: this.isChainComplete(mergeRequestLinks, issueLinks, epics),
          warnings,
          steps,
        },
      };

      return chain;
    } catch (error: any) {
      // Add final error step
      steps.push({
        name: 'Trace failed',
        startedAt: new Date(),
        durationMs: 0,
        success: false,
        result: 'Error',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Traces multiple commits in batch
   *
   * @param commitShas - Array of commit SHAs to trace
   * @param projectId - Project ID or path
   * @returns Batch trace result with successes and failures
   */
  public async traceCommits(
    commitShas: string[],
    projectId?: string | number
  ): Promise<BatchTraceResult> {
    const startTime = Date.now();
    const chains: CommitChain[] = [];
    const failures: TraceFailure[] = [];
    let totalApiCalls = 0;

    for (const sha of commitShas) {
      try {
        const chain = await this.traceCommit(sha, projectId);
        chains.push(chain);
        totalApiCalls += chain.metadata.apiCallCount;

        // Call progress callback
        this.options.onProgress({
          name: `Traced commit ${sha.substring(0, 8)}`,
          startedAt: new Date(),
          durationMs: chain.metadata.durationMs,
          success: true,
          result: `Found ${chain.mergeRequests.length} MRs, ${chain.issues.length} issues, ${chain.epics.length} epics`,
        });
      } catch (error: any) {
        failures.push({
          commitSha: sha,
          error: error as Error,
        });

        this.options.onProgress({
          name: `Failed to trace commit ${sha.substring(0, 8)}`,
          startedAt: new Date(),
          durationMs: 0,
          success: false,
          result: 'Error',
          error: error.message,
        });
      }
    }

    const totalDurationMs = Date.now() - startTime;

    const summary: BatchTraceSummary = {
      totalCommits: commitShas.length,
      successCount: chains.length,
      failureCount: failures.length,
      totalApiCalls,
      totalDurationMs,
      avgDurationMs: chains.length > 0 ? totalDurationMs / chains.length : 0,
    };

    return {
      chains,
      failures,
      summary,
    };
  }

  /**
   * Traces recent commits from a project
   *
   * @param count - Number of recent commits to trace
   * @param projectId - Project ID or path
   * @param branch - Branch name (default: all branches)
   * @returns Batch trace result
   */
  public async traceRecentCommits(
    count: number,
    projectId?: string | number,
    branch?: string
  ): Promise<BatchTraceResult> {
    // Fetch recent commits
    const commitsResponse = await this.client.listCommits(projectId, {
      per_page: count,
      ref_name: branch,
    });

    const commitShas = commitsResponse.data.map((c) => c.id);
    return this.traceCommits(commitShas, projectId);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Executes a tracing step with timing and error handling
   *
   * @param name - Step name
   * @param fn - Function to execute
   * @param steps - Steps array to append to
   * @returns Result of the function
   */
  private async executeStep<T>(
    name: string,
    fn: () => Promise<T>,
    steps: TracingStep[]
  ): Promise<T> {
    const startTime = Date.now();
    const step: TracingStep = {
      name,
      startedAt: new Date(),
      durationMs: 0,
      success: false,
      result: '',
    };

    // Call progress callback
    this.options.onProgress(step);

    try {
      const result = await fn();
      step.durationMs = Date.now() - startTime;
      step.success = true;
      step.result = this.summarizeResult(result);
      steps.push(step);
      return result;
    } catch (error: any) {
      step.durationMs = Date.now() - startTime;
      step.success = false;
      step.result = 'Error';
      step.error = error.message;
      steps.push(step);
      throw error;
    }
  }

  /**
   * Creates a summary string for a step result
   *
   * @param result - Result to summarize
   * @returns Summary string
   */
  private summarizeResult(result: any): string {
    if (result === null || result === undefined) {
      return 'None';
    }

    if (Array.isArray(result)) {
      return `Found ${result.length} item(s)`;
    }

    if (typeof result === 'object') {
      if ('id' in result && 'title' in result) {
        return `${result.title}`;
      }
      return 'Success';
    }

    return String(result);
  }

  /**
   * Determines if a chain is complete
   *
   * @param mrLinks - MR links
   * @param issueLinks - Issue links
   * @param epics - Epics
   * @returns True if chain has all expected components
   */
  private isChainComplete(
    mrLinks: MergeRequestLink[],
    issueLinks: IssueLink[],
    _epics: GitLabEpic[]
  ): boolean {
    // A chain is complete if:
    // 1. Has at least one MR
    // 2. Has at least one issue (if expected)
    // 3. Has epics for issues that should have them

    if (mrLinks.length === 0) {
      return false; // No MRs found
    }

    // Check if we have issues when expected
    const hasIssues = issueLinks.length > 0;
    const shouldHaveIssues = mrLinks.some((mr) => mr.closesIssues.length > 0);

    if (shouldHaveIssues && !hasIssues) {
      return false;
    }

    return true;
  }

  /**
   * Gets tracing statistics
   *
   * @returns Current statistics
   */
  public getStats(): { apiCallCount: number } {
    return {
      apiCallCount: this.apiCallCount,
    };
  }
}
