/**
 * Notifications Module
 *
 * Send notifications to external services (Slack, Discord, email, etc.)
 * when commits are detected, traced, or analyzed.
 */

export * from './types';
export * from './notification-service';
export * from './slack-client';
export { formatSlackMessage } from './formatters/slack-formatter';
