/**
 * GitLab API Module
 *
 * Exports the GitLab API client and all related types.
 */

export { GitLabClient } from './gitlab-client';
export type {
  // Configuration
  GitLabConfig,
  RateLimitInfo,

  // Base types
  GitLabUser,
  References,
  Milestone,

  // Commit types
  GitLabCommit,
  CommitStats,
  ListCommitsParams,

  // Merge Request types
  GitLabMergeRequest,
  MergeRequestState,
  DetailedMergeStatus,
  DiffRefs,
  MRPipeline,
  ListMergeRequestsParams,

  // Issue types
  GitLabIssue,
  IssueState,
  IssueEpic,
  ListIssuesParams,

  // Epic types
  GitLabEpic,
  EpicState,

  // Response wrappers
  PaginationInfo,
  PaginatedResponse,
  GitLabAPIError,
} from './types';
