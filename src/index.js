import {
  handleAnalyticsEventPost, handleAnalyticsAggregateGet,
  handleAnalyticsRealtimeGet, handleAnalyticsRawGet, handleAnalyticsResetPost
} from './analytics-handler.js';

const REDIRECTS = {
  '/': '/index.html',
  '/login': '/login.html',
  '/builder': '/builder.html',
  '/playlist': '/playlist.html',
  '/profile': '/profile.html',
  '/admin': '/admin.html',
  '/admin-login': '/admin-login.html',
  '/admin-upload': '/admin-upload.html',
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
    return new Response(await obj.text(), {
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

