import {
  handleAnalyticsEventPost, handleAnalyticsAggregateGet,
  handleAnalyticsRealtimeGet, handleAnalyticsRawGet, handleAnalyticsResetPost
} from './analytics-handler.js';

// ============================================================================
// ADMIN SECURITY — HMAC-signed tokens, two-step verification, audit logging
// ============================================================================

// Admin credentials (server-side only — never exposed to client)
const ADMIN_EMAIL = 'admin@tamilaistream.com';
const ADMIN_PASSWORD_HASH = 'admin@123'; // In production, use bcrypt/argon2 hash

// HMAC secret for signing admin tokens (set via env.ADMIN_HMAC_SECRET in wrangler.toml)
// Fallback is used only for development — MUST be overridden in production
const DEFAULT_HMAC_SECRET = 'tamil-ai-stream-admin-hmac-secret-2024';

// Admin session timeout: 8 hours (shorter than regular sessions)
const ADMIN_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;

// Verification code TTL: 5 minutes
const VERIFY_CODE_TTL_MS = 5 * 60 * 1000;

// Max failed login attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * HMAC-SHA256 sign a payload using Web Crypto API
 */
async function hmacSign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify an HMAC-SHA256 signature
 */
async function hmacVerify(data, signature, secret) {
  const expected = await hmacSign(data, secret);
  return timingSafeEqual(signature, expected);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Create a signed admin session token
 */
async function createAdminToken(email, env) {
  const secret = (env && env.ADMIN_HMAC_SECRET) || DEFAULT_HMAC_SECRET;
  const payload = {
    email: email,
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + ADMIN_SESSION_TIMEOUT_MS,
    jti: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)
  };
  const payloadStr = JSON.stringify(payload);
  const signature = await hmacSign(payloadStr, secret);
  return btoa(payloadStr) + '.' + signature;
}

/**
 * Validate a signed admin session token
 */
async function validateAdminToken(token, env) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payloadStr = atob(parts[0]);
    const signature = parts[1];
    const secret = (env && env.ADMIN_HMAC_SECRET) || DEFAULT_HMAC_SECRET;
    const valid = await hmacVerify(payloadStr, signature, secret);
    if (!valid) return null;
    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null;
    if (payload.role !== 'admin') return null;
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Generate a 6-digit verification code
 */
function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Audit log — store in R2 under admin-audit/ prefix
 */
