'use strict';

// ============================================
// News Handler - Cloudflare Worker Side
// RSS Fetching, Parsing, Dedup, Storage in R2
// ============================================

const NEWS_R2_KEY = 'tamil-news-data.json';
const NEWS_CONFIG_KEY = 'tamil-news-config.json';

const DEFAULT_FEEDS = [
    {
        id: 'feed_oneindia',
        name: 'Tamil OneIndia',
        url: 'https://tamil.oneindia.com/rss/feeds/tamil-news-fb.xml',
        category: 'General',
        enabled: true,
        lastFetched: null,
        error: null
    },
    {
        id: 'feed_newsintl',
        name: 'Tamil News International',
        url: 'https://tamilnewsinternational.in/rss/latest-posts',
        category: 'Latest',
        enabled: true,
        lastFetched: null,
        error: null
    },
    {
        id: 'feed_goodreturns',
        name: 'Tamil GoodReturns',
        url: 'https://tamil.goodreturns.in/rss/feeds/goodreturns-tamil-fb.xml',
        category: 'Business',
        enabled: true,
        lastFetched: null,
        error: null
    }
];

const CATEGORY_KEYWORDS = {
    'Breaking News': ['breaking', 'urgent', 'alert', 'flash', 'just in', 'உடனடி', 'அவசர'],
    'Cinema': ['cinema', 'movie', 'film', 'actor', 'actress', 'director', 'kollywood', 'ollywood', 'bollywood', 'திரைப்படம்', 'நடிகர்', 'நடிகை', 'சினிமா'],
    'Sports': ['cricket', 'football', 'tennis', 'ipl', 'sports', 'match', 'tournament', 'கிரிக்கெட்', 'விளையாட்டு'],
    'Technology': ['tech', 'technology', 'ai', 'software', 'app', 'digital', 'startup', 'தொழில்நுட்பம்'],
    'Business': ['business', 'market', 'stock', 'finance', 'economy', 'trade', 'invest', 'வணிகம்', 'சந்தை', 'பொருளாதார'],
    'India': ['india', 'delhi', 'modi', 'parliament', 'central government', 'இந்தியா', 'தமிழ்நாடு'],
    'Tamil Nadu': ['tamil nadu', 'chennai', 'coimbatore', 'madurai', 'state government', 'cm', 'தமிழ்நாடு', 'சென்னை'],
    'World': ['world', 'international', 'global', 'us', 'china', 'russia', 'uk', 'உலகம்', 'சர்வதேச'],
    'Trending': ['viral', 'trending', 'social media', 'twitter', 'facebook', 'trending topic']
};

function categorizeArticle(title, description) {
    const text = ((title || '') + ' ' + (description || '')).toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw.toLowerCase()))) return cat;
    }
    return 'General';
}

function extractThumbnail(item) {
    const mediaMatch = item.match(/<media:content[^>]*url="([^"]+)"/i)
        || item.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
        || item.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i);
    if (mediaMatch) return mediaMatch[1];

    const imgMatch = item.match(/<img[^>]*src="([^"]+)"/i);
    if (imgMatch) return imgMatch[1];

    const descMatch = item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/i)
        || item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    if (descMatch) {
        const imgInDesc = descMatch[1].match(/<img[^>]*src="([^"]+)"/i);
        if (imgInDesc) return imgInDesc[1];
    }
    return '';
}

function parseRSSXML(xmlText) {
    const items = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemXml = match[1];

        const getTag = (tag) => {
            const cdata = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
            if (cdata) return cdata[1].trim();
            const plain = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
            return plain ? plain[1].trim() : '';
        };

        const title = getTag('title');
        const link = getTag('link');
        const pubDate = getTag('pubDate');
        const description = getTag('description') || getTag('summary');
        const guid = getTag('guid') || link;
        const category = getTag('category');
        const thumbnail = extractThumbnail(itemXml);

        if (title && (link || guid)) {
            items.push({
                title: title.replace(/<[^>]+>/g, '').trim(),
                url: link || guid,
                description: description.replace(/<[^>]+>/g, '').trim().substring(0, 300),
                pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                guid: guid || link,
                thumbnail,
                sourceCategory: category
            });
        }
    }
    return items;
}

function deduplicateArticles(articles) {
    const seen = new Set();
    return articles.filter(a => {
        const key = a.guid || a.url || a.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function fetchAndParseFeed(feed) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(feed.url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'TamilAI-Stream-News/1.0' }
        });
        clearTimeout(timeout);

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const xml = await resp.text();
        const items = parseRSSXML(xml);

        return {
            items: items.map(item => ({
                ...item,
                feedId: feed.id,
                feedName: feed.name,
                feedCategory: feed.category
            })),
            error: null
        };
    } catch (err) {
        return { items: [], error: err.message || 'Fetch failed' };
    }
}

