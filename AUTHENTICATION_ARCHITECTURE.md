# Authentication Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User's Browser                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  index.html  │  │  teams.html  │  │  epics.html  │             │
│  │              │  │              │  │              │             │
│  │  + Clerk SDK │  │  + Clerk SDK │  │  + Clerk SDK │             │
│  │  + auth-     │  │  + auth-     │  │  + auth-     │             │
│  │    helper.js │  │    helper.js │  │    helper.js │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                      │
│         └──────────────────┴──────────────────┘                      │
│                            │                                         │
│                            ▼                                         │
│                   ┌────────────────┐                                │
│                   │  Clerk SDK     │                                │
│                   │  (Frontend)    │                                │
│                   └────────┬───────┘                                │
│                            │                                         │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    │   JWT Token     │
                    │   in Cookie     │
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Express Server (Port 3005)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  CORS Middleware                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                             ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Clerk Auth Middleware (src/middleware/auth.ts)                │ │
│  │                                                                 │ │
│  │  ┌────────────────────────────────────────────────────────┐   │ │
│  │  │  Feature Flag Check:                                    │   │ │
│  │  │  - CLERK_ENABLED = true/false                          │   │ │
│  │  │  - CLERK_ENFORCE_UI_AUTH = true/false                 │   │ │
│  │  │  - CLERK_ENFORCE_API_AUTH = true/false                │   │ │
│  │  └────────────────────────────────────────────────────────┘   │ │
│  │                             ▼                                   │ │
│  │  ┌────────────────────────────────────────────────────────┐   │ │
│  │  │  Token Verification:                                    │   │ │
│  │  │  - Extract JWT from Authorization header or cookie     │   │ │
│  │  │  - Verify with Clerk API using secret key             │   │ │
│  │  │  - Attach user info to req.auth if valid              │   │ │
│  │  └────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                             ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  API Routes                                                     │ │
│  │                                                                 │ │
│  │  /api/auth/config    - Get auth configuration                  │ │
│  │  /api/auth/user      - Get current user info                   │ │
│  │  /api/status         - Health check (always public)            │ │
│  │  /api/commits        - Commit tracing                          │ │
│  │  /api/history/*      - Historical data                         │ │
│  │  /api/monitor/*      - Monitoring endpoints                    │ │
│  │  ...                                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  Clerk API     │
                    │  (Cloud)       │
                    └────────────────┘
```

---

## Feature Flag Flow

### Phase 1: Infrastructure Only (CLERK_ENABLED=true)

```
User Request → Middleware Check
                     │
                     ├─→ Token Present?
                     │      │
                     │      ├─→ Yes: Verify & Attach to req.auth
                     │      │
                     │      └─→ No: Continue anyway (no error)
                     │
                     └─→ Continue to Route Handler
```

**Result**: Authentication available but not required

---

### Phase 2: UI Protection (CLERK_ENFORCE_UI_AUTH=true)

```
User Request → HTML Page?
                     │
                     ├─→ Yes → Token Present?
                     │           │
                     │           ├─→ Yes: Serve page
                     │           │
                     │           └─→ No: Redirect to /sign-in
                     │
                     └─→ No (API) → Continue (not enforced)
```

**Result**: Pages require auth, APIs do not

---

### Phase 3: Full Protection (CLERK_ENFORCE_API_AUTH=true)

```
User Request → Middleware Check
                     │
                     ├─→ Public Route? (/api/status, /health)
                     │      │
                     │      └─→ Yes: Allow
                     │
                     ├─→ Token Present?
                     │      │
                     │      ├─→ Yes: Verify & Continue
                     │      │
                     │      └─→ No: Return 401 Unauthorized
                     │
                     └─→ Continue to Route Handler
```

**Result**: Everything requires authentication

---

## Authentication Flow

### Sign-Up Flow

```
1. User clicks "Sign Up" in header
      ↓
2. Browser loads /sign-up.html
      ↓
3. Page loads Clerk SDK from CDN
      ↓
4. Clerk renders sign-up form
      ↓
5. User fills out form
      ↓
6. Clerk creates account (API call to Clerk)
      ↓
7. Clerk sets httpOnly cookie with JWT
      ↓
8. User redirected to CLERK_AFTER_SIGN_UP_URL (/)
      ↓
9. auth-helper.js detects user is logged in
      ↓
10. User menu appears in header
```

---

### Sign-In Flow

```
1. User clicks "Sign In" in header
      ↓
2. Browser loads /sign-in.html
      ↓
3. Page loads Clerk SDK from CDN
      ↓
4. Clerk renders sign-in form
      ↓
5. User enters credentials
      ↓
6. Clerk verifies credentials (API call to Clerk)
      ↓
7. Clerk sets httpOnly cookie with JWT
      ↓
8. User redirected to CLERK_AFTER_SIGN_IN_URL (/)
      ↓
9. auth-helper.js detects user is logged in
      ↓
10. User menu appears in header
```

---

### API Request with Authentication

```
1. User makes API request (e.g., fetch('/api/commits'))
      ↓
2. Browser includes JWT cookie automatically
      ↓
3. Express server receives request
      ↓
4. CORS middleware processes request
      ↓
5. Clerk auth middleware intercepts
      ↓
6. Middleware extracts JWT from cookie
      ↓
7. Middleware calls Clerk API to verify JWT
      ↓
8. If valid: Attach user info to req.auth
      ↓
9. If invalid & enforcement enabled: Return 401
      ↓
10. If invalid & enforcement disabled: Continue anyway
      ↓
11. Route handler processes request
      ↓
12. Response sent back to browser
```

---

## File Structure

```
src/
├── middleware/
│   └── auth.ts                    # Authentication middleware
│
├── server/
│   └── index.ts                   # Express server with auth integration
│
ui/public/
├── auth-helper.js                 # Shared auth functionality
├── sign-in.html                   # Sign-in page
├── sign-up.html                   # Sign-up page
├── index.html                     # Home page (+ auth-helper)
├── teams.html                     # Teams page (+ auth-helper)
└── epics.html                     # Epics page (+ auth-helper)

.env
├── CLERK_ENABLED                  # Master switch
├── CLERK_PUBLISHABLE_KEY          # Frontend key
├── CLERK_SECRET_KEY               # Backend key
├── CLERK_ENFORCE_UI_AUTH          # Phase 2 control
├── CLERK_ENFORCE_API_AUTH         # Phase 3 control
└── CLERK_PUBLIC_ROUTES            # Whitelist
```

---

## Data Flow

### User Info Storage

```
┌─────────────┐
│  Clerk API  │  ← User account data stored here
└──────┬──────┘    (name, email, profile, etc.)
       │
       ▼
┌─────────────────────────────────────┐
│  JWT Token (signed by Clerk)        │
│                                      │
│  {                                   │
│    userId: "user_abc123",           │
│    sessionId: "sess_xyz789",        │
│    exp: 1234567890,                 │
│    ...                               │
│  }                                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  httpOnly Cookie in Browser          │
│  __session=<encrypted_jwt_token>     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Express Server                      │
│  req.auth = {                        │
│    userId: "user_abc123",           │
│    sessionId: "sess_xyz789",        │
│    user: { ... }                     │
│  }                                   │
└──────────────────────────────────────┘
```

---

## Security Model

### Token Verification

```
Browser Request
     │
     ├─→ JWT Token in Cookie
     │
     ▼
Express Middleware
     │
     ├─→ Extract Token
     │
     ▼
Clerk SDK (Backend)
     │
     ├─→ Verify Signature with CLERK_SECRET_KEY
     │
     ├─→ Check Expiration
     │
     ├─→ Validate Issuer
     │
     └─→ Return User Info or Error
```

### Why This Is Secure

1. **JWT Signature**: Tokens signed with Clerk's private key, verified with secret key
2. **httpOnly Cookies**: JavaScript cannot access tokens (XSS protection)
3. **Short Expiration**: Tokens expire after 1 hour (configurable in Clerk)
4. **Automatic Refresh**: Clerk SDK refreshes tokens automatically
5. **HTTPS Only**: Cookies marked secure in production
6. **CORS Protection**: Express CORS middleware prevents unauthorized origins

---

## Rollback Strategy

### Instant Disable (1 second)

```
1. Set CLERK_ENABLED=false in .env or Railway
2. Server automatically uses new config (no restart needed for env vars in Railway)
3. Middleware skips all auth logic
4. App works as if auth never existed
```

### Phase Rollback (1 second)

```
Phase 3 → Phase 2: Set CLERK_ENFORCE_API_AUTH=false
Phase 2 → Phase 1: Set CLERK_ENFORCE_UI_AUTH=false
Phase 1 → Disabled: Set CLERK_ENABLED=false
```

---

## Performance Impact

### Phase 1 (Infrastructure Only)
- **With Auth**: +5-10ms per request (token verification)
- **Without Auth**: 0ms overhead (middleware skips when no token)

### Phase 2 (UI Protection)
- **HTML Pages**: +5-10ms (token check)
- **API Endpoints**: 0ms overhead

### Phase 3 (Full Protection)
- **All Endpoints**: +5-10ms per request

### Optimization
- Clerk SDK caches token verification results
- Token verification is async and non-blocking
- Public routes bypass auth completely

---

## Summary

This architecture provides:

✅ **Zero-Trust Security** - All tokens verified with Clerk
✅ **Gradual Rollout** - Feature flags control each phase
✅ **Instant Rollback** - Single environment variable
✅ **Performance** - Minimal overhead, smart caching
✅ **Scalability** - Clerk handles millions of users
✅ **Maintainability** - Clear separation of concerns

Ready to enable? See [CLERK_SETUP_GUIDE.md](CLERK_SETUP_GUIDE.md)!
