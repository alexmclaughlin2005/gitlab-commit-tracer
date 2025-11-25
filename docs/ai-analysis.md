# AI Analysis Approach

This document describes how AI is used to analyze commit chains and provide contextual insights.

## Overview

The AI analysis module takes a complete relationship chain (Commit → MR → Issue → Epic) and uses large language models to understand the context, reasoning, and impact of code changes.

## Analysis Goals

### Primary Questions

1. **Why was this commit made?**
   - What problem does it solve?
   - What triggered this change?

2. **What approach was taken?**
   - How was the problem solved?
   - What technical decisions were made?

3. **What is the impact?**
   - How does this affect the epic's goals?
   - Does it introduce risks or opportunities?

4. **Does it fit patterns?**
   - Is this expected given the issue description?
   - Are there inconsistencies or surprises?

## Input Context Structure

### Data Gathered

For each commit, compile:

```json
{
  "commit": {
    "sha": "abc123...",
    "message": "Fix authentication timeout",
    "author": "developer@example.com",
    "timestamp": "2025-11-24T10:30:00Z",
    "files_changed": 3,
    "summary": "Modified JWT expiration logic in auth service"
  },
  "merge_request": {
    "iid": 42,
    "title": "Fix: Increase JWT token expiration time",
    "description": "Users were getting logged out too frequently...",
    "discussion_summary": "Discussed security implications..."
  },
  "issue": {
    "iid": 123,
    "title": "Users complain about frequent logouts",
    "description": "Multiple users report having to log in every hour...",
    "labels": ["bug", "authentication", "user-experience"]
  },
  "epic": {
    "id": 5,
    "title": "Improve Authentication System",
    "description": "Modernize authentication with better security and UX",
    "objectives": [
      "Reduce login friction",
      "Improve security",
      "Support SSO"
    ]
  }
}
```

## Prompt Engineering

### Structured Prompt Template

```
You are analyzing a code commit in the context of its development lifecycle.

COMMIT:
- SHA: {commit.sha}
- Message: {commit.message}
- Summary: {commit.summary}

MERGE REQUEST:
- Title: {mr.title}
- Description: {mr.description}

ISSUE:
- Title: {issue.title}
- Description: {issue.description}
- Labels: {issue.labels}

EPIC:
- Title: {epic.title}
- Description: {epic.description}
- Objectives: {epic.objectives}

Please analyze this commit and provide:

1. REASON: Why was this commit made? What problem does it solve?
2. APPROACH: What technical approach was taken?
3. IMPACT: How does this commit contribute to the epic's objectives?
4. ALIGNMENT: Does this commit align with the stated issue and epic goals?
5. CONFIDENCE: How confident are you in this analysis? (0.0-1.0)

Provide your response in JSON format:
{
  "reason": "...",
  "approach": "...",
  "impact": "...",
  "alignment": "aligned|partially-aligned|misaligned",
  "alignment_notes": "...",
  "confidence": 0.0-1.0
}
```

## Response Parsing

### Expected Output Format

```json
{
  "reason": "Users were experiencing frequent session timeouts, causing frustration and reducing productivity",
  "approach": "Increased JWT token expiration from 1 hour to 4 hours, balancing security with user experience",
  "impact": "Directly addresses the 'Reduce login friction' objective while maintaining reasonable security",
  "alignment": "aligned",
  "alignment_notes": "Commit directly solves the issue described and contributes to the epic's UX goals",
  "confidence": 0.95
}
```

### Validation

- Ensure all required fields are present
- Validate confidence is between 0.0 and 1.0
- Validate alignment is one of allowed values
- Check for reasonable text length

## AI Provider Selection

### Considerations

**OpenAI (GPT-4)**
- Pros: Strong reasoning, good context understanding
- Cons: Cost, requires external API

**Anthropic (Claude)**
- Pros: Excellent at following structured formats, good reasoning
- Cons: Requires external API

**Local Models**
- Pros: No external dependencies, cost-effective
- Cons: May require more powerful hardware, potentially lower quality

### Implementation

Use pluggable provider interface to allow switching:

```typescript
interface AIProvider {
  analyze(context: CommitContext): Promise<AnalysisResult>;
}
```

## Context Optimization

### Token Management

- Truncate very long descriptions (keep first 500 words)
- Summarize lengthy discussions (extract key points)
- Omit file diffs unless specifically needed
- Keep prompts under 4000 tokens when possible

### Caching Strategy

- Cache analysis results by commit SHA
- Reuse analysis if relationship chain hasn't changed
- Cache common epic/issue descriptions

## Quality Assurance

### Confidence Scoring

Use AI confidence score to flag uncertain analyses:
- `>= 0.8`: High confidence
- `0.5 - 0.8`: Medium confidence
- `< 0.5`: Low confidence (may need human review)

### Human Review Triggers

Flag for review when:
- Confidence < 0.5
- Alignment is "misaligned"
- Commit has no clear MR/Issue/Epic chain
- AI response fails validation

## Edge Cases

### Incomplete Chains

**No MR found**:
- Analyze commit message + issue (if available)
- Note in analysis that context is limited

**No Issue found**:
- Analyze commit + MR only
- Infer purpose from MR description

**No Epic found**:
- Analyze up to issue level
- Note that high-level impact cannot be assessed

### Multiple Issues/Epics

If MR closes multiple issues:
- Analyze in context of primary issue
- Note other related issues

If issue links to multiple epics:
- Analyze impact on primary epic
- Note other affected epics

## Output and Storage

### Storage Format

```sql
CREATE TABLE analyses (
  id INTEGER PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  reason TEXT,
  approach TEXT,
  impact TEXT,
  alignment TEXT,
  alignment_notes TEXT,
  confidence REAL,
  analyzed_at TIMESTAMP,
  ai_provider TEXT,
  ai_model TEXT
);
```

### Reporting

Generate reports showing:
- Commits by confidence level
- Alignment patterns
- Common reasons for changes
- Epic progress indicators

## Performance Targets

- Analyze commit in < 5 seconds
- Support batch processing (10+ commits in parallel)
- Cache hit rate > 80% for re-analysis

## Future Enhancements

- Pattern learning: Improve over time
- Custom analysis rules per project
- Sentiment analysis of discussions
- Risk detection (security, breaking changes)
- Trend analysis across commits
- Team productivity insights