async function refreshAllFeeds(env) {
    const config = await getNewsConfig(env);
    const feeds = config.feeds || DEFAULT_FEEDS;
    const maxItems = config.maxItems || 100;
    const enabledFeeds = feeds.filter(f => f.enabled);

    if (enabledFeeds.length === 0) {
        return { success: true, message: 'No enabled feeds', articles: [], feeds };
    }

    const results = await Promise.allSettled(
        enabledFeeds.map(feed => fetchAndParseFeed(feed))
    );

    let allArticles = [];
    const updatedFeeds = feeds.map((feed, i) => {
        if (!feed.enabled) return feed;
        const result = results[i]?.value || { items: [], error: 'Unknown error' };
        return {
            ...feed,
            lastFetched: new Date().toISOString(),
            error: result.error,
            lastCount: result.items.length
        };
    });

    results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.items) {
            allArticles.push(...r.value.items);
        }
    });

    allArticles = deduplicateArticles(allArticles);

    allArticles = allArticles.map(a => ({
        ...a,
        category: categorizeArticle(a.title, a.description),
        id: 'news_' + (a.guid || a.url || '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 80) + '_' + Date.now(),
        fetchedAt: new Date().toISOString(),
        published: true
    }));

    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    if (allArticles.length > maxItems) {
        allArticles = allArticles.slice(0, maxItems);
    }

    const existing = await getNewsData(env);
    const existingUrls = new Set((existing.articles || []).map(a => a.guid || a.url));
    const newArticles = allArticles.filter(a => !existingUrls.has(a.guid || a.url));

    const merged = [...allArticles];
    (existing.articles || []).forEach(old => {
        if (!merged.find(a => (a.guid || a.url) === (old.guid || old.url))) {
            merged.push(old);
        }
    });

    merged.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const finalArticles = merged.slice(0, maxItems);

    await putNewsData(env, {
        articles: finalArticles,
        lastRefresh: new Date().toISOString(),
        totalArticles: finalArticles.length
    });

    await putNewsConfig(env, { ...config, feeds: updatedFeeds });

    return {
        success: true,
        newCount: newArticles.length,
        totalCount: finalArticles.length,
        feeds: updatedFeeds,
        articles: finalArticles
    };
}

async function getNewsData(env) {
    try {
        const obj = await env.MEDIA_BUCKET.get(NEWS_R2_KEY);
        if (!obj) return { articles: [], lastRefresh: null, totalArticles: 0 };
        return JSON.parse(await obj.text());
    } catch {
        return { articles: [], lastRefresh: null, totalArticles: 0 };
    }
}

async function putNewsData(env, data) {
    await env.MEDIA_BUCKET.put(NEWS_R2_KEY, JSON.stringify(data, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' }
    });
}

async function getNewsConfig(env) {
    try {
        const obj = await env.MEDIA_BUCKET.get(NEWS_CONFIG_KEY);
        if (!obj) return { feeds: DEFAULT_FEEDS, maxItems: 100, refreshInterval: 5, autoPublish: true };
        return JSON.parse(await obj.text());
    } catch {
        return { feeds: DEFAULT_FEEDS, maxItems: 100, refreshInterval: 5, autoPublish: true };
    }
}

async function putNewsConfig(env, config) {
    await env.MEDIA_BUCKET.put(NEWS_CONFIG_KEY, JSON.stringify(config, null, 2), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' }
    });
}

async function handleNewsGet(env) {
    const data = await getNewsData(env);
    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...corsHeaders() }
    });
}

async function handleNewsConfigGet(env) {
    const config = await getNewsConfig(env);
    return new Response(JSON.stringify(config), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...corsHeaders() }
    });
}

async function handleNewsConfigPost(request, env) {
    const payload = await request.json();
    const config = await getNewsConfig(env);

    if (payload.feeds) config.feeds = payload.feeds;
    if (payload.maxItems !== undefined) config.maxItems = payload.maxItems;
    if (payload.refreshInterval !== undefined) config.refreshInterval = payload.refreshInterval;
    if (payload.autoPublish !== undefined) config.autoPublish = payload.autoPublish;

    await putNewsConfig(env, config);
    return new Response(JSON.stringify({ success: true, config }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
}

async function handleNewsRefreshPost(env) {
    const result = await refreshAllFeeds(env);
    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
}

async function handleNewsPublishPost(request, env) {
    const { articleId, published } = await request.json();
    const data = await getNewsData(env);
    data.articles = data.articles.map(a =>
        a.id === articleId ? { ...a, published } : a
    );
    await putNewsData(env, data);
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
}

async function handleNewsDeletePost(request, env) {
    const { articleId } = await request.json();
    const data = await getNewsData(env);
    data.articles = data.articles.filter(a => a.id !== articleId);
    data.totalArticles = data.articles.length;
    await putNewsData(env, data);
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
}

async function handleNewsCleanupPost(env) {
    const data = await getNewsData(env);
    const config = await getNewsConfig(env);
    const maxItems = config.maxItems || 100;
    data.articles = data.articles.slice(0, maxItems);
    data.totalArticles = data.articles.length;
    await putNewsData(env, data);
    return new Response(JSON.stringify({ success: true, remaining: data.articles.length }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
    };
}

export {
    refreshAllFeeds, getNewsData, putNewsData, getNewsConfig, putNewsConfig,
    handleNewsGet, handleNewsConfigGet, handleNewsConfigPost,
    handleNewsRefreshPost, handleNewsPublishPost, handleNewsDeletePost, handleNewsCleanupPost,
    DEFAULT_FEEDS, corsHeaders
};
