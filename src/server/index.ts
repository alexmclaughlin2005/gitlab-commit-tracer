/**
 * GitLab Commit Tracer Web Server
 *
 * Express server providing REST API and serving the web UI
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { GitLabClient } from '../api';
import { CommitTracer } from '../tracing';
import { CommitAnalyzer } from '../analysis';
import { FeedMonitor, CommitProcessor, monitorConfig } from '../monitoring';
import type { CommitChain } from '../tracing/types';
import type { AnalysisResult, StakeholderUpdate } from '../analysis/types';
import { persistCommitChain } from '../db/services/commit-persistence';
import { getNotificationService, createSlackClientFromEnv } from '../notifications';
import { clerkAuthMiddleware, authConfig } from '../middleware/auth';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// CORS configuration - allow all origins in development, specific origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*'];

console.log('🌐 CORS Configuration:');
console.log('  - Allowed Origins:', allowedOrigins);
console.log('  - NODE_ENV:', process.env.NODE_ENV);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // If ALLOWED_ORIGINS is *, allow all
    if (allowedOrigins.includes('*')) {
      callback(null, true);
      return;
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Authentication middleware (feature-flagged)
app.use(clerkAuthMiddleware);

// Serve static files from ui/public directory with HTML preprocessing
app.use(express.static(path.join(__dirname, '../../ui/public')));

// Custom middleware to inject Clerk publishable key into HTML files
app.use((req, res, next) => {
  if (req.path.endsWith('.html') && authConfig.enabled) {
    const filePath = path.join(__dirname, '../../ui/public', req.path);

    if (fs.existsSync(filePath)) {
      let html = fs.readFileSync(filePath, 'utf-8');

      // Replace placeholder with actual publishable key
      if (process.env.CLERK_PUBLISHABLE_KEY) {
        html = html.replace(/__CLERK_PUBLISHABLE_KEY__/g, process.env.CLERK_PUBLISHABLE_KEY);
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }
  }
  next();
});

// Type for monitored commits with analysis
interface MonitoredCommit {
  commit: any;
  chain?: CommitChain;
  analysis?: AnalysisResult;
  updates?: StakeholderUpdate;
}

// Initialize GitLab client and analyzer
let gitlabClient: GitLabClient | null = null;
let commitTracer: CommitTracer | null = null;
let commitAnalyzer: CommitAnalyzer | null = null;

// Initialize monitoring system
let feedMonitor: FeedMonitor | null = null;
let commitProcessor: CommitProcessor | null = null;
const monitoredCommits: Map<string, MonitoredCommit> = new Map();

// Initialize notification system
const notificationService = getNotificationService();
const slackClient = createSlackClientFromEnv();
if (slackClient) {
  notificationService.registerProvider(slackClient);
  console.log('✅ Slack notifications enabled');
} else {
  console.log('ℹ️  Slack notifications disabled (SLACK_WEBHOOK_URL not configured)');
}

function getClient(): GitLabClient {
  if (!gitlabClient) {
    if (!process.env.GITLAB_URL || !process.env.GITLAB_TOKEN) {
      throw new Error('GITLAB_URL and GITLAB_TOKEN must be configured in .env');
    }

    gitlabClient = new GitLabClient({
      baseUrl: process.env.GITLAB_URL,
      token: process.env.GITLAB_TOKEN,
      projectId: process.env.GITLAB_PROJECT_ID,
    });

    commitTracer = new CommitTracer(gitlabClient, {
      includeEpics: true,
      followRelatedMRs: true,
      continueOnError: true,
    });

    commitAnalyzer = new CommitAnalyzer();
  }

  return gitlabClient;
}

function getTracer(): CommitTracer {
  getClient(); // Ensures tracer is initialized
  return commitTracer!;
}

function getAnalyzer(): CommitAnalyzer {
  getClient(); // Ensures analyzer is initialized
  return commitAnalyzer!;
}

function getMonitor(): FeedMonitor {
  if (!feedMonitor) {
    const client = getClient();
    const tracer = getTracer();

    feedMonitor = new FeedMonitor({ configLoader: monitorConfig });
    feedMonitor.setClient(client);

    commitProcessor = new CommitProcessor({ tracer, concurrency: 3 });

    // Wire up events
    feedMonitor.on('newCommit', (event: any) => {
      console.log(`📢 New commit detected: ${event.commit.sha.substring(0, 8)}`);
      monitoredCommits.set(event.commit.sha, { commit: event.commit });
      commitProcessor!.enqueue(event.commit);

      // Send notification for commit detected (optional, usually disabled)
      notificationService.notifyCommitDetected({
        projectId: event.commit.projectId,
        projectName: event.projectName,
        sha: event.commit.sha,
        title: event.commit.title,
        authorName: event.commit.authorName,
        authorEmail: event.commit.authorEmail,
        branch: event.commit.branch,
        committedAt: event.commit.committedAt,
        commitUrl: process.env.GITLAB_URL
          ? `${process.env.GITLAB_URL}/${event.commit.projectId}/-/commit/${event.commit.sha}`
          : undefined,
      }).catch((error) => {
        console.error('Failed to send commit detected notification:', error);
      });
    });

    commitProcessor.on('commitProcessed', (event: any, chain?: CommitChain) => {
      if (event.success && chain) {
        console.log(`✅ Commit processed: ${event.commit.sha.substring(0, 8)}`);
        const existing = monitoredCommits.get(event.commit.sha);
        if (existing) {
          existing.chain = chain;

          // Persist to database immediately (without waiting for AI analysis)
          (async () => {
            try {
              // First, persist the commit chain without analysis/updates
              await persistCommitChain({
                commitSha: event.commit.sha,
                projectId: event.commit.projectId,
                chain,
                analysis: undefined,
                updates: undefined,
              });

              console.log(`🤖 Generating stakeholder updates for ${event.commit.sha.substring(0, 8)}...`);
              const analyzer = getAnalyzer();
              const analysisResult = await analyzer.analyzeCommitWithUpdates(chain);

              // Store the analysis and updates with the commit
              existing.analysis = analysisResult.analysis;
              existing.updates = analysisResult.updates;

              console.log(`✨ Generated updates for ${event.commit.sha.substring(0, 8)}`);
              console.log(`   Technical: ${analysisResult.updates.technicalUpdate.substring(0, 80)}...`);
              console.log(`   Business: ${analysisResult.updates.businessUpdate.substring(0, 80)}...`);

              // Persist to database
              await persistCommitChain({
                commitSha: event.commit.sha,
                projectId: event.commit.projectId,
                chain,
                analysis: analysisResult.analysis,
                updates: analysisResult.updates,
              });

              // Send notification for completed analysis
              await notificationService.notifyAnalysisComplete({
                projectId: event.commit.projectId,
                projectName: event.projectName,
                sha: event.commit.sha,
                title: event.commit.title,
                authorName: event.commit.authorName,
                authorEmail: event.commit.authorEmail,
                branch: event.commit.branch,
                committedAt: event.commit.committedAt,
                chain,
                analysis: analysisResult.analysis,
                updates: analysisResult.updates,
                gitlabUrl: process.env.GITLAB_URL,
              });

              console.log(`📤 Notification sent for ${event.commit.sha.substring(0, 8)}`);
            } catch (error) {
              console.error(
                `❌ Failed to generate updates for ${event.commit.sha.substring(0, 8)}:`,
                error instanceof Error ? error.message : error
              );

              // Send error notification
              notificationService.notifyError({
                projectId: event.commit.projectId,
                projectName: event.projectName,
                sha: event.commit.sha,
                error: error instanceof Error ? error.message : String(error),
                stackTrace: error instanceof Error ? error.stack : undefined,
              }).catch((notifyError) => {
                console.error('Failed to send error notification:', notifyError);
              });
            }
          })(); // Execute immediately but don't await
        }
      }
    });
  }

  return feedMonitor;
}

function getProcessor(): CommitProcessor {
  getMonitor(); // Ensures processor is initialized
  return commitProcessor!;
}

// =============================================================================
// API Routes
// =============================================================================

/**
 * GET /api/status
 * Check server and GitLab connection status
 */
