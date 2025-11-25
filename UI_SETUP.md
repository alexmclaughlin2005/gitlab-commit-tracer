# UI Setup Guide - GitLab Commit Tracer

## Overview

The GitLab Commit Tracer includes a web-based UI for visualizing and exploring commit chains. The UI consists of:

- **Express Server**: REST API backend ([src/server/index.ts](src/server/index.ts))
- **Web Dashboard**: HTML/CSS/JS frontend ([ui/public/index.html](ui/public/index.html))

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs both server dependencies (Express, CORS) and types.

### 2. Configure Environment

Make sure your `.env` file is configured:

```bash
cp .env.example .env
```

Edit `.env` with your GitLab credentials:

```env
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=your_token_here
GITLAB_PROJECT_ID=your-namespace/your-project
PORT=3000
```

### 3. Start the Server

```bash
npm run dev:server
```

The server will start on `http://localhost:3000`

### 4. Open the Dashboard

Open your browser and navigate to:

```
http://localhost:3000
```

You should see the GitLab Commit Tracer dashboard!

## Features

### 🔍 Commit Tracing

**Single Commit Trace**:
1. Enter a commit SHA in the input field
2. Click "Trace Single Commit"
3. View the complete chain visualization

**Recent Commits Trace**:
1. Set the number of commits to trace (1-20)
2. Optionally specify a branch name
3. Click "Trace Recent Commits"
4. View all traced chains with summary statistics

### 📊 Chain Visualization

Each traced commit displays:

- **Commit Info**: SHA, title, author, timestamp
- **Chain Flow**: Visual representation of Commit → MR → Issue → Epic
- **Statistics**: Duration, API calls, completeness status
- **Merge Requests**: All MRs that introduced the commit
- **Issues**: All issues closed by those MRs
- **Epics**: All epics containing those issues
- **Warnings**: Any issues encountered during tracing

### 🔗 Interactive Links

- All GitLab resources (commits, MRs, issues, epics) link to GitLab
- Click any link to open it in a new tab

### ⚡ Real-time Status

- Connection indicator shows GitLab connectivity
- Displays configured GitLab URL and project
- Updates automatically when server restarts

## API Endpoints

The server exposes the following REST API endpoints:

### Status

```http
GET /api/status
```

Returns server and GitLab connection status.

**Response**:
```json
{
  "status": "ok",
  "gitlabConnected": true,
  "gitlabUrl": "https://gitlab.com",
  "projectId": "my-project"
}
```

### List Commits

```http
GET /api/commits?per_page=20&page=1&branch=main
```

List recent commits from the project.

**Query Parameters**:
- `per_page` (optional): Number of commits per page (default: 20)
- `page` (optional): Page number (default: 1)
- `branch` (optional): Branch name

### Get Single Commit

```http
GET /api/commits/:sha
```

Get details of a specific commit.

### Trace Single Commit

```http
POST /api/trace/commit
Content-Type: application/json

{
  "sha": "abc123def456",
  "projectId": "optional-project-id"
}
```

Trace a single commit through its complete chain.

**Response**: `CommitChain` object

### Trace Multiple Commits

```http
POST /api/trace/commits
Content-Type: application/json

{
  "shas": ["abc123", "def456", "ghi789"],
  "projectId": "optional-project-id"
}
```

Trace multiple commits in batch.

**Response**: `BatchTraceResult` object

### Trace Recent Commits

```http
POST /api/trace/recent
Content-Type: application/json

{
  "count": 10,
  "branch": "main",
  "projectId": "optional-project-id"
}
```

Trace the N most recent commits from a branch.

**Response**: `BatchTraceResult` object

### List Merge Requests

```http
GET /api/merge-requests?per_page=20&state=merged
```

List merge requests from the project.

### List Issues

```http
GET /api/issues?per_page=20&state=opened
```

List issues from the project.

## Architecture

```
┌─────────────────────────────────────┐
│         Browser (Frontend)           │
│                                      │
│  • index.html                        │
│  • Vanilla JS (no build required)    │
│  • CSS for styling                   │
└──────────────┬───────────────────────┘
               │
               │ HTTP/REST API
               │
┌──────────────▼───────────────────────┐
│       Express Server (Backend)       │
│                                      │
│  • REST API endpoints                │
│  • Static file serving               │
│  • CORS enabled                      │
└──────────────┬───────────────────────┘
               │
               │
┌──────────────▼───────────────────────┐
│         GitLab API Client            │
│                                      │
│  • CommitTracer                      │
│  • GitLabClient                      │
│  • ChainCache                        │
└──────────────┬───────────────────────┘
               │
               │
┌──────────────▼───────────────────────┐
│           GitLab API                 │
│                                      │
│  • Commits, MRs, Issues, Epics       │
└──────────────────────────────────────┘
```

