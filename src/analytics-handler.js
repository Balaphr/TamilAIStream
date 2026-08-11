/* ============================================
   Analytics Handler - Worker-side API + R2 Storage
   ============================================ */

const ANALYTICS_R2_KEY = 'analytics/events';
const ANALYTICS_AGG_KEY = 'analytics/aggregate';
const REALTIME_KEY = 'analytics/realtime';

function getTimestamp() { return Date.now(); }

function startOfDay(ts) {
    const d = new Date(ts || Date.now());
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function dateKey(ts) {
    return new Date(ts || Date.now()).toISOString().split('T')[0];
}

async function readJSON(env, key) {
    try {
        const obj = await env.ANALYTICS_BUCKET.get(key);
        if (!obj) return null;
        return JSON.parse(await obj.text());
    } catch (e) { return null; }
}

async function writeJSON(env, key, data) {
    await env.ANALYTICS_BUCKET.put(key, JSON.stringify(data), {
        httpMetadata: { 'content-type': 'application/json' }
    });
}

// Merge new events into aggregate store
async function mergeEvents(env, events) {
    // Append raw events (keep last 7 days only)
    const now = Date.now();
    const cutoff = now - 7 * 86400000;
    let raw = await readJSON(env, ANALYTICS_R2_KEY) || [];
    raw = raw.filter(e => e.ts > cutoff);
    raw = raw.concat(events);
    // Cap at 50k events
    if (raw.length > 50000) raw = raw.slice(raw.length - 50000);
    await writeJSON(env, ANALYTICS_R2_KEY, raw);

    // Update aggregates
    let agg = await readJSON(env, ANALYTICS_AGG_KEY) || buildEmptyAgg();
    for (const ev of events) {
        updateAgg(agg, ev);
    }
    await writeJSON(env, ANALYTICS_AGG_KEY, agg);

    // Update realtime
    let rt = await readJSON(env, REALTIME_KEY) || { active: {}, songs: {}, fms: {} };
    updateRealtime(rt, events);
    await writeJSON(env, REALTIME_KEY, rt);
}

function buildEmptyAgg() {
    return {
        totalEvents: 0,
        uniqueSessions: new Set(),
        uniqueUsers: new Set(),
        byDate: {},
        byPage: {},
        byDevice: {},
        byEvent: {},
        songs: {},
        fms: {},
        searches: { keywords: {}, noResults: 0, total: 0, clicks: {} },
        players: { miniOpen: 0, miniClose: 0, miniMinimize: 0, seek: 0, lyricsOpen: 0, lyricsSeek: 0, queueOpen: 0, volumeChange: 0, playPause: 0, prev: 0, next: 0 },
        users: { login: 0, logout: 0, register: 0, loginFail: 0, guest: 0, sessions: {} },
        flow: {},
        sections: {},
        realtime: { activeUsers: {}, currentSongs: {}, currentFMs: {} }
    };
}

function updateAgg(agg, ev) {
    agg.totalEvents++;
    if (ev.sid) agg.uniqueSessions.add(ev.sid);
    if (ev.uid) agg.uniqueUsers.add(ev.uid);

    const dk = dateKey(ev.ts);
    if (!agg.byDate[dk]) agg.byDate[dk] = { events: 0, sessions: new Set(), users: new Set() };
    agg.byDate[dk].events++;
    if (ev.sid) agg.byDate[dk].sessions.add(ev.sid);
    if (ev.uid) agg.byDate[dk].users.add(ev.uid);

    if (ev.page) {
        if (!agg.byPage[ev.page]) agg.byPage[ev.page] = { views: 0, users: new Set() };
        agg.byPage[ev.page].views++;
        if (ev.uid) agg.byPage[ev.page].users.add(ev.uid);
    }

    if (ev.device) {
        agg.byDevice[ev.device] = (agg.byDevice[ev.device] || 0) + 1;
    }

    agg.byEvent[ev.event] = (agg.byEvent[ev.event] || 0) + 1;

    // Song analytics
    if (ev.event === 'song_play' && ev.contentId) {
        if (!agg.songs[ev.contentId]) agg.songs[ev.contentId] = { plays: 0, listeners: new Set(), title: ev.title || '', artist: ev.artist || '', skips: 0, completions: 0, totalDuration: 0 };
        agg.songs[ev.contentId].plays++;
        if (ev.uid) agg.songs[ev.contentId].listeners.add(ev.uid);
    }
    if (ev.event === 'song_skip' && ev.contentId && agg.songs[ev.contentId]) {
        agg.songs[ev.contentId].skips++;
    }
    if (ev.event === 'song_complete' && ev.contentId && agg.songs[ev.contentId]) {
        agg.songs[ev.contentId].completions++;
    }
    if (ev.event === 'song_pause' && ev.contentId && agg.songs[ev.contentId] && ev.position) {
        agg.songs[ev.contentId].totalDuration += ev.position;
    }

    // FM analytics
    if (ev.event === 'fm_play' && ev.contentId) {
        if (!agg.fms[ev.contentId]) agg.fms[ev.contentId] = { plays: 0, listeners: new Set(), name: ev.name || '' };
        agg.fms[ev.contentId].plays++;
        if (ev.uid) agg.fms[ev.contentId].listeners.add(ev.uid);
    }

    // Search analytics
    if (ev.event === 'search') {
        agg.searches.total++;
        const q = (ev.query || '').toLowerCase().trim();
        if (q) {
            agg.searches.keywords[q] = (agg.searches.keywords[q] || 0) + 1;
        }
        if (ev.resultCount === 0) agg.searches.noResults++;
    }
    if (ev.event === 'search_click' && ev.contentId) {
        agg.searches.clicks[ev.contentId] = (agg.searches.clicks[ev.contentId] || 0) + 1;
    }

    // Player analytics
    const p = agg.players;
    if (ev.event === 'mini_player_open') p.miniOpen++;
    if (ev.event === 'mini_player_close') p.miniClose++;
    if (ev.event === 'mini_player_minimize') p.miniMinimize++;
    if (ev.event === 'song_seek') p.seek++;
    if (ev.event === 'lyrics_open') p.lyricsOpen++;
    if (ev.event === 'lyrics_seek') p.lyricsSeek++;
    if (ev.event === 'queue_open') p.queueOpen++;
    if (ev.event === 'volume_change') p.volumeChange++;
    if (ev.event === 'song_pause' || ev.event === 'song_resume') p.playPause++;
    if (ev.event === 'previous_song') p.prev++;
    if (ev.event === 'next_song') p.next++;

    // User analytics
    if (ev.event === 'user_login') {
        agg.users.login++;
        if (ev.uid) agg.users.sessions[ev.uid] = { lastLogin: ev.ts, device: ev.device };
    }
    if (ev.event === 'user_logout') agg.users.logout++;
    if (ev.event === 'user_register') agg.users.register++;
    if (ev.event === 'user_login_fail') agg.users.loginFail++;
    if (ev.event === 'session_start' && !ev.uid) agg.users.guest++;

    // Section analytics
    if (ev.event === 'section_view' && ev.section) {
        if (!agg.sections[ev.section]) agg.sections[ev.section] = { views: 0, users: new Set(), time: 0 };
        agg.sections[ev.section].views++;
        if (ev.uid) agg.sections[ev.section].users.add(ev.uid);
    }
    if (ev.event === 'section_time' && ev.section && agg.sections[ev.section]) {
        agg.sections[ev.section].time += ev.duration || 0;
    }

    // Flow analytics
    if (ev.event === 'page_view') {
        const key = (ev.prev || 'start') + ' → ' + ev.page;
        agg.flow[key] = (agg.flow[key] || 0) + 1;
    }
}

function updateRealtime(rt, events) {
    const now = Date.now();
    const TIMEOUT = 5 * 60 * 1000;
    // Clean stale entries
    for (const [k, v] of Object.entries(rt.active)) {
        if (now - v > TIMEOUT) delete rt.active[k];
    }
    for (const ev of events) {
        if (ev.sid) rt.active[ev.sid] = now;
        if (ev.event === 'song_play' && ev.contentId) {
            rt.currentSongs[ev.sid] = { id: ev.contentId, title: ev.title, ts: now };
        }
        if (ev.event === 'fm_play' && ev.contentId) {
            rt.currentFMs[ev.sid] = { id: ev.contentId, name: ev.name, ts: now };
        }
        if (ev.event === 'song_pause' || ev.event === 'session_end') {
            delete rt.currentSongs[ev.sid];
            delete rt.currentFMs[ev.sid];
        }
    }
    // Clean stale
    for (const [k, v] of Object.entries(rt.currentSongs)) {
        if (now - v.ts > TIMEOUT) delete rt.currentSongs[k];
    }
    for (const [k, v] of Object.entries(rt.currentFMs)) {
        if (now - v.ts > TIMEOUT) delete rt.currentFMs[k];
    }
}

// Convert Sets to counts for serialization
function serializeAgg(agg) {
    const s = { ...agg };
    s.uniqueSessions = agg.uniqueSessions instanceof Set ? agg.uniqueSessions.size : 0;
    s.uniqueUsers = agg.uniqueUsers instanceof Set ? agg.uniqueUsers.size : 0;
    for (const dk of Object.keys(s.byDate || {})) {
        const d = s.byDate[dk];
        s.byDate[dk] = { events: d.events, sessions: d.sessions instanceof Set ? d.sessions.size : 0, users: d.users instanceof Set ? d.users.size : 0 };
    }
    for (const pk of Object.keys(s.byPage || {})) {
        const p = s.byPage[pk];
        s.byPage[pk] = { views: p.views, users: p.users instanceof Set ? p.users.size : 0 };
    }
    for (const sk of Object.keys(s.songs || {})) {
        const song = s.songs[sk];
        s.songs[sk] = { plays: song.plays, listeners: song.listeners instanceof Set ? song.listeners.size : 0, title: song.title, artist: song.artist, skips: song.skips || 0, completions: song.completions || 0, totalDuration: song.totalDuration || 0 };
    }
    for (const fk of Object.keys(s.fms || {})) {
        const fm = s.fms[fk];
        s.fms[fk] = { plays: fm.plays, listeners: fm.listeners instanceof Set ? fm.listeners.size : 0, name: fm.name };
    }
    for (const sk of Object.keys(s.sections || {})) {
        const sec = s.sections[sk];
        s.sections[sk] = { views: sec.views, users: sec.users instanceof Set ? sec.users.size : 0, time: sec.time };
    }
    return s;
}

// API Handlers
export async function handleAnalyticsEventPost(request, env) {
    try {
        const { events } = await request.json();
        if (!events || !Array.isArray(events) || events.length === 0) {
            return new Response(JSON.stringify({ error: 'No events' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        await mergeEvents(env, events);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function handleAnalyticsAggregateGet(env) {
    let agg = await readJSON(env, ANALYTICS_AGG_KEY);
    if (!agg) agg = buildEmptyAgg();
    return new Response(JSON.stringify(serializeAgg(agg)), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
}

export async function handleAnalyticsRealtimeGet(env) {
    let rt = await readJSON(env, REALTIME_KEY) || { active: {}, songs: {}, fms: {} };
    const now = Date.now();
    const TIMEOUT = 5 * 60 * 1000;
    const activeCount = Object.values(rt.active).filter(t => now - t < TIMEOUT).length;
    const songs = Object.values(rt.currentSongs).filter(s => now - s.ts < TIMEOUT);
    const fms = Object.values(rt.currentFMs).filter(f => now - f.ts < TIMEOUT);
    return new Response(JSON.stringify({ activeUsers: activeCount, songs, fms }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
}

export async function handleAnalyticsRawGet(env, url) {
    const params = new URL(url).searchParams;
    const limit = Math.min(parseInt(params.get('limit') || '1000'), 5000);
    let raw = await readJSON(env, ANALYTICS_R2_KEY) || [];
    // Filter by date if provided
    const from = params.get('from');
    const to = params.get('to');
    if (from) raw = raw.filter(e => e.ts >= parseInt(from));
    if (to) raw = raw.filter(e => e.ts <= parseInt(to));
    // Filter by event type
    const event = params.get('event');
    if (event) raw = raw.filter(e => e.event === event);
    raw = raw.slice(-limit);
    return new Response(JSON.stringify(raw), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
}

export async function handleAnalyticsResetPost(env) {
    await writeJSON(env, ANALYTICS_R2_KEY, []);
    await writeJSON(env, ANALYTICS_AGG_KEY, buildEmptyAgg());
    await writeJSON(env, REALTIME_KEY, { active: {}, songs: {}, fms: {} });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
