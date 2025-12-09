/**
 * Feed Monitor Service
 *
 * Polls GitLab projects for new commits and emits events when detected.
 */

import { EventEmitter } from 'events';
import { GitLabClient } from '../api';
import { MonitorConfigLoader } from './config';
import type {
  MonitorState,
  DetectedCommit,
  MonitorStats,
  ProjectConfig,
  NewCommitEvent,
} from './types';

export interface FeedMonitorOptions {
  /** Configuration loader instance */
  configLoader?: MonitorConfigLoader;

  /** GitLab client instance */
  client?: GitLabClient;

  /** Start monitoring immediately */
  autoStart?: boolean;
}

/**
 * Feed Monitor Service
 *
 * Monitors GitLab projects for new commits by polling the commits API.
 * Emits 'newCommit' events when new commits are detected.
 *
 * Events:
 * - 'newCommit': Emitted when a new commit is detected
 * - 'pollStart': Emitted when a poll cycle starts
 * - 'pollComplete': Emitted when a poll cycle completes
 * - 'pollError': Emitted when a poll cycle fails
 * - 'started': Emitted when monitoring starts
 * - 'stopped': Emitted when monitoring stops
 */
export class FeedMonitor extends EventEmitter {
  private configLoader: MonitorConfigLoader;
  private client: GitLabClient | null = null;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private monitorStates: Map<string, MonitorState> = new Map();
  private stats: MonitorStats;

