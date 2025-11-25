# Deployment Guide

This guide covers deploying the GitLab Commit Tracer with a split architecture:
- **Backend**: Railway (or Render/Fly.io)
- **Frontend**: Vercel

## Architecture

```
Frontend (Vercel) → Backend API (Railway) → GitLab API
                                         → OpenAI API
```

## Backend Deployment (Railway)

### Prerequisites
- Railway account ([railway.app](https://railway.app))
- GitLab Personal Access Token
- OpenAI API Key

### Steps

1. **Create New Project on Railway**
   ```bash
   # Visit https://railway.app/new
   # Click "Deploy from GitHub repo"
   # Select your repository
   ```

2. **Configure Environment Variables**

   In Railway dashboard, add these environment variables:

   ```env
   # GitLab Configuration
   GITLAB_URL=https://gitlab.com
   GITLAB_TOKEN=your_gitlab_personal_access_token
   GITLAB_PROJECT_ID=your_project_id

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   AI_MODEL=gpt-4o

   # Application Configuration
   NODE_ENV=production
   LOG_LEVEL=info
   PORT=3005

   # CORS Configuration (will be updated after Vercel deployment)
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```

3. **Configure Build Settings**
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Root Directory: `/`

4. **Deploy**
   - Railway will automatically deploy on push to main branch
   - Note your backend URL: `https://your-app.railway.app`

### Database Setup (Future - Supabase)

When ready to add persistent storage:

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Get your PostgreSQL connection string
3. Add to Railway environment variables:
   ```env
   DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
   ```

## Frontend Deployment (Vercel)

### Prerequisites
- Vercel account ([vercel.com](https://vercel.com))
- Backend deployed and URL noted

### Steps

1. **Prepare Frontend Configuration**

   Update `ui/public/index.html` to use environment-aware API URL:

   ```javascript
   // Replace hardcoded API_BASE with:
   const API_BASE = window.location.hostname === 'localhost'
     ? 'http://localhost:3005/api'
     : 'https://your-app.railway.app/api';
   ```

2. **Create Vercel Project**
   ```bash
   # Visit https://vercel.com/new
   # Click "Import Git Repository"
   # Select your repository
   ```

3. **Configure Build Settings**
   - Framework Preset: `Other`
   - Root Directory: `ui`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Configure Environment Variables** (Optional)
   ```env
   VITE_API_URL=https://your-app.railway.app/api
   ```

5. **Deploy**
   - Vercel will automatically deploy
   - Note your frontend URL: `https://your-app.vercel.app`

6. **Update Backend CORS**
   - Go back to Railway
   - Update `ALLOWED_ORIGINS` environment variable with your Vercel URL
   - Redeploy backend

## Alternative: Monorepo Deployment on Railway Only

If you prefer to host everything on Railway:

1. **Serve Static Files from Express**

   Update `src/server/index.ts`:
   ```typescript
   // Serve static files from ui/dist
   app.use(express.static(path.join(__dirname, '../../ui/dist')));
   ```

2. **Update Build Command**
   ```bash
   npm run build && npm run build:ui
   ```

3. **Deploy to Railway**
   - Single deployment
   - Access at `https://your-app.railway.app`

## Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GITLAB_URL` | Yes | GitLab instance URL | `https://gitlab.com` |
| `GITLAB_TOKEN` | Yes | GitLab Personal Access Token | `glpat-xxxxx` |
| `GITLAB_PROJECT_ID` | Yes | Project ID or path | `23559266` |
| `OPENAI_API_KEY` | Yes | OpenAI API key | `sk-xxxxx` |
| `AI_MODEL` | No | OpenAI model to use | `gpt-4o` |
| `NODE_ENV` | No | Environment | `production` |
| `LOG_LEVEL` | No | Logging level | `info` |
| `PORT` | No | Server port | `3005` |
| `ALLOWED_ORIGINS` | No | CORS origins | `https://app.vercel.app` |

### Frontend (Vercel) - Optional

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | No | Backend API URL | `https://api.railway.app` |

## Monitoring & Logs

### Railway
- View logs: Railway Dashboard → Project → Deployments → Logs
- Metrics: Railway Dashboard → Project → Metrics
- Health: Backend automatically restarts on failure

### Vercel
- View logs: Vercel Dashboard → Project → Deployments → [Deployment] → Logs
- Analytics: Vercel Dashboard → Project → Analytics

## Troubleshooting

### Backend not starting
1. Check Railway logs for errors
2. Verify all environment variables are set
3. Ensure `PORT` is set correctly (Railway assigns this automatically)
4. Check that `config/projects.json` exists

### Frontend can't reach backend
1. Check CORS settings on backend
2. Verify API_BASE URL is correct in frontend
3. Check browser console for CORS errors
4. Ensure backend `ALLOWED_ORIGINS` includes your Vercel URL

### Monitoring not detecting commits
1. Check GitLab token permissions (needs `api` or `read_api` scope)
2. Verify project ID is correct
3. Check Railway logs for polling activity
4. Ensure monitoring is started via API: `POST /api/monitor/start`

## Cost Estimates

### Railway (Backend)
- Free tier: $5/month credit (enough for small projects)
- Paid: ~$5-10/month for hobby projects
- Includes: Compute + egress

### Vercel (Frontend)
- Free tier: Generous (perfect for this project)
- No costs expected for typical usage

### Supabase (Database - Future)
- Free tier: 500MB database, 2GB transfer
- Paid: $25/month for Pro (if needed)

## Next Steps

1. Deploy backend to Railway
2. Deploy frontend to Vercel
3. Test the full flow
4. (Optional) Add Supabase for persistence
5. (Optional) Set up monitoring alerts
6. (Optional) Add webhook support instead of polling

## Support

For issues with:
- **Deployment**: Check Railway/Vercel docs
- **Application**: Check GitHub issues
- **GitLab API**: Check GitLab API docs
