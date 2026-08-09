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

function addCacheBuster(body, contentType, pathname) {
  if (contentType && contentType.includes('text/html') && typeof body === 'string') {
    const versionTag = `<!-- bv:${DEPLOY_TIME} -->`;
    const metaTag = `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">`;
    let result = body.replace('</head>', `${versionTag}\n${metaTag}\n</head>`);
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

      if (url.pathname === '/api/upload' && request.method === 'POST') {
        return handleUpload(request, env, url);
      }
      if (url.pathname === '/api/manifest' && request.method === 'GET') {
        return handleManifestGet(env);
      }
      if (url.pathname === '/api/manifest' && request.method === 'POST') {
        return handleManifestPost(request, env);
      }
      if (url.pathname.startsWith('/api/media/')) {
        return handleMediaGet(url, env);
      }
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if (REDIRECTS[url.pathname]) {
        const newPath = REDIRECTS[url.pathname];
        const newUrl = new URL(url.origin + newPath);
        const assetReq = new Request(newUrl.toString(), request);
        const resp = await env.ASSETS.fetch(assetReq);
        if (resp.ok) return wrapResponse(resp, newPath);
      }

      const resp = await env.ASSETS.fetch(request);
      if (resp.status === 404 && !url.pathname.includes('.')) {
        const withHtml = new URL(url.origin + url.pathname + '.html');
        const retry = await env.ASSETS.fetch(new Request(withHtml.toString(), request));
        if (retry.ok) return wrapResponse(retry, url.pathname + '.html');
      }
      return wrapResponse(resp, url.pathname);

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
  },
};

function wrapResponse(resp, pathname) {
  const headers = new Headers(resp.headers);
  const cacheHeaders = getCacheHeaders(pathname);
  Object.entries(cacheHeaders).forEach(([k, v]) => headers.set(k, v));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Vary', 'Accept-Encoding');
  const contentType = headers.get('Content-Type') || '';
  if (pathname.endsWith('.html') || pathname === '/') {
    return resp.text().then(body => {
      const patched = addCacheBuster(body, contentType, pathname);
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

async function handleMediaGet(url, env) {
  const key = decodeURIComponent(url.pathname.replace('/api/media/', ''));
  if (!key) return new Response('Missing key', { status: 400 });
  try {
    if (!env.MEDIA_BUCKET) return new Response('R2 not configured', { status: 500 });
    const obj = await env.MEDIA_BUCKET.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Surrogate-Control', 'no-cache');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(obj.body, { status: 200, headers });
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500 });
  }
}


