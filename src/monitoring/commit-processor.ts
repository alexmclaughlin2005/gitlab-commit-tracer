/**
 * Commit Processor
 *
 * Processes detected commits by tracing them through the development lifecycle.
 */

import { EventEmitter } from 'events';
import { CommitTracer } from '../tracing';
import type { CommitChain } from '../tracing/types';
import type {
  DetectedCommit,
  QueuedCommit,
  ProcessingStatus,
  CommitProcessedEvent,
} from './types';

export interface CommitProcessorOptions {
  /** CommitTracer instance */
  tracer: CommitTracer;

  /** Maximum number of commits to process concurrently */
  concurrency?: number;

  /** Maximum number of retries for failed commits */
  maxRetries?: number;

  /** Delay between retries (in ms) */
  retryDelayMs?: number;

  /** Whether to automatically generate stakeholder updates */
  autoGenerateUpdates?: boolean;
}

/**
 * Commit Processor
 *
 * Processes new commits by:
 * 1. Adding them to a queue
 * 2. Running CommitTracer to build the chain
 * 3. Optionally generating stakeholder updates
 * 4. Emitting events for storage/display
 *
 * Events:
 * - 'commitQueued': When a commit is added to the queue
 * - 'commitProcessing': When processing starts for a commit
 * - 'commitProcessed': When processing completes (success or failure)
 * - 'queueEmpty': When the queue becomes empty
 */
export class CommitProcessor extends EventEmitter {
  private tracer: CommitTracer;
  private queue: QueuedCommit[] = [];
  private processing: Set<string> = new Set();
  private processed: Map<string, QueuedCommit> = new Map();
  private concurrency: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private autoGenerateUpdates: boolean;

  constructor(options: CommitProcessorOptions) {
    super();

    this.tracer = options.tracer;
    this.concurrency = options.concurrency || 3;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 5000;
    this.autoGenerateUpdates = options.autoGenerateUpdates || false;
  }

  /**
   * Add a commit to the processing queue
   */
  public enqueue(commit: DetectedCommit): void {
    // Check if already processed or in queue
    if (this.processed.has(commit.sha)) {
      console.log(`Commit ${commit.sha.substring(0, 8)} already processed, skipping`);
      return;
    }

    const existing = this.queue.find((c) => c.sha === commit.sha);
    if (existing) {
      console.log(`Commit ${commit.sha.substring(0, 8)} already in queue, skipping`);
      return;
    }

    const queuedCommit: QueuedCommit = {
      ...commit,
      status: 'pending',
      retries: 0,
    };

    this.queue.push(queuedCommit);

    console.log(
      `📥 Queued commit: ${commit.sha.substring(0, 8)} - ${commit.title.substring(0, 50)}`
    );

    this.emit('commitQueued', queuedCommit);

    // Start processing if under concurrency limit
    this.processNext();
  }

