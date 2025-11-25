/**
 * ChainCache - In-memory cache for relationship data
 *
 * Caches API responses to reduce redundant requests during tracing.
 */

import type { CacheEntry } from './types';
import type { GitLabCommit, GitLabMergeRequest, GitLabIssue, GitLabEpic } from '../api/types';

/**
 * Cache key type
 */
type CacheKey = string;

/**
 * Cache entry implementation
 */
class CacheEntryImpl<T> implements CacheEntry<T> {
  constructor(
    public data: T,
    public cachedAt: Date,
    public ttl: number
  ) {}

  isExpired(): boolean {
    const now = Date.now();
    const expiresAt = this.cachedAt.getTime() + this.ttl * 1000;
    return now > expiresAt;
  }
}

/**
 * ChainCache class
 *
 * Provides in-memory caching for GitLab API responses to optimize
 * relationship tracing performance.
 */
export class ChainCache {
  private cache = new Map<CacheKey, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;

  /**
   * Creates a new chain cache
   *
   * @param defaultTTL - Default TTL in seconds (default: 300 = 5 minutes)
   */
  constructor(private readonly defaultTTL: number = 300) {}

  // ==========================================================================
  // Commit Caching
  // ==========================================================================

  /**
   * Gets a cached commit
   *
   * @param sha - Commit SHA
   * @param projectId - Project ID
   * @returns Cached commit or undefined
   */
  public getCommit(sha: string, projectId: string | number): GitLabCommit | undefined {
    return this.get<GitLabCommit>(`commit:${projectId}:${sha}`);
  }

  /**
   * Caches a commit
   *
   * @param commit - Commit to cache
   * @param projectId - Project ID
   * @param ttl - TTL in seconds (optional)
   */
  public setCommit(commit: GitLabCommit, projectId: string | number, ttl?: number): void {
    this.set(`commit:${projectId}:${commit.id}`, commit, ttl);
  }

  // ==========================================================================
  // Merge Request Caching
  // ==========================================================================

  /**
   * Gets cached merge requests for a commit
   *
   * @param sha - Commit SHA
   * @param projectId - Project ID
   * @returns Cached MRs or undefined
   */
  public getCommitMergeRequests(
    sha: string,
    projectId: string | number
  ): GitLabMergeRequest[] | undefined {
    return this.get<GitLabMergeRequest[]>(`commit-mrs:${projectId}:${sha}`);
  }

  /**
   * Caches merge requests for a commit
   *
   * @param sha - Commit SHA
   * @param mrs - Merge requests to cache
   * @param projectId - Project ID
   * @param ttl - TTL in seconds (optional)
   */
  public setCommitMergeRequests(
    sha: string,
    mrs: GitLabMergeRequest[],
    projectId: string | number,
    ttl?: number
  ): void {
    this.set(`commit-mrs:${projectId}:${sha}`, mrs, ttl);
  }

  /**
   * Gets a cached merge request
   *
   * @param iid - MR internal ID
   * @param projectId - Project ID
   * @returns Cached MR or undefined
   */
  public getMergeRequest(iid: number, projectId: string | number): GitLabMergeRequest | undefined {
    return this.get<GitLabMergeRequest>(`mr:${projectId}:${iid}`);
  }

  /**
   * Caches a merge request
   *
   * @param mr - Merge request to cache
   * @param projectId - Project ID
   * @param ttl - TTL in seconds (optional)
   */
  public setMergeRequest(mr: GitLabMergeRequest, projectId: string | number, ttl?: number): void {
    this.set(`mr:${projectId}:${mr.iid}`, mr, ttl);
  }

  // ==========================================================================
  // Issue Caching
  // ==========================================================================

  /**
   * Gets cached issues closed by a merge request
   *
   * @param mrIid - MR internal ID
   * @param projectId - Project ID
   * @returns Cached issues or undefined
   */
  public getMRClosingIssues(mrIid: number, projectId: string | number): GitLabIssue[] | undefined {
    return this.get<GitLabIssue[]>(`mr-closes:${projectId}:${mrIid}`);
  }

