/**
 * Slack Client
 *
 * Sends notifications to Slack using Incoming Webhooks
 */

import { IncomingWebhook } from '@slack/webhook';
import type { NotificationProvider, AnyNotificationEvent, SlackConfig } from './types';
import { formatSlackMessage } from './formatters/slack-formatter';

/**
 * Slack notification provider
 */
export class SlackClient implements NotificationProvider {
  public readonly name = 'slack';
  private webhook: IncomingWebhook;
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
    this.webhook = new IncomingWebhook(config.webhookUrl, {
      username: config.username || 'GitLab Commit Tracer',
      icon_emoji: config.iconEmoji || ':gitlab:',
      channel: config.channel,
    });
  }

  /**
   * Send a notification to Slack
   */
  async send(event: AnyNotificationEvent): Promise<void> {
    // Check if notifications are enabled
    if (!this.config.enabled) {
      return;
    }

    // Check if this specific event type is enabled
    if (!this.shouldSendEvent(event.type)) {
      return;
    }

    try {
      const message = formatSlackMessage(event, this.config);
      await this.webhook.send(message);
      console.log(`📤 Slack notification sent: ${event.type}`);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  /**
   * Test the Slack connection
   */
  async test(): Promise<boolean> {
    try {
      await this.webhook.send({
        text: '✅ GitLab Commit Tracer notification test successful!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ *Test Notification*\n\nGitLab Commit Tracer is configured correctly and can send notifications to this channel.',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Tested at ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      });
      return true;
    } catch (error) {
      console.error('Slack connection test failed:', error);
      return false;
    }
  }

  /**
   * Check if we should send this event type
   */
  private shouldSendEvent(eventType: string): boolean {
    switch (eventType) {
      case 'commit_detected':
        return this.config.notifyOnDetect;
      case 'commit_traced':
        return this.config.notifyOnTrace;
      case 'analysis_complete':
        return this.config.notifyOnComplete;
      case 'error':
        return this.config.notifyOnError;
      default:
        return false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SlackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<SlackConfig, 'webhookUrl'> {
    const { webhookUrl, ...safeConfig } = this.config;
    return safeConfig;
  }
}

/**
 * Create a Slack client from environment variables
 */
export function createSlackClientFromEnv(): SlackClient | null {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL not configured, Slack notifications disabled');
    return null;
  }

  const config: SlackConfig = {
    enabled: process.env.SLACK_ENABLED !== 'false',
    webhookUrl,
    channel: process.env.SLACK_CHANNEL,
    username: process.env.SLACK_USERNAME || 'GitLab Commit Tracer',
    iconEmoji: process.env.SLACK_ICON_EMOJI || ':gitlab:',
    notifyOnDetect: process.env.SLACK_NOTIFY_ON_DETECT === 'true',
    notifyOnTrace: process.env.SLACK_NOTIFY_ON_TRACE === 'true',
    notifyOnComplete: process.env.SLACK_NOTIFY_ON_COMPLETE !== 'false', // Default true
    notifyOnError: process.env.SLACK_NOTIFY_ON_ERROR !== 'false', // Default true
    includeFullAnalysis: process.env.SLACK_INCLUDE_FULL_ANALYSIS === 'true',
    includeTechnicalUpdate: process.env.SLACK_INCLUDE_TECHNICAL_UPDATE === 'true',
    includeBusinessUpdate: process.env.SLACK_INCLUDE_BUSINESS_UPDATE !== 'false', // Default true
  };

  return new SlackClient(config);
}
