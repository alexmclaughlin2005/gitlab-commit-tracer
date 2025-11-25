/**
 * Example: Complete GitLab Commit Analysis Pipeline
 *
 * This example demonstrates the full pipeline:
 * 1. Connect to GitLab
 * 2. Trace commits through their lifecycle
 * 3. Analyze commits with AI to understand context and impact
 */

import { GitLabClient } from '../src/api';
import { CommitTracer } from '../src/tracing';
import { CommitAnalyzer, OpenAIProvider } from '../src/analysis';

async function main() {
  // ========================================
  // Step 1: Initialize GitLab Client
  // ========================================
  console.log('🔧 Initializing GitLab client...');
  const gitlabClient = new GitLabClient({
    baseUrl: process.env.GITLAB_URL || 'https://gitlab.com',
    token: process.env.GITLAB_TOKEN!,
    projectId: process.env.GITLAB_PROJECT_ID!,
  });

  // ========================================
  // Step 2: Initialize Commit Tracer
  // ========================================
  console.log('🔍 Initializing commit tracer...');
  const tracer = new CommitTracer(gitlabClient, {
    includeEpics: true,
    followRelatedMRs: true,
    continueOnError: true,
    onProgress: (step) => {
      const status = step.success ? '✓' : '✗';
      console.log(`  ${status} ${step.name}: ${step.result}`);
    },
  });

  // ========================================
  // Step 3: Initialize AI Analyzer
  // ========================================
  console.log('🤖 Initializing AI analyzer (OpenAI GPT-5)...');
  const aiProvider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
    model: 'gpt-5',
    temperature: 0.3,
    maxTokens: 1000,
  });

  const analyzer = new CommitAnalyzer(aiProvider);

  // ========================================
  // Example 1: Analyze a Single Commit
  // ========================================
  console.log('\n=== Example 1: Single Commit Analysis ===\n');

  const commitSha = 'abc123def456'; // Replace with actual commit SHA
  console.log(`Tracing commit ${commitSha}...`);

  try {
    // Trace the commit
    const chain = await tracer.traceCommit(commitSha);
    console.log(`\n✓ Traced successfully!`);
    console.log(`  - Merge Requests: ${chain.mergeRequests.length}`);
    console.log(`  - Issues: ${chain.issues.length}`);
    console.log(`  - Epics: ${chain.epics.length}`);
    console.log(`  - API calls: ${chain.metadata.apiCallCount}`);
    console.log(`  - Duration: ${chain.metadata.durationMs}ms`);

    // Analyze the commit
    console.log(`\nAnalyzing commit with AI...`);
    const analysis = await analyzer.analyzeCommit(chain);

    console.log('\n📊 Analysis Results:');
    console.log(`\nReason:\n${analysis.analysis.reason}`);
    console.log(`\nApproach:\n${analysis.analysis.approach}`);
    console.log(`\nImpact:\n${analysis.analysis.impact}`);
    console.log(`\nAlignment: ${analysis.analysis.alignment}`);
    console.log(`Notes: ${analysis.analysis.alignmentNotes}`);
    console.log(`\nConfidence: ${(analysis.analysis.confidence * 100).toFixed(1)}%`);
    console.log(
      `\nCost: $${analysis.analysis.metadata.costUsd?.toFixed(4) || 'N/A'} (${analysis.analysis.metadata.tokensUsed || 0} tokens)`
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // ========================================
  // Example 2: Batch Analysis of Recent Commits
  // ========================================
  console.log('\n\n=== Example 2: Batch Analysis of Recent Commits ===\n');

  try {
    // Trace recent commits
    console.log('Tracing last 5 commits from main branch...');
    const tracedBatch = await tracer.traceRecentCommits(5, undefined, 'main');

    console.log(`\n✓ Traced ${tracedBatch.summary.successCount} commits`);
    console.log(`  - Failures: ${tracedBatch.summary.failureCount}`);
    console.log(`  - Total API calls: ${tracedBatch.summary.totalApiCalls}`);
    console.log(`  - Total duration: ${(tracedBatch.summary.totalDurationMs / 1000).toFixed(2)}s`);

    // Analyze all traced commits
    console.log('\nAnalyzing commits with AI...');
    const analysisResult = await analyzer.analyzeCommits(tracedBatch.chains);

    // Generate summary report
    console.log('\n' + analyzer.generateSummary(analysisResult));

    // Show individual analyses
    console.log('\n📋 Individual Analyses:\n');
    for (const analysis of analysisResult.analyses) {
      const commit = analysis.chain.commit;
      console.log(`\n${commit.short_id}: ${commit.title}`);
      console.log(`  Alignment: ${analysis.analysis.alignment}`);
      console.log(`  Confidence: ${(analysis.analysis.confidence * 100).toFixed(1)}%`);
      console.log(`  Reason: ${analysis.analysis.reason.substring(0, 80)}...`);
    }

    // Show commits needing review
    const needsReview = analyzer.getAnalysesNeedingReview(analysisResult.analyses, 0.7);
    if (needsReview.length > 0) {
      console.log('\n\n⚠️  Commits Needing Human Review:\n');
      for (const review of needsReview) {
        console.log(`  - ${review.chain.commit.short_id}: ${review.chain.commit.title}`);
        console.log(`    Confidence: ${(review.analysis.confidence * 100).toFixed(1)}%`);
        console.log(`    Alignment: ${review.analysis.alignment}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // ========================================
  // Example 3: Filter by Alignment
  // ========================================
  console.log('\n\n=== Example 3: Filter by Alignment ===\n');

  try {
    // Trace and analyze
    const traced = await tracer.traceRecentCommits(10, undefined, 'main');
    const analyzed = await analyzer.analyzeCommits(traced.chains);

    // Show aligned commits
    const aligned = analyzer.getAnalysesByAlignment(analyzed.analyses, 'aligned');
    console.log(`✓ ${aligned.length} Aligned Commits:`);
    aligned.forEach((a) => {
      console.log(`  - ${a.chain.commit.short_id}: ${a.chain.commit.title}`);
    });

    // Show partially aligned
    const partial = analyzer.getAnalysesByAlignment(analyzed.analyses, 'partially-aligned');
    console.log(`\n⚠️  ${partial.length} Partially Aligned Commits:`);
    partial.forEach((a) => {
      console.log(`  - ${a.chain.commit.short_id}: ${a.chain.commit.title}`);
    });

    // Show misaligned
    const misaligned = analyzer.getAnalysesByAlignment(analyzed.analyses, 'misaligned');
    if (misaligned.length > 0) {
      console.log(`\n❌ ${misaligned.length} Misaligned Commits:`);
      misaligned.forEach((a) => {
        console.log(`  - ${a.chain.commit.short_id}: ${a.chain.commit.title}`);
        console.log(`    Notes: ${a.analysis.alignmentNotes}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // ========================================
  // Example 4: Custom Model Configuration
  // ========================================
  console.log('\n\n=== Example 4: Using GPT-5-nano for Faster/Cheaper Analysis ===\n');

  try {
    // Create analyzer with GPT-5-nano
    const nanoProvider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
      model: 'gpt-5-nano',
      temperature: 0.3,
      maxTokens: 500,
    });

    const nanoAnalyzer = new CommitAnalyzer(nanoProvider);

    // Trace and analyze
    const traced = await tracer.traceRecentCommits(3, undefined, 'main');
    const analyzed = await nanoAnalyzer.analyzeCommits(traced.chains);

    console.log('Summary:', nanoAnalyzer.generateSummary(analyzed));
    console.log(
      `\n💰 Cost Comparison: GPT-5-nano is ~50% cheaper but may have slightly lower quality`
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n\n✅ Examples complete!\n');
}

// Run the examples
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
