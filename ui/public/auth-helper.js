/**
 * Shared Authentication Helper for GitLab Commit Tracer
 *
 * This script provides authentication functionality across all pages.
 * It's designed to work with Clerk authentication in a feature-flagged manner.
 */

// Configuration
const AUTH_CONFIG = {
    publishableKey: 'pk_test_ZmFjdHVhbC1tYW4tMjAuY2xlcmsuYWNjb3VudHMuZGV2JA',
    apiBase: window.location.hostname === 'localhost'
        ? 'http://localhost:3005/api'
        : 'https://web-production-7418.up.railway.app/api',
};

// Global Clerk instance
let clerkInstance = null;
let authEnabled = false;
let authConfig = null;

/**
 * Check if authentication is enabled on the server
 */
async function checkAuthEnabled() {
    try {
        const response = await fetch(`${AUTH_CONFIG.apiBase}/auth/config`);
        const config = await response.json();
        authEnabled = config.enabled;
        authConfig = config;
        return config;
    } catch (error) {
        console.warn('Could not check auth status:', error);
        authEnabled = false;
        return { enabled: false };
    }
}

/**
 * Initialize Clerk authentication
 */
async function initializeAuth() {
    const config = await checkAuthEnabled();

    if (!config.enabled) {
        console.log('Authentication is disabled');
        return null;
    }

    return new Promise((resolve, reject) => {
        // Check if Clerk script is already loaded
        if (window.Clerk) {
            initializeClerkInstance().then(resolve).catch(reject);
            return;
        }

        // Load Clerk script from your Clerk instance's Frontend API
        const script = document.createElement('script');
        script.src = 'https://factual-man-20.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-clerk-publishable-key', AUTH_CONFIG.publishableKey);

        script.onload = async () => {
            try {
                const clerk = await initializeClerkInstance();
                resolve(clerk);
            } catch (error) {
                console.error('Failed to initialize Clerk:', error);
                reject(error);
            }
        };

        script.onerror = () => {
            console.error('Failed to load Clerk script');
            reject(new Error('Failed to load authentication script'));
        };

        document.head.appendChild(script);
    });
}

/**
 * Initialize Clerk instance
 */
async function initializeClerkInstance() {
    const clerk = window.Clerk;

    // Clerk should auto-initialize with the data-clerk-publishable-key attribute
    // If not initialized, manually load with the key
    if (!clerk) {
        throw new Error('Clerk SDK failed to load');
    }

    // Wait for Clerk to be ready
    await clerk.load();

    clerkInstance = clerk;
    return clerk;
}

/**
 * Add user menu to the header
 */
function addUserMenuToHeader() {
    if (!authEnabled || !clerkInstance) {
        return;
    }

    // Find the header navigation
    const headerNav = document.querySelector('.header-nav');
    if (!headerNav) {
        console.warn('Could not find header navigation element');
        return;
    }

    // Create user menu container
    const userMenuContainer = document.createElement('div');
    userMenuContainer.id = 'authUserMenu';
    userMenuContainer.style.marginLeft = '20px';

    if (clerkInstance.user) {
        // User is signed in
        const user = clerkInstance.user;
        const userName = user.fullName || user.primaryEmailAddress?.emailAddress || 'User';
        const userInitials = getUserInitials(userName);

        userMenuContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="background: rgba(255,255,255,0.2); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white;">
                    ${userInitials}
                </div>
                <div style="color: white;">
                    <div style="font-weight: 600; font-size: 0.9em;">${escapeHtml(userName)}</div>
                    <a href="#" onclick="handleSignOut(event)" style="color: rgba(255,255,255,0.8); font-size: 0.8em; text-decoration: none;">Sign Out</a>
                </div>
            </div>
        `;
    } else {
        // User is not signed in
        userMenuContainer.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <a href="/sign-in" style="background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 500; transition: all 0.2s;">
                    Sign In
                </a>
                <a href="/sign-up" style="background: white; color: #667eea; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 500; transition: all 0.2s;">
                    Sign Up
                </a>
            </div>
        `;
    }

    // Append to header (next to existing nav)
    headerNav.appendChild(userMenuContainer);
}

/**
 * Handle sign out
 */
async function handleSignOut(event) {
    event.preventDefault();

    if (!clerkInstance) {
        return;
    }

    try {
        await clerkInstance.signOut();
        window.location.href = '/sign-in';
    } catch (error) {
        console.error('Sign out failed:', error);
        alert('Failed to sign out. Please try again.');
    }
}

/**
 * Check if UI authentication is enforced and redirect if needed
 */
function checkUIAuthEnforcement() {
    if (!authEnabled || !authConfig) {
        return;
    }

    if (!authConfig.enforceUI) {
        // UI auth not enforced yet
        return;
    }

    // Check if this is an auth page (don't redirect from auth pages)
    const currentPath = window.location.pathname;
    if (currentPath === '/sign-in' || currentPath === '/sign-in.html' ||
        currentPath === '/sign-up' || currentPath === '/sign-up.html') {
        return;
    }

    // Check if user is signed in
    if (!clerkInstance || !clerkInstance.user) {
        // Redirect to sign-in
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/sign-in?redirect_url=${returnUrl}`;
    }
}

/**
 * Get user initials from name
 */
function getUserInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get authentication token for API requests
 */
async function getAuthToken() {
    if (!clerkInstance || !clerkInstance.session) {
        return null;
    }

    try {
        const token = await clerkInstance.session.getToken();
        return token;
    } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
    }
}

/**
 * Enhanced fetch function that includes authentication token
 */
async function authenticatedFetch(url, options = {}) {
    const token = await getAuthToken();

    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        };
    }

    return fetch(url, options);
}

/**
 * Initialize authentication on page load
 */
window.addEventListener('load', async () => {
    try {
        await initializeAuth();

        // Add user menu to header if auth is enabled
        if (authEnabled) {
            addUserMenuToHeader();
            checkUIAuthEnforcement();
        }
    } catch (error) {
        console.error('Auth initialization error:', error);
        // Don't block page load if auth fails
    }
});

// Make functions globally available
window.handleSignOut = handleSignOut;
window.authenticatedFetch = authenticatedFetch;
window.getAuthToken = getAuthToken;