## Development

### Project Structure

```
src/server/
  └── index.ts          # Express server

ui/public/
  └── index.html        # Web dashboard (all-in-one file)
```

### Making Changes

**Server Changes**:

1. Edit `src/server/index.ts`
2. Server automatically restarts (via `tsx watch`)
3. Refresh browser to see changes

**UI Changes**:

1. Edit `ui/public/index.html`
2. Refresh browser to see changes (no build step!)

### Adding New API Endpoints

1. Add route handler in `src/server/index.ts`
2. Update this documentation
3. Update UI to call the new endpoint

Example:

```typescript
app.get('/api/my-endpoint', async (req: Request, res: Response) => {
  try {
    const result = await someOperation();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

## Customization

### Styling

The UI uses embedded CSS in `index.html`. To customize:

1. Locate the `<style>` block in `ui/public/index.html`
2. Modify colors, fonts, spacing, etc.
3. Refresh browser to see changes

**Color Scheme**:
- Primary: `#667eea` (purple)
- Secondary: `#764ba2` (deep purple)
- Success: `#27ae60` (green)
- Warning: `#ffc107` (yellow)
- Error: `#e74c3c` (red)

### Adding Features

To add new features to the UI:

1. Add HTML in the appropriate section
2. Add JavaScript function in the `<script>` block
3. Style it in the `<style>` block
4. Add corresponding API endpoint in server if needed

## Deployment

### Development

```bash
npm run dev:server
```

Access at: `http://localhost:3000`

### Production

1. Build the server:
```bash
npm run build:server
```

2. Set environment to production:
```bash
export NODE_ENV=production
```

3. Start the server:
```bash
npm start
```

4. Access at: `http://your-server:3000`

### Docker (Future)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build:server

EXPOSE 3000

CMD ["npm", "start"]
```

## Troubleshooting

### Server won't start

**Error**: `GITLAB_URL and GITLAB_TOKEN must be configured`

**Solution**: Make sure `.env` file exists and contains valid credentials.

### Can't connect to GitLab

**Error**: Status shows "Not connected to GitLab"

**Solutions**:
1. Check your `GITLAB_TOKEN` is valid and not expired
2. Verify `GITLAB_URL` is correct
3. Ensure token has `api` scope
4. Test connection: `curl -H "PRIVATE-TOKEN: your_token" https://gitlab.com/api/v4/user`

### UI loads but API calls fail

**Error**: Console shows CORS errors or network errors

**Solutions**:
1. Make sure server is running on port 3000
2. Check `API_BASE` constant in `index.html` matches server port
3. Ensure CORS is enabled (should be by default)

### Commits trace successfully but no MRs/Issues/Epics

**Possible Reasons**:
- Commit genuinely has no MR (direct push)
- Issues not linked to MRs properly
- Epics require GitLab Premium/Ultimate

**Check Warnings**: The UI displays any warnings in yellow boxes below each chain.

## Performance Tips

1. **Batch Tracing**: Use "Trace Recent Commits" instead of tracing commits one by one
2. **Caching**: The server uses caching to reduce API calls (default 5 min TTL)
3. **Limit Count**: When tracing recent commits, start with 5-10 to avoid rate limits
4. **Rate Limits**: GitLab has rate limits; the server handles this automatically

## Browser Compatibility

Tested and working on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

**Note**: Uses modern JavaScript (fetch API, async/await). IE11 not supported.

## Security Notes

⚠️ **Important Security Considerations**:

1. **Do not expose the server to the internet** without authentication
2. **Tokens are server-side only** - never exposed to the browser
3. **Use HTTPS** in production environments
4. **Set CORS appropriately** for production (`app.use(cors({ origin: 'your-domain' }))`)

## Next Steps

- [ ] Add authentication to the UI
- [ ] Add real-time updates with WebSockets
- [ ] Add export functionality (JSON, CSV)
- [ ] Add filter and search capabilities
- [ ] Add visualization graphs (D3.js, Chart.js)
- [ ] Add dark mode toggle

## Support

For issues or questions:
1. Check this documentation
2. Review server logs for error messages
3. Check browser console for client-side errors
4. Refer to [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) for project context

---

**UI Status**: ✅ Fully Functional
**Last Updated**: 2025-11-24
**Browser Requirements**: Modern browsers with ES6+ support
