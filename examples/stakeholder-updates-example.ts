/**
 * Example: Generating Stakeholder Updates
 *
 * This example demonstrates how to generate two versions of updates:
 * 1. Technical update for developers, PMs, and architects
 * 2. Business update for marketing, sales, support, and executives
 */

import { GitLabClient } from '../src/api';
import { CommitTracer } from '../src/tracing';
import { CommitAnalyzer } from '../src/analysis';

async function main() {
  console.log('=== Stakeholder Updates Generator ===\n');

  // ========================================
  // Step 1: Initialize
  // ========================================
  console.log('🔧 Initializing GitLab client...');
  const gitlabClient = new GitLabClient({
    baseUrl: process.env.GITLAB_URL || 'https://gitlab.com',
    token: process.env.GITLAB_TOKEN!,
    projectId: process.env.GITLAB_PROJECT_ID!,
  });

  console.log('🔍 Initializing commit tracer...');
  const tracer = new CommitTracer(gitlabClient, {
    includeEpics: true,
    followRelatedMRs: true,
    continueOnError: true,
  });

  console.log('🤖 Initializing AI analyzer...\n');
  const analyzer = new CommitAnalyzer();

  // ========================================
  // Example 1: Single Commit with Updates
  // ========================================
  console.log('=== Example 1: Single Commit Stakeholder Updates ===\n');

  const commitSha = 'abc123def456'; // Replace with actual commit SHA
  console.log(`Analyzing commit ${commitSha}...`);

  try {
    // Trace the commit
    const chain = await tracer.traceCommit(commitSha);
    console.log('✓ Traced successfully');

    // Analyze and generate updates
    console.log('Generating analysis and stakeholder updates...');
    const analysisWithUpdates = await analyzer.analyzeCommitWithUpdates(chain);

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log(`COMMIT: ${chain.commit.short_id} - ${chain.commit.title}`);
    console.log('='.repeat(80));
    console.log('');

    console.log('📊 ANALYSIS:');
    console.log(`  Reason: ${analysisWithUpdates.analysis.reason}`);
    console.log(`  Alignment: ${analysisWithUpdates.analysis.alignment}`);
    console.log(`  Confidence: ${(analysisWithUpdates.analysis.confidence * 100).toFixed(1)}%`);
    console.log('');

    console.log('📋 TECHNICAL UPDATE (For: Developers, PMs, Architects)');
    console.log('─'.repeat(80));
    console.log(analysisWithUpdates.updates.technicalUpdate);
    console.log('');

    console.log('💼 BUSINESS UPDATE (For: Marketing, Sales, Support, GTM, Executives)');
    console.log('─'.repeat(80));
    console.log(analysisWithUpdates.updates.businessUpdate);
    console.log('');

    console.log('💰 COSTS:');
    console.log(`  Analysis: $${analysisWithUpdates.analysis.metadata.costUsd?.toFixed(4) || 'N/A'}`);
    console.log(`  Updates: $${analysisWithUpdates.updates.metadata.costUsd?.toFixed(4) || 'N/A'}`);
    console.log(
      `  Total: $${((analysisWithUpdates.analysis.metadata.costUsd || 0) + (analysisWithUpdates.updates.metadata.costUsd || 0)).toFixed(4)}`
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // ========================================
  // Example 2: Batch Updates for Recent Commits
  // ========================================
  console.log('\n\n=== Example 2: Batch Stakeholder Updates ===\n');

  try {
    // Trace recent commits
    console.log('Tracing last 3 commits from main branch...');
    const tracedBatch = await tracer.traceRecentCommits(3, undefined, 'main');

    console.log(`✓ Traced ${tracedBatch.summary.successCount} commits\n`);

    // Analyze all with updates
    console.log('Generating analyses and updates for all commits...');
    const analysesWithUpdates = await analyzer.analyzeCommitsWithUpdates(tracedBatch.chains);

    console.log(`✓ Generated ${analysesWithUpdates.length} analyses with updates\n`);

    // Generate full report
    const report = analyzer.generateUpdateReport(analysesWithUpdates);
    console.log(report);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // ========================================
  // Example 3: Filtering for Specific Audiences
  // ========================================
  console.log('\n\n=== Example 3: Export Updates for Specific Teams ===\n');

  try {
    const traced = await tracer.traceRecentCommits(5, undefined, 'main');
    const analyzed = await analyzer.analyzeCommitsWithUpdates(traced.chains);

    // Export technical updates only
    console.log('📋 TECHNICAL UPDATES (For Engineering Team):');
    console.log('='.repeat(80));
    analyzed.forEach((a) => {
      console.log(`\n• ${a.chain.commit.short_id}: ${a.chain.commit.title}`);
      console.log(`  ${a.updates.technicalUpdate}`);
    });

    console.log('\n\n');

    // Export business updates only
    console.log('💼 BUSINESS UPDATES (For Marketing/Sales/GTM Team):');
    console.log('='.repeat(80));
    analyzed.forEach((a) => {
      console.log(`\n• ${a.chain.commit.short_id}: ${a.chain.commit.title}`);
      console.log(`  ${a.updates.businessUpdate}`);
    });

    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // ========================================
  // Example 4: Markdown Format for Slack/Email
  // ========================================
  console.log('\n\n=== Example 4: Markdown Format for Communication ===\n');

  try {
    const traced = await tracer.traceRecentCommits(2, undefined, 'main');
    const analyzed = await analyzer.analyzeCommitsWithUpdates(traced.chains);

    console.log('## Product Updates - Sprint Summary\n');
    console.log('### Technical Updates (Engineering)\n');
    analyzed.forEach((a) => {
      console.log(`**${a.chain.commit.title}**`);
      console.log(`${a.updates.technicalUpdate}\n`);
    });

    console.log('\n### Business Impact (Leadership/GTM)\n');
    analyzed.forEach((a) => {
      console.log(`**${a.chain.commit.title}**`);
      console.log(`${a.updates.businessUpdate}\n`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n✅ Examples complete!\n');
}

// Run the examples
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