async function auditLog(env, action, details, ip) {
  try {
    if (!env.MEDIA_BUCKET) return;
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      ip: ip || 'unknown',
      ...details
    };
    const key = `admin-audit/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await env.MEDIA_BUCKET.put(key, JSON.stringify(entry, null, 2), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });
  } catch (e) { /* audit log is best-effort */ }
}

/**
 * Check rate limiting for failed admin attempts
 */
async function checkRateLimit(env, identifier) {
  try {
    if (!env.MEDIA_BUCKET) return { blocked: false };
    const obj = await env.MEDIA_BUCKET.get(`admin-rate-limit/${identifier}.json`);
    if (!obj) return { blocked: false };
    const data = JSON.parse(await obj.text());
    if (data.attempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutEnd = data.lastAttempt + LOCKOUT_DURATION_MS;
      if (Date.now() < lockoutEnd) {
        return { blocked: true, retryAfter: Math.ceil((lockoutEnd - Date.now()) / 1000) };
      }
      // Lockout expired, reset
      await env.MEDIA_BUCKET.delete(`admin-rate-limit/${identifier}.json`);
      return { blocked: false };
    }
    return { blocked: false, attempts: data.attempts };
  } catch (e) {
    return { blocked: false };
  }
}

/**
 * Record a failed attempt
 */
async function recordFailedAttempt(env, identifier) {
  try {
    if (!env.MEDIA_BUCKET) return;
    const obj = await env.MEDIA_BUCKET.get(`admin-rate-limit/${identifier}.json`);
    let data = { attempts: 0, lastAttempt: 0 };
    if (obj) data = JSON.parse(await obj.text());
    data.attempts = (data.attempts || 0) + 1;
    data.lastAttempt = Date.now();
    await env.MEDIA_BUCKET.put(`admin-rate-limit/${identifier}.json`, JSON.stringify(data), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });
  } catch (e) { /* best-effort */ }
}

/**
 * Clear failed attempts on success
 */
async function clearFailedAttempts(env, identifier) {
  try {
    if (!env.MEDIA_BUCKET) return;
    await env.MEDIA_BUCKET.delete(`admin-rate-limit/${identifier}.json`);
  } catch (e) { /* best-effort */ }
}

/**
 * Validate login credentials against the server-side admin account.
 * Used by the regular login page (login.js) so that credentials work
 * on any device, not just the one where the account was first registered.
 */
async function handleAuthValidate(request, env) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

    if (!email || !password) {
      return json({ error: 'Email and password required' }, 400);
    }

    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD_HASH) {
      await auditLog(env, 'auth_validate_success', { email }, ip);
      return json({
        success: true,
        user: {
          name: 'Admin',
          email: ADMIN_EMAIL,
          uid: 'admin-verified',
          photoURL: '',
          role: 'admin'
        }
      });
    }

    await auditLog(env, 'auth_validate_failed', { email, reason: 'invalid_credentials' }, ip);
    return json({ error: 'Invalid email or password' }, 401);
  } catch (e) {
    return json({ error: 'Validation failed: ' + e.message }, 500);
  }
}

// ─── User Data Sync (server-side storage via R2) ───

/**
 * Extract user ID from the request. Accepts:
 *  - X-User-Id header (set by client after login)
 *  - Authorization: Bearer <token> (admin token)
 * Returns null if not authenticated.
 */
/**
 * Validate and extract user ID from request header.
 * Returns null if not authenticated or if the ID is invalid.
 * SECURITY: Validates format to prevent injection and abuse.
 */
function extractUserId(request) {
  const userId = request.headers.get('x-user-id');
  if (!userId || typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  // Must be a valid email or a reasonable UID string
  // Allow: emails, Firebase UIDs (alphanumeric + dashes + underscores)
  if (!/^[a-zA-Z0-9._@\-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Save user data to R2. Body: { data: { history, favorites, likedSongs, playlists, preferences, ... } }
 * Key: user-data/{userId}.json
 */
async function handleUserDataSave(request, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'Storage not configured' }, 500);
    const userId = extractUserId(request);
    if (!userId) return json({ error: 'Authentication required' }, 401);

    const body = await request.json();
    if (!body || typeof body.data !== 'object') return json({ error: 'Invalid payload' }, 400);

    const key = `user-data/${userId}.json`;
    // Merge with existing data to allow partial updates
    let existing = {};
    try {
      const obj = await env.MEDIA_BUCKET.get(key);
      if (obj) existing = JSON.parse(await obj.text());
    } catch (e) { /* fresh user */ }

    const merged = { ...existing, ...body.data, _updatedAt: Date.now(), _userId: userId };
    await env.MEDIA_BUCKET.put(key, JSON.stringify(merged), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });

    return json({ success: true, userId, updatedAt: merged._updatedAt });
  } catch (e) {
    return json({ error: 'Save failed: ' + e.message }, 500);
  }
}

/**
 * Load user data from R2. Returns all stored personal data for the user.
 */
async function handleUserDataLoad(request, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'Storage not configured' }, 500);
    const userId = extractUserId(request);
    if (!userId) return json({ error: 'Authentication required' }, 401);

    const key = `user-data/${userId}.json`;
    const obj = await env.MEDIA_BUCKET.get(key);
    if (!obj) return json({ success: true, data: {}, isNew: true });

    const data = JSON.parse(await obj.text());
    return json({ success: true, data, isNew: false });
  } catch (e) {
    return json({ error: 'Load failed: ' + e.message }, 500);
  }
}

/**
 * Verify admin credentials (step 1 of 2FA)
 * Returns a verification code on success
 */
async function handleAdminVerifyCredentials(request, env) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

    // Rate limit check
    const rateLimit = await checkRateLimit(env, email || ip);
    if (rateLimit.blocked) {
      await auditLog(env, 'admin_login_blocked', { email, reason: 'rate_limited' }, ip);
      return json({ error: 'Too many failed attempts. Try again later.', retryAfter: rateLimit.retryAfter }, 429);
    }

    // Validate credentials
    if (!email || !password) {
      await auditLog(env, 'admin_login_failed', { email, reason: 'missing_fields' }, ip);
      return json({ error: 'Email and password required' }, 400);
    }

    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD_HASH) {
      await recordFailedAttempt(env, email || ip);
      await auditLog(env, 'admin_login_failed', { email, reason: 'invalid_credentials' }, ip);
      return json({ error: 'Invalid email or password' }, 401);
    }

    // Generate verification code
    const code = generateVerifyCode();
    const codeData = {
      code,
      email: email.toLowerCase(),
      createdAt: Date.now(),
      expiresAt: Date.now() + VERIFY_CODE_TTL_MS,
      verified: false
    };

    // Store verification code in R2
    const codeKey = `admin-verify-codes/${email.toLowerCase()}.json`;
    await env.MEDIA_BUCKET.put(codeKey, JSON.stringify(codeData), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });

    await auditLog(env, 'admin_verify_code_sent', { email }, ip);

    // Return the code (in production, this would be sent via email/SMS)
    // For demo purposes, we return it in the response so it can be displayed
    return json({
      success: true,
      message: 'Verification code sent',
      code: code, // In production: remove this and send via email/SMS
      expiresIn: Math.floor(VERIFY_CODE_TTL_MS / 1000)
    });

  } catch (e) {
    return json({ error: 'Verification failed: ' + e.message }, 500);
  }
}

/**
 * Verify the 6-digit code (step 2 of 2FA) and issue admin token
 */
async function handleAdminVerifyCode(request, env) {
  try {
    const body = await request.json();
    const { email, code } = body;
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

    if (!email || !code) {
      return json({ error: 'Email and verification code required' }, 400);
    }

    // Retrieve stored verification code
    const codeKey = `admin-verify-codes/${email.toLowerCase()}.json`;
    if (!env.MEDIA_BUCKET) return json({ error: 'Server configuration error' }, 500);

    const obj = await env.MEDIA_BUCKET.get(codeKey);
    if (!obj) {
      await auditLog(env, 'admin_verify_failed', { email, reason: 'no_code_found' }, ip);
      return json({ error: 'No verification code found. Please request a new one.' }, 400);
    }

    const codeData = JSON.parse(await obj.text());

    // Check expiry
    if (codeData.expiresAt < Date.now()) {
      await env.MEDIA_BUCKET.delete(codeKey);
      await auditLog(env, 'admin_verify_failed', { email, reason: 'code_expired' }, ip);
      return json({ error: 'Verification code expired. Please request a new one.' }, 400);
    }

    // Check if already used
    if (codeData.verified) {
      await env.MEDIA_BUCKET.delete(codeKey);
      await auditLog(env, 'admin_verify_failed', { email, reason: 'code_already_used' }, ip);
      return json({ error: 'Code already used. Please request a new one.' }, 400);
    }

    // Verify code (timing-safe comparison)
    if (!timingSafeEqual(code, codeData.code)) {
      await auditLog(env, 'admin_verify_failed', { email, reason: 'invalid_code' }, ip);
      return json({ error: 'Invalid verification code' }, 401);
    }

    // Mark as verified and delete
    await env.MEDIA_BUCKET.delete(codeKey);

    // Clear rate limit on success
    await clearFailedAttempts(env, email);

    // Issue signed admin token
    const token = await createAdminToken(email, env);

    await auditLog(env, 'admin_login_success', { email }, ip);

    return json({
      success: true,
      token,
      email: email.toLowerCase(),
      expiresIn: Math.floor(ADMIN_SESSION_TIMEOUT_MS / 1000)
    });

  } catch (e) {
    return json({ error: 'Verification failed: ' + e.message }, 500);
  }
}

/**
 * Validate admin token on protected API endpoints
 */
async function requireAdminAuth(request, env) {
  // Check for admin token in Authorization header or cookie
  let token = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token) {
    // Check cookie
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(/admin_session_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return { authorized: false, error: 'Admin authentication required' };
  }

  const payload = await validateAdminToken(token, env);
  if (!payload) {
    return { authorized: false, error: 'Invalid or expired admin session' };
  }

  return { authorized: true, admin: payload };
}

const REDIRECTS = {
  '/': '/index.html',
  '/login': '/login.html',
  '/builder': '/builder.html',
  '/admin': '/admin.html',
  '/playlist': '/playlist.html',
  '/profile': '/profile.html',
  '/dashboard': '/dashboard.html',
  '/particles': '/particles.html',
  '/Nexvora': '/nexvora.html',
};

let DEPLOY_TIME;
try {
  const mod = await import('./build-version.js');
  DEPLOY_TIME = mod.BUILD_VERSION || Date.now().toString();
} catch {
  DEPLOY_TIME = Date.now().toString();
}

function getCacheHeaders(pathname) {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'CDN-Cache-Control': 'no-store',
    'Surrogate-Control': 'no-cache',
  };
}

async function addCacheBusterAndBranding(body, contentType, pathname, env) {
  if (contentType && contentType.includes('text/html') && typeof body === 'string') {
    const versionTag = `<!-- bv:${DEPLOY_TIME} -->`;
    const metaTag = `<meta name="app-build-version" content="${DEPLOY_TIME}"><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">`;
    let result = body.replace('</head>', `${versionTag}\n${metaTag}\n</head>`);

    // Centralized brand logo: when the Builder has configured a logo/favicon
    // in siteSettings, rewrite the PWA favicon + apple-touch-icon link tags so
    // the installed app always follows the published brand (Task 4).
    if (env && env.MEDIA_BUCKET) {
      try {
        const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
        if (obj) {
          const manifest = JSON.parse(await obj.text());
          const site = manifest.data && manifest.data.siteSettings;
          const logo = site && (site.logo || site.favicon);
          if (logo) {
            result = result.replace(/<link[^>]*rel="apple-touch-icon"[^>]*>/gi, (match) => {
              return match.replace(/href="[^"]*"/, `href="${logo}"`);
            });
            result = result.replace(/<link[^>]*rel="icon"[^>]*>/gi, (match) => {
              return match.replace(/href="[^"]*"/, `href="${logo}"`);
            });
          }
          if (site && site.title) {
            result = result.replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"/, `<meta name="apple-mobile-web-app-title" content="${site.title}"`);
          }
        }
      } catch (_) { /* branding patch is best-effort */ }
    }

    result = result.replace(/(src|href)="([^"]*?\.(?:js|css|jpg|jpeg|png|webp|gif|svg|ico|woff|woff2|ttf|eot))"/g, (match, attr, path) => {
      if (path.startsWith('http') || path.startsWith('data:')) return match;
      const sep = path.includes('?') ? '&' : '?';
      return `${attr}="${path}${sep}v=${DEPLOY_TIME}"`;
    });
    result = result.replace(/url\(["']?([^"')]+\.(?:css|jpg|jpeg|png|webp|gif|svg|ico|woff|woff2|ttf|eot))["']?\)/g, (match, path) => {
      if (path.startsWith('http') || path.startsWith('data:')) return match;
      const sep = path.includes('?') ? '&' : '?';
      return `url("${path}${sep}v=${DEPLOY_TIME}")`;
    });
    return result;
  }
  return body;
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/version' && request.method === 'GET') {
        return handleVersionGet(env);
      }
      if (url.pathname === '/sw.js') {
        return handleSW(env);
      }
      if (url.pathname === '/manifest.webmanifest') {
        return handleManifestWebmanifest(env);
      }

      // ─── Admin Authentication Endpoints (public) ───
      if (url.pathname === '/api/admin/verify-credentials' && request.method === 'POST') {
        return handleAdminVerifyCredentials(request, env);
      }
      if (url.pathname === '/api/admin/verify-code' && request.method === 'POST') {
        return handleAdminVerifyCode(request, env);
      }

      // ─── Cross-device login validation (same credentials as admin) ───
      if (url.pathname === '/api/auth/validate' && request.method === 'POST') {
        return handleAuthValidate(request, env);
      }

      // ─── User Data Sync Endpoints (require user token) ───
      if (url.pathname === '/api/user/data' && request.method === 'POST') {
        return handleUserDataSave(request, env);
      }
      if (url.pathname === '/api/user/data' && request.method === 'GET') {
        return handleUserDataLoad(request, env);
      }

      // ─── Protected Admin Endpoints (require valid admin token) ───
      const isAdminWrite = (
        (url.pathname === '/api/upload' && request.method === 'POST') ||
        (url.pathname === '/api/manifest' && request.method === 'POST') ||
        (url.pathname === '/api/admin-overrides' && request.method === 'POST') ||
        (url.pathname === '/api/global-settings' && request.method === 'POST') ||
        (url.pathname === '/api/versions' && request.method === 'POST') ||
        (url.pathname.match(/^\/api\/versions\/[^/]+\/revert$/) && request.method === 'POST') ||
        (url.pathname.match(/^\/api\/versions\/[^/]+$/) && request.method === 'DELETE') ||
        (url.pathname === '/api/analytics/reset' && request.method === 'POST')
      );

      if (isAdminWrite) {
        const auth = await requireAdminAuth(request, env);
        if (!auth.authorized) {
          await auditLog(env, 'admin_api_denied', { path: url.pathname, method: request.method, reason: auth.error }, request.headers.get('cf-connecting-ip'));
          return json({ error: auth.error }, 401);
        }
        // Attach admin info to request for downstream handlers
        request.adminInfo = auth.admin;
      }

      if (url.pathname === '/api/upload' && request.method === 'POST') {
        return handleUpload(request, env, url);
      }
      if (url.pathname === '/api/manifest' && request.method === 'GET') {
        return handleManifestGet(env);
      }
      if (url.pathname === '/api/manifest' && request.method === 'POST') {
        return handleManifestPost(request, env);
      }

      // --- Deploy verification ---
      if (url.pathname === '/api/deploy-verify' && request.method === 'GET') {
        return handleDeployVerifyGet(env);
      }

      // --- Legacy staging/publish endpoints (backward-compatible stubs) ---
      if (url.pathname === '/api/staging' && request.method === 'GET') {
        return handleStagingGet();
      }
      if (url.pathname === '/api/staging' && request.method === 'POST') {
        return handleStagingPost();
      }
      if (url.pathname === '/api/staging' && request.method === 'DELETE') {
        return handleStagingDelete();
      }
      if (url.pathname === '/api/publish' && request.method === 'POST') {
        return handlePublishPost();
      }
      if (url.pathname === '/api/publish' && request.method === 'GET') {
        return handlePublishStatus();
      }
      if (url.pathname === '/api/staging/diff' && request.method === 'GET') {
        return handleStagingDiff();
      }

      // --- Version snapshots ---
      if (url.pathname === '/api/versions' && request.method === 'GET') {
        return handleVersionsGet(env);
      }
      if (url.pathname === '/api/versions' && request.method === 'POST') {
        return handleVersionsPost(request, env);
      }
      // /api/versions/:id/revert
      const revertMatch = url.pathname.match(/^\/api\/versions\/([^/]+)\/revert$/);
      if (revertMatch && request.method === 'POST') {
        return handleVersionSnapshotRevert(revertMatch[1], env);
      }
      // /api/versions/:id
      const versionMatch = url.pathname.match(/^\/api\/versions\/([^/]+)$/);
      if (versionMatch && request.method === 'GET') {
        return handleVersionSnapshotGet(versionMatch[1], env);
      }
      if (versionMatch && request.method === 'DELETE') {
        return handleVersionSnapshotDelete(versionMatch[1], env);
      }
      // --- Admin overrides (CSS editor) ---
      if (url.pathname === '/api/admin-overrides' && request.method === 'GET') {
        return handleAdminOverridesGet(env);
      }
      if (url.pathname === '/api/admin-overrides' && request.method === 'POST') {
        return handleAdminOverridesPost(request, env);
      }

      // --- Global settings (site-wide CSS variables) ---
      if (url.pathname === '/api/global-settings' && request.method === 'GET') {
        return handleGlobalSettingsGet(env);
      }
      if (url.pathname === '/api/global-settings' && request.method === 'POST') {
        return handleGlobalSettingsPost(request, env);
      }

      if (url.pathname === '/api/media/list' && request.method === 'GET') {
        return handleMediaList(url, env);
      }
      if (url.pathname.startsWith('/api/media/')) {
        return handleMediaGet(url, request, env);
      }

      // Analytics API endpoints
      if (url.pathname === '/api/analytics/event' && request.method === 'POST') {
        return handleAnalyticsEventPost(request, env);
      }
      if (url.pathname === '/api/analytics/aggregate' && request.method === 'GET') {
        return handleAnalyticsAggregateGet(env);
      }
      if (url.pathname === '/api/analytics/realtime' && request.method === 'GET') {
        return handleAnalyticsRealtimeGet(env);
      }
      if (url.pathname === '/api/analytics/raw' && request.method === 'GET') {
        return handleAnalyticsRawGet(env, request.url);
      }
      if (url.pathname === '/api/analytics/reset' && request.method === 'POST') {
        return handleAnalyticsResetPost(env);
      }

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if (REDIRECTS[url.pathname]) {
        const newPath = REDIRECTS[url.pathname];
        const newUrl = new URL(url.origin + newPath);
        const assetReq = new Request(newUrl.toString(), request);
        const resp = await env.ASSETS.fetch(assetReq);
        if (resp.ok) return wrapResponse(resp, newPath, env);
      }

      // ─── Server-side admin page protection ───
      // Admin/builder pages require a valid admin session token in cookie
      const adminPages = ['/admin.html', '/builder.html', '/admin-upload.html'];
      if (adminPages.includes(url.pathname)) {
        const auth = await requireAdminAuth(request, env);
        if (!auth.authorized) {
          // Redirect unauthorized users to login page
          const loginUrl = new URL(url.origin + '/admin-login.html');
          return Response.redirect(loginUrl.toString(), 302);
        }
      }

      const resp = await env.ASSETS.fetch(request);
      if (resp.status === 404 && !url.pathname.includes('.')) {
        const withHtml = new URL(url.origin + url.pathname + '.html');
        const retry = await env.ASSETS.fetch(new Request(withHtml.toString(), request));
        if (retry.ok) return wrapResponse(retry, url.pathname + '.html', env);
      }
      return wrapResponse(resp, url.pathname, env);

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
  },

  // AI News Bot: runs on a cron trigger and automatically moves expired news
  // items in the Builder manifest into the Trash. This keeps the live news
  // section fresh without manual cleanup.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runNewsAutoCleanup(env));
  },
};

