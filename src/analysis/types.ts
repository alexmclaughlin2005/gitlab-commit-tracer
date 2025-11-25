/**
 * Type definitions for AI-powered commit analysis
 *
 * These types represent the analysis results and configuration
 * for understanding commit context and impact.
 */

import type { CommitChain } from '../tracing/types';

/**
 * Result of AI analysis for a commit chain
 */
export interface AnalysisResult {
  /** Explanation of why this commit was made */
  reason: string;

  /** Description of the technical approach taken */
  approach: string;

  /** Assessment of impact on epic/project goals */
  impact: string;

  /** Alignment status with issue and epic goals */
  alignment: 'aligned' | 'partially-aligned' | 'misaligned';

  /** Additional notes about alignment */
  alignmentNotes: string;

  /** AI confidence in this analysis (0.0 - 1.0) */
  confidence: number;

  /** Metadata about the analysis */
  metadata: AnalysisMetadata;
}

/**
 * Metadata about the analysis operation
 */
export interface AnalysisMetadata {
  /** When the analysis was performed */
  analyzedAt: Date;

  /** How long the analysis took (milliseconds) */
  durationMs: number;

  /** AI provider used (e.g., 'openai') */
  provider: string;

  /** Model used (e.g., 'gpt-5') */
  model: string;

  /** Number of tokens used (if available) */
  tokensUsed?: number;

  /** Cost of the analysis (if calculable) */
  costUsd?: number;
}

/**
 * Complete analysis with the original chain
 */
export interface CommitAnalysis {
  /** The commit chain that was analyzed */
  chain: CommitChain;

  /** The AI analysis results */
  analysis: AnalysisResult;
}

/**
 * Options for the AI analyzer
 */
export interface AnalyzerOptions {
  /** AI model to use (default: 'gpt-5') */
  model?: string;

  /** Maximum tokens for response */
  maxTokens?: number;

  /** Temperature for response generation (0.0 - 2.0) */
  temperature?: number;

  /** Whether to include commit diff in analysis */
  includeDiff?: boolean;

  /** Maximum diff size to include (characters) */
  maxDiffSize?: number;

  /** Custom system instructions */
  systemInstructions?: string;
}

/**
 * Context prepared for AI analysis
 */
export interface AnalysisContext {
  /** Commit information */
  commit: {
    sha: string;
    message: string;
    author: string;
    timestamp: string;
    filesChanged?: number;
    summary?: string;
  };

  /** Merge request information (if available) */
  mergeRequest?: {
    iid: number;
    title: string;
    description: string;
    discussionSummary?: string;
  };

  /** Issue information (if available) */
  issue?: {
    iid: number;
    title: string;
    description: string;
    labels: string[];
  };

  /** Epic information (if available) */
  epic?: {
    id: number;
    title: string;
    description: string;
    objectives?: string[];
  };
}

/**
 * Raw response from OpenAI API
 */
export interface OpenAIAnalysisResponse {
  reason: string;
  approach: string;
  impact: string;
  alignment: 'aligned' | 'partially-aligned' | 'misaligned';
  alignment_notes: string;
  confidence: number;
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  /** Successfully analyzed commits */
  analyses: CommitAnalysis[];

  /** Commits that failed to analyze */
  failures: AnalysisFailure[];

  /** Summary statistics */
  summary: BatchAnalysisSummary;
}

/**
 * Information about a failed analysis
 */
export interface AnalysisFailure {
  /** Commit SHA that failed */
  commitSha: string;

  /** Error that occurred */
  error: Error;

  /** The chain that was attempted (if available) */
  chain?: CommitChain;
}

/**
 * Summary of batch analysis operation
 */
export interface BatchAnalysisSummary {
  /** Total commits analyzed */
  totalCommits: number;

  /** Successfully analyzed */
  successCount: number;

  /** Failed analyses */
  failureCount: number;

  /** Total time taken (milliseconds) */
  totalDurationMs: number;

  /** Average time per commit (milliseconds) */
  avgDurationMs: number;

  /** Total tokens used */
  totalTokens?: number;

  /** Total cost (USD) */
  totalCostUsd?: number;

  /** Average confidence score */
  avgConfidence: number;
}

/**
 * AI Provider interface for pluggable providers
 */
export interface AIProvider {
  /** Provider name */
  name: string;

  /** Analyze a commit chain */
  analyze(context: AnalysisContext, options?: AnalyzerOptions): Promise<AnalysisResult>;

  /** Generate stakeholder updates (optional) */
  generateUpdate?(context: AnalysisContext, analysis: AnalysisResult, options?: AnalyzerOptions): Promise<StakeholderUpdate>;
}

/**
 * Stakeholder update with different audience versions
 */
export interface StakeholderUpdate {
  /** Update for technical/project context audience (developers, PMs, architects) */
  technicalUpdate: string;

  /** Update for business/GTM audience (marketing, sales, support, executives) */
  businessUpdate: string;

  /** Metadata about the update generation */
  metadata: {
    generatedAt: Date;
    durationMs: number;
    provider: string;
    model: string;
    tokensUsed?: number;
    costUsd?: number;
  };
}

/**
 * Complete commit analysis with stakeholder updates
 */
export interface CommitAnalysisWithUpdates extends CommitAnalysis {
  /** Stakeholder updates for different audiences */
  updates: StakeholderUpdate;
}
