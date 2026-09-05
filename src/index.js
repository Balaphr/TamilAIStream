import {
  handleAnalyticsEventPost, handleAnalyticsAggregateGet,
  handleAnalyticsRealtimeGet, handleAnalyticsRawGet, handleAnalyticsResetPost
} from './analytics-handler.js';

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
    const action = body.action || 'save-staging';

    if (action === 'save-staging') {
      const payload = { overrides: body.overrides, savedAt: new Date().toISOString(), savedBy: body.admin || 'Admin' };
      await env.MEDIA_BUCKET.put('admin-overrides-staging.json', JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      });
      return json({ success: true, savedAt: payload.savedAt });
    }

    if (action === 'publish') {
      const stagingObj = await env.MEDIA_BUCKET.get('admin-overrides-staging.json');
      if (!stagingObj) return json({ error: 'No staging overrides to publish' }, 400);
      const staging = JSON.parse(await stagingObj.text());
      staging.publishedAt = new Date().toISOString();
      await env.MEDIA_BUCKET.put('admin-overrides.json', JSON.stringify(staging, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      });
      await env.MEDIA_BUCKET.delete('admin-overrides-staging.json');
      return json({ success: true, publishedAt: staging.publishedAt });
    }

    if (action === 'discard') {
      await env.MEDIA_BUCKET.delete('admin-overrides-staging.json');
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

