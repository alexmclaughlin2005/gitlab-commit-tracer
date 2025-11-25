/**
 * TypeScript type definitions for GitLab API responses
 * Based on GitLab REST API v4 documentation
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * User information returned in API responses
 */
export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email?: string;
  state: string;
  avatar_url: string | null;
  web_url: string;
}

/**
 * Reference information for GitLab resources
 */
export interface References {
  short: string;
  relative: string;
  full: string;
}

/**
 * Milestone information
 */
export interface Milestone {
  id: number;
  iid: number;
  project_id?: number;
  group_id?: number;
  title: string;
  description: string | null;
  state: 'active' | 'closed';
  created_at: string;
  updated_at: string;
  due_date: string | null;
  start_date: string | null;
  web_url: string;
}

// ============================================================================
// Commit Types
// ============================================================================

/**
 * Commit statistics
 */
export interface CommitStats {
  additions: number;
  deletions: number;
  total: number;
}

/**
 * Commit object returned by GitLab API
 */
export interface GitLabCommit {
  id: string; // SHA
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  created_at: string; // Always identical to committed_date
  parent_ids: string[];
  web_url: string;
  trailers?: Record<string, string>;
  extended_trailers?: Record<string, string>;
  stats?: CommitStats;
  status?: 'running' | 'pending' | 'success' | 'failed' | 'canceled';
  last_pipeline?: {
    id: number;
    ref: string;
    sha: string;
    status: string;
  };
}

/**
 * Parameters for listing commits
 */
export interface ListCommitsParams {
  ref_name?: string; // Branch, tag, or revision range
  since?: string; // ISO 8601 date
  until?: string; // ISO 8601 date
  path?: string; // File path
  author?: string; // Commit author
  all?: boolean; // Retrieve all commits
  with_stats?: boolean; // Include commit statistics
  trailers?: boolean; // Include Git trailers
  order?: 'default' | 'topo';
  per_page?: number;
  page?: number;
}

// ============================================================================
// Merge Request Types
// ============================================================================

/**
 * Merge request state
 */
export type MergeRequestState = 'opened' | 'closed' | 'locked' | 'merged';

/**
 * Detailed merge status
 */
export type DetailedMergeStatus =
  | 'mergeable'
  | 'checking'
  | 'unchecked'
  | 'conflict'
  | 'draft_status'
  | 'not_approved'
  | 'discussions_not_resolved'
  | 'ci_must_pass'
  | 'ci_still_running'
  | 'jira_association_missing'
  | 'blocked_status'
  | 'external_status_checks'
  | 'need_rebase';

/**
 * Diff references
 */
export interface DiffRefs {
  base_sha: string;
  head_sha: string;
  start_sha: string;
}

/**
 * Pipeline information in MR
 */
export interface MRPipeline {
  id: number;
  sha: string;
  ref: string;
  status: string;
  web_url: string;
}

/**
 * Merge request object returned by GitLab API
 */
export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: MergeRequestState;
  created_at: string;
  updated_at: string;
  merged_by?: GitLabUser;
  merge_user?: GitLabUser; // Replaces merged_by
  merged_at?: string | null;
  closed_by?: GitLabUser | null;
  closed_at?: string | null;
  target_branch: string;
  source_branch: string;
  upvotes: number;
  downvotes: number;
  author: GitLabUser;
  assignee?: GitLabUser | null;
  assignees: GitLabUser[];
  reviewers: GitLabUser[];
  source_project_id: number;
  target_project_id: number;
  labels: string[];
  draft: boolean;
  work_in_progress: boolean;
  milestone: Milestone | null;
  merge_when_pipeline_succeeds: boolean;
  merge_status: string;
  detailed_merge_status: DetailedMergeStatus;
  sha: string;
  merge_commit_sha: string | null;
  squash_commit_sha: string | null;
  user_notes_count: number;
  discussion_locked: boolean | null;
  should_remove_source_branch: boolean | null;
  force_remove_source_branch: boolean;
  web_url: string;
  references: References;
  changes_count?: string; // Capped at "1000+"
  diff_refs: DiffRefs;
  head_pipeline?: MRPipeline | null;
  has_conflicts: boolean;
  blocking_discussions_resolved: boolean;
}

/**
 * Parameters for listing merge requests
 */
