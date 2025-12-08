# Clerk Authentication Setup Guide

## Phase 1: Infrastructure Setup (Non-Breaking) - READY TO TEST!

All the code has been implemented. Follow these steps to enable Clerk authentication in **non-enforcement mode** (completely safe, no impact on existing functionality).

---

## Step 1: Create Clerk Account

1. Go to https://clerk.com and sign up for a free account
2. Click "Create Application"
3. Application name: **GitLab Commit Tracer**
4. Choose authentication methods you want:
   - ✅ Email/Password (recommended)
   - ✅ Google OAuth (recommended)
   - ✅ GitHub OAuth (recommended)
   - Optional: Microsoft, etc.

---

## Step 2: Get Your API Keys

1. In Clerk Dashboard, go to **API Keys**
2. Copy your keys:
   - **Publishable Key** (starts with `pk_test_...`)
   - **Secret Key** (starts with `sk_test_...`)

---

## Step 3: Configure Allowed Domains

1. In Clerk Dashboard, go to **Paths**
2. Under "Allowed Redirect URLs", add:
   ```
   http://localhost:3005/*
   https://your-railway-app.up.railway.app/*
   ```

3. Under "Home URL", set:
   ```
   http://localhost:3005/
   ```

---

## Step 4: Update Your .env File

Add these lines to your `.env` file:

```bash
# Clerk Authentication - Phase 1 (Infrastructure Only)
CLERK_ENABLED=true
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Enforcement Flags (Keep FALSE for Phase 1)
CLERK_ENFORCE_UI_AUTH=false
CLERK_ENFORCE_API_AUTH=false

# URLs (defaults are fine)
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up
CLERK_AFTER_SIGN_IN_URL=/
CLERK_AFTER_SIGN_UP_URL=/

# Public routes (always accessible)
CLERK_PUBLIC_ROUTES=/api/status,/health
```

**Important**: Replace `pk_test_YOUR_KEY_HERE` and `sk_test_YOUR_KEY_HERE` with your actual keys from Step 2.

---

## Step 5: Restart Your Server

```bash
# If running locally with npm
npm run dev:server

# Or if using tsx directly
tsx watch src/server/index.ts
```

---

## Step 6: Test the Implementation

### Test 1: Check Authentication is Available (But Not Enforced)

1. Open http://localhost:3005 in your browser
2. **Expected**: Page loads normally (no redirect)
3. **Expected**: You should see "Sign In" and "Sign Up" buttons in the header (top right)

### Test 2: Sign Up for an Account

1. Click "Sign Up" in the header
2. **Expected**: Clerk sign-up page loads
3. Create an account with your email
4. **Expected**: After sign-up, you're redirected to the home page
5. **Expected**: Your name/avatar appears in the header instead of "Sign In/Sign Up"

### Test 3: Sign Out and Sign In

1. Click your name in the header, then "Sign Out"
2. **Expected**: Redirected to sign-in page
3. Sign in with your account
4. **Expected**: Redirected back to home page
5. **Expected**: Your user info appears in header

### Test 4: Access Without Authentication

1. Open a private/incognito browser window
2. Go to http://localhost:3005
3. **Expected**: Page works perfectly WITHOUT signing in
4. **Expected**: All features work (manual trace, monitoring, etc.)

### Test 5: API Authentication Check

```bash
# Test without auth (should work in Phase 1)
curl http://localhost:3005/api/status

# Check auth config
curl http://localhost:3005/api/auth/config
```

**Expected Response**:
```json
{
  "enabled": true,
  "enforceUI": false,
  "enforceAPI": false,
  "signInUrl": "/sign-in",
  "publishableKey": "pk_test_..."
}
```

---

## Phase 1 Verification Checklist

- [ ] Clerk account created
- [ ] API keys added to `.env`
- [ ] Server restarted successfully
- [ ] Home page loads without authentication
- [ ] "Sign In" and "Sign Up" buttons visible in header
- [ ] Can create an account successfully
- [ ] Can sign in and see user info in header
- [ ] Can sign out
- [ ] Unauthenticated users can still access all pages
- [ ] API endpoints work without authentication
- [ ] `/api/auth/config` returns `enabled: true, enforceUI: false, enforceAPI: false`

