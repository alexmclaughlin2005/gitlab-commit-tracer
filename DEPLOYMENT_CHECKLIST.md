# Deployment Checklist - Clerk Authentication

## Current Status: Phase 2 Complete ✅

### ✅ Completed Steps

1. **Authentication Infrastructure**
   - ✅ Installed Clerk dependencies (`@clerk/backend`, `@clerk/clerk-sdk-node`)
   - ✅ Created authentication middleware with 3-phase rollout ([src/middleware/auth.ts](src/middleware/auth.ts))
   - ✅ Created shared auth-helper.js with Clerk SDK integration
   - ✅ Integrated auth middleware into Express server
   - ✅ Added auth configuration API endpoints
   - ✅ Configured Account Portal authentication flow

2. **CORS Configuration**
   - ✅ Enhanced CORS with function-based validation
   - ✅ Added support for credentials and auth headers
   - ✅ Added debug logging for troubleshooting
   - ✅ Configured for Vercel frontend + Railway backend architecture

3. **Clerk Instance Configuration**
   - ✅ **Instance**: calm-giraffe-10.clerk.accounts.dev
   - ✅ **Publishable Key**: pk_test_Y2FsbS1naXJhZmZlLTEwLmNsZXJrLmFjY291bnRzLmRldiQ
   - ✅ **Authentication Method**: Account Portal (Clerk-hosted pages)
   - ✅ **Frontend API URL**: https://calm-giraffe-10.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js

4. **Railway Environment Variables** (Backend)
   - ✅ `CLERK_ENABLED=true`
   - ✅ `CLERK_ENFORCE_UI_AUTH=true` ← **Phase 2 Active**
   - ✅ `CLERK_ENFORCE_API_AUTH=false` ← **Phase 3 Not Yet Active**
   - ✅ `CLERK_PUBLISHABLE_KEY=pk_test_Y2FsbS1naXJhZmZlLTEwLmNsZXJrLmFjY291bnRzLmRldiQ`
   - ✅ `CLERK_SECRET_KEY=sk_test_irKfZictAEMgQCRpStTcOufMhRTg24GxzTlIWPvhu0`
   - ✅ `ALLOWED_ORIGINS=https://gitlab-commit-tracer.vercel.app`
   - ✅ `CLERK_PUBLIC_ROUTES=/api/status,/health,/api/auth/config`
   - ✅ `NODE_ENV=production`

5. **Clerk Dashboard Configuration**
   - ✅ **Settings → Advanced → Paths**: Set to "Account Portal" (Clerk-hosted)
   - ✅ Sign-in URL: Handled by Clerk at calm-giraffe-10.clerk.accounts.dev
   - ✅ Sign-up URL: Handled by Clerk at calm-giraffe-10.clerk.accounts.dev
   - ✅ Redirect after sign-in: Returns to original page
   - ✅ Redirect after sign-out: Returns to home page (/)

6. **Frontend Integration**
   - ✅ All pages include [auth-helper.js](ui/public/auth-helper.js)
   - ✅ User menu displays in header when signed in
   - ✅ Sign In / Sign Up buttons when not authenticated
   - ✅ UI enforcement redirects unauthenticated users to Clerk sign-in
   - ✅ Sign-out functionality working correctly

### 🎯 Current Phase: Phase 2 - UI Protection

**Status**: ✅ **Working**

**Configuration**:
```bash
CLERK_ENABLED=true
CLERK_ENFORCE_UI_AUTH=true
CLERK_ENFORCE_API_AUTH=false
```

**What This Means**:
- ✅ Users must sign in to access pages
- ✅ Sign In / Sign Up buttons visible in header
- ✅ Authentication redirects to Clerk Account Portal
- ✅ After sign-in, users redirected back to original page
- ✅ API endpoints remain open (no token required)

**Verified Working**:
- ✅ Unauthenticated users redirected to Clerk sign-in
- ✅ Sign-up flow creates new accounts
- ✅ Sign-in flow authenticates existing users
- ✅ Sign-out redirects to home page
- ✅ All app functionality works after authentication

---