  /**
   * Caches issues closed by a merge request
   *
   * @param mrIid - MR internal ID
   * @param issues - Issues to cache
   * @param projectId - Project ID
   * @param ttl - TTL in seconds (optional)
   */
  public setMRClosingIssues(
    mrIid: number,
    issues: GitLabIssue[],
    projectId: string | number,
    ttl?: number
  ): void {
    this.set(`mr-closes:${projectId}:${mrIid}`, issues, ttl);
  }

  /**
   * Gets a cached issue
   *
   * @param iid - Issue internal ID
   * @param projectId - Project ID
   * @returns Cached issue or undefined
   */
  public getIssue(iid: number, projectId: string | number): GitLabIssue | undefined {
    return this.get<GitLabIssue>(`issue:${projectId}:${iid}`);
  }

  /**
   * Caches an issue
   *
   * @param issue - Issue to cache
   * @param projectId - Project ID
   * @param ttl - TTL in seconds (optional)
   */
  public setIssue(issue: GitLabIssue, projectId: string | number, ttl?: number): void {
    this.set(`issue:${projectId}:${issue.iid}`, issue, ttl);
  }

  /**
   * Gets cached related merge requests for an issue
   *
   * @param issueIid - Issue internal ID
   * @param projectId - Project ID
   * @returns Cached MRs or undefined
   */
  public getIssueRelatedMRs(
    issueIid: number,
    projectId: string | number
  ): GitLabMergeRequest[] | undefined {
    return this.get<GitLabMergeRequest[]>(`issue-mrs:${projectId}:${issueIid}`);
  }

  /**
   * Caches related merge requests for an issue
   *
   * @param issueIid - Issue internal ID
   * @param mrs - Merge requests to cache
   * @param projectId - Project ID
   * @param ttl - TTL in seconds (optional)
   */
  public setIssueRelatedMRs(
    issueIid: number,
    mrs: GitLabMergeRequest[],
    projectId: string | number,
    ttl?: number
  ): void {
    this.set(`issue-mrs:${projectId}:${issueIid}`, mrs, ttl);
  }

  // ==========================================================================
  // Epic Caching
  // ==========================================================================

  /**
   * Gets a cached epic
   *
   * @param iid - Epic internal ID
   * @param groupId - Group ID
   * @returns Cached epic or undefined
   */
  public getEpic(iid: number, groupId: string | number): GitLabEpic | undefined {
    return this.get<GitLabEpic>(`epic:${groupId}:${iid}`);
  }

  /**
   * Caches an epic
   *
   * @param epic - Epic to cache
   * @param groupId - Group ID
   * @param ttl - TTL in seconds (optional)
   */
  public setEpic(epic: GitLabEpic, groupId: string | number, ttl?: number): void {
    this.set(`epic:${groupId}:${epic.iid}`, epic, ttl);
  }

  // ==========================================================================
  // Generic Cache Operations
  // ==========================================================================

  /**
   * Gets a value from cache
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  private get<T>(key: CacheKey): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.isExpired()) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.data as T;
  }

  /**
   * Sets a value in cache
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - TTL in seconds (optional, uses default if not provided)
   */
  private set<T>(key: CacheKey, data: T, ttl?: number): void {
    const entry = new CacheEntryImpl(data, new Date(), ttl || this.defaultTTL);
    this.cache.set(key, entry);
  }

  /**
   * Clears a specific cache entry
   *
   * @param key - Cache key to clear
   */
  public clear(key: CacheKey): void {
    this.cache.delete(key);
  }

  /**
   * Clears all cache entries
   */
  public clearAll(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Clears expired entries
   *
   * @returns Number of entries cleared
   */
  public clearExpired(): number {
    let cleared = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.isExpired()) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Gets cache statistics
   *
   * @returns Cache stats
   */
  public getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Gets cache size in entries
   *
   * @returns Number of cached entries
   */
  public size(): number {
    return this.cache.size;
  }
}
