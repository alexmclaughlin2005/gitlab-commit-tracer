# Clerk Authentication Implementation Plan

## Overview
This document outlines a safe, feature-flagged approach to adding Clerk authentication to the GitLab Commit Tracer application.

## Architecture Overview

**Current State:**
- Backend: Express.js server (port 3005)
- Frontend: Vanilla JavaScript + HTML (served as static files)
- No authentication - public access

**Target State:**
- Clerk-based authentication for both UI and API
- Feature-flagged rollout with 3 phases
- Zero downtime deployment

## Feature Flags (Environment Variables)

```bash
# Phase Control
CLERK_ENABLED=false                    # Master switch - enables Clerk integration
CLERK_ENFORCE_UI_AUTH=false           # Phase 2 - redirects unauthenticated users to sign-in
CLERK_ENFORCE_API_AUTH=false          # Phase 3 - returns 401 for unauthenticated API requests

# Clerk Configuration
CLERK_PUBLISHABLE_KEY=pk_test_...     # From Clerk Dashboard
CLERK_SECRET_KEY=sk_test_...          # From Clerk Dashboard (backend verification)
CLERK_SIGN_IN_URL=/sign-in            # Custom sign-in page path
CLERK_SIGN_UP_URL=/sign-up            # Custom sign-up page path
CLERK_AFTER_SIGN_IN_URL=/             # Redirect after successful sign-in
CLERK_AFTER_SIGN_UP_URL=/             # Redirect after successful sign-up

# Optional: Whitelist specific paths (even when auth is enforced)
CLERK_PUBLIC_ROUTES=/api/status,/health  # Comma-separated list of public routes
```

## Rollout Phases

### Phase 1: Infrastructure Setup (Non-Breaking)
**Feature Flags**: `CLERK_ENABLED=true`, `CLERK_ENFORCE_UI_AUTH=false`, `CLERK_ENFORCE_API_AUTH=false`

**What happens:**
- Clerk SDK loaded but authentication NOT enforced
- Sign-in/sign-up pages available but optional
- Users can access all pages with or without authentication
- Backend middleware verifies tokens IF present, but doesn't reject requests
- User info displayed in header if logged in

**Benefits:**
- Zero risk - existing functionality unchanged
- Can test authentication flows in production
- Gradual user adoption

**Files Changed:**
- `package.json` - add Clerk dependencies
- `.env.example` - add Clerk environment variables
- `src/server/index.ts` - add optional auth middleware
- `ui/public/sign-in.html` - new sign-in page
- `ui/public/sign-up.html` - new sign-up page
- `ui/public/index.html` - add Clerk SDK and user menu
- `ui/public/teams.html` - add Clerk SDK and user menu
- `ui/public/epics.html` - add Clerk SDK and user menu

---

### Phase 2: Enforce UI Authentication (Partial Protection)
**Feature Flags**: `CLERK_ENABLED=true`, `CLERK_ENFORCE_UI_AUTH=true`, `CLERK_ENFORCE_API_AUTH=false`

**What happens:**
- All HTML pages redirect to sign-in if not authenticated
- API endpoints still work without authentication (for backward compatibility)
- Users must log in to view UI, but API remains accessible

**Benefits:**
- Protects sensitive data from casual browsing
- API clients (if any) continue to work
- Can validate authentication UX before full lockdown

**Use Case:**
- Internal tool where UI access should be restricted
- API might be used by CI/CD or monitoring tools

---

### Phase 3: Full Authentication (Complete Protection)
**Feature Flags**: `CLERK_ENABLED=true`, `CLERK_ENFORCE_UI_AUTH=true`, `CLERK_ENFORCE_API_AUTH=true`

**What happens:**
- All pages require authentication
- All API endpoints require valid JWT token
- 401 responses for unauthenticated API requests

**Benefits:**
- Complete security posture
- Fine-grained access control possible (roles, permissions)
- Audit trail of all actions

---

## Implementation Steps

### Step 1: Create Clerk Account and Application
1. Go to https://clerk.com and sign up
2. Create a new application (name: "GitLab Commit Tracer")
3. Copy publishable key and secret key
4. Configure allowed redirect URLs:
   - Development: `http://localhost:3005/*`
   - Production: `https://your-railway-app.up.railway.app/*`

### Step 2: Install Dependencies
```bash
npm install @clerk/clerk-sdk-node @clerk/clerk-js
```