app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const client = getClient();
    const isConnected = await client.testConnection();

    res.json({
      status: 'ok',
      gitlabConnected: isConnected,
      gitlabUrl: process.env.GITLAB_URL,
      projectId: process.env.GITLAB_PROJECT_ID || 'not configured',
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      gitlabConnected: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/config
 * Get authentication configuration (for frontend)
 */
app.get('/api/auth/config', (_req: Request, res: Response) => {
  res.json({
    enabled: authConfig.enabled,
    enforceUI: authConfig.enforceUI,
    enforceAPI: authConfig.enforceAPI,
    signInUrl: authConfig.signInUrl,
    publishableKey: authConfig.enabled ? process.env.CLERK_PUBLISHABLE_KEY : null,
  });
});

/**
 * GET /api/auth/user
 * Get current user info (if authenticated)
 */
app.get('/api/auth/user', (req: Request, res: Response) => {
  if (!authConfig.enabled) {
    res.status(503).json({
      error: 'Authentication not enabled',
    });
    return;
  }

  if (!req.auth?.userId) {
    res.status(401).json({
      error: 'Not authenticated',
      signInUrl: authConfig.signInUrl,
    });
    return;
  }

  res.json({
    userId: req.auth.userId,
    sessionId: req.auth.sessionId,
    user: req.auth.user,
  });
});

/**
 * GET /api/commits
 * List recent commits
 */
app.get('/api/commits', async (req: Request, res: Response) => {
  try {
    const client = getClient();
    const perPage = parseInt(req.query.per_page as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const branch = req.query.branch as string | undefined;

    const result = await client.listCommits(undefined, {
      per_page: perPage,
      page,
      ref_name: branch,
    });

    res.json({
      commits: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/commits/:sha
 * Get a single commit
 */
app.get('/api/commits/:sha', async (req: Request, res: Response) => {
  try {
    const client = getClient();
    const commit = await client.getCommit(req.params.sha);

    res.json(commit);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /api/trace/commit
 * Trace a single commit
 * Body: { sha: string, projectId?: string, forceRefresh?: boolean }
 *
 * If forceRefresh=false (default), checks database first and returns cached data if available.
 * If forceRefresh=true, always fetches fresh data from GitLab API.
 */
app.post('/api/trace/commit', async (req: Request, res: Response) => {
  try {
    const { sha, projectId, forceRefresh = false } = req.body;

    if (!sha) {
      return res.status(400).json({ error: 'sha is required' });
    }

    // Check database first unless force refresh is requested
    if (!forceRefresh) {
      const { getCompleteCommitChain } = await import('../db/repositories/commit-repository');
      const cachedData = await getCompleteCommitChain(sha);

      if (cachedData && cachedData.chain.isComplete) {
        console.log(`✅ Returning cached commit chain for ${sha.substring(0, 8)}`);

        // Transform database format to match tracer CommitChain format (with snake_case for GitLab API compatibility)
        const response = {
          commit: {
            id: cachedData.commit.sha,
            short_id: cachedData.commit.shortId,
            title: cachedData.commit.title,
            message: cachedData.commit.message,
            author_name: cachedData.commit.authorName,
            author_email: cachedData.commit.authorEmail,
            authored_date: cachedData.commit.authoredDate,
            committed_date: cachedData.commit.committedDate,
            created_at: cachedData.commit.authoredDate,
            web_url: cachedData.commit.webUrl,
            projectId: cachedData.commit.projectId,
          },
          mergeRequests: cachedData.mergeRequests.map((mr) => ({
            mergeRequest: {
              id: mr.id,
              iid: mr.iid,
              project_id: parseInt(mr.projectId),
              title: mr.title,
              description: mr.description,
              state: mr.state,
              source_branch: mr.sourceBranch,
              target_branch: mr.targetBranch,
              author: {
                name: mr.authorName,
                username: mr.authorUsername,
              },
              labels: mr.labels,
              upvotes: mr.upvotes,
              downvotes: mr.downvotes,
              user_notes_count: mr.userNotesCount,
              web_url: mr.webUrl,
              created_at: mr.createdAt,
              updated_at: mr.updatedAt,
              merged_at: mr.mergedAt,
            },
            closesIssues: [],
            containsCommit: true,
          })),
          issues: cachedData.issues.map((issue) => ({
            issue: {
              id: issue.id,
              iid: issue.iid,
              project_id: parseInt(issue.projectId),
              title: issue.title,
              description: issue.description,
              state: issue.state,
              labels: issue.labels,
              web_url: issue.webUrl,
              created_at: issue.createdAt,
              updated_at: issue.updatedAt,
              closed_at: issue.closedAt,
            },
            relatedMergeRequests: [],
          })),
          epics: cachedData.epics.map((epic) => ({
            id: epic.id,
            group_id: epic.groupId,
            iid: epic.iid,
            title: epic.title,
            description: epic.description,
            state: epic.state,
            web_url: epic.webUrl,
            created_at: epic.createdAt,
            updated_at: epic.updatedAt,
            closed_at: epic.closedAt,
          })),
          metadata: {
            isComplete: cachedData.chain.isComplete,
            apiCallCount: cachedData.chain.apiCallCount || 0,
            durationMs: cachedData.chain.durationMs || 0,
            warnings: cachedData.chain.warnings || [],
          },
          _fromCache: true,
          _cachedAt: cachedData.chain.tracedAt,
        };

        return res.json(response);
      }
    }

    // If not in cache or force refresh, trace from GitLab
    console.log(`🔄 Tracing commit ${sha.substring(0, 8)} from GitLab...`);
    const tracer = getTracer();
    const chain = await tracer.traceCommit(sha, projectId);

    // Persist the traced chain
    await persistCommitChain({
      commitSha: sha,
      projectId: projectId || process.env.GITLAB_PROJECT_ID || '',
      chain,
    });

    return res.json({
      ...chain,
      _fromCache: false,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trace/commits
 * Trace multiple commits
 * Body: { shas: string[], projectId?: string }
 */
app.post('/api/trace/commits', async (req: Request, res: Response) => {
  try {
    const { shas, projectId } = req.body;

    if (!shas || !Array.isArray(shas)) {
      return res.status(400).json({ error: 'shas array is required' });
    }

    const tracer = getTracer();
    const result = await tracer.traceCommits(shas, projectId);

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trace/recent
 * Trace recent commits
 * Body: { count: number, projectId?: string, branch?: string }
 */
app.post('/api/trace/recent', async (req: Request, res: Response) => {
  try {
    const { count, projectId, branch } = req.body;

    if (!count || typeof count !== 'number') {
      return res.status(400).json({ error: 'count (number) is required' });
    }

    const tracer = getTracer();
    const result = await tracer.traceRecentCommits(count, projectId, branch);

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/merge-requests
 * List merge requests
 */
app.get('/api/merge-requests', async (req: Request, res: Response) => {
  try {
    const client = getClient();
    const perPage = parseInt(req.query.per_page as string) || 20;
    const state = req.query.state as 'opened' | 'closed' | 'merged' | 'all' | undefined;

    const result = await client.listMergeRequests(undefined, {
      per_page: perPage,
      state,
    });

    res.json({
      mergeRequests: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/issues
 * List issues
 */
app.get('/api/issues', async (req: Request, res: Response) => {
  try {
    const client = getClient();
    const perPage = parseInt(req.query.per_page as string) || 20;
    const state = req.query.state as 'opened' | 'closed' | 'all' | undefined;

    const result = await client.listIssues(undefined, {
      per_page: perPage,
      state,
    });

    res.json({
      issues: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/merge-requests/sync
 * Sync merge requests from GitLab to database
 */
app.post('/api/merge-requests/sync', async (_req: Request, res: Response) => {
  try {
    const client = getClient();
    const { saveMergeRequestBatch, saveProject } = await import('../db/repositories/gitlab-entity-repository');

    // Get project info
    const projectId = process.env.GITLAB_PROJECT_ID;
    if (!projectId) {
      return res.status(400).json({ error: 'GITLAB_PROJECT_ID not configured' });
    }

    // Save/update project first
    await saveProject({
      id: projectId,
      name: projectId, // You can update this with actual project name
      gitlabUrl: process.env.GITLAB_URL || 'https://gitlab.com',
    });

    // Fetch MRs from GitLab API
    console.log('Fetching merge requests from GitLab...');
    const result = await client.listMergeRequests(undefined, {
      per_page: 100,
      state: 'all',
    });

    const mrData = result.data.map(mr => ({
      id: mr.id,
      iid: mr.iid,
      projectId: projectId,
      title: mr.title,
      description: mr.description || undefined,
      state: mr.state,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      authorName: mr.author?.name,
      authorUsername: mr.author?.username,
      labels: mr.labels || [],
      upvotes: mr.upvotes,
      downvotes: mr.downvotes,
      userNotesCount: mr.user_notes_count,
      webUrl: mr.web_url,
      createdAt: new Date(mr.created_at),
      updatedAt: new Date(mr.updated_at),
      mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
    }));

    // Save to database
    console.log(`Saving ${mrData.length} merge requests to database...`);
    await saveMergeRequestBatch(mrData);

    return res.json({
      success: true,
      synced: mrData.length,
      message: `Successfully synced ${mrData.length} merge requests`,
    });
  } catch (error: any) {
    console.error('Error syncing merge requests:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/merge-requests/db
 * Get merge requests from database with pagination and filtering
 */
app.get('/api/merge-requests/db', async (req: Request, res: Response) => {
  try {
    const { getAllMergeRequests, getMergeRequestsCount } = await import('../db/repositories/gitlab-entity-repository');

    const state = req.query.state as 'opened' | 'closed' | 'merged' | 'all' | undefined;
    const projectId = req.query.projectId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const [mergeRequests, total] = await Promise.all([
      getAllMergeRequests({ state, projectId, limit, offset }),
      getMergeRequestsCount({ state, projectId }),
    ]);

    res.json({
      mergeRequests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching merge requests from database:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analyze/updates
 * Generate stakeholder updates for a commit chain
 * Body: { chain: CommitChain }
 */
app.post('/api/analyze/updates', async (req: Request, res: Response) => {
  try {
    const { chain } = req.body;

    if (!chain) {
      return res.status(400).json({ error: 'chain is required' });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY not configured. Please add it to your .env file.',
      });
    }

    const analyzer = getAnalyzer();
    const result = await analyzer.analyzeCommitWithUpdates(chain);

    return res.json(result);
  } catch (error: any) {
    console.error('Error generating updates:', error);
    return res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Historical Data API Routes
// =============================================================================

/**
 * GET /api/history/teams
 * Get all teams
 */
app.get('/api/history/teams', async (_req: Request, res: Response) => {
  try {
    const { getAllTeams } = await import('../db/repositories/team-repository');
    const teams = await getAllTeams();
    res.json({ teams });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/teams/:id
 * Get a specific team
 */
app.get('/api/history/teams/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getTeamById } = await import('../db/repositories/team-repository');
    const teamId = parseInt(req.params.id);
    const team = await getTeamById(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/teams/:id/commits
 * Get commits by team
 */
app.get('/api/history/teams/:id/commits', async (req: Request, res: Response) => {
  try {
    const { getCommitsByTeam } = await import('../db/repositories/commit-repository');
    const teamId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const commits = await getCommitsByTeam(teamId, { limit, offset });

    res.json({
      commits,
      pagination: {
        limit,
        offset,
        count: commits.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/teams/:id/updates
 * Get stakeholder updates for a team
 */
app.get('/api/history/teams/:id/updates', async (req: Request, res: Response) => {
  try {
    const { searchUpdates } = await import('../db/repositories/update-repository');
    const teamId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const updates = await searchUpdates({
      teamIds: [teamId],
      limit,
      offset,
    });

    res.json({
      updates,
      pagination: {
        limit,
        offset,
        count: updates.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/epics
 * Get all epics
 */
app.get('/api/history/epics', async (req: Request, res: Response) => {
  try {
    const { getAllEpics, getEpicsByState } = await import('../db/repositories/gitlab-entity-repository');
    const state = req.query.state as string | undefined;

    const epics = state ? await getEpicsByState(state) : await getAllEpics();

    res.json({ epics });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/epics/:id
 * Get a specific epic
 */
app.get('/api/history/epics/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getEpicById } = await import('../db/repositories/gitlab-entity-repository');
    const epicId = parseInt(req.params.id);
    const epic = await getEpicById(epicId);

    if (!epic) {
      res.status(404).json({ error: 'Epic not found' });
      return;
    }

    res.json(epic);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/epics/:id/commits
 * Get commits by epic
 */
app.get('/api/history/epics/:id/commits', async (req: Request, res: Response) => {
  try {
    const { getCommitsByEpic } = await import('../db/repositories/commit-repository');
    const epicId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const commits = await getCommitsByEpic(epicId, { limit, offset });

    res.json({
      commits,
      pagination: {
        limit,
        offset,
        count: commits.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/epics/:id/updates
 * Get stakeholder updates for an epic
 */
app.get('/api/history/epics/:id/updates', async (req: Request, res: Response) => {
  try {
    const { searchUpdates } = await import('../db/repositories/update-repository');
    const epicId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const updates = await searchUpdates({
      epicIds: [epicId],
      limit,
      offset,
    });

    res.json({
      updates,
      pagination: {
        limit,
        offset,
        count: updates.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/commits
 * Search/filter commits
 */
app.get('/api/history/commits', async (req: Request, res: Response) => {
  try {
    const { searchCommits } = await import('../db/repositories/commit-repository');
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const projectId = req.query.projectId as string | undefined;
    const authorEmail = req.query.authorEmail as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const commits = await searchCommits({
      projectId,
      authorEmail,
      startDate,
      endDate,
      limit,
      offset,
    });

    res.json({
      commits,
      pagination: {
        limit,
        offset,
        count: commits.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/commits/:sha
 * Get a commit with its full chain and updates
 */
app.get('/api/history/commits/:sha', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getCommitBySha, getCommitChainBySha } = await import('../db/repositories/commit-repository');
    const { getUpdateByCommit } = await import('../db/repositories/update-repository');
    const { getAnalysisByCommit } = await import('../db/repositories/analysis-repository');

    const commit = await getCommitBySha(req.params.sha);

    if (!commit) {
      res.status(404).json({ error: 'Commit not found' });
      return;
    }

    const chain = await getCommitChainBySha(req.params.sha);
    const update = await getUpdateByCommit(req.params.sha);
    const analysis = await getAnalysisByCommit(req.params.sha);

    res.json({
      commit,
      chain,
      update,
      analysis,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/updates/recent
 * Get recent stakeholder updates
 */
app.get('/api/history/updates/recent', async (req: Request, res: Response) => {
  try {
    const { getRecentUpdates } = await import('../db/repositories/update-repository');
    const limit = parseInt(req.query.limit as string) || 50;

    const updates = await getRecentUpdates(limit);

    res.json({
      updates,
      count: updates.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Monitor API Routes
// =============================================================================

/**
 * GET /api/monitor/status
 * Get monitor status and statistics
 */
app.get('/api/monitor/status', (_req: Request, res: Response) => {
  try {
    const monitor = getMonitor();
    const processor = getProcessor();

    const stats = monitor.getStats();
    const processorStats = processor.getStats();
    const states = monitor.getAllStates();

    res.json({
      monitor: stats,
      processor: processorStats,
      states,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monitor/start
 * Start monitoring
 */
app.post('/api/monitor/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const monitor = getMonitor();

    if (monitor.getStats().isRunning) {
      res.status(400).json({ error: 'Monitor is already running' });
      return;
    }

    await monitor.start();

    res.json({
      success: true,
      message: 'Monitor started',
      stats: monitor.getStats(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monitor/stop
 * Stop monitoring
 */
app.post('/api/monitor/stop', (_req: Request, res: Response): void => {
  try {
    const monitor = getMonitor();

    if (!monitor.getStats().isRunning) {
      res.status(400).json({ error: 'Monitor is not running' });
      return;
    }

    monitor.stop();

    res.json({
      success: true,
      message: 'Monitor stopped',
      stats: monitor.getStats(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitor/projects
 * Get monitored projects configuration
 */
app.get('/api/monitor/projects', (_req: Request, res: Response) => {
  try {
    const config = monitorConfig.getConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monitor/poll/:projectId
 * Manually trigger a poll for a specific project
 */
app.post('/api/monitor/poll/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const monitor = getMonitor();

    await monitor.pollProject(projectId);

    res.json({
      success: true,
      message: `Poll completed for project ${projectId}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monitor/show-recent
 * Fetch recent commits for all enabled projects and reset baseline
 */
app.post('/api/monitor/show-recent', async (req: Request, res: Response) => {
  try {
    const { count = 5 } = req.body;
    const monitor = getMonitor();
    const client = getClient();
    const config = monitorConfig.getConfig();
    const enabledProjects = config.projects.filter((p) => p.enabled);

    let totalCommits = 0;

    // For each enabled project, fetch recent commits
    for (const project of enabledProjects) {
      for (const branch of project.branches) {
        try {
          // Get recent commits from GitLab
          const response = await client.listCommits(project.id, {
            ref_name: branch,
            per_page: count,
          });

          const commits = response.data;

          if (commits.length === 0) {
            continue;
          }

          // Reset the baseline to null so these commits will be "new"
          monitor.resetState(project.id, branch);

          // Queue each commit for processing (oldest first)
          const commitsToProcess = [...commits].reverse();
          for (const commit of commitsToProcess) {
            const detectedCommit = {
              sha: commit.id,
              projectId: project.id,
              branch,
              title: commit.title,
              authorName: commit.author_name,
              authorEmail: commit.author_email,
              committedAt: new Date(commit.committed_date),
              discoveredAt: new Date(),
            };

            // Add to monitored commits immediately
            monitoredCommits.set(commit.id, { commit: detectedCommit });

            // Queue for tracing
            commitProcessor!.enqueue(detectedCommit);

            totalCommits++;
          }

          // Update the baseline to the latest commit
          const latestCommit = commits[0];
          monitor.updateLastCommit(project.id, branch, latestCommit.id);
        } catch (error: any) {
          console.error(
            `Error fetching recent commits for ${project.name}:${branch}:`,
            error.message
          );
        }
      }
    }

    res.json({
      success: true,
      message: `Fetched ${totalCommits} recent commits`,
      totalCommits,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitor/commits
 * Get monitored commits
 */
app.get('/api/monitor/commits', (_req: Request, res: Response) => {
  try {
    const commits = Array.from(monitoredCommits.values());

    // Sort by discovered date (most recent first)
    commits.sort((a, b) => {
      const dateA = new Date(a.commit.discoveredAt).getTime();
      const dateB = new Date(b.commit.discoveredAt).getTime();
      return dateB - dateA;
    });

    res.json({
      commits,
      total: commits.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitor/queue
 * Get processing queue status
 */
app.get('/api/monitor/queue', (_req: Request, res: Response) => {
  try {
    const processor = getProcessor();
    const queue = processor.getQueue();
    const processed = processor.getProcessed();
    const stats = processor.getStats();

    res.json({
      queue,
      processed: processed.slice(-20), // Last 20 processed
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monitor/retry/:sha
 * Retry a failed commit
 */
app.post('/api/monitor/retry/:sha', (req: Request, res: Response) => {
  try {
    const { sha } = req.params;
    const processor = getProcessor();

    processor.retry(sha);

    res.json({
      success: true,
      message: `Retrying commit ${sha.substring(0, 8)}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Notification API Routes
// =============================================================================

/**
 * GET /api/notifications/status
 * Get notification service status
 */
app.get('/api/notifications/status', (_req: Request, res: Response) => {
  try {
    const providers = notificationService.getProviders();
    const providerStatus = providers.map((p) => ({
      name: p.name,
      config: slackClient?.getConfig(),
    }));

    res.json({
      enabled: providers.length > 0,
      providers: providerStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/test
 * Test notification connections
 */
app.post('/api/notifications/test', async (_req: Request, res: Response) => {
  try {
    const results = await notificationService.testAll();
    const resultsObj = Object.fromEntries(results);

    res.json({
      success: Array.from(results.values()).every((r) => r),
      results: resultsObj,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Static file serving
// =============================================================================

// Serve UI files
const uiPath = path.join(__dirname, '../../ui/public');
app.use(express.static(uiPath));

// Fallback to index.html for SPA routing
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(uiPath, 'index.html'));
  }
});

// =============================================================================
// Error handling
// =============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// =============================================================================
// Start server
// =============================================================================

app.listen(PORT, () => {
  console.log(`🚀 GitLab Commit Tracer server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`🎨 UI dev server should be running separately on http://localhost:5173`);
    console.log(`   Run: npm run dev:ui`);
  }
});
