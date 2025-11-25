/**
 * Slack Message Formatter
 *
 * Formats notification events into Slack Block Kit messages
 */

import type {
  AnyNotificationEvent,
  CommitDetectedEvent,
  CommitTracedEvent,
  AnalysisCompleteEvent,
  ErrorEvent,
  SlackConfig,
} from '../types';

/**
 * Slack Block Kit message format
 */
export interface SlackMessage {
  text: string; // Fallback text
  blocks?: any[]; // Slack Block Kit blocks
  username?: string;
  icon_emoji?: string;
  channel?: string;
}

/**
 * Format notification event as Slack message
 */
export function formatSlackMessage(
  event: AnyNotificationEvent,
  config: SlackConfig
): SlackMessage {
  switch (event.type) {
    case 'commit_detected':
      return formatCommitDetected(event, config);
    case 'commit_traced':
      return formatCommitTraced(event, config);
    case 'analysis_complete':
      return formatAnalysisComplete(event, config);
    case 'error':
      return formatError(event, config);
    default:
      return {
        text: 'Unknown notification event',
        username: config.username,
        icon_emoji: config.iconEmoji,
        channel: config.channel,
      };
  }
}

/**
 * Format commit detected event
 */
function formatCommitDetected(event: CommitDetectedEvent, config: SlackConfig): SlackMessage {
  const shortSha = event.sha.substring(0, 8);
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔍 New Commit Detected',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Commit:*\n${event.commitUrl ? `<${event.commitUrl}|${shortSha}>` : shortSha}`,
        },
        {
          type: 'mrkdwn',
          text: `*Branch:*\n${event.branch}`,
        },
        {
          type: 'mrkdwn',
          text: `*Author:*\n${event.authorName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Project:*\n${event.projectName || event.projectId}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Message:*\n${event.title}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Committed ${formatTimestamp(event.committedAt)}`,
        },
      ],
    },
  ];

  return {
    text: `New commit detected: ${event.title}`,
    blocks,
    username: config.username,
    icon_emoji: config.iconEmoji,
    channel: config.channel,
  };
}

/**
 * Format commit traced event
 */
function formatCommitTraced(event: CommitTracedEvent, config: SlackConfig): SlackMessage {
  const shortSha = event.sha.substring(0, 8);
  const { chain } = event;

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔗 Commit Traced',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Commit:*\n${event.commitUrl ? `<${event.commitUrl}|${shortSha}>` : shortSha}`,
        },
        {
          type: 'mrkdwn',
          text: `*Message:*\n${event.title}`,
        },
      ],
    },
  ];

  // Add relationship chain
  const chainParts: string[] = [];
  if (chain.mergeRequests.length > 0) {
    chainParts.push(`${chain.mergeRequests.length} MR(s)`);
  }
  if (chain.issues.length > 0) {
    chainParts.push(`${chain.issues.length} Issue(s)`);
  }
  if (chain.epics.length > 0) {
    chainParts.push(`${chain.epics.length} Epic(s)`);
  }

  if (chainParts.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Relationships:*\n${chainParts.join(' → ')}`,
      },
    });
  }

  return {
    text: `Commit traced: ${event.title}`,
    blocks,
    username: config.username,
    icon_emoji: config.iconEmoji,
    channel: config.channel,
  };
}

/**
 * Format analysis complete event (main notification)
 */
function formatAnalysisComplete(event: AnalysisCompleteEvent, config: SlackConfig): SlackMessage {
  const shortSha = event.sha.substring(0, 8);
  const { chain, analysis, updates } = event;

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '✨ AI Analysis Complete',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Commit:*\n${event.commitUrl ? `<${event.commitUrl}|${shortSha}>` : shortSha}`,
        },
        {
          type: 'mrkdwn',
          text: `*Author:*\n${event.authorName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Project:*\n${event.projectName || event.projectId}`,
        },
        {
          type: 'mrkdwn',
          text: `*Confidence:*\n${Math.round(analysis.confidence * 100)}%`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Commit Message:*\n${event.title}`,
      },
    },
  ];

  // Add relationship chain with links
  const relationshipLines: string[] = [];

  if (event.mrUrls && event.mrUrls.length > 0) {
    const mrLinks = event.mrUrls
      .slice(0, 3)
      .map((url, i) => {
        const mrLink = chain.mergeRequests[i];
        const mr = mrLink.mergeRequest;
        return `<${url}|!${mr.iid} ${mr.title}>`;
      })
      .join('\n');
    relationshipLines.push(`*Merge Requests:*\n${mrLinks}`);
  }

  if (event.issueUrls && event.issueUrls.length > 0) {
    const issueLinks = event.issueUrls
      .slice(0, 3)
      .map((url, i) => {
        const issueLink = chain.issues[i];
        const issue = issueLink.issue;
        return `<${url}|#${issue.iid} ${issue.title}>`;
      })
      .join('\n');
    relationshipLines.push(`*Issues:*\n${issueLinks}`);
  }

  if (event.epicUrls && event.epicUrls.length > 0) {
    const epicLinks = event.epicUrls
      .slice(0, 3)
      .map((url, i) => {
        const epic = chain.epics[i];
        return `<${url}|&${epic.iid} ${epic.title}>`;
      })
      .join('\n');
    relationshipLines.push(`*Epics:*\n${epicLinks}`);
  }

  if (relationshipLines.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: relationshipLines.join('\n\n'),
      },
    });
  }

  blocks.push({
    type: 'divider',
  });

  // Add business update (always included by default)
  if (config.includeBusinessUpdate !== false && updates.businessUpdate) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📊 Business Update:*\n${updates.businessUpdate}`,
      },
    });
  }

  // Add technical update (optional)
  if (config.includeTechnicalUpdate && updates.technicalUpdate) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🔧 Technical Update:*\n${updates.technicalUpdate}`,
      },
    });
  }

  // Add full analysis details (optional)
  if (config.includeFullAnalysis) {
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Reason:*\n${analysis.reason.substring(0, 200)}${analysis.reason.length > 200 ? '...' : ''}`,
        },
        {
          type: 'mrkdwn',
          text: `*Approach:*\n${analysis.approach.substring(0, 200)}${analysis.approach.length > 200 ? '...' : ''}`,
        },
      ],
    });
  }

  // Add timestamp
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Committed ${formatTimestamp(event.committedAt)} | Analyzed ${formatTimestamp(event.timestamp)}`,
      },
    ],
  });

  return {
    text: `Analysis complete for ${event.title}`,
    blocks,
    username: config.username,
    icon_emoji: config.iconEmoji,
    channel: config.channel,
  };
}

/**
 * Format error event
 */
function formatError(event: ErrorEvent, config: SlackConfig): SlackMessage {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '❌ Processing Error',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Project:*\n${event.projectName || event.projectId}`,
        },
        ...(event.sha
          ? [
              {
                type: 'mrkdwn',
                text: `*Commit:*\n${event.sha.substring(0, 8)}`,
              },
            ]
          : []),
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:*\n\`\`\`${event.error}\`\`\``,
      },
    },
  ];

  if (event.stackTrace) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Stack Trace:*\n\`\`\`${event.stackTrace.substring(0, 500)}\`\`\``,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Occurred ${formatTimestamp(event.timestamp)}`,
      },
    ],
  });

  return {
    text: `Error: ${event.error}`,
    blocks,
    username: config.username,
    icon_emoji: config.iconEmoji,
    channel: config.channel,
  };
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}
