# GitLab API Integration

This document describes how the application integrates with the GitLab API.

## Overview

The GitLab API client provides a typed interface to interact with GitLab's REST API v4.

## Authentication

### Personal Access Token

The application uses GitLab Personal Access Tokens for authentication.

**Required Scopes**:
- `api` - Full API access
- `read_repository` - Repository access

**Setup**:
1. Go to GitLab → Settings → Access Tokens
2. Create token with required scopes
3. Add to `.env` file as `GITLAB_TOKEN`

## API Endpoints Used

### Commits

**Endpoint**: `GET /projects/:id/repository/commits`

**Purpose**: Fetch recent commits for monitoring

**Key Fields**:
- `id` (SHA)
- `message`
- `author_name`, `author_email`
- `created_at`
- `web_url`

### Merge Requests

**Endpoint**: `GET /projects/:id/merge_requests`

**Purpose**: Find MRs containing specific commits

**Key Fields**:
- `iid`
- `title`, `description`
- `state` (opened, merged, closed)
- `merge_commit_sha`
- `web_url`

**Endpoint**: `GET /projects/:id/merge_requests/:merge_request_iid/commits`

**Purpose**: List commits in a specific MR

### Issues

**Endpoint**: `GET /projects/:id/issues`

**Purpose**: Fetch issue details

**Key Fields**:
- `iid`
- `title`, `description`
- `labels`
- `state`
- `epic` (relationship)
- `web_url`

**Endpoint**: `GET /projects/:id/merge_requests/:merge_request_iid/closes_issues`

**Purpose**: Find issues closed by a specific MR

### Epics

**Endpoint**: `GET /groups/:id/epics/:epic_id`

**Purpose**: Fetch epic details

**Key Fields**:
- `id`
- `title`, `description`
- `labels`
- `start_date`, `end_date`
- `web_url`

**Note**: Epics require GitLab Premium/Ultimate

## Rate Limiting

GitLab rate limits:
- **Authenticated**: 2000 requests per minute per user
- **Unauthenticated**: 10 requests per minute per IP

**Strategy**:
- Implement exponential backoff on 429 responses
- Track request count and pace requests
- Cache responses where appropriate

## Pagination

GitLab API uses pagination for list endpoints.

**Headers**:
- `x-total-pages` - Total pages available
- `x-page` - Current page
- `x-per-page` - Items per page
- `x-next-page` - Next page number

**Implementation**:
- Use `per_page=100` for efficiency
- Follow pagination headers to fetch all results

## Error Handling

**Common Errors**:
- `401 Unauthorized` - Invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `429 Too Many Requests` - Rate limit exceeded

**Retry Strategy**:
- Retry on 5xx errors with exponential backoff
- Don't retry on 4xx errors (except 429)
- Max 3 retry attempts

## Data Validation

All API responses should be validated for:
- Required fields presence
- Field type correctness
- Expected value ranges

## Example Flows

### Flow 1: Find MR for Commit

```
1. GET /projects/:id/repository/commits/:sha
2. GET /projects/:id/merge_requests?state=merged
3. For each MR:
   GET /projects/:id/merge_requests/:iid/commits
   Check if commit SHA is in list
4. Return matching MR
```

### Flow 2: Find Issue from MR

```
1. GET /projects/:id/merge_requests/:iid/closes_issues
2. If empty, parse MR description for "Closes #123"
3. Return linked issue(s)
```

### Flow 3: Find Epic from Issue

```
1. GET /projects/:id/issues/:iid
2. Extract epic relationship from response
3. If epic exists:
   GET /groups/:group_id/epics/:epic_id
4. Return epic details
```

## API Documentation Reference

### Official GitLab API Documentation
- [REST API Overview](https://docs.gitlab.com/ee/api/rest/)
- [Authentication](https://docs.gitlab.com/ee/api/rest/authentication.html)
- [Commits API](https://docs.gitlab.com/ee/api/commits.html)
- [Merge Requests API](https://docs.gitlab.com/ee/api/merge_requests.html)
- [Issues API](https://docs.gitlab.com/ee/api/issues.html)
- [Epics API](https://docs.gitlab.com/ee/api/epics.html) - **Deprecated in 17.0, use Work Items API**
- [Rate Limits](https://docs.gitlab.com/ee/security/rate_limits.html)

### Key API Features

**Authentication Headers:**
```bash
# Recommended method
--header "PRIVATE-TOKEN: <your_access_token>"

# Alternative OAuth-compliant method
--header "Authorization: Bearer <your_access_token>"
```

**Find Merge Requests for a Commit:**
```
GET /projects/:id/repository/commits/:sha/merge_requests
```
Returns merge requests that introduced the specified commit.

**Get Issues Closed by MR:**
```
GET /projects/:id/merge_requests/:merge_request_iid/closes_issues
```
Returns issues that will be closed when the MR is merged.

**Get Related MRs for an Issue:**
```
GET /projects/:id/issues/:issue_iid/related_merge_requests
GET /projects/:id/issues/:issue_iid/closed_by
```

### Important Notes

1. **Epic API Deprecation**: The Epics REST API was deprecated in GitLab 17.0. Applications should plan to migrate to the Work Items API in the future.

2. **Pagination Limitations**: The Commits API does not return `x-total` and `x-total-pages` headers for performance reasons.

3. **Epic Access**: Epics require GitLab Premium or Ultimate tier.

4. **Issue-Epic Relationship**: Issues on Premium/Ultimate include an `epic` property in the response:
   ```json
   {
     "epic": {
       "id": 42,
       "iid": 5,
       "title": "Epic title",
       "url": "/groups/group-name/-/epics/5",
       "group_id": 8
     }
   }
   ```

## Testing

- Use fixtures for common API responses
- Mock API calls in unit tests
- Integration tests against test GitLab instance
- Never commit real API tokens

## Future Enhancements

- Webhook support for real-time updates
- GraphQL API usage (more efficient for relationship queries)
- Batch operations
- Incremental sync
