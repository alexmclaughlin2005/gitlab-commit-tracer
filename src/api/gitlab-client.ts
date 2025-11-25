/**
 * GitLab API Client
 *
 * Handles all interactions with the GitLab REST API v4.
 * Implements authentication, rate limiting, error handling, and retry logic.
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import type {
  GitLabConfig,
  PaginationInfo,
  PaginatedResponse,
  GitLabAPIError,
  RateLimitInfo,
  GitLabCommit,
  ListCommitsParams,
  GitLabMergeRequest,
  ListMergeRequestsParams,
  GitLabIssue,
  ListIssuesParams,
  GitLabEpic,
} from './types';

/**
 * GitLab API Client
 *
 * Provides methods to interact with GitLab API endpoints with built-in
 * authentication, rate limiting, pagination, and error handling.
 */
export class GitLabClient {
  private readonly client: AxiosInstance;
  private readonly config: Required<GitLabConfig>;
  private rateLimitInfo: RateLimitInfo = {};
  private requestCount = 0;
  private lastRequestTime = 0;

  /**
   * Creates a new GitLab API client
   *
   * @param config - Configuration object with baseUrl, token, and options
   */
  constructor(config: GitLabConfig) {
    // Set defaults
    this.config = {
      baseUrl: config.baseUrl,
      token: config.token,
      projectId: config.projectId || '',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
    };

    // Validate configuration
    if (!this.config.baseUrl) {
      throw new Error('GitLab baseUrl is required');
    }
    if (!this.config.token) {
      throw new Error('GitLab token is required');
    }

    // Create axios instance
    this.client = axios.create({
      baseURL: `${this.config.baseUrl}/api/v4`,
      timeout: this.config.timeout,
      headers: {
        'PRIVATE-TOKEN': this.config.token,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(response);
        return response;
      },
      (error) => {
        if (error.response) {
          this.updateRateLimitInfo(error.response);
        }
        return Promise.reject(error);
      }
    );
  }

  // ==========================================================================
  // Core Request Methods
  // ==========================================================================

  /**
   * Makes a GET request to the GitLab API with retry logic
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters
   * @param retryCount - Current retry attempt (internal)
   * @returns Response data
   */
  private async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    retryCount = 0
  ): Promise<T> {
    try {
      await this.checkRateLimit();

      const response = await this.client.get<T>(endpoint, { params });
      this.requestCount++;
      this.lastRequestTime = Date.now();

      return response.data;
    } catch (error) {
      return this.handleError<T>(error, () => this.get(endpoint, params, retryCount + 1), retryCount);
    }
  }

  /**
   * Makes a GET request and returns response with pagination info
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters
   * @returns Paginated response with data and pagination info
   */
  private async getPaginated<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    try {
      await this.checkRateLimit();

      const response = await this.client.get<T[]>(endpoint, { params });
      this.requestCount++;
      this.lastRequestTime = Date.now();

      const pagination = this.extractPaginationInfo(response);

      return {
        data: response.data,
        pagination,
      };
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Handles API errors and implements retry logic
   *
   * @param error - The error that occurred
   * @param retryFn - Function to retry the request
   * @param retryCount - Current retry attempt
   * @returns Response data if retry succeeds
   * @throws Transformed error if retry fails or not retriable
   */
  private async handleError<T>(
    error: unknown,
    retryFn: () => Promise<T>,
    retryCount: number
  ): Promise<T> {
    const axiosError = error as AxiosError<GitLabAPIError>;

    // Check if we should retry
    if (this.shouldRetry(axiosError, retryCount)) {
      const delay = this.calculateRetryDelay(retryCount, axiosError);
      console.log(`Retrying request after ${delay}ms (attempt ${retryCount + 1}/${this.config.maxRetries})`);

      await this.sleep(delay);
      return retryFn();
    }

    // No more retries, throw transformed error
    throw this.transformError(error);
  }

  /**
   * Determines if a request should be retried
   *
   * @param error - The axios error
   * @param retryCount - Current retry attempt
   * @returns True if should retry
   */
  private shouldRetry(error: AxiosError, retryCount: number): boolean {
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    const status = error.response?.status;

    // Retry on 5xx errors
    if (status && status >= 500) {
      return true;
    }

    // Retry on 429 (rate limit)
    if (status === 429) {
      return true;
    }

    // Retry on network errors
    if (!status && error.code !== 'ECONNABORTED') {
      return true;
    }

    return false;
  }

  /**
   * Calculates retry delay with exponential backoff
   *
   * @param retryCount - Current retry attempt
   * @param error - The axios error (to check for Retry-After header)
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(retryCount: number, error: AxiosError): number {
    // Check for Retry-After header (rate limiting)
    const retryAfter = error.response?.headers['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }

    // Exponential backoff: delay * 2^retryCount
    return this.config.retryDelay * Math.pow(2, retryCount);
  }

  /**
   * Transforms error into a standardized format
   *
   * @param error - The error to transform
   * @returns Standardized error
   */
  private transformError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<GitLabAPIError>;
      const status = axiosError.response?.status || 0;
      const message = axiosError.response?.data?.message || axiosError.message;

      const errorMsg = `GitLab API Error (${status}): ${message}`;
      const apiError = new Error(errorMsg) as Error & { status: number; response?: GitLabAPIError };
      apiError.status = status;
      apiError.response = axiosError.response?.data;

      return apiError;
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Unknown error occurred');
  }

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  /**
   * Updates rate limit information from response headers
   *
   * @param response - Axios response
   */
  private updateRateLimitInfo(response: AxiosResponse): void {
    const headers = response.headers;

    // GitLab may return rate limit headers (implementation varies)
    if (headers['ratelimit-limit']) {
      this.rateLimitInfo.limit = parseInt(headers['ratelimit-limit'], 10);
    }
    if (headers['ratelimit-remaining']) {
      this.rateLimitInfo.remaining = parseInt(headers['ratelimit-remaining'], 10);
    }
    if (headers['ratelimit-reset']) {
      const reset = parseInt(headers['ratelimit-reset'], 10);
      this.rateLimitInfo.reset = new Date(reset * 1000);
    }
  }