## 🚀 Phase Rollout Plan

### ~~Phase 1: Infrastructure Only~~ ✅ Complete
```bash
CLERK_ENABLED=true
CLERK_ENFORCE_UI_AUTH=false
CLERK_ENFORCE_API_AUTH=false
```
- Auth available but not required
- Test authentication components
- Verify no breaking changes
- **Status**: Completed successfully

---

### Phase 2: UI Protection ✅ Current Phase
```bash
CLERK_ENABLED=true
CLERK_ENFORCE_UI_AUTH=true
CLERK_ENFORCE_API_AUTH=false
```
- Pages require authentication
- APIs remain open (for now)
- **Status**: Working in production

**Testing Checklist**:
- ✅ Visit site while signed out → redirects to Clerk sign-in
- ✅ Sign up with new account → creates account and redirects back
- ✅ Sign in with existing account → authenticates and redirects back
- ✅ Sign out → redirects to home page
- ✅ All app features functional after authentication
- ✅ User menu displays correctly in header

---

### Phase 3: Full Protection ⏳ Next Step

**Prerequisites**:
- ⚠️ **Frontend code needs updates** - All API calls must use `authenticatedFetch()` instead of `fetch()`
- Currently ~20+ API calls across all pages need to be updated

**Configuration**:
```bash
CLERK_ENABLED=true
CLERK_ENFORCE_UI_AUTH=true
CLERK_ENFORCE_API_AUTH=true
```

**What Will Change**:
- All API endpoints require authentication token
- Frontend must include JWT token in all API requests
- Public routes remain accessible: `/api/status`, `/health`, `/api/auth/config`

**Files That Need Updates for Phase 3**:
1. [ui/public/index.html](ui/public/index.html) - ~15 API calls
2. [ui/public/teams.html](ui/public/teams.html) - ~4 API calls
3. [ui/public/epics.html](ui/public/epics.html) - ~4 API calls

**Example Change**:
```javascript
// Before (Phase 2):
const response = await fetch(`${API_BASE}/trace/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha })
});

// After (Phase 3):
const response = await authenticatedFetch(`${API_BASE}/trace/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha })
});
```

The `authenticatedFetch()` function (defined in [auth-helper.js](ui/public/auth-helper.js:244-255)) automatically adds the JWT token to requests.

---

## 🔧 Troubleshooting

### CORS Errors
- **Symptom**: `No 'Access-Control-Allow-Origin' header` in browser console
- **Solution**:
  - Verify `ALLOWED_ORIGINS=https://gitlab-commit-tracer.vercel.app` in Railway
  - Check Railway logs for CORS configuration output
  - Ensure no trailing slash in origin URL
  - Verify Railway has deployed latest code

### Clerk SDK Not Loading
- **Symptom**: Clerk SDK fails to load, console errors
- **Solution**:
  - Verify `CLERK_PUBLISHABLE_KEY` is correct
  - Check that Frontend API URL matches decoded key (calm-giraffe-10.clerk.accounts.dev)
  - Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)

### Authentication Redirect Loop
- **Symptom**: Infinite redirects between app and Clerk
- **Solution**:
  - Verify Clerk Dashboard paths are set to "Account Portal"
  - Check that `checkUIAuthEnforcement()` is using `clerkInstance.redirectToSignIn()`
  - Ensure `CLERK_ENFORCE_UI_AUTH=true` is set correctly

### Sign-Out 404 Error
- **Symptom**: After sign-out, redirects to `/sign-in` with 404
- **Solution**: ✅ Fixed - Now redirects to `/` (home page)

### 401 Unauthorized on API Calls
- **Symptom**: All API calls fail with 401 when `CLERK_ENFORCE_API_AUTH=true`
- **Solution**:
  - Set `CLERK_ENFORCE_API_AUTH=false` temporarily (Phase 2)
  - Update frontend to use `authenticatedFetch()` for all API calls
  - Add `/api/auth/config` to `CLERK_PUBLIC_ROUTES`

---

## 📝 Architecture