  /**
   * Process the next commit in the queue
   */
  private async processNext(): Promise<void> {
    // Check concurrency limit
    if (this.processing.size >= this.concurrency) {
      return;
    }

    // Find next pending commit
    const commit = this.queue.find((c) => c.status === 'pending');
    if (!commit) {
      // Check if queue is completely empty
      if (this.queue.length === 0 && this.processing.size === 0) {
        this.emit('queueEmpty');
      }
      return;
    }

    // Mark as processing
    commit.status = 'processing';
    commit.processingStartedAt = new Date();
    this.processing.add(commit.sha);

    this.emit('commitProcessing', commit);

    console.log(
      `⚙️  Processing commit: ${commit.sha.substring(0, 8)} (${this.processing.size}/${this.concurrency} slots)`
    );

    try {
      await this.processCommit(commit);
    } catch (error) {
      console.error(
        `Error processing commit ${commit.sha.substring(0, 8)}:`,
        error instanceof Error ? error.message : error
      );
    } finally {
      this.processing.delete(commit.sha);

      // Process next commit
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Process a single commit
   */
  private async processCommit(commit: QueuedCommit): Promise<void> {
    try {
      // Run CommitTracer
      console.log(`🔗 Tracing commit ${commit.sha.substring(0, 8)}...`);

      const chain: CommitChain = await this.tracer.traceCommit(
        commit.sha,
        commit.projectId
      );

      console.log(
        `✅ Traced commit ${commit.sha.substring(0, 8)}: ` +
          `${chain.mergeRequests.length} MRs, ` +
          `${chain.issues.length} issues, ` +
          `${chain.epics.length} epics`
      );

      // Mark as completed
      commit.status = 'completed';
      commit.processingCompletedAt = new Date();

      // Move from queue to processed
      this.moveToProcessed(commit);

      const event: CommitProcessedEvent = {
        commit,
        success: true,
      };

      this.emit('commitProcessed', event, chain);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      console.error(
        `❌ Failed to trace commit ${commit.sha.substring(0, 8)}:`,
        err.message
      );

      commit.retries++;

      // Check if we should retry
      if (commit.retries < this.maxRetries) {
        console.log(
          `🔄 Will retry commit ${commit.sha.substring(0, 8)} (attempt ${commit.retries + 1}/${this.maxRetries})`
        );

        // Reset to pending for retry
        commit.status = 'pending';

        // Schedule retry with delay
        setTimeout(() => {
          this.processNext();
        }, this.retryDelayMs);
      } else {
        console.error(
          `💀 Commit ${commit.sha.substring(0, 8)} failed after ${commit.retries} retries`
        );

        commit.status = 'failed';
        commit.error = err.message;
        commit.processingCompletedAt = new Date();

        this.moveToProcessed(commit);

        const event: CommitProcessedEvent = {
          commit,
          success: false,
          error: err.message,
        };

        this.emit('commitProcessed', event);
      }
    }
  }

  /**
   * Move a commit from queue to processed
   */
  private moveToProcessed(commit: QueuedCommit): void {
    const index = this.queue.findIndex((c) => c.sha === commit.sha);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
    this.processed.set(commit.sha, commit);
  }

  /**
   * Get current queue
   */
  public getQueue(): QueuedCommit[] {
    return [...this.queue];
  }

  /**
   * Get all processed commits
   */
  public getProcessed(): QueuedCommit[] {
    return Array.from(this.processed.values());
  }

  /**
   * Get a specific processed commit
   */
  public getProcessedCommit(sha: string): QueuedCommit | undefined {
    return this.processed.get(sha);
  }

  /**
   * Get queue statistics
   */
  public getStats() {
    const pending = this.queue.filter((c) => c.status === 'pending').length;
    const processing = this.queue.filter((c) => c.status === 'processing').length;
    const completed = Array.from(this.processed.values()).filter(
      (c) => c.status === 'completed'
    ).length;
    const failed = Array.from(this.processed.values()).filter(
      (c) => c.status === 'failed'
    ).length;

    return {
      queueSize: this.queue.length,
      pending,
      processing,
      activeSlots: this.processing.size,
      maxConcurrency: this.concurrency,
      totalProcessed: this.processed.size,
      completed,
      failed,
    };
  }

  /**
   * Retry a failed commit
   */
  public retry(sha: string): void {
    const commit = this.processed.get(sha);

    if (!commit) {
      throw new Error(`Commit not found: ${sha}`);
    }

    if (commit.status !== 'failed') {
      throw new Error(`Commit ${sha.substring(0, 8)} is not in failed state`);
    }

    console.log(`🔄 Retrying failed commit: ${sha.substring(0, 8)}`);

    // Remove from processed
    this.processed.delete(sha);

    // Reset and re-queue
    commit.status = 'pending';
    commit.retries = 0;
    commit.error = undefined;
    commit.processingStartedAt = undefined;
    commit.processingCompletedAt = undefined;

    this.queue.push(commit);

    // Start processing
    this.processNext();
  }

  /**
   * Clear processed history
   */
  public clearProcessed(): void {
    this.processed.clear();
    console.log('🧹 Cleared processed commits history');
  }

  /**
   * Clear the entire queue (cancel pending)
   */
  public clearQueue(): void {
    const pending = this.queue.filter((c) => c.status === 'pending');
    this.queue = [];
    console.log(`🧹 Cleared queue (${pending.length} pending commits cancelled)`);
  }
}
