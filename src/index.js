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
      if (url.pathname === '/api/news' && request.method === 'GET') {
        return handleNewsGet(request, env);
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
    const cutoff = Date.now() - (retentionHours > 0 ? retentionHours : 24) * 3600 * 1000;

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

/* ---------------- Live Tamil News (/api/news) ---------------- */

const NEWS_FEED_URL = 'https://feeds.bbci.co.uk/tamil/rss.xml';
const NEWS_CACHE_KEY = 'rcc-news-cache.json';
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000; // re-fetch the RSS feed at most every 10 min
const DEFAULT_RETENTION_HOURS = 24;

// Tamil unicode block range used for the language filter.
function tamilCharCount(text) {
  if (!text) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0b80 && code <= 0x0bff) count++;
  }
  return count;
}

// Reject non-Tamil / mixed-language / unrelated headlines. The RSS source is
// Tamil-only, but we keep a hard guard so a bad item can never sneak through.
function isTamilHeadline(title) {
  const trimmed = (title || '').trim();
  if (!trimmed) return false;
  const tamil = tamilCharCount(trimmed);
  const latin = (trimmed.match(/[a-zA-Z]/g) || []).length;
  return tamil >= 3 && tamil > latin;
}

// Place names / hints that identify Tamil Nadu news. Only used to PRIORITIZE
// Tamil Nadu items first on the news list — items stay Tamil-only regardless.
const TAMIL_NADU_KEYWORDS = [
  'தமிழ்நாடு', 'தமிழகம்', 'தமிழ்நாட்டில்', 'தமிழகத்தில்',
  'சென்னை', 'மதுரை', 'கோவை', 'கோயம்புத்தூர்', 'சேலம்', 'திருச்சி',
  'நெல்லை', 'தூத்துக்குடி', 'ராமநாதபுரம்', 'காஞ்சிபுரம்', 'தஞ்சாவூர்',
  'வேலூர்', 'கன்னியாகுமரி', 'ஈரோடு', 'திண்டுக்கல்', 'கரூர்', 'நாமக்கல்',
  'திருவண்ணாமலை', 'விழுப்புரம்', 'கடலூர்', 'நாகப்பட்டினம்', 'திருவாரூர்',
  'புதுக்கோட்டை', 'சிவகங்கை', 'விருதுநகர்', 'தேனி', 'பெரம்பலூர்',
  'அரியலூர்', 'தென்காசி', 'கிருஷ்ணகிரி', 'தருமபுரி', 'ஆம்பூர்', 'வாணியம்பாடி',
  'திருப்பூர்', 'பொள்ளாச்சி', 'நாகர்கோவில்', 'உதகை', 'கொடைக்கானல்',
  'வாழைப்பழம்', 'தமிழக அரசு', 'தமிழ்நாடு அரசு', 'சென்னையில்', 'மதுரையில்',
];

// Classify an item as Tamil Nadu news (title + content both checked).
function isTamilNaduItem(item) {
  const text = (item.title || '') + ' ' + (item.content || '');
  return TAMIL_NADU_KEYWORDS.some((k) => text.indexOf(k) !== -1);
}

