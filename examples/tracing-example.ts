/**
 * Tracing Example - Demonstrates automatic commit chain tracing
 *
 * This example shows how to use the CommitTracer to automatically
 * build relationship chains (Commit → MR → Issue → Epic).
 */

import { GitLabClient } from '../src/api';
import { CommitTracer } from '../src/tracing';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main example function
 */
async function main(): Promise<void> {
  console.log('=== GitLab Commit Tracer - Automatic Tracing Example ===\n');

  // Step 1: Create GitLab client
  const client = new GitLabClient({
    baseUrl: process.env.GITLAB_URL || 'https://gitlab.com',
    token: process.env.GITLAB_TOKEN!,
    projectId: process.env.GITLAB_PROJECT_ID,
  });

  // Step 2: Test connection
  console.log('Testing connection to GitLab...');
  const connected = await client.testConnection();
  if (!connected) {
    console.error('Failed to connect to GitLab. Check your token and URL.');
    process.exit(1);
  }
  console.log('✓ Connected successfully\n');

  // Step 3: Create tracer with progress tracking
  const tracer = new CommitTracer(client, {
    includeEpics: true,
    followRelatedMRs: true,
    continueOnError: true,
    onProgress: (step) => {
      const status = step.success ? '✓' : '✗';
      console.log(`  ${status} ${step.name}: ${step.result} (${step.durationMs}ms)`);
      if (step.error) {
        console.error(`    Error: ${step.error}`);
      }
    },
  });

  // Step 4: Trace recent commits
  console.log('Tracing recent commits...\n');

  const result = await tracer.traceRecentCommits(5);

  console.log('\n=== Tracing Summary ===');
  console.log(`Total commits: ${result.summary.totalCommits}`);
  console.log(`Successful: ${result.summary.successCount}`);
  console.log(`Failed: ${result.summary.failureCount}`);
  console.log(`Total API calls: ${result.summary.totalApiCalls}`);
  console.log(`Total duration: ${result.summary.totalDurationMs}ms`);
  console.log(`Average per commit: ${result.summary.avgDurationMs.toFixed(0)}ms`);

  // Step 5: Display results for each chain
  console.log('\n=== Commit Chains ===\n');

  for (const chain of result.chains) {
    console.log(`Commit: ${chain.commit.short_id} - ${chain.commit.title}`);
    console.log(`Author: ${chain.commit.author_name}`);
    console.log(`Date: ${chain.commit.created_at}`);
    console.log(`Complete: ${chain.metadata.isComplete ? 'Yes' : 'No'}`);

    // Display merge requests
    if (chain.mergeRequests.length > 0) {
      console.log(`\nMerge Requests (${chain.mergeRequests.length}):`);
      for (const mrLink of chain.mergeRequests) {
        const mr = mrLink.mergeRequest;
        console.log(`  !${mr.iid}: ${mr.title}`);
        console.log(`    State: ${mr.state}`);
        console.log(`    URL: ${mr.web_url}`);
        if (mrLink.closesIssues.length > 0) {
          console.log(`    Closes: ${mrLink.closesIssues.length} issue(s)`);
        }
      }
    } else {
      console.log('\n  (No merge requests found)');
    }

    // Display issues
    if (chain.issues.length > 0) {
      console.log(`\nIssues (${chain.issues.length}):`);
      for (const issueLink of chain.issues) {
        const issue = issueLink.issue;
        console.log(`  #${issue.iid}: ${issue.title}`);
        console.log(`    State: ${issue.state}`);
        console.log(`    Labels: ${issue.labels.join(', ') || 'None'}`);
        console.log(`    URL: ${issue.web_url}`);

        if (issueLink.epic) {
          console.log(`    Epic: &${issueLink.epic.iid} - ${issueLink.epic.title}`);
        }
      }
    } else if (chain.mergeRequests.length > 0) {
      console.log('\n  (No issues found for these MRs)');
    }

    // Display epics
    if (chain.epics.length > 0) {
      console.log(`\nEpics (${chain.epics.length}):`);
      for (const epic of chain.epics) {
        console.log(`  &${epic.iid}: ${epic.title}`);
        console.log(`    State: ${epic.state}`);
        console.log(`    URL: ${epic.web_url}`);
        if (epic.description) {
          const preview = epic.description.substring(0, 100).replace(/\n/g, ' ');
          console.log(`    Description: ${preview}${epic.description.length > 100 ? '...' : ''}`);
        }
      }
    }

    // Display warnings
    if (chain.metadata.warnings.length > 0) {
      console.log(`\nWarnings:`);
      for (const warning of chain.metadata.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
    }

    // Display full chain visualization
    if (chain.metadata.isComplete && chain.epics.length > 0) {
      console.log('\nFull Chain:');
      const commit = chain.commit.short_id;
      const mr = chain.mergeRequests[0]?.mergeRequest.iid || '?';
      const issue = chain.issues[0]?.issue.iid || '?';
      const epic = chain.epics[0]?.iid || '?';
      console.log(`  ${commit} → !${mr} → #${issue} → &${epic}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  // Display failures
  if (result.failures.length > 0) {
    console.log('=== Failures ===\n');
    for (const failure of result.failures) {
      console.log(`Commit ${failure.commitSha}:`);
      console.log(`  Error: ${failure.error.message}`);
    }
    console.log();
  }

  // Step 6: Demonstrate single commit tracing
  if (result.chains.length > 0) {
    const firstCommitSha = result.chains[0].commit.id;

    console.log('=== Single Commit Trace (with detailed steps) ===\n');
    console.log(`Tracing commit: ${firstCommitSha}\n`);

    const singleChain = await tracer.traceCommit(firstCommitSha);

    console.log('\nDetailed Steps:');
    for (const step of singleChain.metadata.steps) {
      console.log(`\n${step.name}:`);
      console.log(`  Started: ${step.startedAt.toISOString()}`);
      console.log(`  Duration: ${step.durationMs}ms`);
      console.log(`  Success: ${step.success ? 'Yes' : 'No'}`);
      console.log(`  Result: ${step.result}`);
      if (step.error) {
        console.error(`  Error: ${step.error}`);
      }
    }
  }

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch((error) => {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Response:', error.response);
  }
  process.exit(1);
});
