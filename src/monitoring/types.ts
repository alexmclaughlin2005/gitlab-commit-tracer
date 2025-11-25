/**
 * Monitoring System Type Definitions
 */

/**
 * Configuration for a single monitored project
 */
export interface ProjectConfig {
  /** GitLab project ID (numeric) or path (namespace/project) */
  id: string | number;

  /** Human-readable name for the project */
  name: string;

  /** Optional description */
  description?: string;

  /** Branches to monitor */
  branches: string[];

  /** Whether monitoring is enabled for this project */
  enabled: boolean;

  /** Automatically generate stakeholder updates for new commits */
  autoGenerateUpdates?: boolean;

  /** Filtering options */
  filters?: {
    /** Only process commits from these authors */
    includeAuthors?: string[];

    /** Exclude commits from these authors (e.g., bots) */
    excludeAuthors?: string[];

    /** Only process commits with these labels */
    includeLabels?: string[];

    /** Exclude commits with these labels */
    excludeLabels?: string[];
  };
}

/**
 * Global monitoring configuration
 */
export interface GlobalConfig {
  /** How often to poll for new commits (in seconds) */
  pollIntervalSeconds: number;

  /** Maximum number of commits to fetch per poll */
  maxCommitsPerPoll: number;

  /** Enable notifications (future feature) */
  enableNotifications: boolean;

  /** Where to store monitor data */
  storageLocation: string;
}

/**
 * Complete monitoring configuration
 */
export interface MonitorConfig {
  /** List of projects to monitor */
  projects: ProjectConfig[];

  /** Global settings */
  global: GlobalConfig;
}

/**
 * Monitor state for a specific project/branch combination
 */
export interface MonitorState {
  /** Project ID */
  projectId: string | number;

  /** Branch name */
  branch: string;

  /** Last seen commit SHA */
  lastCommitSha: string | null;

  /** When this branch was last polled */
  lastPolledAt: Date | null;

  /** Whether this branch is currently being polled */
  isPolling: boolean;

  /** Number of consecutive poll failures */
  consecutiveFailures: number;
}

/**
 * A new commit detected by the monitor
 */
export interface DetectedCommit {
  /** Commit SHA */
  sha: string;

  /** Project ID */
  projectId: string | number;

  /** Branch name */
  branch: string;

  /** Commit title */
  title: string;

  /** Author name */
  authorName: string;

  /** Author email */
  authorEmail: string;

  /** Commit timestamp */
  committedAt: Date;

  /** When we discovered this commit */
  discoveredAt: Date;
}

/**
 * Processing status for a commit
 */
export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * A commit in the processing queue
 */
export interface QueuedCommit extends DetectedCommit {
  /** Current processing status */
  status: ProcessingStatus;

  /** Number of retry attempts */
  retries: number;

  /** Error message if failed */
  error?: string;

  /** When processing started */
  processingStartedAt?: Date;

  /** When processing completed */
  processingCompletedAt?: Date;
}

/**
 * Monitor statistics
 */
export interface MonitorStats {
  /** Whether the monitor is currently running */
  isRunning: boolean;

  /** Total number of configured projects */
  totalProjects: number;

  /** Number of enabled projects */
  enabledProjects: number;

  /** Total number of branches being monitored */
  totalBranches: number;

  /** Total commits discovered */
  totalCommitsDiscovered: number;

  /** Total commits processed */
  totalCommitsProcessed: number;

  /** Total commits failed */
  totalCommitsFailed: number;

  /** Commits currently in queue */
  queueSize: number;

  /** When monitoring started */
  startedAt: Date | null;

  /** Last poll time */
  lastPollAt: Date | null;

  /** Next scheduled poll time */
  nextPollAt: Date | null;
}

/**
 * Event emitted when a new commit is detected
 */
export interface NewCommitEvent {
  commit: DetectedCommit;
  project: ProjectConfig;
}

/**
 * Event emitted when a commit is processed
 */
export interface CommitProcessedEvent {
  commit: QueuedCommit;
  success: boolean;
  error?: string;
}