  constructor(options: FeedMonitorOptions = {}) {
    super();

    this.configLoader = options.configLoader || new MonitorConfigLoader();

    if (options.client) {
      this.client = options.client;
    }

    this.stats = this.initializeStats();

    if (options.autoStart) {
      this.start();
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): MonitorStats {
    return {
      isRunning: false,
      totalProjects: 0,
      enabledProjects: 0,
      totalBranches: 0,
      totalCommitsDiscovered: 0,
      totalCommitsProcessed: 0,
      totalCommitsFailed: 0,
      queueSize: 0,
      startedAt: null,
      lastPollAt: null,
      nextPollAt: null,
    };
  }

  /**
   * Set the GitLab client
   */
  public setClient(client: GitLabClient): void {
    this.client = client;
  }

  /**
   * Get current monitor statistics
   */
  public getStats(): MonitorStats {
    const config = this.configLoader.getConfig();
    const enabledProjects = this.configLoader.getEnabledProjects();

    this.stats.totalProjects = config.projects.length;
    this.stats.enabledProjects = enabledProjects.length;
    this.stats.totalBranches = enabledProjects.reduce(
      (sum, p) => sum + p.branches.length,
      0
    );

    return { ...this.stats };
  }

  /**
   * Get monitor state for a specific project/branch
   */
  public getState(projectId: string | number, branch: string): MonitorState | undefined {
    const key = this.getStateKey(projectId, branch);
    return this.monitorStates.get(key);
  }

  /**
   * Get all monitor states
   */
  public getAllStates(): MonitorState[] {
    return Array.from(this.monitorStates.values());
  }

  /**
   * Create state key for Map lookup
   */
  private getStateKey(projectId: string | number, branch: string): string {
    return `${projectId}:${branch}`;
  }

  /**
   * Initialize or get monitor state for a project/branch
   */
  private getOrCreateState(projectId: string | number, branch: string): MonitorState {
    const key = this.getStateKey(projectId, branch);
    let state = this.monitorStates.get(key);

    if (!state) {
      state = {
        projectId,
        branch,
        lastCommitSha: null,
        lastPolledAt: null,
        isPolling: false,
        consecutiveFailures: 0,
      };
      this.monitorStates.set(key, state);
    }

    return state;
  }

  /**
   * Start monitoring all enabled projects
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Monitor is already running');
      return;
    }

    if (!this.client) {
      throw new Error('GitLab client not set. Call setClient() first.');
    }

    console.log('🚀 Starting GitLab commit monitor...');

    this.isRunning = true;
    this.stats.isRunning = true;
    this.stats.startedAt = new Date();

    this.emit('started');

    // Do an initial poll immediately
    await this.pollAll();

    // Schedule recurring polls
    this.schedulePoll();
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('Monitor is not running');
      return;
    }

    console.log('🛑 Stopping GitLab commit monitor...');

    this.isRunning = false;
    this.stats.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    this.emit('stopped');
  }

  /**
   * Schedule the next poll
   */
  private schedulePoll(): void {
    if (!this.isRunning) {
      return;
    }

    const config = this.configLoader.getConfig();
    const intervalMs = config.global.pollIntervalSeconds * 1000;

    this.stats.nextPollAt = new Date(Date.now() + intervalMs);

    this.pollTimer = setTimeout(async () => {
      await this.pollAll();
      this.schedulePoll(); // Schedule next poll
    }, intervalMs);
  }

  /**
   * Poll all enabled projects
   */
  private async pollAll(): Promise<void> {
    const enabledProjects = this.configLoader.getEnabledProjects();

    if (enabledProjects.length === 0) {
      console.log('⚠️  No enabled projects to monitor');
      return;
    }

    this.emit('pollStart', { projectCount: enabledProjects.length });

    console.log(`🔍 Polling ${enabledProjects.length} project(s)...`);

    for (const project of enabledProjects) {
      for (const branch of project.branches) {
        try {
          await this.pollProjectBranch(project, branch);
        } catch (error) {
          console.error(
            `Error polling ${project.name}:${branch}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }

    this.stats.lastPollAt = new Date();
    this.emit('pollComplete');
  }

  /**
   * Poll a specific project/branch for new commits
   */
  private async pollProjectBranch(
    project: ProjectConfig,
    branch: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('GitLab client not set');
    }

    const state = this.getOrCreateState(project.id, branch);

    if (state.isPolling) {
      console.log(`Skipping ${project.name}:${branch} - already polling`);
      return;
    }

    state.isPolling = true;

    try {
      const config = this.configLoader.getConfig();

      // Fetch recent commits
      const response = await this.client.listCommits(project.id, {
        ref_name: branch,
        per_page: config.global.maxCommitsPerPoll,
      });

      const commits = response.data;

      if (commits.length === 0) {
        console.log(`No commits found for ${project.name}:${branch}`);
        state.lastPolledAt = new Date();
        state.isPolling = false;
        return;
      }

      // The first commit is the most recent
      const latestCommit = commits[0];

      // If this is the first time polling, fetch and emit the 50 most recent commits
      if (!state.lastCommitSha) {
        console.log(
          `📌 Initial poll for ${project.name}:${branch} - fetching 50 most recent commits`
        );

        // Take the first 50 commits (or fewer if less are available)
        const recentCommits = commits.slice(0, Math.min(50, commits.length));

        console.log(
          `✨ Loading ${recentCommits.length} recent commit(s) for ${project.name}:${branch}`
        );

        // Process recent commits (oldest first for chronological processing)
        for (const commit of recentCommits.reverse()) {
          // Apply filters
          if (this.shouldSkipCommit(commit, project)) {
            console.log(
              `⏭️  Skipping commit ${commit.short_id} (filtered by author: ${commit.author_name})`
            );
            continue;
          }

          const detectedCommit: DetectedCommit = {
            sha: commit.id,
            projectId: project.id,
            branch,
            title: commit.title,
            authorName: commit.author_name,
            authorEmail: commit.author_email,
            committedAt: new Date(commit.committed_date),
            discoveredAt: new Date(),
          };

          this.stats.totalCommitsDiscovered++;

          const event: NewCommitEvent = {
            commit: detectedCommit,
            project,
          };

          this.emit('newCommit', event);

          console.log(
            `📢 Recent commit: ${commit.short_id} - ${commit.title.substring(0, 60)}...`
          );
        }

        // Set baseline to the latest commit
        state.lastCommitSha = latestCommit.id;
        state.lastPolledAt = new Date();
        state.consecutiveFailures = 0;
        state.isPolling = false;
        return;
      }

      // Check if we have new commits
      if (latestCommit.id === state.lastCommitSha) {
        console.log(`No new commits for ${project.name}:${branch}`);
        state.lastPolledAt = new Date();
        state.consecutiveFailures = 0;
        state.isPolling = false;
        return;
      }

      // Find all new commits (from most recent to last seen)
      const newCommits = [];
      for (const commit of commits) {
        if (commit.id === state.lastCommitSha) {
          break; // Reached the last commit we saw
        }
        newCommits.push(commit);
      }

      console.log(
        `✨ Found ${newCommits.length} new commit(s) for ${project.name}:${branch}`
      );

      // Process new commits (oldest first for chronological processing)
      for (const commit of newCommits.reverse()) {
        // Apply filters
        if (this.shouldSkipCommit(commit, project)) {
          console.log(
            `⏭️  Skipping commit ${commit.short_id} (filtered by author: ${commit.author_name})`
          );
          continue;
        }

        const detectedCommit: DetectedCommit = {
          sha: commit.id,
          projectId: project.id,
          branch,
          title: commit.title,
          authorName: commit.author_name,
          authorEmail: commit.author_email,
          committedAt: new Date(commit.committed_date),
          discoveredAt: new Date(),
        };

        this.stats.totalCommitsDiscovered++;

        const event: NewCommitEvent = {
          commit: detectedCommit,
          project,
        };

        this.emit('newCommit', event);

        console.log(
          `📢 New commit: ${commit.short_id} - ${commit.title.substring(0, 60)}...`
        );
      }

      // Update state with the latest commit
      state.lastCommitSha = latestCommit.id;
      state.lastPolledAt = new Date();
      state.consecutiveFailures = 0;
    } catch (error) {
      state.consecutiveFailures++;
      const err = error instanceof Error ? error : new Error(String(error));

      console.error(
        `❌ Error polling ${project.name}:${branch} (failure #${state.consecutiveFailures}):`,
        err.message
      );

      this.emit('pollError', {
        project,
        branch,
        error: err,
        consecutiveFailures: state.consecutiveFailures,
      });

      // If too many consecutive failures, consider disabling?
      if (state.consecutiveFailures >= 5) {
        console.error(
          `⚠️  Project ${project.name}:${branch} has failed ${state.consecutiveFailures} times consecutively`
        );
      }
    } finally {
      state.isPolling = false;
    }
  }

  /**
   * Check if a commit should be skipped based on filters
   */
  private shouldSkipCommit(commit: any, project: ProjectConfig): boolean {
    if (!project.filters) {
      return false;
    }

    const { includeAuthors, excludeAuthors } = project.filters;

    // If includeAuthors is set, only include commits from those authors
    if (includeAuthors && includeAuthors.length > 0) {
      if (!includeAuthors.includes(commit.author_name)) {
        return true;
      }
    }

    // If excludeAuthors is set, skip commits from those authors
    if (excludeAuthors && excludeAuthors.length > 0) {
      if (excludeAuthors.includes(commit.author_name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Manually trigger a poll for a specific project
   */
  public async pollProject(projectId: string | number): Promise<void> {
    const project = this.configLoader.getProject(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!project.enabled) {
      throw new Error(`Project is disabled: ${project.name}`);
    }

    console.log(`🔍 Manual poll triggered for ${project.name}`);

    for (const branch of project.branches) {
      await this.pollProjectBranch(project, branch);
    }
  }

  /**
   * Reset state for a project/branch (start fresh)
   */
  public resetState(projectId: string | number, branch: string): void {
    const key = this.getStateKey(projectId, branch);
    this.monitorStates.delete(key);
    console.log(`🔄 Reset state for ${projectId}:${branch}`);
  }

  /**
   * Update the last commit SHA for a project/branch
   */
  public updateLastCommit(
    projectId: string | number,
    branch: string,
    commitSha: string
  ): void {
    const state = this.getOrCreateState(projectId, branch);
    state.lastCommitSha = commitSha;
    state.lastPolledAt = new Date();
    console.log(`✅ Updated baseline for ${projectId}:${branch} to ${commitSha.substring(0, 8)}`);
  }

  /**
   * Reset all states
   */
  public resetAllStates(): void {
    this.monitorStates.clear();
    console.log('🔄 Reset all monitor states');
  }
}
