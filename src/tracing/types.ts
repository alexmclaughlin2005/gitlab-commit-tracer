/**
 * Type definitions for commit relationship tracing
 *
 * These types represent the complete chain from a commit through
 * merge requests, issues, and epics.
 */

import type {
  GitLabCommit,
  GitLabMergeRequest,
  GitLabIssue,
  GitLabEpic,
} from '../api/types';

/**
 * Represents a complete relationship chain from commit to epic
 *
 * This is the primary data structure returned by the CommitTracer.
 * It contains the full context needed for AI analysis.
 */
export interface CommitChain {
  /** The commit being traced */
  commit: GitLabCommit;

  /** Merge requests that introduced this commit */
  mergeRequests: MergeRequestLink[];

  /** Issues addressed by the merge requests */
  issues: IssueLink[];

  /** Epics that contain the issues (Premium/Ultimate only) */
  epics: GitLabEpic[];

  /** Metadata about the tracing operation */
  metadata: ChainMetadata;
}

/**
 * A merge request with additional relationship context
 */
export interface MergeRequestLink {
  /** The merge request object */
  mergeRequest: GitLabMergeRequest;

  /** Issues closed by this MR */
  closesIssues: GitLabIssue[];

  /** Whether this MR directly contains the commit */
  containsCommit: boolean;
}

/**
 * An issue with additional relationship context
 */
export interface IssueLink {
  /** The issue object */
  issue: GitLabIssue;

  /** Merge requests that address this issue */
  relatedMergeRequests: GitLabMergeRequest[];

  /** The epic this issue belongs to (if any) */
  epic?: GitLabEpic;

  /** The MR that closes this issue (if traced from MR) */
  closedByMergeRequest?: GitLabMergeRequest;
}

/**
 * Metadata about the tracing operation
 */
export interface ChainMetadata {
  /** When the trace was performed */
  tracedAt: Date;

  /** How long the trace took (milliseconds) */
  durationMs: number;

  /** Number of API calls made */
  apiCallCount: number;

  /** Whether the chain is complete */
  isComplete: boolean;

  /** Warnings or issues encountered during tracing */
  warnings: string[];

  /** Steps taken during tracing */
  steps: TracingStep[];
}

/**
 * A step in the tracing process
 */
export interface TracingStep {
  /** Step name/description */
  name: string;

  /** When this step started */
  startedAt: Date;

  /** How long this step took (milliseconds) */
  durationMs: number;

  /** Whether the step succeeded */
  success: boolean;

  /** Result summary */
  result: string;

  /** Error message if step failed */
  error?: string;
}

/**
 * Options for tracing operations
 */
export interface TracingOptions {
  /** Whether to fetch epic details (requires Premium/Ultimate) */
  includeEpics?: boolean;

  /** Whether to follow all related MRs for issues */
  followRelatedMRs?: boolean;

  /** Maximum depth to traverse relationships */
  maxDepth?: number;

  /** Whether to use cached data */
  useCache?: boolean;

  /** Cache TTL in seconds */
  cacheTTL?: number;

  /** Whether to continue on errors */
  continueOnError?: boolean;

  /** Progress callback for long operations */
  onProgress?: (step: TracingStep) => void;
}

/**
 * Result of a batch tracing operation
 */
export interface BatchTraceResult {
  /** Successfully traced chains */
  chains: CommitChain[];

  /** Commits that failed to trace */
  failures: TraceFailure[];

  /** Summary statistics */
  summary: BatchTraceSummary;
}

/**
 * Information about a failed trace
 */
export interface TraceFailure {
  /** Commit SHA that failed */
  commitSha: string;

  /** Error that occurred */
  error: Error;

  /** Partial chain if any was built */
  partialChain?: Partial<CommitChain>;
}

/**
 * Summary of a batch trace operation
 */
export interface BatchTraceSummary {
  /** Total commits processed */
  totalCommits: number;

  /** Successfully traced */
  successCount: number;

  /** Failed traces */
  failureCount: number;

  /** Total API calls made */
  totalApiCalls: number;

  /** Total time taken (milliseconds) */
  totalDurationMs: number;

  /** Average time per commit (milliseconds) */
  avgDurationMs: number;
}

/**
 * Cache entry for relationship data
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;

  /** When this was cached */
  cachedAt: Date;

  /** TTL in seconds */
  ttl: number;

  /** Whether this entry has expired */
  isExpired(): boolean;
}

/**
 * Statistics about chain completeness
 */
export interface ChainStatistics {
  /** Total chains analyzed */
  totalChains: number;

  /** Chains with MRs found */
  chainsWithMRs: number;

  /** Chains with issues found */
  chainsWithIssues: number;

  /** Chains with epics found */
  chainsWithEpics: number;

  /** Average MRs per commit */
  avgMRsPerCommit: number;

  /** Average issues per MR */
  avgIssuesPerMR: number;

  /** Completeness percentage (0-100) */
  completenessScore: number;
}
