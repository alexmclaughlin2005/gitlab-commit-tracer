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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// CORS configuration - allow all origins in development, specific origins in production
const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || '*'
      : '*',
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

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
    });

    commitProcessor.on('commitProcessed', (event: any, chain?: CommitChain) => {
      if (event.success && chain) {
        console.log(`✅ Commit processed: ${event.commit.sha.substring(0, 8)}`);
        const existing = monitoredCommits.get(event.commit.sha);
        if (existing) {
          existing.chain = chain;

          // Automatically generate stakeholder updates and persist to database (fire-and-forget for parallel processing)
          (async () => {
            try {
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
            } catch (error) {
              console.error(
                `❌ Failed to generate updates for ${event.commit.sha.substring(0, 8)}:`,
                error instanceof Error ? error.message : error
              );
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
 * Body: { sha: string, projectId?: string }
 */
app.post('/api/trace/commit', async (req: Request, res: Response) => {
  try {
    const { sha, projectId } = req.body;

    if (!sha) {
      return res.status(400).json({ error: 'sha is required' });
    }

    const tracer = getTracer();
    const chain = await tracer.traceCommit(sha, projectId);

    return res.json(chain);
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
app.get('/api/history/teams/:id', async (req: Request, res: Response) => {
  try {
    const { getTeamById } = await import('../db/repositories/team-repository');
    const teamId = parseInt(req.params.id);
    const team = await getTeamById(teamId);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
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
    const updateType = req.query.type as 'technical' | 'business' | undefined;

    const updates = await searchUpdates({
      teamIds: [teamId],
      updateType,
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
app.get('/api/history/epics/:id', async (req: Request, res: Response) => {
  try {
    const { getEpicById } = await import('../db/repositories/gitlab-entity-repository');
    const epicId = parseInt(req.params.id);
    const epic = await getEpicById(epicId);

    if (!epic) {
      return res.status(404).json({ error: 'Epic not found' });
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
    const updateType = req.query.type as 'technical' | 'business' | undefined;

    const updates = await searchUpdates({
      epicIds: [epicId],
      updateType,
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
app.get('/api/history/commits/:sha', async (req: Request, res: Response) => {
  try {
    const { getCommitBySha, getCommitChainBySha } = await import('../db/repositories/commit-repository');
    const { getUpdatesByCommit } = await import('../db/repositories/update-repository');
    const { getAnalysesByCommit } = await import('../db/repositories/analysis-repository');

    const commit = await getCommitBySha(req.params.sha);

    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    const chain = await getCommitChainBySha(req.params.sha);
    const updates = await getUpdatesByCommit(req.params.sha);
    const analyses = await getAnalysesByCommit(req.params.sha);

    res.json({
      commit,
      chain,
      updates,
      analyses,
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
    const updateType = req.query.type as 'technical' | 'business' | undefined;

    const updates = await getRecentUpdates(limit, updateType);

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
