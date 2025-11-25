# Slack Integration Setup Guide

This guide will help you set up Slack notifications for the GitLab Commit Tracer.

## Quick Start

### Step 1: Create a Slack Incoming Webhook

1. Go to your Slack workspace: `https://[your-workspace].slack.com/apps`
2. Search for "Incoming Webhooks" and click "Add to Slack"
3. Select the channel where you want notifications (e.g., `#gitlab-commits`)
4. Click "Add Incoming Webhooks integration"
5. Copy the Webhook URL (looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX`)

Full guide: https://api.slack.com/messaging/webhooks

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# Required
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional (defaults shown)
SLACK_ENABLED=true
SLACK_NOTIFY_ON_COMPLETE=true
SLACK_NOTIFY_ON_ERROR=true
SLACK_INCLUDE_BUSINESS_UPDATE=true
```

### Step 3: Restart Your Server

```bash
npm run dev:server
```

You should see in the logs:
```
✅ Slack notifications enabled
```

### Step 4: Test the Connection

```bash
curl -X POST http://localhost:3005/api/notifications/test
```

Expected response:
```json
{
  "success": true,
  "results": {
    "slack": true
  }
}
```

You should receive a test message in your Slack channel!

## Configuration Options

### Event Control

Control which events trigger notifications:

```env
# Commit detected (usually disabled - too noisy)
SLACK_NOTIFY_ON_DETECT=false

# Commit traced (usually disabled)
SLACK_NOTIFY_ON_TRACE=false

# AI analysis complete (main notification) ✨
SLACK_NOTIFY_ON_COMPLETE=true

# Processing errors
SLACK_NOTIFY_ON_ERROR=true
```

### Content Control

Control what information is included in notifications:

```env
# Business update (for non-technical stakeholders)
SLACK_INCLUDE_BUSINESS_UPDATE=true

# Technical update (for developers)
SLACK_INCLUDE_TECHNICAL_UPDATE=false

# Full AI analysis details (very verbose)
SLACK_INCLUDE_FULL_ANALYSIS=false
```

### Customization

Customize the bot appearance:

```env
# Default channel (optional - webhook has its own default)
SLACK_CHANNEL=#gitlab-commits

# Bot display name
SLACK_USERNAME=GitLab Commit Tracer

# Bot icon emoji
SLACK_ICON_EMOJI=:gitlab:
```

## What You'll Receive

### Analysis Complete Notification

When AI analysis finishes for a commit, you'll receive a rich Slack message with:

- **Header**: "✨ AI Analysis Complete"
- **Commit info**: SHA (linked), author, project, confidence score
- **Commit message**: Full title
- **Relationships**: Links to related MRs, Issues, and Epics in GitLab
- **Business Update**: AI-generated update for stakeholders (always included)
- **Technical Update**: Developer-focused details (optional)
- **Timestamps**: When committed and when analyzed

Example:
```
┌─────────────────────────────────────────┐
│ ✨ AI Analysis Complete                 │
├─────────────────────────────────────────┤
│ Commit:    abc123 (link to GitLab)      │
│ Author:    John Doe                     │
│ Project:   My Project                   │
│ Confidence: 95%                         │
├─────────────────────────────────────────┤
│ Commit Message:                         │
│ Fix authentication bug in login flow    │
├─────────────────────────────────────────┤
│ Merge Requests:                         │
│ !42 Fix auth token validation (link)    │
│                                         │
│ Issues:                                 │
│ #123 Users can't login (link)           │
│                                         │
│ Epics:                                  │
│ &5 Authentication Improvements (link)   │
├─────────────────────────────────────────┤
│ 📊 Business Update:                     │
│ Fixed critical login issue affecting    │
│ enterprise customers. This resolves     │
│ authentication failures and improves    │
│ security compliance.                    │
├─────────────────────────────────────────┤
│ Committed 2 hours ago | Analyzed now    │
└─────────────────────────────────────────┘
```

### Error Notification

If processing fails, you'll receive an error notification:

```
┌─────────────────────────────────────────┐
│ ❌ Processing Error                     │
├─────────────────────────────────────────┤
│ Project: My Project                     │
│ Commit:  abc123                         │
├─────────────────────────────────────────┤
│ Error:                                  │
│ Failed to analyze commit: API timeout   │
├─────────────────────────────────────────┤
│ Occurred just now                       │
└─────────────────────────────────────────┘
```

## Recommended Configuration

### For Product/Business Teams
```env
SLACK_NOTIFY_ON_COMPLETE=true
SLACK_NOTIFY_ON_ERROR=false
SLACK_INCLUDE_BUSINESS_UPDATE=true
SLACK_INCLUDE_TECHNICAL_UPDATE=false
SLACK_CHANNEL=#product-updates
```

### For Development Teams
```env
SLACK_NOTIFY_ON_COMPLETE=true
SLACK_NOTIFY_ON_ERROR=true
SLACK_INCLUDE_BUSINESS_UPDATE=true
SLACK_INCLUDE_TECHNICAL_UPDATE=true
SLACK_CHANNEL=#dev-commits
```

### For Leadership/Executives
```env
SLACK_NOTIFY_ON_COMPLETE=true
SLACK_NOTIFY_ON_ERROR=false
SLACK_INCLUDE_BUSINESS_UPDATE=true
SLACK_INCLUDE_TECHNICAL_UPDATE=false
SLACK_INCLUDE_FULL_ANALYSIS=false
SLACK_CHANNEL=#executive-updates
```

## Multiple Channels

Want to send to different channels? Create multiple webhooks:

1. Set up multiple Incoming Webhooks in Slack (one per channel)
2. Use the primary webhook in `SLACK_WEBHOOK_URL`
3. For additional channels, you'll need to extend the code (future enhancement)

Alternatively, use Slack's workflow automation to forward messages to other channels.

## Troubleshooting

### Notifications Not Sending

**Check 1: Is Slack enabled?**
```bash
curl http://localhost:3005/api/notifications/status
```

Should return:
```json
{
  "enabled": true,
  "providers": [{"name": "slack", ...}]
}
```

**Check 2: Is the webhook URL correct?**
- Verify `SLACK_WEBHOOK_URL` in `.env`
- URL should start with `https://hooks.slack.com/services/`
- Test with: `curl -X POST http://localhost:3005/api/notifications/test`

**Check 3: Are the right events enabled?**
- Check `SLACK_NOTIFY_ON_COMPLETE=true`
- Check `SLACK_ENABLED=true`

**Check 4: Server logs**
Look for:
```
✅ Slack notifications enabled
📤 Notification sent for abc123
```

Or errors:
```
❌ Failed to send Slack notification: ...
```

### Rate Limiting

Slack webhooks have a limit of **1 message per second**. If you're processing many commits:
- The system handles this gracefully (errors are logged but processing continues)
- Consider batching notifications (future enhancement)
- Reduce notification frequency

### Message Formatting Issues

If links don't work:
- Verify `GITLAB_URL` is set correctly in `.env`
- Should be: `https://gitlab.com` or your GitLab instance URL
- Links are auto-generated from this base URL

## Production Deployment

### Railway/Vercel Setup

Add environment variables in Railway dashboard:

1. Go to your Railway project
2. Click "Variables"
3. Add `SLACK_WEBHOOK_URL` and other config
4. Redeploy

The webhook URL is **secret** - never commit it to git!

### Security

- Webhook URLs contain authentication tokens
- Treat them like API keys
- Rotate periodically if compromised
- Use environment variables only

## API Endpoints

### Check Status
```bash
GET /api/notifications/status
```

### Test Connection
```bash
POST /api/notifications/test
```

## Need Help?

- See [src/notifications/README.md](src/notifications/README.md) for detailed documentation
- Check server logs for error messages
- Verify webhook URL in Slack settings
- Test with simple curl commands first

## Next Steps

After Slack is working:
- Adjust content settings to your preference
- Set up different channels for different teams
- Consider adding Discord or Teams (similar setup)
- Configure error notifications separately
