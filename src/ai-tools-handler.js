// ============================================================================
// ai-tools-handler.js — Server-side API handlers for AI Tools
// ============================================================================
// API keys are stored in R2 under ai-tools-config/ prefix.
// They are NEVER exposed to the frontend.
// ============================================================================

const AI_TOOLS_CONFIG_KEY = 'ai-tools-config/providers.json';

// ---------------------------------------------------------------------------
// Read provider config from R2 (admin-written, server-read only)
// ---------------------------------------------------------------------------
async function getProviderConfig(env) {
  try {
    if (!env.MEDIA_BUCKET) return getDefaultConfig();
    const obj = await env.MEDIA_BUCKET.get(AI_TOOLS_CONFIG_KEY);
    if (!obj) return getDefaultConfig();
    return { ...getDefaultConfig(), ...JSON.parse(await obj.text()) };
  } catch (e) {
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    ai: { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions' },
    imageEnhance: { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-image-1', endpoint: 'https://api.openai.com/v1/images/generations' },
    imageUpscale: { enabled: false, provider: 'replicate', apiKey: '', model: 'nightmareai/real-esrgan', endpoint: '' },
    bgRemoval: { enabled: false, provider: 'removebg', apiKey: '', model: 'u2net', endpoint: 'https://api.remove.bg/v1.0/removebg' },
    videoProcessing: { enabled: false, provider: 'cloudconvert', apiKey: '', model: '', endpoint: '' },
    audioProcessing: { enabled: false, provider: 'cloudconvert', apiKey: '', model: '', endpoint: '' },
    imageProcessing: { enabled: false, provider: 'sharp', apiKey: '', model: '', endpoint: '' },
    pdfTools: { enabled: false, provider: 'pdf-lib', apiKey: '', model: '', endpoint: '' },
    urlDownloader: { enabled: false, provider: 'yt-dlp', apiKey: '', model: '', endpoint: '' }
  };
}

// ---------------------------------------------------------------------------
// Security: URL validation (SSRF prevention)
// ---------------------------------------------------------------------------
function validateUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, error: 'Only HTTP/HTTPS URLs allowed' };
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '[::1]'];
    const hostname = url.hostname.toLowerCase();
    if (blocked.includes(hostname)) return { ok: false, error: 'Internal URLs are blocked' };
    // Block metadata endpoints
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return { ok: false, error: 'Internal hostnames blocked' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Invalid URL format' };
  }
}

