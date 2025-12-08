/**
 * Clerk Authentication Middleware
 *
 * Feature-flagged authentication middleware with 3 phases:
 * - Phase 1: CLERK_ENABLED=true (infrastructure only, no enforcement)
 * - Phase 2: CLERK_ENFORCE_UI_AUTH=true (UI protection)
 * - Phase 3: CLERK_ENFORCE_API_AUTH=true (full API protection)
 */

import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';

// Extend Express Request type to include auth info
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        user?: any;
      };
    }
  }
}

/**
 * Configuration from environment variables
 */
export const authConfig = {
  enabled: process.env.CLERK_ENABLED === 'true',
  enforceUI: process.env.CLERK_ENFORCE_UI_AUTH === 'true',
  enforceAPI: process.env.CLERK_ENFORCE_API_AUTH === 'true',
  secretKey: process.env.CLERK_SECRET_KEY,
  publicRoutes: (process.env.CLERK_PUBLIC_ROUTES || '').split(',').filter(Boolean),
  signInUrl: process.env.CLERK_SIGN_IN_URL || '/sign-in',
};

/**
 * Check if a route is public (doesn't require auth even when enforced)
 */
function isPublicRoute(path: string): boolean {
  return authConfig.publicRoutes.some(route => {
    // Exact match or prefix match
    return path === route || path.startsWith(route + '/');
  });
}

/**
 * Extract JWT token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Also check for token in cookies (for browser requests)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('__session='));
    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }
  }

  return null;
}

/**
 * Verify JWT token with Clerk
 */
async function verifyToken(token: string): Promise<any> {
  try {
    const client = clerkClient;
    // Verify the session token
    const session = await client.sessions.verifySession(token, token);
    return session;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Main authentication middleware
 * Behavior depends on feature flags:
 * - CLERK_ENABLED=false: Skip all auth logic
 * - CLERK_ENABLED=true, no enforcement: Verify token if present, but allow requests without it
 * - CLERK_ENFORCE_API_AUTH=true: Require valid token for API routes
 */
export async function clerkAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip if Clerk is disabled
  if (!authConfig.enabled) {
    return next();
  }

  // Skip if this is a public route
  if (isPublicRoute(req.path)) {
    return next();
  }

  // Extract token from request
  const token = extractToken(req);

  // If no token present
  if (!token) {
    // Phase 1 & 2: Allow requests without tokens (no API enforcement)
    if (!authConfig.enforceAPI) {
      return next();
    }

    // Phase 3: Enforce API authentication
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please provide a valid token.',
      signInUrl: authConfig.signInUrl,
    });
    return;
  }

  // Verify the token
  try {
    const session = await verifyToken(token);

    if (!session) {
      // Invalid token
      if (!authConfig.enforceAPI) {
        // Phase 1 & 2: Log warning but allow request
        console.warn('Invalid auth token provided, but enforcement disabled. Allowing request.');
        return next();
      }

      // Phase 3: Reject invalid tokens
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token.',
        signInUrl: authConfig.signInUrl,
      });
      return;
    }

    // Valid token - attach user info to request
    req.auth = {
      userId: session.userId,
      sessionId: session.id,
      user: session,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    if (!authConfig.enforceAPI) {
      // Phase 1 & 2: Log error but allow request
      console.warn('Auth verification error, but enforcement disabled. Allowing request.');
      return next();
    }

    // Phase 3: Return error
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication verification failed.',
    });
  }
}

/**
 * Middleware specifically for protecting HTML pages (UI routes)
 * Redirects to sign-in page if not authenticated
 */
export function requireUIAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip if Clerk is disabled
  if (!authConfig.enabled) {
    return next();
  }

  // Skip if UI enforcement is disabled (Phase 1)
  if (!authConfig.enforceUI) {
    return next();
  }

  // Skip if this is a public route or auth page
  const isAuthPage = req.path === authConfig.signInUrl ||
                      req.path === (process.env.CLERK_SIGN_UP_URL || '/sign-up');

  if (isPublicRoute(req.path) || isAuthPage) {
    return next();
  }

  // Check if user has valid session cookie
  const token = extractToken(req);

  if (!token) {
    // Redirect to sign-in page
    const returnUrl = encodeURIComponent(req.originalUrl);
    res.redirect(`${authConfig.signInUrl}?redirect_url=${returnUrl}`);
    return;
  }

  // Let them through (token will be verified by API middleware if needed)
  next();
}

/**
 * Optional: Middleware to require authentication (always enforces, regardless of flags)
 * Use this for specific routes that should ALWAYS require auth
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!authConfig.enabled) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Authentication is not configured.',
    });
    return;
  }

  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required.',
      signInUrl: authConfig.signInUrl,
    });
    return;
  }

  try {
    const session = await verifyToken(token);

    if (!session) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token.',
        signInUrl: authConfig.signInUrl,
      });
      return;
    }

    req.auth = {
      userId: session.userId,
      sessionId: session.id,
      user: session,
    };

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication verification failed.',
    });
  }
}

/**
 * Utility: Get current user info from request
 */
export function getCurrentUser(req: Request): any | null {
  return req.auth?.user || null;
}

/**
 * Utility: Check if request is authenticated
 */
export function isAuthenticated(req: Request): boolean {
  return !!req.auth?.userId;
}
