# Stakeholder Updates Feature

## Overview

The GitLab Commit Tracer now generates **two versions of updates** for every commit, tailored for different audiences:

1. **Technical Update**: For people with project context (developers, PMs, architects)
2. **Business Update**: For GTM teams (marketing, sales, support, executives)

This feature automatically translates technical commit information into appropriate language for each audience, making it easy to communicate progress across your entire organization.

---

## Use Cases

### 1. Sprint Updates
Generate updates for your entire team at the end of a sprint:
- Engineering team gets technical details
- Leadership team gets business impact

### 2. Product Releases
Create release notes that speak to different stakeholders:
- Developers understand what changed technically
- Sales team understands what to tell customers

### 3. Cross-Functional Communication
Bridge the gap between technical and business teams:
- Technical teams see implementation details
- Business teams see customer value

### 4. Executive Reporting
Provide context-appropriate updates to leadership:
- Skip implementation details
- Focus on business outcomes and strategic alignment

---

## How It Works

### 1. Analysis First
The system first analyzes the commit to understand:
- **Reason**: Why the commit was made
- **Approach**: How the problem was solved
- **Impact**: How it affects project goals
- **Alignment**: How well it fits with issues/epics

### 2. Dual Update Generation
Using the analysis, GPT-5 generates two versions:

**Technical Update** (3-5 sentences):
- Includes technical terminology
- Explains implementation details
- Shows how it fits into architecture
- Assumes project context knowledge

**Business Update** (2-4 sentences):
- No technical jargon
- Focuses on business value
- Explains user impact
- Connects to customer outcomes

---

## Example Output

### Commit: "Implement JWT token caching"

**Technical Update:**
"Implemented a Redis-based caching layer for JWT tokens to reduce authentication latency by 60%. The cache stores validated tokens with a 5-minute TTL, falling back to database validation on cache misses. This change advances our 'Improve Authentication System' epic by addressing the performance bottleneck identified in issue #234, where users experienced 200-300ms auth delays during peak traffic. The implementation uses our existing Redis cluster and integrates seamlessly with the current auth middleware, requiring minimal changes to downstream services."

**Business Update:**
"We've improved login performance by 60%, making the application significantly faster for users during peak hours. Previously, users experienced noticeable delays when accessing features, especially during busy periods. This enhancement ensures a smoother, more responsive user experience that will reduce support tickets related to 'slow loading' and improve customer satisfaction scores. This improvement supports our commitment to delivering best-in-class performance."

---

## Usage

### Basic Usage

```typescript
import { GitLabClient } from './src/api';
import { CommitTracer } from './src/tracing';
import { CommitAnalyzer } from './src/analysis';

// Initialize
const client = new GitLabClient({
  baseUrl: process.env.GITLAB_URL!,
  token: process.env.GITLAB_TOKEN!,
  projectId: 'my-project',
});

const tracer = new CommitTracer(client);
const analyzer = new CommitAnalyzer();

// Trace and analyze with updates
const chain = await tracer.traceCommit('abc123');
const result = await analyzer.analyzeCommitWithUpdates(chain);

// Access different versions
console.log('Technical:', result.updates.technicalUpdate);
console.log('Business:', result.updates.businessUpdate);
```

### Batch Processing

```typescript
// Trace recent commits
const traced = await tracer.traceRecentCommits(10, 'my-project', 'main');

// Generate updates for all
const analyses = await analyzer.analyzeCommitsWithUpdates(traced.chains);

// Generate formatted report
const report = analyzer.generateUpdateReport(analyses);
console.log(report);
```

### Filter by Audience

```typescript
const analyses = await analyzer.analyzeCommitsWithUpdates(chains);

// Export for engineering team
const techUpdates = analyses.map(a => ({
  commit: a.chain.commit.title,
  update: a.updates.technicalUpdate
}));

// Export for business team
const bizUpdates = analyses.map(a => ({
  commit: a.chain.commit.title,
  update: a.updates.businessUpdate
}));
```

---

## Report Format

The `generateUpdateReport()` method creates a comprehensive report:

```
=== STAKEHOLDER UPDATES REPORT ===

Generated: 2025-11-24T10:30:00.000Z
Commits Analyzed: 5

────────────────────────────────────────────────────────────────────────────────

COMMIT: abc123de - Implement JWT token caching
Author: John Developer
Date: 2025-11-23T15:45:00Z
Alignment: aligned (95% confidence)

📋 TECHNICAL UPDATE (For: Developers, PMs, Architects)
────────────────────────────────────────────────────────────────────────────────
Implemented a Redis-based caching layer for JWT tokens to reduce authentication
latency by 60%...

💼 BUSINESS UPDATE (For: Marketing, Sales, Support, GTM, Executives)
────────────────────────────────────────────────────────────────────────────────
We've improved login performance by 60%, making the application significantly
faster for users during peak hours...

[... more commits ...]

════════════════════════════════════════════════════════════════════════════════

SUMMARY

Total Commits: 5
Total Tokens Used: 8,234
Total Cost: $0.0823
Average Cost per Commit: $0.0165
```

---

## Configuration

### Model Selection

