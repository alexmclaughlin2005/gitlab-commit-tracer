/**
 * Notification System Types
 *
 * Types and interfaces for the notification system that sends alerts
 * to external services (Slack, Discord, email, etc.)
 */

import type { CommitChain } from '../tracing/types';
import type { AnalysisResult, StakeholderUpdate } from '../analysis/types';

/**
 * Notification event types
 */
export enum NotificationEventType {
  /** New commit detected */
  COMMIT_DETECTED = 'commit_detected',
  /** Commit traced through GitLab */
  COMMIT_TRACED = 'commit_traced',
  /** AI analysis completed */
  ANALYSIS_COMPLETE = 'analysis_complete',
  /** Processing error occurred */
  ERROR = 'error',
}

/**
 * Base notification event
 */
export interface NotificationEvent {
  /** Event type */
  type: NotificationEventType;
  /** Timestamp of event */
  timestamp: Date;
  /** Project ID */
  projectId: string;
  /** Project name */
  projectName?: string;
}

/**
 * Commit detected notification
 */
export interface CommitDetectedEvent extends NotificationEvent {
  type: NotificationEventType.COMMIT_DETECTED;
  /** Commit SHA */
  sha: string;
  /** Commit title */
  title: string;
  /** Author name */
  authorName: string;
  /** Author email */
  authorEmail: string;
  /** Branch name */
  branch: string;
  /** Commit timestamp */
  committedAt: Date;
  /** GitLab commit URL */
  commitUrl?: string;
}

/**
 * Commit traced notification
 */
export interface CommitTracedEvent extends NotificationEvent {
  type: NotificationEventType.COMMIT_TRACED;
  /** Commit SHA */
  sha: string;
  /** Commit title */
  title: string;
  /** Complete traced chain */
  chain: CommitChain;
  /** GitLab commit URL */
  commitUrl?: string;
}

/**
 * Analysis complete notification (most detailed)
 */
export interface AnalysisCompleteEvent extends NotificationEvent {
  type: NotificationEventType.ANALYSIS_COMPLETE;
  /** Commit SHA */
  sha: string;
  /** Commit title */
  title: string;
  /** Author name */
  authorName: string;
  /** Author email */
  authorEmail: string;
  /** Branch name */
  branch: string;
  /** Commit timestamp */
  committedAt: Date;
  /** Complete traced chain */
  chain: CommitChain;
  /** AI analysis result */
  analysis: AnalysisResult;
  /** Stakeholder updates */
  updates: StakeholderUpdate;
  /** GitLab commit URL */
  commitUrl?: string;
  /** GitLab MR URLs */
  mrUrls?: string[];
  /** GitLab issue URLs */
  issueUrls?: string[];
  /** GitLab epic URLs */
  epicUrls?: string[];
}

/**
 * Error notification
 */
export interface ErrorEvent extends NotificationEvent {
  type: NotificationEventType.ERROR;
  /** Commit SHA (if applicable) */
  sha?: string;
  /** Error message */
  error: string;
  /** Error stack trace */
  stackTrace?: string;
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Union type of all notification events
 */
export type AnyNotificationEvent =
  | CommitDetectedEvent
  | CommitTracedEvent
  | AnalysisCompleteEvent
  | ErrorEvent;

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Enable notifications globally */
  enabled: boolean;
  /** Enable commit detected notifications */
  notifyOnDetect: boolean;
  /** Enable commit traced notifications */
  notifyOnTrace: boolean;
  /** Enable analysis complete notifications */
  notifyOnComplete: boolean;
  /** Enable error notifications */
  notifyOnError: boolean;
  /** Additional provider-specific config */
  [key: string]: any;
}

/**
 * Notification provider interface
 */
export interface NotificationProvider {
  /** Provider name */
  readonly name: string;

  /** Send a notification */
  send(event: AnyNotificationEvent): Promise<void>;

  /** Test the notification connection */
  test(): Promise<boolean>;
}

/**
 * Slack-specific configuration
 */
export interface SlackConfig extends NotificationConfig {
  /** Slack webhook URL */
  webhookUrl: string;
  /** Default channel (optional, webhook can have default) */
  channel?: string;
  /** Bot username */
  username?: string;
  /** Bot icon emoji */
  iconEmoji?: string;
  /** Include full AI analysis in messages */
  includeFullAnalysis?: boolean;
  /** Include technical updates */
  includeTechnicalUpdate?: boolean;
  /** Include business updates */
  includeBusinessUpdate?: boolean;
}
