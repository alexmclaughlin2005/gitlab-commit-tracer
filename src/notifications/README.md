# Notifications Module

The notifications module provides a flexible system for sending alerts to external services (Slack, Discord, email, etc.) when commits are detected, traced, or analyzed.

## Overview

The notification system is built with a provider-based architecture that allows easy integration of multiple notification services. Currently, Slack is the primary supported provider using Incoming Webhooks.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Notification Service                    │
│              (Central coordination layer)                │
└────────────────┬───────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│ Slack  │  │Discord │  │ Email  │
│Provider│  │Provider│  │Provider│
└────────┘  └────────┘  └────────┘
```

## Features

- **Event-driven**: Integrates seamlessly with FeedMonitor and CommitProcessor events
- **Multiple providers**: Support for Slack, with easy extension to Discord, Teams, email
- **Configurable**: Control which events trigger notifications and what content is included
- **Non-blocking**: Notifications sent asynchronously without slowing down processing
- **Rich formatting**: Beautiful Slack messages with Block Kit formatting
- **Error resilient**: Provider failures don't stop the main processing pipeline

## Components

### 1. Notification Service ([notification-service.ts](notification-service.ts))

Central coordinator that manages multiple notification providers.

**Key methods:**
- `registerProvider(provider)` - Add a notification provider
- `send(event)` - Send notification to all providers
- `notifyCommitDetected()` - Helper for commit detection events
- `notifyAnalysisComplete()` - Helper for analysis completion events
- `notifyError()` - Helper for error events

### 2. Slack Client ([slack-client.ts](slack-client.ts))

Slack-specific implementation using Incoming Webhooks.

**Features:**
- Webhook-based (no OAuth required)
- Configurable via environment variables
- Rich message formatting with Block Kit
- Per-event-type enabling/disabling

### 3. Slack Formatter ([formatters/slack-formatter.ts](formatters/slack-formatter.ts))

Formats notification events into Slack Block Kit messages.

**Supported events:**
- Commit detected (optional)
- Commit traced (optional)
- Analysis complete (main notification) ✨
- Error notifications

### 4. Types ([types.ts](types.ts))

TypeScript interfaces and types for the notification system.

## Usage

### Basic Setup

The notification system is automatically initialized in the server if configured:

```typescript
import { getNotificationService, createSlackClientFromEnv } from './notifications';

// Initialize service
const notificationService = getNotificationService();

// Register Slack provider
const slackClient = createSlackClientFromEnv();
if (slackClient) {
  notificationService.registerProvider(slackClient);
}
```

### Sending Notifications

#### Commit Detected

```typescript
await notificationService.notifyCommitDetected({
  projectId: '23559266',
  projectName: 'My Project',
  sha: 'abc123...',
  title: 'Fix authentication bug',
  authorName: 'John Doe',
  authorEmail: 'john@example.com',
  branch: 'main',
  committedAt: new Date(),
  commitUrl: 'https://gitlab.com/...',
});
```

#### Analysis Complete (Main Notification)

```typescript
await notificationService.notifyAnalysisComplete({
  projectId: '23559266',
  projectName: 'My Project',
  sha: 'abc123...',
  title: 'Fix authentication bug',
  authorName: 'John Doe',
  authorEmail: 'john@example.com',
  branch: 'main',
  committedAt: new Date(),
  chain: commitChain,
  analysis: analysisResult,
  updates: stakeholderUpdates,
  gitlabUrl: 'https://gitlab.com',
});
```

#### Error

```typescript
await notificationService.notifyError({
  projectId: '23559266',
  sha: 'abc123...',
  error: 'Failed to analyze commit',
  stackTrace: error.stack,
});
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Required
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional
SLACK_ENABLED=true
SLACK_CHANNEL=#gitlab-commits
SLACK_USERNAME=GitLab Commit Tracer
SLACK_ICON_EMOJI=:gitlab:

# Event control (defaults shown)
SLACK_NOTIFY_ON_DETECT=false
SLACK_NOTIFY_ON_TRACE=false
SLACK_NOTIFY_ON_COMPLETE=true
SLACK_NOTIFY_ON_ERROR=true