// ---------------------------------------------------------------------------
// OpenAI API — AI Commands + Image Enhancement
// ---------------------------------------------------------------------------
async function callOpenAI(config, messages, options = {}) {
  const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
  const model = config.model || 'gpt-4o-mini';
  const body = {
    model,
    messages,
    max_tokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.7
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ---------------------------------------------------------------------------
// OpenAI Images API — Image Enhancement / Generation
// ---------------------------------------------------------------------------
async function callOpenAIImages(config, prompt, options = {}) {
  const endpoint = config.endpoint || 'https://api.openai.com/v1/images/generations';
  const model = config.model || 'gpt-image-1';
  const body = {
    model,
    prompt,
    n: 1,
    size: options.size || '1024x1024',
    quality: options.quality || 'high'
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Images API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.data?.[0]?.url || data.data?.[0]?.b64_json || null;
}

// ---------------------------------------------------------------------------
// Replicate API — Image Upscaling, Background Removal, etc.
// ---------------------------------------------------------------------------
async function callReplicate(config, model, input) {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('Replicate API key not configured');

  // Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`
    },
    body: JSON.stringify({ version: model, input }),
    signal: AbortSignal.timeout(10000)
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Replicate API error (${createRes.status}): ${err}`);
  }

  const prediction = await createRes.json();

  // Poll for completion (max 120 seconds)
  const pollUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
  const deadline = Date.now() + 120000;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Token ${apiKey}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!pollRes.ok) throw new Error('Failed to poll Replicate');
    const status = await pollRes.json();
    if (status.status === 'succeeded') return status.output;
    if (status.status === 'failed') throw new Error(`Replicate processing failed: ${status.error}`);
  }

  throw new Error('Replicate processing timed out');
}

// ---------------------------------------------------------------------------
// remove.bg API — Background Removal
// ---------------------------------------------------------------------------
async function callRemoveBg(config, imageBase64) {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('remove.bg API key not configured');

  const formData = new FormData();
  formData.append('image_file_b64', imageBase64);
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`remove.bg API error (${response.status}): ${err}`);
  }

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// CloudConvert API — Video/Audio Conversion
// ---------------------------------------------------------------------------
async function callCloudConvert(config, operation, inputFileUrl, options = {}) {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('CloudConvert API key not configured');

  // Create job
  const jobBody = {
    tasks: {
      'import': { operation: 'import/url', url: inputFileUrl },
      'process': {
        operation,
        input: 'import',
        ...options
      },
      'export': { operation: 'export/url', input: 'process' }
    }
  };

  const response = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(jobBody),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`CloudConvert API error (${response.status}): ${err}`);
  }

  const job = await response.json();

  // Poll for completion
  const jobId = job.data?.id;
  if (!jobId) throw new Error('No job ID returned');

  const deadline = Date.now() + 300000; // 5 minutes
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!pollRes.ok) throw new Error('Failed to poll CloudConvert');
    const status = await pollRes.json();
    if (status.data?.status === 'finished') {
      const exportTask = Object.values(status.data.tasks || {}).find(t => t.operation === 'export/url');
      return exportTask?.result?.files?.[0]?.url || null;
    }
    if (status.data?.status === 'failed') throw new Error('CloudConvert job failed');
  }

  throw new Error('CloudConvert processing timed out');
}

// ---------------------------------------------------------------------------
// Tool Processors — each returns { result, outputUrl?, outputData? }
// ---------------------------------------------------------------------------

async function processAIToolsCommand(config, body) {
  const { command, files, options } = body;
  if (!config.ai.enabled || !config.ai.apiKey) {
    return { error: 'AI not configured. Set up your API key in Admin → AI & Tools Settings.' };
  }

  const systemPrompt = `You are an AI assistant for a media tools platform. The user wants to perform a media operation. Parse their request and return a JSON object with:
{ "tool": "<tool-id>", "options": { ... }, "description": "<short description>" }
Available tools: video-convert, video-compress, video-extract-audio, video-resize, audio-convert, audio-compress, audio-normalize, image-convert, image-resize, image-crop, image-rotate, image-compress, image-enhance, image-upscale, image-bg-remove, pdf-create, pdf-to-images, pdf-merge, pdf-split, file-zip, file-unzip, url-download, file-info.
For video/audio tools, include "format" in options. For image tools, include "format" or "width"/"height". Return ONLY valid JSON, no markdown.`;

  const content = await callOpenAI(config.ai, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: command }
  ]);

  try {
    const parsed = JSON.parse(content);
    return { success: true, tool: parsed.tool, options: parsed.options || {}, description: parsed.description };
  } catch (e) {
    return { success: true, tool: null, raw: content, error: 'Could not parse AI response as tool command' };
  }
}

async function processImageEnhance(config, body) {
  const { imageData, options } = body;
  if (!config.imageEnhance.enabled) {
    return { error: 'Image Enhancer not enabled. Enable it in Admin → AI & Tools Settings.' };
  }

  const provider = config.imageEnhance.provider;

  if (provider === 'openai') {
    if (!config.imageEnhance.apiKey) return { error: 'OpenAI API key not configured for image enhancement.' };
    const prompt = `Enhance this image: improve quality, sharpness, color vibrancy, and overall clarity. Maintain the original composition and style. Enhanced high-quality result.`;
    const result = await callOpenAIImages(config.imageEnhance, prompt, {
      size: options?.size || '1024x1024',
      quality: 'high'
    });
    return { success: true, outputUrl: result, provider: 'openai' };
  }

  if (provider === 'replicate') {
    if (!config.imageEnhance.apiKey) return { error: 'Replicate API key not configured.' };
    const result = await callReplicate(config.imageEnhance, 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa', {
      image: imageData,
      scale: 4,
      face_enhance: true
    });
    return { success: true, outputUrl: Array.isArray(result) ? result[0] : result, provider: 'replicate' };
  }

  return { error: `Provider "${provider}" not supported for image enhancement.` };
}

async function processImageUpscale(config, body) {
  const { imageData, options } = body;
  if (!config.imageUpscale.enabled) {
    return { error: 'Image Upscaler not enabled. Enable it in Admin → AI & Tools Settings.' };
  }

  const provider = config.imageUpscale.provider;

  if (provider === 'replicate') {
    if (!config.imageUpscale.apiKey) return { error: 'Replicate API key not configured.' };
    const scale = options?.scale || 4;
    const result = await callReplicate(config.imageUpscale, 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa', {
      image: imageData,
      scale,
      face_enhance: options?.faceEnhance !== false
    });
    return { success: true, outputUrl: Array.isArray(result) ? result[0] : result, scale, provider: 'replicate' };
  }

  if (provider === 'openai') {
    if (!config.imageUpscale.apiKey) return { error: 'OpenAI API key not configured.' };
    const result = await callOpenAIImages(config.imageUpscale, 'Upscale this image to high resolution, maintaining sharpness and detail. Professional quality upscaled result.', {
      size: '1536x1536',
      quality: 'high'
    });
    return { success: true, outputUrl: result, provider: 'openai' };
  }

  return { error: `Provider "${provider}" not supported for image upscaling.` };
}

async function processBgRemoval(config, body) {
  const { imageData, options } = body;
  if (!config.bgRemoval.enabled) {
    return { error: 'Background Removal not enabled. Enable it in Admin → AI & Tools Settings.' };
  }

  const provider = config.bgRemoval.provider;

  if (provider === 'removebg') {
    if (!config.bgRemoval.apiKey) return { error: 'remove.bg API key not configured.' };
    const hexData = await callRemoveBg(config.bgRemoval, imageData);
    return { success: true, outputData: hexData, format: 'png', provider: 'removebg' };
  }

  if (provider === 'replicate') {
    if (!config.bgRemoval.apiKey) return { error: 'Replicate API key not configured.' };
    const result = await callReplicate(config.bgRemoval, 'cjwbw/rembg:fb8af171cfa907e033bcfc5c2b2df2ac80c463e43779916c637f6c6d164a8504', {
      image: imageData
    });
    return { success: true, outputUrl: Array.isArray(result) ? result[0] : result, provider: 'replicate' };
  }

  if (provider === 'clipdrop') {
    if (!config.bgRemoval.apiKey) return { error: 'Clipdrop API key not configured.' };
    const formData = new FormData();
    formData.append('image_file', new Blob([Uint8Array.from(hexToBytes(imageData))], { type: 'image/png' }), 'image.png');
    const response = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: { 'x-api-key': config.bgRemoval.apiKey },
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`Clipdrop API error: ${response.status}`);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    return { success: true, outputData: Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''), format: 'png', provider: 'clipdrop' };
  }

  return { error: `Provider "${provider}" not supported for background removal.` };
}

async function processVideoTool(config, toolId, body) {
  const { fileUrl, files, options } = body;
  if (!config.videoProcessing.enabled) {
    return { error: 'Video Processing not enabled. Enable it in Admin → AI & Tools Settings.' };
  }

  const provider = config.videoProcessing.provider;

  if (provider === 'cloudconvert') {
    if (!config.videoProcessing.apiKey) return { error: 'CloudConvert API key not configured.' };
    if (!fileUrl) return { error: 'File URL required for cloud processing.' };

    let operation;
    const outputFormat = options?.format || 'mp4';
    switch (toolId) {
      case 'video-convert': operation = 'convert'; break;
      case 'video-compress': operation = 'compress'; break;
      case 'video-extract-audio': operation = 'extract-audio'; break;
      case 'video-resize': operation = 'resize'; break;
      default: operation = 'convert';
    }

    const result = await callCloudConvert(config.videoProcessing, operation, fileUrl, {
      output_format: outputFormat,
      ...(toolId === 'video-compress' && { bitrate: options?.compression === 'heavy' ? '500k' : options?.compression === 'light' ? '5000k' : '2000k' }),
      ...(toolId === 'video-resize' && { width: options?.width || 1280, height: options?.height || 720 })
    });

    return { success: true, outputUrl: result, format: outputFormat, provider: 'cloudconvert' };
  }

  // FFmpeg (local) — not available in Cloudflare Workers
  return { error: `Provider "${provider}" for video processing is not available in this environment. Use CloudConvert or configure a cloud provider.` };
}

async function processAudioTool(config, toolId, body) {
  const { fileUrl, files, options } = body;
  if (!config.audioProcessing.enabled) {
    return { error: 'Audio Processing not enabled. Enable it in Admin → AI & Tools Settings.' };
  }

  const provider = config.audioProcessing.provider;

  if (provider === 'cloudconvert') {
    if (!config.audioProcessing.apiKey) return { error: 'CloudConvert API key not configured.' };
    if (!fileUrl) return { error: 'File URL required for cloud processing.' };

    let operation;
    const outputFormat = options?.format || 'mp3';
    switch (toolId) {
      case 'audio-convert': operation = 'convert'; break;
      case 'audio-compress': operation = 'compress'; break;
      case 'audio-normalize': operation = 'normalize'; break;
      default: operation = 'convert';
    }

    const result = await callCloudConvert(config.audioProcessing, operation, fileUrl, {
      output_format: outputFormat
    });

    return { success: true, outputUrl: result, format: outputFormat, provider: 'cloudconvert' };
  }

  return { error: `Provider "${provider}" for audio processing is not available in this environment. Use CloudConvert or configure a cloud provider.` };
}

async function processPdfTool(config, toolId, body) {
  const { files, fileData, options } = body;
  if (!config.pdfTools.enabled) {
    return { error: 'PDF Tools not enabled. Enable it in Admin → AI & Tools Settings.' };
  }

  // PDF processing uses pdf-lib (client-side) for basic operations
  // Server-side only handles operations that need external APIs
  return { success: true, clientSide: true, tool: toolId, message: 'PDF processing runs in the browser. Use pdf-lib.' };
}

async function processImageLocal(toolId, body) {
  const { files, options } = body;
  // Local image processing uses client-side canvas/sharp.js
  return { success: true, clientSide: true, tool: toolId, message: 'Image processing runs in the browser.' };
}

async function processUrlDownload(config, body) {
  const { url, options } = body;
  if (!config.urlDownloader.enabled) {
    return { error: 'URL Downloader not enabled. Enable it in Admin → AI & Tools Settings.' };
  }

  const urlCheck = validateUrl(url);
  if (!urlCheck.ok) return { error: urlCheck.error };

  const provider = config.urlDownloader.provider;

  if (provider === 'yt-dlp') {
    // yt-dlp is a CLI tool — not available in Cloudflare Workers
    // Return the URL for client-side processing or use a hosted service
    return { success: true, clientSide: true, url, message: 'URL download requires yt-dlp (server-side) or client-side processing.' };
  }

  // For direct HTTP downloads, just validate and return the URL
  try {
    const headRes = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    if (!headRes.ok) return { error: `URL not accessible (HTTP ${headRes.status})` };
    const contentType = headRes.headers.get('content-type') || '';
    const contentLength = headRes.headers.get('content-length') || '0';
    return {
      success: true,
      url,
      contentType,
      contentLength: parseInt(contentLength),
      downloadable: true
    };
  } catch (e) {
    return { error: `Could not access URL: ${e.message}` };
  }
}

function processFileInfo(body) {
  const { files } = body;
  if (!files || files.length === 0) return { error: 'No file provided' };
  const file = files[0];
  return {
    success: true,
    info: {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      category: getFileCategory(file.name)
    }
  };
}

function getFileCategory(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'other';
}

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Admin: Save provider config (write to R2)
// ---------------------------------------------------------------------------
async function handleAIToolsConfigSave(request, env) {
  try {
    const body = await request.json();
    const { type, config: providerConfig } = body;

    if (!type || !providerConfig) return json({ error: 'Missing type or config' }, 400);

    // Read existing config
    let fullConfig = await getProviderConfig(env);
    fullConfig[type] = providerConfig;

    // Save to R2
    await env.MEDIA_BUCKET.put(AI_TOOLS_CONFIG_KEY, JSON.stringify(fullConfig, null, 2), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' }
    });

    return json({ success: true, savedAt: new Date().toISOString() });
  } catch (e) {
    return json({ error: 'Save failed: ' + e.message }, 500);
  }
}

async function handleAIToolsConfigGet(request, env) {
  try {
    const config = await getProviderConfig(env);
    // Strip API keys from response (server-side only)
    const safe = {};
    for (const [key, val] of Object.entries(config)) {
      safe[key] = { ...val, apiKey: val.apiKey ? '••••••••' + val.apiKey.slice(-4) : '' };
    }
    return json({ config: safe });
  } catch (e) {
    return json({ error: 'Load failed: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Admin: Test API connection
// ---------------------------------------------------------------------------
async function handleAIToolsTest(request, env) {
  try {
    const body = await request.json();
    const { type } = body;
    const config = await getProviderConfig(env);
    const provider = config[type];

    if (!provider) return json({ error: 'Unknown provider type' }, 400);
    if (!provider.enabled) return json({ error: 'Provider is disabled' }, 400);
    if (!provider.apiKey && provider.provider !== 'sharp' && provider.provider !== 'pdf-lib') {
      return json({ error: 'API key not configured' }, 400);
    }

    let result;
    switch (type) {
      case 'ai':
        result = await callOpenAI(provider, [{ role: 'user', content: 'Say "API connection successful"' }], { maxTokens: 20 });
        return json({ success: true, message: 'OpenAI responded: ' + result.substring(0, 100) });

      case 'imageEnhance':
      case 'imageUpscale':
        if (provider.provider === 'openai') {
          result = await callOpenAIImages(provider, 'Test connection', { size: '256x256' });
          return json({ success: true, message: 'OpenAI Images API connected', url: result });
        }
        if (provider.provider === 'replicate') {
          // Simple model info check
          const res = await fetch(`https://api.replicate.com/v1/models/${provider.model}`, {
            headers: { 'Authorization': `Token ${provider.apiKey}` },
            signal: AbortSignal.timeout(10000)
          });
          if (!res.ok) throw new Error('Replicate model not found');
          const data = await res.json();
          return json({ success: true, message: `Replicate model "${data.name}" accessible` });
        }
        return json({ success: true, message: `${provider.provider} configured (local tool)` });

      case 'bgRemoval':
        if (provider.provider === 'removebg') {
          // Test with a tiny valid PNG
          const testB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          const testRes = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: { 'X-Api-Key': provider.apiKey },
            body: (() => { const fd = new FormData(); fd.append('image_file_b64', testB64); fd.append('size', 'auto'); return fd; })(),
            signal: AbortSignal.timeout(15000)
          });
          if (!testRes.ok) {
            const err = await testRes.text();
            return json({ error: `remove.bg returned ${testRes.status}: ${err}` });
          }
          return json({ success: true, message: 'remove.bg API connected successfully' });
        }
        if (provider.provider === 'replicate') {
          const res = await fetch(`https://api.replicate.com/v1/models/${provider.model}`, {
            headers: { 'Authorization': `Token ${provider.apiKey}` },
            signal: AbortSignal.timeout(10000)
          });
          if (!res.ok) throw new Error('Replicate model not found');
          return json({ success: true, message: 'Replicate BG removal model accessible' });
        }
        return json({ success: true, message: `${provider.provider} configured` });

      case 'videoProcessing':
      case 'audioProcessing':
        if (provider.provider === 'cloudconvert') {
          const res = await fetch('https://api.cloudconvert.com/v2/users/me', {
            headers: { 'Authorization': `Bearer ${provider.apiKey}` },
            signal: AbortSignal.timeout(10000)
          });
          if (!res.ok) return json({ error: 'CloudConvert API key invalid' });
          const data = await res.json();
          return json({ success: true, message: `CloudConvert connected — Plan: ${data.data?.credits?.plan || 'unknown'}` });
        }
        return json({ success: true, message: `${provider.provider} configured (local tool)` });

      default:
        return json({ success: true, message: `${provider.provider} configured` });
    }
  } catch (e) {
    return json({ error: 'Test failed: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Main Tool Processing Endpoint
// ---------------------------------------------------------------------------
async function handleAIToolsProcess(request, env) {
  try {
    const body = await request.json();
    const { tool, options, fileUrl, files, command, imageData } = body;

    if (!tool && !command) return json({ error: 'Missing tool or command' }, 400);

    const config = await getProviderConfig(env);

    let result;

    // AI Command parsing
    if (command) {
      result = await processAIToolsCommand(config, body);
      return json(result);
    }

    // Route to appropriate processor
    switch (tool) {
      case 'image-enhance':
        result = await processImageEnhance(config, body);
        break;
      case 'image-upscale':
        result = await processImageUpscale(config, body);
        break;
      case 'image-bg-remove':
        result = await processBgRemoval(config, body);
        break;

      case 'video-convert':
      case 'video-compress':
      case 'video-extract-audio':
      case 'video-resize':
      case 'video-trim':
        result = await processVideoTool(config, tool, body);
        break;

      case 'audio-convert':
      case 'audio-compress':
      case 'audio-trim':
      case 'audio-normalize':
        result = await processAudioTool(config, tool, body);
        break;

      case 'pdf-create':
      case 'pdf-to-images':
      case 'pdf-merge':
      case 'pdf-split':
        result = await processPdfTool(config, tool, body);
        break;

      case 'image-convert':
      case 'image-resize':
      case 'image-crop':
      case 'image-rotate':
      case 'image-compress':
        result = await processImageLocal(tool, body);
        break;

      case 'url-download':
        result = await processUrlDownload(config, body);
        break;

      case 'file-info':
        result = processFileInfo(body);
        break;

      case 'file-zip':
      case 'file-unzip':
        result = { success: true, clientSide: true, tool, message: 'File archive processing runs in the browser.' };
        break;

      default:
        return json({ error: `Unknown tool: ${tool}` }, 400);
    }

    return json(result);
  } catch (e) {
    return json({ error: 'Processing failed: ' + e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  });
}

export {
  handleAIToolsProcess,
  handleAIToolsConfigSave,
  handleAIToolsConfigGet,
  handleAIToolsTest,
  getProviderConfig
};