function decodeEntities(text) {
  return (text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(text) {
  return decodeEntities((text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function stripCdata(text) {
  return (text || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

// Regex-based RSS parser (Workers have no DOMParser).
function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];

    const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(block);
    const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(block);
    const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(block);
    const guidMatch = /<guid[^>]*>([\s\S]*?)<\/guid>/i.exec(block);
    const pubMatch = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block);
    const thumbMatch = /<media:thumbnail[^>]*url="([^"]+)"/i.exec(block) || /<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(block);

    const title = stripTags(stripCdata(titleMatch ? titleMatch[1] : ''));
    if (!title) continue;
    if (!isTamilHeadline(title)) continue;

    const content = stripTags(stripCdata(descMatch ? descMatch[1] : ''));
    const link = stripCdata(linkMatch ? linkMatch[1] : '').trim();
    const guid = stripCdata(guidMatch ? guidMatch[1] : '').trim() || link;
    const pubDateStr = stripCdata(pubMatch ? pubMatch[1] : '').trim();
    const publishedAt = pubDateStr ? new Date(pubDateStr).toISOString() : null;
    const image = thumbMatch ? thumbMatch[1] : '';

    items.push({
      id: guid,
      title,
      content,
      image,
      publishedAt,
    });
  }

  // Dedupe by normalized title / guid.
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = (item.id || item.title || '').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Tamil Nadu news first, then other Tamil news. Region never leaks as
    // branding — it is an internal sort priority only.
    item.tamilNadu = isTamilNaduItem(item);
    unique.push(item);
  }

  // TN priority first, then newest-first (null dates go to the end).
  unique.sort((a, b) => {
    if (a.tamilNadu !== b.tamilNadu) return a.tamilNadu ? -1 : 1;
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  return unique;
}

async function fetchNewsFeed(env) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(NEWS_FEED_URL, {
      headers: { 'User-Agent': 'TamilAIStream-NewsBot/1.0 (+https://tamilai.stream)' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error('RSS fetch failed with status ' + resp.status);
    const xml = await resp.text();
    const items = parseRssItems(xml);
    const fetchedAt = new Date().toISOString();
    const payload = JSON.stringify({ fetchedAt, items });
    if (env.MEDIA_BUCKET) {
      try {
        await env.MEDIA_BUCKET.put(NEWS_CACHE_KEY, payload, {
          httpMetadata: { contentType: 'application/json' },
        });
      } catch (_) { /* cache write is best-effort */ }
    }
    return { fetchedAt, items };
  } finally {
    clearTimeout(timeout);
  }
}

async function readNewsSettings(env) {
  const settings = {
    autoDelete: true,
    retentionHours: DEFAULT_RETENTION_HOURS,
    tamilNaduPriority: true,
    maxItems: 40,
    highlightHours: 6,
  };
  try {
    if (env.MEDIA_BUCKET) {
      const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
      if (obj) {
        const manifest = JSON.parse(await obj.text());
        const site = manifest.data && manifest.data.siteSettings;
        if (site && site.newsSettings) {
          if (typeof site.newsSettings.autoDelete === 'boolean') {
            settings.autoDelete = site.newsSettings.autoDelete;
          }
          const hours = parseInt(site.newsSettings.retentionHours, 10);
          if (hours && hours > 0) settings.retentionHours = hours;
          if (typeof site.newsSettings.tamilNaduPriority === 'boolean') {
            settings.tamilNaduPriority = site.newsSettings.tamilNaduPriority;
          }
          const max = parseInt(site.newsSettings.maxItems, 10);
          if (max && max > 0) settings.maxItems = max;
          const hl = parseInt(site.newsSettings.highlightHours, 10);
          if (hl && hl > 0) settings.highlightHours = hl;
        }
      }
    }
  } catch (_) { /* fall back to defaults */ }
  return settings;
}

// Load published, non-trashed news items curated by the Builder from the R2
// manifest, applying the same retention window as the live feed.
async function readCuratedNews(env, settings) {
  try {
    if (!env.MEDIA_BUCKET) return [];
    const obj = await env.MEDIA_BUCKET.get('content-manifest.json');
    if (!obj) return [];
    const manifest = JSON.parse(await obj.text());
    const data = manifest.data || {};
    if (!Array.isArray(data.news)) return [];

    const cutoff = Date.now() - (settings && settings.autoDelete !== false ? (settings.retentionHours || 24) * 3600 * 1000 : 0);
    return data.news.filter((n) => {
      if (n.status === 'trashed' || !n.published) return false;
      if (settings && settings.autoDelete !== false) {
        if (!n.publishedAt) return false;
        const t = new Date(n.publishedAt).getTime();
        if (isNaN(t) || t < cutoff) return false;
      }
      return true;
    });
  } catch (_) { /* ignore manifest read errors */ }
  return [];
}

// GET /api/news
// Returns the latest Tamil news from the RCC source. Items are filtered to
// Tamil-only, deduped, prioritized (Tamil Nadu first when enabled), and capped
// by the retention window configured in the Builder Site Settings (default:
// auto-delete after 24 hours). No source branding is exposed — each item only
// carries Tamil content fields. Results are cached in R2 for NEWS_CACHE_TTL_MS
// so we don't hammer the upstream feed.
async function handleNewsGet(request, env) {
  try {
    let cached = null;
    if (env.MEDIA_BUCKET) {
      try {
        const obj = await env.MEDIA_BUCKET.get(NEWS_CACHE_KEY);
        if (obj) cached = JSON.parse(await obj.text());
      } catch (_) { /* ignore cache read errors */ }
    }

    const cacheFresh = cached && cached.fetchedAt && (Date.now() - new Date(cached.fetchedAt).getTime()) < NEWS_CACHE_TTL_MS;

    let items = [];
    let fetchedAt;
    if (cacheFresh && Array.isArray(cached.items)) {
      items = cached.items;
      fetchedAt = cached.fetchedAt;
    } else {
      try {
        const fresh = await fetchNewsFeed(env);
        items = fresh.items;
        fetchedAt = fresh.fetchedAt;
      } catch (e) {
        // Upstream feed failed; serve stale cache if we have any, otherwise error.
        if (cached && Array.isArray(cached.items) && cached.items.length) {
          items = cached.items;
          fetchedAt = cached.fetchedAt;
        } else {
          return json({ error: 'News feed unavailable', detail: e.message }, 502);
        }
      }
    }

    const settings = await readNewsSettings(env);

    let result = items;
    if (settings.autoDelete) {
      const cutoff = Date.now() - settings.retentionHours * 3600 * 1000;
      result = items.filter((item) => {
        if (!item.publishedAt) return false;
        const t = new Date(item.publishedAt).getTime();
        return !isNaN(t) && t >= cutoff;
      });
    }

    // Merge curated news (published, non-trashed items managed in the Builder)
    // ahead of the live RCC feed. Curated items are deduped against the feed by
    // normalized title, so a Builder-edited headline never duplicates.
    const curated = await readCuratedNews(env, settings);
    if (curated.length) {
      const curatedTitles = new Set(curated.map((c) => (c.title || '').trim().toLowerCase()));
      result = curated.concat(result.filter((item) => {
        return !curatedTitles.has((item.title || '').trim().toLowerCase());
      }));
    }

    // TN priority is applied both at parse time and defensively here so the
    // ordering is stable even for cached payloads produced by an older build.
    if (settings.tamilNaduPriority) {
      result = result.slice().sort((a, b) => {
        const pa = a.tnPriority || a.priority === 'tamil-nadu' || a.tamilNadu;
        const pb = b.tnPriority || b.priority === 'tamil-nadu' || b.tamilNadu;
        if (pa !== pb) return pa ? -1 : 1;
        // Highlighted / admin-ordered curated items float above the feed.
        if (!!a.highlighted !== !!b.highlighted) return a.highlighted ? -1 : 1;
        const oa = typeof a.order === 'number' ? a.order : 0;
        const ob = typeof b.order === 'number' ? b.order : 0;
        if (oa !== ob) return oa - ob;
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return tb - ta;
      });
    }

    // Strip internal-only fields before serving.
    const clean = result.map((item) => {
      const priority = item.tnPriority || item.tamilNadu || item.priority === 'tamil-nadu'
        ? 'tamil-nadu'
        : 'other';
      return {
        id: item.id,
        title: item.title,
        content: item.content,
        image: item.image,
        publishedAt: item.publishedAt,
        priority,
        highlighted: !!item.highlighted,
      };
    });

    return json({
      fetchedAt,
      retention: settings,
      count: clean.length,
      items: clean.slice(0, settings.maxItems),
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}


