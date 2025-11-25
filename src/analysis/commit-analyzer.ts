/**
 * CommitAnalyzer - Analyzes commits using AI to understand context and impact
 *
 * Orchestrates the analysis of commit chains using AI providers
 */

import type { CommitChain } from '../tracing/types';
import type {
  AIProvider,
  AnalysisContext,
  AnalyzerOptions,
  CommitAnalysis,
  BatchAnalysisResult,
  AnalysisFailure,
  BatchAnalysisSummary,
  CommitAnalysisWithUpdates,
} from './types';
import { OpenAIProvider } from './openai-provider';

/**
 * CommitAnalyzer class
 *
 * Analyzes commit chains to extract context and understand impact
 */
export class CommitAnalyzer {
  private provider: AIProvider;
  private options: AnalyzerOptions;

  /**
   * Creates a new CommitAnalyzer
   *
   * @param provider - AI provider to use (defaults to OpenAI)
   * @param options - Analyzer options
   */
  constructor(provider?: AIProvider, options?: AnalyzerOptions) {
    this.provider = provider || new OpenAIProvider();
    this.options = options || {};
  }

  /**
   * Analyzes a single commit chain
   *
   * @param chain - Commit chain to analyze
   * @param options - Analysis options (overrides constructor options)
   * @returns Complete commit analysis
   */
  public async analyzeCommit(
    chain: CommitChain,
    options?: AnalyzerOptions
  ): Promise<CommitAnalysis> {
    // Build context from chain
    const context = this.buildContext(chain);

    // Perform analysis
    const analysis = await this.provider.analyze(context, { ...this.options, ...options });

    return {
      chain,
      analysis,
    };
  }

  /**
   * Analyzes multiple commit chains in batch
   *
   * @param chains - Array of commit chains to analyze
   * @param options - Analysis options
   * @returns Batch analysis result
   */
  public async analyzeCommits(
    chains: CommitChain[],
    options?: AnalyzerOptions
  ): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    const analyses: CommitAnalysis[] = [];
    const failures: AnalysisFailure[] = [];
    let totalConfidence = 0;

    for (const chain of chains) {
      try {
        const analysis = await this.analyzeCommit(chain, options);
        analyses.push(analysis);
        totalConfidence += analysis.analysis.confidence;
      } catch (error) {
        failures.push({
          commitSha: chain.commit.id,
          error: error as Error,
          chain,
        });
      }
    }

    const totalDurationMs = Date.now() - startTime;

    // Calculate summary statistics
    const summary: BatchAnalysisSummary = {
      totalCommits: chains.length,
      successCount: analyses.length,
      failureCount: failures.length,
      totalDurationMs,
      avgDurationMs: analyses.length > 0 ? totalDurationMs / analyses.length : 0,
      totalTokens: analyses.reduce((sum, a) => sum + (a.analysis.metadata.tokensUsed || 0), 0),
      totalCostUsd: analyses.reduce((sum, a) => sum + (a.analysis.metadata.costUsd || 0), 0),
      avgConfidence: analyses.length > 0 ? totalConfidence / analyses.length : 0,
    };