  /**
   * Checks rate limit and waits if necessary
   */
  private async checkRateLimit(): Promise<void> {
    // Simple rate limiting: ensure minimum time between requests
    const minTimeBetweenRequests = 100; // 100ms = max 600 req/min
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      await this.sleep(minTimeBetweenRequests - timeSinceLastRequest);
    }

    // Check if we have rate limit info and are close to limit
    if (this.rateLimitInfo.remaining !== undefined && this.rateLimitInfo.remaining < 10) {
      if (this.rateLimitInfo.reset) {
        const waitTime = this.rateLimitInfo.reset.getTime() - Date.now();
        if (waitTime > 0) {
          console.warn(`Rate limit nearly exceeded. Waiting ${waitTime}ms until reset.`);
          await this.sleep(waitTime);
        }
      }
    }
  }

  /**
   * Gets current rate limit information
   *
   * @returns Rate limit info
   */
  public getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  // ==========================================================================
  // Pagination Helpers
  // ==========================================================================

  /**
   * Extracts pagination information from response headers
   *
   * @param response - Axios response
   * @returns Pagination information
   */
  private extractPaginationInfo(response: AxiosResponse): PaginationInfo {
    const headers = response.headers;

    const info: PaginationInfo = {
      page: parseInt(headers['x-page'] || '1', 10),
      perPage: parseInt(headers['x-per-page'] || '20', 10),
    };

    if (headers['x-next-page']) {
      info.nextPage = parseInt(headers['x-next-page'], 10);
    }
    if (headers['x-prev-page']) {
      info.prevPage = parseInt(headers['x-prev-page'], 10);
    }
    if (headers['x-total']) {
      info.total = parseInt(headers['x-total'], 10);
    }
    if (headers['x-total-pages']) {
      info.totalPages = parseInt(headers['x-total-pages'], 10);
    }

    return info;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Sleeps for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets the configured project ID
   *
   * @param projectId - Optional project ID override
   * @returns Project ID
   * @throws Error if no project ID is configured
   */
  private getProjectId(projectId?: string | number): string | number {
    const id = projectId || this.config.projectId;
    if (!id) {
      throw new Error('Project ID is required. Provide it in config or method call.');
    }
    return id;
  }

  /**
   * URL encodes a path (for namespaced projects)
   *
   * @param path - Path to encode
   * @returns Encoded path
   */
  private encodePath(path: string): string {
    // If it's a numeric ID, don't encode it
    if (/^\d+$/.test(path)) {
      return path;
    }
    // Otherwise, it's a path-based ID that needs encoding
    return encodeURIComponent(path);
  }

  // ==========================================================================
  // Public Commit Methods (to be implemented)
  // ==========================================================================

  /**
   * Lists commits for a project
   *
   * @param projectId - Project ID or path
   * @param params - Query parameters
   * @returns Paginated commits
   */
  public async listCommits(
    projectId?: string | number,
    params?: ListCommitsParams
  ): Promise<PaginatedResponse<GitLabCommit>> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.getPaginated<GitLabCommit>(`/projects/${id}/repository/commits`, params);
  }

  /**
   * Gets a single commit by SHA
   *
   * @param sha - Commit SHA
   * @param projectId - Project ID or path
   * @returns Commit object
   */
  public async getCommit(sha: string, projectId?: string | number): Promise<GitLabCommit> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabCommit>(`/projects/${id}/repository/commits/${sha}`);
  }

  /**
   * Gets merge requests that introduced a commit
   *
   * @param sha - Commit SHA
   * @param projectId - Project ID or path
   * @returns Array of merge requests
   */
  public async getCommitMergeRequests(
    sha: string,
    projectId?: string | number
  ): Promise<GitLabMergeRequest[]> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabMergeRequest[]>(`/projects/${id}/repository/commits/${sha}/merge_requests`);
  }

  // ==========================================================================
  // Public Merge Request Methods
  // ==========================================================================

  /**
   * Lists merge requests for a project
   *
   * @param projectId - Project ID or path
   * @param params - Query parameters
   * @returns Paginated merge requests
   */
  public async listMergeRequests(
    projectId?: string | number,
    params?: ListMergeRequestsParams
  ): Promise<PaginatedResponse<GitLabMergeRequest>> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.getPaginated<GitLabMergeRequest>(`/projects/${id}/merge_requests`, params);
  }

  /**
   * Gets a single merge request by IID
   *
   * @param iid - Merge request internal ID
   * @param projectId - Project ID or path
   * @returns Merge request object
   */
  public async getMergeRequest(
    iid: number,
    projectId?: string | number
  ): Promise<GitLabMergeRequest> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabMergeRequest>(`/projects/${id}/merge_requests/${iid}`);
  }

  /**
   * Gets commits in a merge request
   *
   * @param iid - Merge request internal ID
   * @param projectId - Project ID or path
   * @returns Array of commits
   */
  public async getMergeRequestCommits(
    iid: number,
    projectId?: string | number
  ): Promise<GitLabCommit[]> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabCommit[]>(`/projects/${id}/merge_requests/${iid}/commits`);
  }

  /**
   * Gets issues that will be closed by a merge request
   *
   * @param iid - Merge request internal ID
   * @param projectId - Project ID or path
   * @returns Array of issues
   */
  public async getMergeRequestClosesIssues(
    iid: number,
    projectId?: string | number
  ): Promise<GitLabIssue[]> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabIssue[]>(`/projects/${id}/merge_requests/${iid}/closes_issues`);
  }

  // ==========================================================================
  // Public Issue Methods
  // ==========================================================================

  /**
   * Lists issues for a project
   *
   * @param projectId - Project ID or path
   * @param params - Query parameters
   * @returns Paginated issues
   */
  public async listIssues(
    projectId?: string | number,
    params?: ListIssuesParams
  ): Promise<PaginatedResponse<GitLabIssue>> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.getPaginated<GitLabIssue>(`/projects/${id}/issues`, params);
  }

  /**
   * Gets a single issue by IID
   *
   * @param iid - Issue internal ID
   * @param projectId - Project ID or path
   * @returns Issue object
   */
  public async getIssue(iid: number, projectId?: string | number): Promise<GitLabIssue> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabIssue>(`/projects/${id}/issues/${iid}`);
  }

  /**
   * Gets merge requests related to an issue
   *
   * @param iid - Issue internal ID
   * @param projectId - Project ID or path
   * @returns Array of merge requests
   */
  public async getIssueRelatedMergeRequests(
    iid: number,
    projectId?: string | number
  ): Promise<GitLabMergeRequest[]> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabMergeRequest[]>(`/projects/${id}/issues/${iid}/related_merge_requests`);
  }

  /**
   * Gets merge requests that close an issue
   *
   * @param iid - Issue internal ID
   * @param projectId - Project ID or path
   * @returns Array of merge requests
   */
  public async getIssueClosedBy(
    iid: number,
    projectId?: string | number
  ): Promise<GitLabMergeRequest[]> {
    const id = this.encodePath(String(this.getProjectId(projectId)));
    return this.get<GitLabMergeRequest[]>(`/projects/${id}/issues/${iid}/closed_by`);
  }

  // ==========================================================================
  // Public Epic Methods (Premium/Ultimate only)
  // ==========================================================================

  /**
   * Gets a single epic by IID
   * Note: Requires GitLab Premium/Ultimate
   * Note: Epics API deprecated in GitLab 17.0, consider migrating to Work Items API
   *
   * @param groupId - Group ID or path
   * @param epicIid - Epic internal ID
   * @returns Epic object
   */
  public async getEpic(groupId: string | number, epicIid: number): Promise<GitLabEpic> {
    const id = this.encodePath(String(groupId));
    return this.get<GitLabEpic>(`/groups/${id}/epics/${epicIid}`);
  }

  /**
   * Lists epics for a group
   * Note: Requires GitLab Premium/Ultimate
   * Note: Epics API deprecated in GitLab 17.0, consider migrating to Work Items API
   *
   * @param groupId - Group ID or path
   * @param params - Query parameters
   * @returns Paginated epics
   */
  public async listEpics(
    groupId: string | number,
    params?: { state?: 'opened' | 'closed' | 'all'; per_page?: number; page?: number }
  ): Promise<PaginatedResponse<GitLabEpic>> {
    const id = this.encodePath(String(groupId));
    return this.getPaginated<GitLabEpic>(`/groups/${id}/epics`, params);
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Tests the connection and authentication
   *
   * @returns True if authenticated successfully
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Try to get current user info
      await this.get('/user');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Gets statistics about API usage
   *
   * @returns Usage statistics
   */
  public getStats(): { requestCount: number; rateLimitInfo: RateLimitInfo } {
    return {
      requestCount: this.requestCount,
      rateLimitInfo: this.getRateLimitInfo(),
    };
  }
}