---

## What Phase 1 Provides

✅ **Authentication infrastructure fully in place**
✅ **Users can optionally sign up and sign in**
✅ **User info displayed when logged in**
✅ **Zero impact on existing functionality**
✅ **All pages and APIs work without authentication**

---

## Moving to Phase 2 (UI Protection)

When you're ready to **require authentication for the UI** (but keep API public):

### Update `.env`:
```bash
CLERK_ENFORCE_UI_AUTH=true  # Change this to true
```

### What Changes:
- Unauthenticated users redirected to sign-in page
- API endpoints still work without authentication
- Good for: Internal tools where UI should be protected

### Rollback:
```bash
CLERK_ENFORCE_UI_AUTH=false  # Change back to false
```

---

## Moving to Phase 3 (Full Protection)

When you're ready for **complete authentication** (UI + API):

### Update `.env`:
```bash
CLERK_ENFORCE_UI_AUTH=true   # Both true
CLERK_ENFORCE_API_AUTH=true
```

### What Changes:
- All pages require authentication
- All API endpoints require valid JWT token
- API returns 401 for unauthenticated requests

### Rollback:
```bash
CLERK_ENFORCE_API_AUTH=false  # Disable API enforcement
# OR
CLERK_ENABLED=false           # Disable all auth
```

---

## Troubleshooting

### Issue: "Authentication not loading"

**Solution**: Check that `CLERK_PUBLISHABLE_KEY` is set correctly in `.env` and matches the format `pk_test_...`

### Issue: "Failed to load authentication script"

**Solution**: Check your internet connection. Clerk loads from CDN. Make sure the page can access `https://accounts.clerk.dev`

### Issue: Sign-in redirects to wrong page

**Solution**: Check `CLERK_SIGN_IN_URL` and `CLERK_AFTER_SIGN_IN_URL` in your `.env` file

### Issue: API returns 401 in Phase 1

**Solution**: Make sure `CLERK_ENFORCE_API_AUTH=false` in your `.env` file. Phase 1 should NOT enforce API authentication.

### Issue: Can't see user menu in header

**Solution**:
1. Check browser console for errors
2. Verify `auth-helper.js` is loading (check Network tab in DevTools)
3. Make sure `CLERK_ENABLED=true` in `.env`

---

## Deployment to Railway

### Update Environment Variables in Railway:

1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Add the same environment variables from your `.env`:
   ```
   CLERK_ENABLED=true
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_ENFORCE_UI_AUTH=false
   CLERK_ENFORCE_API_AUTH=false
   ```

5. Railway will automatically redeploy

### Update Allowed URLs in Clerk:

1. Go to Clerk Dashboard → Paths
2. Add your Railway URL:
   ```
   https://your-app-name.up.railway.app/*
   ```

---

## Security Notes

1. **Never commit your `.env` file** - It contains secret keys
2. **Use different keys for development and production** - Create separate Clerk applications
3. **Keep `CLERK_SECRET_KEY` secure** - It can verify any token
4. **Phase 1 is safe for production** - No enforcement means no breaking changes
5. **Test each phase thoroughly** - Don't rush to Phase 3

---

## Support

- **Clerk Documentation**: https://clerk.com/docs
- **Clerk Support**: https://clerk.com/support
- **Project Issues**: Check [CLERK_AUTHENTICATION_PLAN.md](CLERK_AUTHENTICATION_PLAN.md) for detailed architecture

---

## Summary

You now have a **fully functional, feature-flagged authentication system**!

- ✅ **Phase 1 (Current)**: Infrastructure in place, optional auth, zero breaking changes
- 🔜 **Phase 2**: UI protection (one environment variable change)
- 🔜 **Phase 3**: Full protection (one environment variable change)

**Start with Phase 1, test thoroughly, then progress when ready!**