# Content control (defaults shown)
SLACK_INCLUDE_BUSINESS_UPDATE=true
SLACK_INCLUDE_TECHNICAL_UPDATE=false
SLACK_INCLUDE_FULL_ANALYSIS=false
```

### Getting a Slack Webhook URL

1. Go to your Slack workspace settings
2. Navigate to **Apps** → **Incoming Webhooks**
3. Click "Add to Slack"
4. Choose a channel for notifications
5. Copy the webhook URL

Full guide: https://api.slack.com/messaging/webhooks

## Notification Events

### 1. Commit Detected
**When:** New commit discovered by FeedMonitor
**Enabled by default:** No
**Contains:**
- Commit SHA and message
- Author and branch
- GitLab link

**Use case:** High-frequency notifications, usually disabled

### 2. Commit Traced
**When:** Commit successfully traced through GitLab
**Enabled by default:** No
**Contains:**
- Commit details
- Relationship counts (MRs, Issues, Epics)

**Use case:** Intermediate tracking, usually disabled

### 3. Analysis Complete ✨
**When:** AI analysis and stakeholder updates generated
**Enabled by default:** Yes
**Contains:**
- Full commit details
- Complete relationship chain with links
- AI confidence score
- Business update (always)
- Technical update (optional)
- Full analysis details (optional)

**Use case:** Main notification - this is what stakeholders see!

### 4. Error
**When:** Processing or analysis fails
**Enabled by default:** Yes
**Contains:**
- Error message
- Stack trace
- Context information

**Use case:** Alert team to issues

## Message Formatting

### Analysis Complete Message Structure

```
┌─────────────────────────────────────────┐
│ ✨ AI Analysis Complete                 │
├─────────────────────────────────────────┤
│ Commit:    abc123 (linked)              │
│ Author:    John Doe                     │
│ Project:   My Project                   │
│ Confidence: 95%                         │
├─────────────────────────────────────────┤
│ Commit Message:                         │
│ Fix authentication bug                  │
├─────────────────────────────────────────┤
│ Merge Requests:                         │
│ !42 Fix auth token validation           │
│                                         │
│ Issues:                                 │
│ #123 Users can't login                  │
│                                         │
│ Epics:                                  │
│ &5 Authentication Improvements          │
├─────────────────────────────────────────┤
│ 📊 Business Update:                     │
│ Fixed critical login issue affecting... │
│                                         │
│ 🔧 Technical Update: (optional)         │
│ Updated token validation logic...       │
├─────────────────────────────────────────┤
│ Committed 2 hours ago | Analyzed now    │
└─────────────────────────────────────────┘
```

## API Endpoints

### GET /api/notifications/status
Get current notification configuration

**Response:**
```json
{
  "enabled": true,
  "providers": [
    {
      "name": "slack",
      "config": {
        "enabled": true,
        "notifyOnComplete": true,
        ...
      }
    }
  ]
}
```

### POST /api/notifications/test
Test notification connections

**Response:**
```json
{
  "success": true,
  "results": {
    "slack": true
  }
}
```

## Adding New Providers

To add a new notification provider (e.g., Discord, Teams, email):

1. **Implement the NotificationProvider interface:**

```typescript
export class DiscordClient implements NotificationProvider {
  readonly name = 'discord';

  async send(event: AnyNotificationEvent): Promise<void> {
    // Format and send to Discord
  }

  async test(): Promise<boolean> {
    // Test connection
  }
}
```

2. **Create a formatter:**

```typescript
// formatters/discord-formatter.ts
export function formatDiscordMessage(event: AnyNotificationEvent): DiscordMessage {
  // Format message for Discord
}
```

3. **Add configuration support:**

```typescript
export function createDiscordClientFromEnv(): DiscordClient | null {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return null;
  // ...
}
```

4. **Register in server:**

```typescript
const discordClient = createDiscordClientFromEnv();
if (discordClient) {
  notificationService.registerProvider(discordClient);
}
```

## Best Practices

### 1. Event Selection
- **Enable:** Analysis complete, errors
- **Disable:** Commit detected, traced (too noisy)

### 2. Content Selection
- **Always include:** Business update (non-technical stakeholders)
- **Optionally include:** Technical update (for dev channels)
- **Rarely include:** Full analysis (very verbose)

### 3. Channel Strategy
- **#gitlab-updates**: All analysis complete notifications
- **#gitlab-errors**: Error notifications only
- **#dev-team**: Include technical updates

### 4. Error Handling
Notifications are fire-and-forget - failures are logged but don't stop processing:

```typescript
notificationService.send(event).catch(error => {
  console.error('Notification failed:', error);
  // Processing continues normally
});
```

## Testing

### Test Slack Connection

```bash
curl -X POST http://localhost:3005/api/notifications/test
```

### Manual Test Message

```typescript
const notificationService = getNotificationService();
await notificationService.notifyError({
  projectId: 'test',
  error: 'This is a test notification',
});
```

## Troubleshooting

### Notifications not sending

1. Check `SLACK_ENABLED=true` in `.env`
2. Verify `SLACK_WEBHOOK_URL` is correct
3. Check event is enabled (`SLACK_NOTIFY_ON_COMPLETE=true`)
4. Review server logs for errors

### Messages not formatted correctly

1. Check Slack webhook URL is valid
2. Verify GitLab URLs are accessible
3. Test with `/api/notifications/test` endpoint

### Rate limiting

Slack webhooks have rate limits:
- 1 message per second per webhook
- If exceeded, errors are logged but processing continues

## Performance

- Notifications are sent asynchronously
- Provider failures don't block main processing
- Average latency: <100ms per notification
- No retry logic (fire-and-forget)

## Security

- Webhook URLs contain secrets - never commit to git
- Use environment variables for all sensitive config
- Webhook URLs are not exposed via API endpoints
- Messages don't contain sensitive commit content (only metadata)

## Future Enhancements

- [ ] Discord provider
- [ ] Microsoft Teams provider
- [ ] Email notifications via SendGrid/AWS SES
- [ ] Notification batching (digest mode)
- [ ] User-specific notification preferences
- [ ] Notification scheduling (quiet hours)
- [ ] Retry logic with exponential backoff
- [ ] Notification delivery tracking

## Related Documentation

- [Architecture](../../docs/architecture.md)
- [Monitoring System](../monitoring/README.md)
- [AI Analysis](../analysis/README.md)