    return {
      analyses,
      failures,
      summary,
    };
  }

  /**
   * Builds analysis context from a commit chain
   *
   * @param chain - Commit chain
   * @returns Analysis context
   */
  private buildContext(chain: CommitChain): AnalysisContext {
    const context: AnalysisContext = {
      commit: {
        sha: chain.commit.id,
        message: chain.commit.message,
        author: chain.commit.author_name,
        timestamp: chain.commit.committed_date,
        summary: chain.commit.title,
      },
    };

    // Add merge request info (use first MR if multiple)
    if (chain.mergeRequests.length > 0) {
      const mr = chain.mergeRequests[0].mergeRequest;
      context.mergeRequest = {
        iid: mr.iid,
        title: mr.title,
        description: mr.description || '',
      };
    }

    // Add issue info (use first issue if multiple)
    if (chain.issues.length > 0) {
      const issue = chain.issues[0].issue;
      context.issue = {
        iid: issue.iid,
        title: issue.title,
        description: issue.description || '',
        labels: issue.labels || [],
      };
    }

    // Add epic info (use first epic if multiple)
    if (chain.epics.length > 0) {
      const epic = chain.epics[0];
      context.epic = {
        id: epic.id,
        title: epic.title,
        description: epic.description || '',
      };
    }

    return context;
  }

  /**
   * Gets analyses that need human review
   *
   * @param analyses - Array of commit analyses
   * @param confidenceThreshold - Minimum confidence (default: 0.5)
   * @returns Analyses that should be reviewed
   */
  public getAnalysesNeedingReview(
    analyses: CommitAnalysis[],
    confidenceThreshold: number = 0.5
  ): CommitAnalysis[] {
    return analyses.filter((analysis) => {
      const { confidence, alignment } = analysis.analysis;

      return (
        confidence < confidenceThreshold ||
        alignment === 'misaligned' ||
        analysis.chain.metadata.warnings.length > 0
      );
    });
  }

  /**
   * Gets analyses by alignment
   *
   * @param analyses - Array of commit analyses
   * @param alignment - Alignment type to filter by
   * @returns Filtered analyses
   */
  public getAnalysesByAlignment(
    analyses: CommitAnalysis[],
    alignment: 'aligned' | 'partially-aligned' | 'misaligned'
  ): CommitAnalysis[] {
    return analyses.filter((a) => a.analysis.alignment === alignment);
  }

  /**
   * Generates a summary report for batch analysis
   *
   * @param result - Batch analysis result
   * @returns Human-readable summary
   */
  public generateSummary(result: BatchAnalysisResult): string {
    const { summary, analyses, failures } = result;
    const lines: string[] = [];

    lines.push('=== Commit Analysis Summary ===');
    lines.push('');
    lines.push(`Total Commits: ${summary.totalCommits}`);
    lines.push(`Successfully Analyzed: ${summary.successCount}`);
    lines.push(`Failed: ${summary.failureCount}`);
    lines.push(`Average Confidence: ${(summary.avgConfidence * 100).toFixed(1)}%`);
    lines.push(`Total Duration: ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
    lines.push(`Average Duration: ${(summary.avgDurationMs / 1000).toFixed(2)}s per commit`);

    if (summary.totalTokens) {
      lines.push(`Total Tokens: ${summary.totalTokens.toLocaleString()}`);
    }
    if (summary.totalCostUsd) {
      lines.push(`Total Cost: $${summary.totalCostUsd.toFixed(4)}`);
    }

    lines.push('');
    lines.push('=== Alignment Breakdown ===');
    const aligned = this.getAnalysesByAlignment(analyses, 'aligned');
    const partial = this.getAnalysesByAlignment(analyses, 'partially-aligned');
    const misaligned = this.getAnalysesByAlignment(analyses, 'misaligned');

    lines.push(`Aligned: ${aligned.length} (${((aligned.length / analyses.length) * 100).toFixed(1)}%)`);
    lines.push(
      `Partially Aligned: ${partial.length} (${((partial.length / analyses.length) * 100).toFixed(1)}%)`
    );
    lines.push(
      `Misaligned: ${misaligned.length} (${((misaligned.length / analyses.length) * 100).toFixed(1)}%)`
    );

    const needsReview = this.getAnalysesNeedingReview(analyses);
    if (needsReview.length > 0) {
      lines.push('');
      lines.push('=== Needs Review ===');
      lines.push(`${needsReview.length} commit(s) flagged for human review`);
    }

    if (failures.length > 0) {
      lines.push('');
      lines.push('=== Failures ===');
      failures.forEach((failure) => {
        lines.push(`- ${failure.commitSha.substring(0, 8)}: ${failure.error.message}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Sets a new AI provider
   *
   * @param provider - AI provider to use
   */
  public setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  /**
   * Gets the current AI provider
   *
   * @returns Current provider
   */
  public getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Analyzes a commit and generates stakeholder updates
   *
   * @param chain - Commit chain to analyze
   * @param options - Analysis options
   * @returns Complete analysis with stakeholder updates
   */
  public async analyzeCommitWithUpdates(
    chain: CommitChain,
    options?: AnalyzerOptions
  ): Promise<CommitAnalysisWithUpdates> {
    // First, perform the standard analysis
    const analysis = await this.analyzeCommit(chain, options);

    // Check if the provider supports update generation
    if (!this.provider.generateUpdate) {
      throw new Error(`Provider ${this.provider.name} does not support update generation`);
    }

    // Build context
    const context = this.buildContext(chain);

    // Generate updates
    const updates = await this.provider.generateUpdate(context, analysis.analysis, {
      ...this.options,
      ...options,
    });

    return {
      ...analysis,
      updates,
    };
  }

  /**
   * Analyzes multiple commits and generates stakeholder updates for each
   *
   * @param chains - Array of commit chains to analyze
   * @param options - Analysis options
   * @returns Array of analyses with updates
   */
  public async analyzeCommitsWithUpdates(
    chains: CommitChain[],
    options?: AnalyzerOptions
  ): Promise<CommitAnalysisWithUpdates[]> {
    const results: CommitAnalysisWithUpdates[] = [];

    for (const chain of chains) {
      try {
        const analysisWithUpdates = await this.analyzeCommitWithUpdates(chain, options);
        results.push(analysisWithUpdates);
      } catch (error: any) {
        console.error(`Failed to analyze commit ${chain.commit.id}:`, error.message);
        // Continue with other commits
      }
    }

    return results;
  }

  /**
   * Generates a formatted report with both technical and business updates
   *
   * @param analyses - Array of analyses with updates
   * @returns Formatted report string
   */
  public generateUpdateReport(analyses: CommitAnalysisWithUpdates[]): string {
    const lines: string[] = [];

    lines.push('=== STAKEHOLDER UPDATES REPORT ===');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Commits Analyzed: ${analyses.length}`);
    lines.push('');

    for (const analysis of analyses) {
      const commit = analysis.chain.commit;
      lines.push('─'.repeat(80));
      lines.push('');
      lines.push(`COMMIT: ${commit.short_id} - ${commit.title}`);
      lines.push(`Author: ${commit.author_name}`);
      lines.push(`Date: ${commit.committed_date}`);
      lines.push(`Alignment: ${analysis.analysis.alignment} (${(analysis.analysis.confidence * 100).toFixed(0)}% confidence)`);
      lines.push('');

      lines.push('📋 TECHNICAL UPDATE (For: Developers, PMs, Architects)');
      lines.push('─'.repeat(80));
      lines.push(analysis.updates.technicalUpdate);
      lines.push('');

      lines.push('💼 BUSINESS UPDATE (For: Marketing, Sales, Support, GTM, Executives)');
      lines.push('─'.repeat(80));
      lines.push(analysis.updates.businessUpdate);
      lines.push('');
    }

    lines.push('='.repeat(80));
    lines.push('');
    lines.push('SUMMARY');
    lines.push('');
    const totalCost = analyses.reduce((sum, a) => {
      return (
        sum +
        (a.analysis.metadata.costUsd || 0) +
        (a.updates.metadata.costUsd || 0)
      );
    }, 0);
    const totalTokens = analyses.reduce((sum, a) => {
      return (
        sum +
        (a.analysis.metadata.tokensUsed || 0) +
        (a.updates.metadata.tokensUsed || 0)
      );
    }, 0);

    lines.push(`Total Commits: ${analyses.length}`);
    lines.push(`Total Tokens Used: ${totalTokens.toLocaleString()}`);
    lines.push(`Total Cost: $${totalCost.toFixed(4)}`);
    lines.push(`Average Cost per Commit: $${(totalCost / analyses.length).toFixed(4)}`);

    return lines.join('\n');
  }
}