```typescript
import { OpenAIProvider } from './src/analysis';

// Use GPT-5 for highest quality
const provider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
  model: 'gpt-5',
  temperature: 0.3,
});

// Use GPT-5-nano for faster/cheaper
const nanoProvider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
  model: 'gpt-5-nano',
  temperature: 0.3,
});

const analyzer = new CommitAnalyzer(provider);
```

---

## Cost Tracking

Each update includes cost information:

```typescript
const result = await analyzer.analyzeCommitWithUpdates(chain);

console.log('Analysis Cost:', result.analysis.metadata.costUsd);
console.log('Updates Cost:', result.updates.metadata.costUsd);
console.log('Total Cost:',
  (result.analysis.metadata.costUsd || 0) +
  (result.updates.metadata.costUsd || 0)
);
```

**Estimated Costs:**
- Analysis: ~$0.005-0.015 per commit
- Updates: ~$0.003-0.008 per commit
- **Total: ~$0.008-0.023 per commit**

For a sprint with 100 commits: **~$0.80-2.30**

---

## Integration Examples

### Slack Integration

```typescript
const analyses = await analyzer.analyzeCommitsWithUpdates(chains);

// Post to #engineering channel
const techMessage = {
  channel: '#engineering',
  text: '## Sprint Summary - Technical Updates\n' +
    analyses.map(a =>
      `**${a.chain.commit.title}**\n${a.updates.technicalUpdate}`
    ).join('\n\n')
};

// Post to #general channel
const bizMessage = {
  channel: '#general',
  text: '## Sprint Summary - Product Updates\n' +
    analyses.map(a =>
      `**${a.chain.commit.title}**\n${a.updates.businessUpdate}`
    ).join('\n\n')
};
```

### Email Reports

```typescript
const analyses = await analyzer.analyzeCommitsWithUpdates(chains);

const engineeringEmail = {
  to: 'engineering-team@company.com',
  subject: 'Sprint Technical Updates',
  body: generateTechnicalEmail(analyses)
};

const executiveEmail = {
  to: 'executives@company.com',
  subject: 'Sprint Business Impact Summary',
  body: generateBusinessEmail(analyses)
};
```

### Confluence/Notion Documentation

```typescript
// Generate markdown for documentation
const markdown = `
# Sprint ${sprintNumber} Updates

## Technical Changes
${analyses.map(a => `
### ${a.chain.commit.title}
${a.updates.technicalUpdate}
- Alignment: ${a.analysis.alignment}
- Confidence: ${(a.analysis.confidence * 100).toFixed(0)}%
`).join('\n')}

## Business Impact
${analyses.map(a => `
### ${a.chain.commit.title}
${a.updates.businessUpdate}
`).join('\n')}
`;
```

---

## Best Practices

### 1. Complete Chains
For best results, ensure commits have:
- Associated merge requests
- Linked issues with clear descriptions
- Epics with defined objectives

### 2. Clear Commit Messages
Better commit messages lead to better updates:
- ✅ "Implement JWT caching to reduce auth latency"
- ❌ "Fix bug"

### 3. Batch Processing
Process multiple commits together for efficiency:
- Lower cost per commit
- Consistent analysis quality
- Better context understanding

### 4. Review High-Value Commits
Focus human review on:
- Low confidence scores (< 0.7)
- Misaligned commits
- Customer-facing changes

---

## Troubleshooting

### "Provider does not support update generation"
- Ensure you're using `OpenAIProvider`
- The provider must implement `generateUpdate()`

### Updates Too Technical/Too Simple
- Adjust the `temperature` parameter (0.1-0.5 recommended)
- Provide better issue/epic descriptions
- Ensure commit messages are clear

### High Costs
- Use `gpt-5-nano` instead of `gpt-5`
- Process only important commits
- Cache results to avoid regeneration

---

## Files Modified/Created

### New Types
- `src/analysis/types.ts`: Added `StakeholderUpdate`, `CommitAnalysisWithUpdates`

### New Methods
- `OpenAIProvider.generateUpdate()`: Generates dual updates
- `CommitAnalyzer.analyzeCommitWithUpdates()`: Analysis + updates
- `CommitAnalyzer.analyzeCommitsWithUpdates()`: Batch processing
- `CommitAnalyzer.generateUpdateReport()`: Formatted reports

### New Examples
- `examples/stakeholder-updates-example.ts`: Complete examples

---

## Next Steps

Potential enhancements:
1. **Custom Templates**: Allow users to define their own update formats
2. **More Audiences**: Add updates for QA, DevOps, Security teams
3. **Localization**: Generate updates in multiple languages
4. **Priority Filtering**: Only generate updates for high-priority commits
5. **Change Categorization**: Group updates by type (feature, bugfix, refactor)

---

## Conclusion

The Stakeholder Updates feature bridges the communication gap between technical and business teams. By automatically generating appropriate updates for different audiences, it:

✅ Saves time on status reporting
✅ Improves cross-functional communication
✅ Ensures consistent messaging
✅ Makes technical work visible to business stakeholders
✅ Helps leadership understand engineering impact

**Ready to use!** See [examples/stakeholder-updates-example.ts](examples/stakeholder-updates-example.ts) for working examples.
