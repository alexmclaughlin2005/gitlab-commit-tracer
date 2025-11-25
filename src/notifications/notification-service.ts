/**
 * Notification Service
 *
 * Central service for managing and sending notifications to various providers
 */

import type {
  NotificationProvider,
  AnyNotificationEvent,
  NotificationEventType,
  CommitDetectedEvent,
  AnalysisCompleteEvent,
  ErrorEvent,
} from './types';
import type { CommitChain } from '../tracing/types';
import type { AnalysisResult, StakeholderUpdate } from '../analysis/types';

/**
 * Notification service manages multiple notification providers
 */
export class NotificationService {
  private providers: Map<string, NotificationProvider> = new Map();

  /**
   * Register a notification provider
   */
  registerProvider(provider: NotificationProvider): void {
    this.providers.set(provider.name, provider);
    console.log(`✅ Notification provider registered: ${provider.name}`);
  }

  /**
   * Unregister a notification provider
   */
  unregisterProvider(providerName: string): void {
    this.providers.delete(providerName);
    console.log(`❌ Notification provider unregistered: ${providerName}`);
  }

  /**
   * Get a provider by name
   */
  getProvider(providerName: string): NotificationProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get all registered providers
   */
  getProviders(): NotificationProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Send a notification to all registered providers
   */
  async send(event: AnyNotificationEvent): Promise<void> {
    if (this.providers.size === 0) {
      return; // No providers registered
    }

    const sendPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.send(event);
      } catch (error) {
        console.error(`Failed to send notification via ${provider.name}:`, error);
        // Don't throw - we don't want one provider failure to stop others
      }
    });

    await Promise.allSettled(sendPromises);
  }

  /**
   * Test all registered providers
   */
  async testAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const providerEntries = Array.from(this.providers.entries());

    for (const [name, provider] of providerEntries) {
      try {
        const success = await provider.test();
        results.set(name, success);
      } catch (error) {
        console.error(`Test failed for ${name}:`, error);
        results.set(name, false);
      }
    }

    return results;
  }

  // =============================================================================
  // Helper methods to create specific notification events
  // =============================================================================

  /**
   * Notify about a newly detected commit
   */
  async notifyCommitDetected(params: {
    projectId: string;
    projectName?: string;
    sha: string;
    title: string;
    authorName: string;
    authorEmail: string;
    branch: string;
    committedAt: Date;
    commitUrl?: string;
  }): Promise<void> {
    const event: CommitDetectedEvent = {
      type: 'commit_detected' as NotificationEventType.COMMIT_DETECTED,
      timestamp: new Date(),
      ...params,
    };

    await this.send(event);
  }

  /**
   * Notify about completed AI analysis (main notification)
   */
  async notifyAnalysisComplete(params: {
    projectId: string;
    projectName?: string;
    sha: string;
    title: string;
    authorName: string;
    authorEmail: string;
    branch: string;
    committedAt: Date;
    chain: CommitChain;
    analysis: AnalysisResult;
    updates: StakeholderUpdate;
    gitlabUrl?: string;
  }): Promise<void> {
    // Build URLs for GitLab entities
    const commitUrl = params.gitlabUrl
      ? `${params.gitlabUrl}/${params.projectId}/-/commit/${params.sha}`
      : undefined;

    const mrUrls = params.gitlabUrl
      ? params.chain.mergeRequests.map(
          (mrLink) => `${params.gitlabUrl}/${params.projectId}/-/merge_requests/${mrLink.mergeRequest.iid}`
        )
      : undefined;

    const issueUrls = params.gitlabUrl
      ? params.chain.issues.map((issueLink) => `${params.gitlabUrl}/${params.projectId}/-/issues/${issueLink.issue.iid}`)
      : undefined;

    const epicUrls = params.gitlabUrl
      ? params.chain.epics.map((epic) => {
          // Epics are at group level, try to extract from epic web_url if available
          if (epic.web_url) {
            return epic.web_url;
          }
          // Fallback: construct from group_id if available
          return `${params.gitlabUrl}/groups/${epic.group_id}/-/epics/${epic.iid}`;
        })
      : undefined;

    const event: AnalysisCompleteEvent = {
      type: 'analysis_complete' as NotificationEventType.ANALYSIS_COMPLETE,
      timestamp: new Date(),
      projectId: params.projectId,
      projectName: params.projectName,
      sha: params.sha,
      title: params.title,
      authorName: params.authorName,
      authorEmail: params.authorEmail,
      branch: params.branch,
      committedAt: params.committedAt,
      chain: params.chain,
      analysis: params.analysis,
      updates: params.updates,
      commitUrl,
      mrUrls,
      issueUrls,
      epicUrls,
    };

    await this.send(event);
  }

  /**
   * Notify about an error
   */
  async notifyError(params: {
    projectId: string;
    projectName?: string;
    sha?: string;
    error: string;
    stackTrace?: string;
    context?: Record<string, any>;
  }): Promise<void> {
    const event: ErrorEvent = {
      type: 'error' as NotificationEventType.ERROR,
      timestamp: new Date(),
      ...params,
    };

    await this.send(event);
  }
}

/**
 * Create a singleton notification service
 */
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