### Step 3: Update Environment Variables
Add to `.env`:
```bash
# Clerk Authentication (Phase 1 - Infrastructure Only)
CLERK_ENABLED=true
CLERK_ENFORCE_UI_AUTH=false
CLERK_ENFORCE_API_AUTH=false
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up
CLERK_AFTER_SIGN_IN_URL=/
CLERK_AFTER_SIGN_UP_URL=/
CLERK_PUBLIC_ROUTES=/api/status,/health
```

### Step 4: Create Authentication Middleware (Backend)
Create `src/middleware/auth.ts`:
- Optional auth checker (Phase 1)
- UI redirect logic (Phase 2)
- API enforcement logic (Phase 3)

### Step 5: Create Sign-In/Sign-Up Pages
- `ui/public/sign-in.html` - Clerk sign-in component
- `ui/public/sign-up.html` - Clerk sign-up component
- Both use Clerk's pre-built UI components

### Step 6: Add Clerk SDK to Existing Pages
Update all HTML pages:
- Load Clerk JavaScript SDK
- Initialize with publishable key
- Add user menu/avatar in header
- Add authentication state checking
- Redirect logic (when enforcement enabled)

### Step 7: Update API Routes
- Add optional auth middleware to all routes
- Extract user info from JWT when available
- Store userId with database records (optional enhancement)

### Step 8: Testing Plan
**Phase 1 Testing:**
- [ ] App works without authentication
- [ ] Sign-in page renders correctly
- [ ] Can create account and log in
- [ ] User info displays in header when logged in
- [ ] Can access all pages logged out

**Phase 2 Testing:**
- [ ] Logged out users redirected to sign-in
- [ ] Sign-in redirects back to intended page
- [ ] API endpoints still work without auth
- [ ] User menu shows correct info

**Phase 3 Testing:**
- [ ] API returns 401 without token
- [ ] API works with valid JWT token
- [ ] Token refresh works correctly
- [ ] Sign-out clears session

### Step 9: Database Schema Enhancement (Optional)
Add user tracking to commits:
```sql
ALTER TABLE commits ADD COLUMN discovered_by_user_id VARCHAR(255);
ALTER TABLE stakeholder_updates ADD COLUMN generated_by_user_id VARCHAR(255);
```

### Step 10: Rollout Strategy

**Development:**
1. Deploy Phase 1 with `CLERK_ENABLED=true`
2. Test authentication flows
3. Invite team members to test

**Production:**
1. Deploy Phase 1 (non-breaking)
2. Monitor for 1 week
3. Enable Phase 2 (UI protection)
4. Monitor for 1 week
5. Enable Phase 3 (full protection) if needed

---

## Rollback Plan

**If issues arise:**
1. Set `CLERK_ENABLED=false` in environment
2. Redeploy (or restart app)
3. All authentication disabled, app returns to original state

**No code rollback needed** - feature flags provide instant rollback!

---

## Security Considerations

1. **JWT Verification**: Backend MUST verify JWT signatures using Clerk secret key
2. **Token Storage**: Clerk handles secure token storage in httpOnly cookies
3. **CORS**: Update CORS settings to allow Clerk domains
4. **CSP**: Update Content Security Policy to allow Clerk scripts
5. **Rate Limiting**: Consider adding rate limiting to auth endpoints
6. **Audit Logs**: Clerk provides authentication audit logs

---

## Cost Estimation

**Clerk Pricing (as of 2024):**
- Free: Up to 10,000 monthly active users (MAUs)
- Pro: $25/month base + $0.02 per MAU over 10,000
- Enterprise: Custom pricing

**Recommendation**: Start with free tier

---

## Alternative: Clerk vs. Other Options

| Feature | Clerk | Auth0 | Supabase Auth |
|---------|-------|-------|---------------|
| Setup Time | 10 min | 30 min | 20 min |
| Pre-built UI | ✅ Excellent | ✅ Good | ⚠️ Basic |
| Free Tier | 10k MAU | 7k MAU | Unlimited |
| Vanilla JS Support | ✅ | ✅ | ✅ |
| JWT Verification | ✅ | ✅ | ✅ |

**Recommendation**: Clerk is ideal for this use case due to:
- Excellent vanilla JS support
- Beautiful pre-built UI components
- Simple integration
- Generous free tier

---

## Next Steps

Would you like me to proceed with implementation? I can:

1. ✅ Start with Phase 1 (infrastructure setup)
2. Create all necessary files with feature flags
3. Test locally before deployment
4. Provide step-by-step testing checklist

The entire implementation is **reversible** via environment variables - no risk to production!
