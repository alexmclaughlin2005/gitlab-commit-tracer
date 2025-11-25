/**
 * Basic Usage Example for GitLab Commit Tracer
 *
 * This example demonstrates how to use the GitLab API client
 * to fetch commits and trace them through MRs, issues, and epics.
 */

import { GitLabClient } from '../src/api';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main example function
 */
async function main(): Promise<void> {
  console.log('=== GitLab Commit Tracer - Basic Usage Example ===\n');

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

  // Step 3: Fetch recent commits
  console.log('Fetching recent commits...');
  const commitsResponse = await client.listCommits(undefined, {
    per_page: 5,
    with_stats: true,
  });

  console.log(`Found ${commitsResponse.data.length} commits:`);
  for (const commit of commitsResponse.data) {
    console.log(`  - ${commit.short_id}: ${commit.title}`);
    console.log(`    Author: ${commit.author_name}`);
    console.log(`    Date: ${commit.created_at}`);
    if (commit.stats) {
      console.log(`    Stats: +${commit.stats.additions} -${commit.stats.deletions}`);
    }
    console.log();
  }

  // Step 4: Trace first commit through its chain
  if (commitsResponse.data.length > 0) {
    const commit = commitsResponse.data[0];
    console.log(`\n=== Tracing commit ${commit.short_id} ===\n`);

    // Find merge requests for this commit
    console.log('Finding merge requests...');
    const mergeRequests = await client.getCommitMergeRequests(commit.id);

    if (mergeRequests.length === 0) {
      console.log('No merge requests found for this commit.');
    } else {
      console.log(`Found ${mergeRequests.length} merge request(s):\n`);

      for (const mr of mergeRequests) {
        console.log(`Merge Request !${mr.iid}: ${mr.title}`);
        console.log(`  State: ${mr.state}`);
        console.log(`  Author: ${mr.author.name}`);
        console.log(`  URL: ${mr.web_url}`);

        // Find issues closed by this MR
        console.log('  Finding related issues...');
        const issues = await client.getMergeRequestClosesIssues(mr.iid);

        if (issues.length === 0) {
          console.log('  No issues closed by this MR.\n');
        } else {
          console.log(`  Closes ${issues.length} issue(s):\n`);

          for (const issue of issues) {
            console.log(`    Issue #${issue.iid}: ${issue.title}`);
            console.log(`      State: ${issue.state}`);
            console.log(`      Labels: ${issue.labels.join(', ') || 'None'}`);
            console.log(`      URL: ${issue.web_url}`);

            // Check for epic (Premium/Ultimate only)
            if (issue.epic) {
              console.log(`      Epic: &${issue.epic.iid} - ${issue.epic.title}`);
              console.log(`      Epic URL: ${issue.epic.url}`);

              // Optionally fetch full epic details
              try {
                const epic = await client.getEpic(issue.epic.group_id, issue.epic.iid);
                console.log(`      Epic Description: ${epic.description?.substring(0, 100)}...`);
                console.log(`      Epic State: ${epic.state}`);
              } catch (error: any) {
                if (error.status === 404 || error.status === 403) {
                  console.log('      (Epic details not accessible - may require Premium/Ultimate)');
                } else {
                  console.log(`      Error fetching epic: ${error.message}`);
                }
              }
            } else {
              console.log('      (No epic associated)');
            }
            console.log();
          }
        }
      }
    }
  }

  // Step 5: Display API usage statistics
  console.log('\n=== API Usage Statistics ===');
  const stats = client.getStats();
  console.log(`Total requests made: ${stats.requestCount}`);
  const rateLimit = stats.rateLimitInfo;
  if (rateLimit.remaining !== undefined) {
    console.log(`Rate limit remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
    if (rateLimit.reset) {
      console.log(`Rate limit resets at: ${rateLimit.reset.toISOString()}`);
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