// Move expired published news items into the Trash inside the Builder manifest.
async function runNewsAutoCleanup(env) {
  try {
    if (!env.MEDIA_BUCKET) return;
    const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
    if (!obj) return;
    const manifest = JSON.parse(await obj.text());
    const data = manifest.data || {};
    if (!Array.isArray(data.news)) return;

    const site = data.siteSettings || {};
    const ns = site.newsSettings || {};
    const autoDelete = ns.autoDelete !== false;
    if (!autoDelete) return;
    const retentionHours = parseInt(ns.retentionHours, 10);
    const cutoff = Date.now() - (retentionHours > 0 ? retentionHours : 0.5) * 3600 * 1000;

    let moved = 0;
    const news = data.news.map((n) => {
      if (n.status !== 'trashed' && n.published && n.publishedAt) {
        const t = new Date(n.publishedAt).getTime();
        if (!isNaN(t) && t < cutoff) {
          moved++;
          return { ...n, status: 'trashed', expired: true, trashedAt: new Date().toISOString() };
        }
      }
      return n;
    });

    if (moved > 0) {
      data.news = news;
      manifest.data = data;
      manifest.updatedAt = new Date().toISOString();
      await env.MEDIA_BUCKET.put('content-manifest.json', JSON.stringify(manifest, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      });
    }
  } catch (_) { /* best-effort */ }
}