### Frontend: Vercel
- **URL**: https://gitlab-commit-tracer.vercel.app
- **Files**: ui/public/* (static HTML + JavaScript)
- **Deployment**: Automatic on git push to main
- **Auth Integration**: Clerk SDK loaded via CDN, auth-helper.js on all pages

### Backend: Railway
- **URL**: https://web-production-7418.up.railway.app/api
- **Stack**: Express server with authentication middleware
- **Database**: PostgreSQL with historical data persistence
- **Deployment**: Automatic on git push to main
- **Auth Integration**: Clerk SDK for token verification

### Authentication: Clerk
- **Instance**: calm-giraffe-10.clerk.accounts.dev
- **Method**: Account Portal (Clerk-hosted authentication pages)
- **Token Type**: JWT stored in httpOnly cookies
- **Token Verification**: Backend verifies tokens using Clerk secret key
- **Session Management**: Automatic token refresh by Clerk SDK

---

## 🔐 Security Features

1. **JWT Token Verification**
   - Tokens signed with Clerk's private key
   - Backend verifies with Clerk secret key
   - Tokens expire after 1 hour (configurable)

2. **httpOnly Cookies**
   - JavaScript cannot access tokens (XSS protection)
   - Cookies marked secure in production (HTTPS only)
   - Automatic cookie handling by browser

3. **CORS Protection**
   - Only allows requests from verified origins
   - Credentials support for cookie transmission
   - Proper preflight handling for complex requests

4. **Feature-Flagged Rollout**
   - Gradual enablement reduces risk
   - Instant rollback via environment variables
   - No code changes needed to enable/disable

5. **Public Route Whitelist**
   - Health checks always accessible
   - Auth config endpoint available before authentication
   - Status endpoint for monitoring

---

## 🔗 Important Links

- **Clerk Dashboard**: https://dashboard.clerk.com
- **Clerk Instance**: https://calm-giraffe-10.clerk.accounts.dev
- **Railway Project**: https://railway.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Repo**: https://github.com/alexmclaughlin2005/gitlab-commit-tracer
- **Frontend**: https://gitlab-commit-tracer.vercel.app
- **Backend API**: https://web-production-7418.up.railway.app/api

---

## 📊 Deployment History

| Date | Commit | Phase | Status | Notes |
|------|--------|-------|--------|-------|
| - | 8ee046d | Phase 1 | ✅ | Initial auth infrastructure |
| - | ba64df0 | Phase 1 | ✅ | Fixed API URLs for Vercel/Railway architecture |
| - | 510f402 | Phase 1 | ✅ | Enhanced CORS configuration |
| - | c0364d9 | Phase 1 | ✅ | Fixed Clerk Frontend API URL (factual-man-20) |
| - | 5212794 | Phase 1 | ✅ | Switched to new Clerk instance (calm-giraffe-10) |
| - | ab31a94 | Phase 1 | ✅ | Fixed publishable key passing via data attribute |
| - | e42d1f8 | Phase 1 | ✅ | Switched to Account Portal authentication |
| - | b5f4322 | Phase 2 | ✅ | Fixed sign-out redirect to home page |
| - | fb30e80 | Phase 2 | ✅ | Fixed UI enforcement redirect logic |
| - | 5903562 | Phase 2 | ✅ | Added /api/auth/config to public routes |

---

## 📞 Support

If issues persist:
1. Check Railway deployment logs for server errors
2. Check browser console for client-side errors
3. Verify all environment variables are set correctly in Railway
4. Ensure latest code is deployed on both Vercel and Railway
5. Test in incognito/private browsing mode to rule out cache issues
6. Check Clerk Dashboard for authentication errors/logs

---

## ✅ Ready for Phase 3?

**Current Status**: Not yet

**To enable Phase 3 (Full API Protection)**:
1. Update all frontend `fetch()` calls to use `authenticatedFetch()`
2. Test all app functionality with API auth enforcement locally
3. Set `CLERK_ENFORCE_API_AUTH=true` in Railway
4. Monitor for any API authentication issues
5. Verify all features work with full protection

**Estimated Time**: ~2-3 hours to update all API calls and test thoroughly