export interface ListMergeRequestsParams {
  state?: MergeRequestState | 'all';
  order_by?: 'created_at' | 'updated_at';
  sort?: 'asc' | 'desc';
  milestone?: string;
  labels?: string;
  author_id?: number;
  author_username?: string;
  assignee_id?: number;
  reviewer_id?: number;
  scope?: 'created_by_me' | 'assigned_to_me' | 'all';
  search?: string;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  per_page?: number;
  page?: number;
}

// ============================================================================
// Issue Types
// ============================================================================

/**
 * Issue state
 */
export type IssueState = 'opened' | 'closed';

/**
 * Epic information embedded in issue
 */
export interface IssueEpic {
  id: number;
  iid: number;
  title: string;
  url: string;
  group_id: number;
}

/**
 * Issue object returned by GitLab API
 */
export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null; // Max 1,048,576 characters
  state: IssueState;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: GitLabUser | null;
  labels: string[];
  milestone: Milestone | null;
  assignees: GitLabUser[];
  author: GitLabUser;
  assignee?: GitLabUser | null; // Deprecated, use assignees
  user_notes_count: number;
  merge_requests_count: number;
  upvotes: number;
  downvotes: number;
  due_date: string | null;
  confidential: boolean;
  discussion_locked: boolean | null;
  issue_type: 'issue' | 'incident' | 'test_case';
  web_url: string;
  references: References;
  time_stats: {
    time_estimate: number;
    total_time_spent: number;
    human_time_estimate: string | null;
    human_total_time_spent: string | null;
  };
  has_tasks: boolean;
  task_status: string;
  _links: {
    self: string;
    notes: string;
    award_emoji: string;
    project: string;
  };
  // Premium/Ultimate features
  epic?: IssueEpic; // Only in Premium/Ultimate
  epic_iid?: number; // Deprecated, use epic.iid
  weight?: number | null; // Premium/Ultimate
  health_status?: 'on_track' | 'needs_attention' | 'at_risk' | null; // Premium/Ultimate
  iteration?: {
    id: number;
    iid: number;
    title: string;
    description: string | null;
    state: number;
    created_at: string;
    updated_at: string;
    start_date: string;
    due_date: string;
    web_url: string;
  } | null; // Premium/Ultimate
}

/**
 * Parameters for listing issues
 */
export interface ListIssuesParams {
  state?: IssueState | 'all';
  labels?: string;
  milestone?: string;
  scope?: 'created_by_me' | 'assigned_to_me' | 'all';
  author_id?: number;
  assignee_id?: number;
  search?: string;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  order_by?: 'created_at' | 'updated_at';
  sort?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// ============================================================================
// Epic Types (Premium/Ultimate - Deprecated in 17.0)
// ============================================================================

/**
 * Epic state
 */
export type EpicState = 'opened' | 'closed';

/**
 * Epic object returned by GitLab API
 * Note: Epics API is deprecated in GitLab 17.0, migrate to Work Items API
 */
export interface GitLabEpic {
  id: number;
  iid: number;
  work_item_id?: number;
  group_id: number;
  parent_id?: number | null;
  parent_iid?: number | null;
  title: string;
  description: string | null;
  state: EpicState;
  web_url: string;
  references: References;
  author: GitLabUser;
  start_date: string | null; // Composite value
  start_date_is_fixed: boolean;
  start_date_fixed: string | null;
  start_date_from_milestones: string | null; // Deprecated
  end_date: string | null; // Deprecated, use due_date
  due_date: string | null; // Composite value
  due_date_is_fixed: boolean;
  due_date_fixed: string | null;
  due_date_from_milestones: string | null; // Deprecated
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: string[];
  upvotes: number;
  downvotes: number;
  color: string;
  _links: {
    self: string;
    epic_issues: string;
    group: string;
  };
}

// ============================================================================
// API Response Wrappers
// ============================================================================

/**
 * Pagination information from response headers
 */
export interface PaginationInfo {
  page: number;
  perPage: number;
  nextPage?: number;
  prevPage?: number;
  total?: number; // May not be available for some endpoints
  totalPages?: number; // May not be available for some endpoints
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

/**
 * API error response
 */
export interface GitLabAPIError {
  message: string;
  error?: string;
  error_description?: string;
  status: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * GitLab API client configuration
 */
export interface GitLabConfig {
  baseUrl: string; // e.g., https://gitlab.com
  token: string; // Personal access token
  projectId?: string | number; // Default project ID
  timeout?: number; // Request timeout in ms
  maxRetries?: number; // Max retry attempts
  retryDelay?: number; // Initial retry delay in ms
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: Date;
}