function wrapResponse(resp, pathname, env) {
  const headers = new Headers(resp.headers);
  const cacheHeaders = getCacheHeaders(pathname);
  Object.entries(cacheHeaders).forEach(([k, v]) => headers.set(k, v));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Vary', 'Accept-Encoding');
  if (pathname.endsWith('.webmanifest')) {
    headers.set('Content-Type', 'application/manifest+json');
  }
  const contentType = headers.get('Content-Type') || '';
  if (pathname.endsWith('.html') || pathname === '/') {
    return resp.text().then(async body => {
      const patched = await addCacheBusterAndBranding(body, contentType, pathname, env);
      headers.delete('Content-Length');
      return new Response(patched, { status: resp.status, headers });
    });
  }
  return new Response(resp.body, { status: resp.status, headers });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'CDN-Cache-Control': 'no-store',
      'Surrogate-Control': 'no-cache',
      ...corsHeaders(),
    },
  });
}

async function handleUpload(request, env, url) {
  try {
    if (!env.MEDIA_BUCKET) {
      return json({ error: 'R2 bucket not configured. Check your Worker binding.' }, 500);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return json({ error: 'Expected multipart/form-data' }, 400);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'general';

    if (!file || file.size === 0) {
      return json({ error: 'No file provided' }, 400);
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${timestamp}-${sanitizedName}`;
    const mime = file.type || 'application/octet-stream';

    await env.MEDIA_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: mime, cacheControl: 'no-cache, no-store, must-revalidate' },
    });

    const publicUrl = `${url.origin}/api/media/${key}`;

    return json({
      success: true,
      url: publicUrl,
      key,
      format: file.name.split('.').pop(),
      bytes: file.size,
      contentType: mime,
    });
  } catch (e) {
    return json({ error: 'Upload failed: ' + e.message }, 500);
  }
}

async function handleManifestGet(env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
    if (!obj) return json({ version: 1, data: {}, updatedAt: new Date().toISOString() });

    // Seed default Tamil FM stations if manifest has none.
    // This ensures the live site always has radio stations without requiring
    // the Builder to explicitly save them first.
    let manifest = JSON.parse(await obj.text());
    const stations = manifest?.data?.stations;
    if (Array.isArray(stations) && stations.length === 0) {
      manifest.data.stations = [
        { id: 'st_radio_mirchi', name: 'Radio Mirchi Tamil', freq: '98.3', streamUrl: 'https://listen.openstream.co/4543/audio', genre: 'Music', city: 'Chennai', status: 'active', thumbnail: '' },
        { id: 'st_suryan_fm', name: 'Suryan FM', freq: '93.5', streamUrl: 'https://listen.openstream.co/6714/audio', genre: 'Music', city: 'Chennai', status: 'active', thumbnail: '' },
        { id: 'st_hello_fm', name: 'Hello FM', freq: '106.4', streamUrl: 'https://listen.openstream.co/4428/audio', genre: 'Music', city: 'Chennai', status: 'active', thumbnail: '' },
        { id: 'st_big_fm', name: 'Big FM Tamil', freq: '92.7', streamUrl: 'https://listen.openstream.co/4434/audio', genre: 'Music', city: 'Chennai', status: 'active', thumbnail: '' },
        { id: 'st_radio_city', name: 'Radio City Tamil', freq: '91.1', streamUrl: 'https://listen.openstream.co/4426/audio', genre: 'Music', city: 'Chennai', status: 'active', thumbnail: '' },
        { id: 'st_fm_rainbow', name: 'FM Rainbow Chennai', freq: '101.4', streamUrl: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio022/playlist.m3u8', genre: 'Music', city: 'Chennai', status: 'active', thumbnail: '' },
        { id: 'st_ilayaraja', name: 'Ilayaraja Radio', freq: 'Online', streamUrl: 'https://server.geetradio.com:8100/radio.mp3', genre: 'Music', city: 'India', status: 'active', thumbnail: '' },
        { id: 'st_ar_rahman', name: 'AR Rahman Radio', freq: 'Online', streamUrl: 'https://stream.zeno.fm/ihpr0rqzoxquv', genre: 'Music', city: 'India', status: 'active', thumbnail: '' },
        { id: 'st_radio_tamizha', name: 'Radio Tamizha', freq: 'Online', streamUrl: 'https://c22.radioboss.fm:8832/stream', genre: 'Music', city: 'India', status: 'active', thumbnail: '' },
        { id: 'st_tamil_ai_fm', name: 'Tamil AI FM', freq: 'Online', streamUrl: 'https://servidor23-4.brlogic.com:7072/live?source=website', genre: 'Music', city: 'Malaysia', status: 'active', thumbnail: '' }
      ];
    }

    return new Response(JSON.stringify(manifest), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0', 'CDN-Cache-Control': 'no-store', 'Surrogate-Control': 'no-cache' },
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleManifestPost(request, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const payload = await request.json();
    await env.MEDIA_BUCKET.put('content-manifest.json', JSON.stringify(payload, null, 2), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });
    return json({ success: true, updatedAt: payload?.updatedAt });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// --- Deploy verification endpoint ---
// Returns the current build version + content version so the Builder
// can confirm a deployment succeeded.

async function handleDeployVerifyGet(env) {
  let contentVersion = null;
  let songCount = 0;
  let stationCount = 0;
  try {
    if (env.MEDIA_BUCKET) {
      const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
      if (obj) {
        const manifest = JSON.parse(await obj.text());
        contentVersion = manifest.updatedAt || null;
        songCount = Array.isArray(manifest.data?.songs) ? manifest.data.songs.length : 0;
        stationCount = Array.isArray(manifest.data?.stations) ? manifest.data.stations.length : 0;
      }
    }
  } catch (_) { /* ignore */ }

  return new Response(JSON.stringify({
    ok: true,
    appVersion: DEPLOY_TIME,
    contentVersion,
    songCount,
    stationCount,
    verifiedAt: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Surrogate-Control': 'no-cache',
      ...corsHeaders(),
    },
  });
}

// Legacy staging/publish endpoints — backward-compatible stubs.
// All saves go directly to production via POST /api/manifest.

function handlePublishPost() {
  return json({ success: true, message: 'Direct deploy only — use POST /api/manifest.' });
}

function handlePublishStatus() {
  return json({ hasPublished: true, publishedAt: new Date().toISOString(), hasStaging: false, stagingSavedAt: null });
}

function handleStagingDiff() {
  return json({ hasChanges: false, changeCount: 0, changes: [], publishedAt: null, stagingSavedAt: null });
}

function handleStagingGet() {
  return json({ hasStaging: false, staging: null });
}

function handleStagingPost() {
  return json({ success: true, message: 'Direct deploy only — use POST /api/manifest instead.' });
}

function handleStagingDelete() {
  return json({ success: true });
}

// --- Version Snapshots ---

async function handleVersionsGet(env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    // List all version snapshots under the versions/ prefix
    const listed = await env.MEDIA_BUCKET.list({ prefix: 'versions/', limit: 100 });
    const versions = [];
    for (const obj of (listed.objects || [])) {
      try {
        const data = JSON.parse(await (await env.MEDIA_BUCKET.get(obj.key)).text());
        versions.push({
          id: obj.key.replace('versions/', '').replace('.json', ''),
          label: data.label || obj.key,
          savedBy: data.savedBy || 'Admin',
          savedAt: data.savedAt || obj.uploaded,
          sectionCount: data.data ? Object.keys(data.data).length : 0,
        });
      } catch (_) { /* skip corrupt entries */ }
    }
    // Sort newest first
    versions.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    return json({ versions });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleVersionsPost(request, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const body = await request.json();
    const id = 'snap-' + Date.now();
    const snapshot = {
      label: body.label || 'Snapshot',
      savedBy: body.savedBy || 'Admin',
      savedAt: new Date().toISOString(),
      data: body.data || {},
      globalSettings: body.globalSettings || {},
    };
    await env.MEDIA_BUCKET.put('versions/' + id + '.json', JSON.stringify(snapshot, null, 2), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });
    // Keep only last 30 versions
    const listed = await env.MEDIA_BUCKET.list({ prefix: 'versions/', limit: 100 });
    if (listed.objects && listed.objects.length > 30) {
      const sorted = listed.objects.sort((a, b) => new Date(a.uploaded) - new Date(b.uploaded));
      for (let i = 0; i < sorted.length - 30; i++) {
        await env.MEDIA_BUCKET.delete(sorted[i].key);
      }
    }
    return json({ success: true, id, savedAt: snapshot.savedAt });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleVersionSnapshotGet(versionId, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const obj = await env.MEDIA_BUCKET.get('versions/' + versionId + '.json');
    if (!obj) return json({ error: 'Version not found' }, 404);
    const data = JSON.parse(await obj.text());
    return json({ version: { id: versionId, ...data } });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleVersionSnapshotRevert(versionId, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const obj = await env.MEDIA_BUCKET.get('versions/' + versionId + '.json');
    if (!obj) return json({ error: 'Version not found' }, 404);
    const snapshot = JSON.parse(await obj.text());
    // Apply reverted data to staging so Admin can review before publishing
    const stagingPayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      data: snapshot.data || {},
      _stagingMeta: { savedAt: new Date().toISOString(), savedBy: 'revert', source: 'revert-to-version:' + versionId },
    };
    await env.MEDIA_BUCKET.put('staging-manifest.json', JSON.stringify(stagingPayload, null, 2), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });
    // Also restore global settings to staging if included in snapshot
    if (snapshot.globalSettings) {
      const gsPayload = { settings: snapshot.globalSettings, savedAt: new Date().toISOString(), savedBy: 'revert', source: 'revert-to-version:' + versionId };
      await env.MEDIA_BUCKET.put('global-settings-staging.json', JSON.stringify(gsPayload, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      });
    }
    return json({ success: true, data: snapshot.data, globalSettings: snapshot.globalSettings || {} });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleVersionSnapshotDelete(versionId, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    await env.MEDIA_BUCKET.delete('versions/' + versionId + '.json');
    return json({ success: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// --- Admin Overrides (CSS Editor) ---

async function handleAdminOverridesGet(env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    // Check staging first, then production
    const stagingObj = await env.MEDIA_BUCKET.get('admin-overrides-staging.json');
    if (stagingObj) {
      const data = JSON.parse(await stagingObj.text());
      return json({ source: 'staging', overrides: data.overrides || data, published: false });
    }
    const pubObj = await env.MEDIA_BUCKET.get('admin-overrides.json');
    if (pubObj) {
      const data = JSON.parse(await pubObj.text());
      return json({ source: 'published', overrides: data.overrides || data, published: true });
    }
    return json({ source: 'none', overrides: { sections: {}, order: [], hidden: {} }, published: false });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleAdminOverridesPost(request, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const body = await request.json();
    const action = body.action || 'save-direct';

    if (action === 'save-direct' || action === 'save-staging') {
      // DIRECT DEPLOY: Save directly to production manifest
      const payload = { overrides: body.overrides, savedAt: new Date().toISOString(), savedBy: body.admin || 'Admin' };
      await env.MEDIA_BUCKET.put('admin-overrides.json', JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      });
      return json({ success: true, savedAt: payload.savedAt, published: true });
    }

    if (action === 'publish') {
      // In direct deploy model, save and publish are the same
      const payload = { overrides: body.overrides, savedAt: new Date().toISOString(), savedBy: body.admin || 'Admin' };
      await env.MEDIA_BUCKET.put('admin-overrides.json', JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      });
      return json({ success: true, publishedAt: payload.savedAt });
    }

    if (action === 'discard') {
      // No staging to discard in direct deploy model
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// --- Global Settings (Site-wide CSS Variables) ---

async function handleGlobalSettingsGet(env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const empty = { settings: { colors: {}, fonts: {}, spacing: {}, borderRadius: {} } };
    // Try staging first, then production
    const staging = await env.MEDIA_BUCKET.get('global-settings-staging.json');
    if (staging) {
      const data = JSON.parse(await staging.text());
      return json({ settings: data.settings || data, source: 'staging' });
    }
    const prod = await env.MEDIA_BUCKET.get('global-settings.json');
    if (!prod) return json(empty);
    const data = JSON.parse(await prod.text());
    return json({ settings: data.settings || data, source: 'production' });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleGlobalSettingsPost(request, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const body = await request.json();
    const payload = { settings: body.settings, savedAt: new Date().toISOString(), savedBy: body.admin || 'Admin' };
    // Always save to staging
    await env.MEDIA_BUCKET.put('global-settings-staging.json', JSON.stringify(payload, null, 2), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    });
    // If publish=true, also write to production (global-settings.json)
    if (body.publish) {
      await env.MEDIA_BUCKET.put('global-settings.json', JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      });
    }
    return json({ success: true, savedAt: payload.savedAt, published: !!body.publish });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleMediaGet(url, request, env) {
  const key = decodeURIComponent(url.pathname.replace('/api/media/', ''));
  if (!key) return new Response('Missing key', { status: 400 });
  try {
    if (!env.MEDIA_BUCKET) return new Response('R2 not configured', { status: 500 });

    // Parse a single Range header (e.g. "bytes=0-1023", "bytes=1024-",
    // "bytes=-512"). Audio players rely on 206 Partial Content responses for
    // seeking and reliable streaming on iOS/Safari.
    let range = null;
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (match && (match[1] !== '' || match[2] !== '')) {
        range = { start: match[1] === '' ? null : parseInt(match[1], 10), end: match[2] === '' ? null : parseInt(match[2], 10) };
      }
    }

    // First fetch without a range to get size for suffix/open-ended requests,
    // unless a precise range was given (then do a single ranged read).
    const headObj = await env.MEDIA_BUCKET.head(key);
    if (!headObj) return new Response('Not found', { status: 404 });
    const total = Number(headObj.size) || 0;

    const headers = new Headers();
    headObj.writeHttpMetadata(headers);
    // Ensure correct Content-Type for images/audio even if metadata is missing
    if (!headers.get('Content-Type') || headers.get('Content-Type') === 'application/octet-stream') {
      const ext = key.split('.').pop().toLowerCase();
      const mimeMap = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
        'avif': 'image/avif', 'ico': 'image/x-icon', 'bmp': 'image/bmp',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
        'oga': 'audio/ogg', 'aac': 'audio/aac', 'm4a': 'audio/mp4',
        'flac': 'audio/flac', 'opus': 'audio/opus', 'webm': 'audio/webm',
      };
      if (mimeMap[ext]) headers.set('Content-Type', mimeMap[ext]);
    }
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Surrogate-Control', 'no-cache');
    headers.set('Access-Control-Allow-Origin', '*');

    if (!range) {
      const obj = await env.MEDIA_BUCKET.get(key);
      if (!obj) return new Response('Not found', { status: 404 });
      headers.set('Content-Length', String(total));
      return new Response(obj.body, { status: 200, headers });
    }

    let start = range.start;
    let end = range.end;
    if (start === null && end === null) {
      // Empty "bytes=-" is invalid; treat as full body.
      const obj = await env.MEDIA_BUCKET.get(key);
      if (!obj) return new Response('Not found', { status: 404 });
      headers.set('Content-Length', String(total));
      return new Response(obj.body, { status: 200, headers });
    }
    if (start === null) {
      // Suffix range: last `end` bytes.
      if (end <= 0) {
        headers.set('Content-Range', `bytes */${total}`);
        return new Response(null, { status: 416, headers });
      }
      start = Math.max(total - end, 0);
      end = total - 1;
    } else if (end === null) {
      end = total - 1;
    }
    if (start < 0 || start >= total || start > end) {
      headers.set('Content-Range', `bytes */${total}`);
      return new Response(null, { status: 416, headers });
    }
    if (end >= total) end = total - 1;
    if (start > end) {
      headers.set('Content-Range', `bytes */${total}`);
      return new Response(null, { status: 416, headers });
    }

    const obj = await env.MEDIA_BUCKET.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return new Response('Not found', { status: 404 });
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(obj.body, { status: 206, headers });
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500 });
  }
}

/**
 * GET /api/media/list?prefix=audio/&limit=1000&cursor=...
 * Lists objects stored in the R2 bucket so the Builder/Admin can discover
 * previously uploaded media (songs, album art) that may not yet be tracked
 * in the content manifest. Paginated with R2 cursors.
 */
async function handleMediaList(url, env) {
  try {
    if (!env.MEDIA_BUCKET) return json({ error: 'R2 not configured' }, 500);
    const prefix = url.searchParams.get('prefix') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10) || 1000, 1000);
    const cursor = url.searchParams.get('cursor') || undefined;
    const listed = await env.MEDIA_BUCKET.list({ prefix, limit, cursor });
    const objects = (listed.objects || []).map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded ? obj.uploaded.toISOString() : null,
      etag: obj.etag || null,
      contentType: obj.httpMetadata ? obj.httpMetadata.contentType || null : null,
    }));
    return json({
      prefix,
      objects,
      truncated: !!listed.truncated,
      cursor: listed.truncated ? listed.cursor : null,
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleVersionGet(env) {
  let contentVersion = null;
  try {
    if (env.MEDIA_BUCKET) {
      const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
      if (obj) {
        const manifest = JSON.parse(await obj.text());
        contentVersion = manifest.updatedAt || null;
      }
    }
  } catch (_) { /* ignore */ }

  return new Response(JSON.stringify({
    appVersion: DEPLOY_TIME,
    contentVersion,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Surrogate-Control': 'no-cache',
      ...corsHeaders(),
    },
  });
}

async function handleSW(env) {
  try {
    const swReq = new Request(new URL('/sw.js', 'https://placeholder').toString());
    const resp = await env.ASSETS.fetch(swReq);
    if (!resp.ok) return resp;
    let body = await resp.text();
    body = body.replace('__BUILD_VERSION__', DEPLOY_TIME);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Service-Worker-Allowed': '/',
      },
    });
  } catch (e) {
    return new Response('SW load error', { status: 500 });
  }
}

// GET /manifest.webmanifest
// Serves the PWA manifest dynamically so installed-app branding ALWAYS follows
// the centralized logo/title configured in the Builder Site Settings. When no
// logo is configured, the static default icons are used.
async function handleManifestWebmanifest(env) {
  try {
    let name = 'Tamil AI Stream - AI-Powered Tamil Radio';
    let shortName = 'Tamil AI Stream';
    let themeColor = '#000000';
    let logo = null;

    if (env && env.MEDIA_BUCKET) {
      try {
        const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
        if (obj) {
          const manifest = JSON.parse(await obj.text());
          const site = manifest.data && manifest.data.siteSettings;
          if (site) {
            if (site.title) name = site.title;
            if (site.ogTitle) shortName = site.ogTitle;
            if (site.themeColor) themeColor = site.themeColor;
            logo = site.logo || site.favicon || null;
          }
        }
      } catch (_) { /* fall back to static manifest */ }
    }

    let manifest = null;
    try {
      const staticReq = new Request(new URL('/manifest.webmanifest', 'https://placeholder').toString());
      const resp = await env.ASSETS.fetch(staticReq);
      if (resp.ok) manifest = JSON.parse(await resp.text());
    } catch (_) { /* ignore */ }

    if (!manifest) {
      manifest = {
        name, short_name: shortName, start_url: '/', scope: '/',
        display: 'standalone', theme_color: themeColor,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      };
    } else {
      manifest.name = name;
      manifest.short_name = shortName;
      manifest.theme_color = themeColor;
      if (logo) {
        manifest.icons = [
          { src: logo, sizes: 'any', type: 'image/png', purpose: 'any' },
          { src: logo, sizes: 'any', type: 'image/png', purpose: 'maskable' },
        ];
        if (manifest.shortcuts) {
          manifest.shortcuts.forEach((s) => { if (s.icons) s.icons = [{ src: logo, sizes: 'any' }]; });
        }
      }
    }

    return new Response(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

