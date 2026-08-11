/* Analytics Handler - Worker-side API + R2 Storage (JSON-safe, no Sets) */
const ANALYTICS_R2_KEY = 'analytics/events';
const ANALYTICS_AGG_KEY = 'analytics/aggregate';
const REALTIME_KEY = 'analytics/realtime';

function dateKey(ts) { return new Date(ts || Date.now()).toISOString().split('T')[0]; }

async function readJSON(env, key) {
    try { const o = await env.MEDIA_BUCKET.get(key); return o ? JSON.parse(await o.text()) : null; } catch (e) { return null; }
}
async function writeJSON(env, key, data) {
    await env.MEDIA_BUCKET.put(key, JSON.stringify(data), { httpMetadata: { 'content-type': 'application/json' } });
}
function ensureObj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
function setAdd(obj, id) { if (id) obj[id] = true; }
function setSize(obj) { return obj && typeof obj === 'object' ? Object.keys(obj).length : 0; }

function buildEmptyAgg() {
    return {
        totalEvents: 0, uniqueSessions: {}, uniqueUsers: {},
        byDate: {}, byPage: {}, byDevice: {}, byEvent: {},
        songs: {}, fms: {},
        searches: { keywords: {}, noResults: 0, total: 0, clicks: {} },
        players: { miniOpen: 0, miniClose: 0, miniMinimize: 0, seek: 0, lyricsOpen: 0, lyricsSeek: 0, queueOpen: 0, volumeChange: 0, playPause: 0, prev: 0, next: 0 },
        users: { login: 0, logout: 0, register: 0, loginFail: 0, guest: 0, sessions: {} },
        flow: {}, sections: {}
    };
}

function updateAgg(agg, ev) {
    agg.totalEvents++;
    if (ev.sid) setAdd(agg.uniqueSessions, ev.sid);
    if (ev.uid) setAdd(agg.uniqueUsers, ev.uid);

    const dk = dateKey(ev.ts);
    if (!agg.byDate[dk]) agg.byDate[dk] = { events: 0, sessions: {}, users: {} };
    agg.byDate[dk].events++;
    if (ev.sid) setAdd(agg.byDate[dk].sessions, ev.sid);
    if (ev.uid) setAdd(agg.byDate[dk].users, ev.uid);

    if (ev.page) {
        if (!agg.byPage[ev.page]) agg.byPage[ev.page] = { views: 0, users: {} };
        agg.byPage[ev.page].views++;
        if (ev.uid) setAdd(agg.byPage[ev.page].users, ev.uid);
    }

    if (ev.device) agg.byDevice[ev.device] = (agg.byDevice[ev.device] || 0) + 1;
    agg.byEvent[ev.event] = (agg.byEvent[ev.event] || 0) + 1;

    if (ev.event === 'song_play' && ev.contentId) {
        if (!agg.songs[ev.contentId]) agg.songs[ev.contentId] = { plays: 0, listeners: {}, title: ev.title || '', artist: ev.artist || '', skips: 0, completions: 0, totalDuration: 0 };
        agg.songs[ev.contentId].plays++;
        if (ev.uid) setAdd(agg.songs[ev.contentId].listeners, ev.uid);
    }
    if (ev.event === 'song_skip' && ev.contentId && agg.songs[ev.contentId]) agg.songs[ev.contentId].skips++;
    if (ev.event === 'song_complete' && ev.contentId && agg.songs[ev.contentId]) agg.songs[ev.contentId].completions++;
    if (ev.event === 'song_pause' && ev.contentId && agg.songs[ev.contentId] && ev.position) agg.songs[ev.contentId].totalDuration += ev.position;

    if (ev.event === 'fm_play' && ev.contentId) {
        if (!agg.fms[ev.contentId]) agg.fms[ev.contentId] = { plays: 0, listeners: {}, name: ev.name || '' };
        agg.fms[ev.contentId].plays++;
        if (ev.uid) setAdd(agg.fms[ev.contentId].listeners, ev.uid);
    }

    if (ev.event === 'search') {
        agg.searches.total++;
        const q = (ev.query || '').toLowerCase().trim();
        if (q) agg.searches.keywords[q] = (agg.searches.keywords[q] || 0) + 1;
        if (ev.resultCount === 0) agg.searches.noResults++;
    }
    if (ev.event === 'search_click' && ev.contentId) agg.searches.clicks[ev.contentId] = (agg.searches.clicks[ev.contentId] || 0) + 1;

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

    if (ev.event === 'user_login') { agg.users.login++; if (ev.uid) agg.users.sessions[ev.uid] = { lastLogin: ev.ts, device: ev.device }; }
    if (ev.event === 'user_logout') agg.users.logout++;
    if (ev.event === 'user_register') agg.users.register++;
    if (ev.event === 'user_login_fail') agg.users.loginFail++;
    if (ev.event === 'session_start' && !ev.uid) agg.users.guest++;

    if (ev.event === 'section_view' && ev.section) {
        if (!agg.sections[ev.section]) agg.sections[ev.section] = { views: 0, users: {}, time: 0 };
        agg.sections[ev.section].views++;
        if (ev.uid) setAdd(agg.sections[ev.section].users, ev.uid);
    }
    if (ev.event === 'section_time' && ev.section && agg.sections[ev.section]) agg.sections[ev.section].time += ev.duration || 0;

    if (ev.event === 'page_view') {
        const key = (ev.prev || 'start') + ' -> ' + ev.page;
        agg.flow[key] = (agg.flow[key] || 0) + 1;
    }
}

function updateRealtime(rt, events) {
    const now = Date.now(); const T = 5 * 60000;
    rt.active = ensureObj(rt.active); rt.currentSongs = ensureObj(rt.currentSongs); rt.currentFMs = ensureObj(rt.currentFMs);
    for (const [k, v] of Object.entries(rt.active)) { if (now - v > T) delete rt.active[k]; }
    for (const ev of events) {
        if (ev.sid) rt.active[ev.sid] = now;
        if (ev.event === 'song_play' && ev.contentId) rt.currentSongs[ev.sid] = { id: ev.contentId, title: ev.title, ts: now };
        if (ev.event === 'fm_play' && ev.contentId) rt.currentFMs[ev.sid] = { id: ev.contentId, name: ev.name, ts: now };
        if (ev.event === 'song_pause' || ev.event === 'session_end') { delete rt.currentSongs[ev.sid]; delete rt.currentFMs[ev.sid]; }
    }
    for (const [k, v] of Object.entries(rt.currentSongs)) { if (now - v.ts > T) delete rt.currentSongs[k]; }
    for (const [k, v] of Object.entries(rt.currentFMs)) { if (now - v.ts > T) delete rt.currentFMs[k]; }
}

function serializeAgg(agg) {
    const s = { ...agg };
    s.uniqueSessions = setSize(agg.uniqueSessions);
    s.uniqueUsers = setSize(agg.uniqueUsers);
    for (const dk of Object.keys(s.byDate || {})) {
        const d = s.byDate[dk];
        s.byDate[dk] = { events: d.events, sessions: setSize(d.sessions), users: setSize(d.users) };
    }
    for (const pk of Object.keys(s.byPage || {})) {
        s.byPage[pk] = { views: s.byPage[pk].views, users: setSize(s.byPage[pk].users) };
    }
    for (const sk of Object.keys(s.songs || {})) {
        const song = s.songs[sk];
        s.songs[sk] = { plays: song.plays, listeners: setSize(song.listeners), title: song.title, artist: song.artist, skips: song.skips || 0, completions: song.completions || 0, totalDuration: song.totalDuration || 0 };
    }
    for (const fk of Object.keys(s.fms || {})) {
        s.fms[fk] = { plays: s.fms[fk].plays, listeners: setSize(s.fms[fk].listeners), name: s.fms[fk].name };
    }
    for (const sk of Object.keys(s.sections || {})) {
        s.sections[sk] = { views: s.sections[sk].views, users: setSize(s.sections[sk].users), time: s.sections[sk].time };
    }
    return s;
}

// Ensure agg loaded from R2 has proper object structure (no broken Sets)
function ensureAgg(agg) {
    if (!agg) return buildEmptyAgg();
    agg.uniqueSessions = ensureObj(agg.uniqueSessions);
    agg.uniqueUsers = ensureObj(agg.uniqueUsers);
    agg.byDate = ensureObj(agg.byDate); agg.byPage = ensureObj(agg.byPage);
    agg.byDevice = ensureObj(agg.byDevice); agg.byEvent = ensureObj(agg.byEvent);
    agg.songs = ensureObj(agg.songs); agg.fms = ensureObj(agg.fms);
    agg.searches = ensureObj(agg.searches); agg.searches.keywords = ensureObj(agg.searches.keywords);
    agg.searches.clicks = ensureObj(agg.searches.clicks);
    agg.players = ensureObj(agg.players); agg.users = ensureObj(agg.users);
    agg.users.sessions = ensureObj(agg.users.sessions);
    agg.flow = ensureObj(agg.flow); agg.sections = ensureObj(agg.sections);
    for (const dk of Object.keys(agg.byDate)) { agg.byDate[dk].sessions = ensureObj(agg.byDate[dk].sessions); agg.byDate[dk].users = ensureObj(agg.byDate[dk].users); }
    for (const pk of Object.keys(agg.byPage)) { agg.byPage[pk].users = ensureObj(agg.byPage[pk].users); }
    for (const sk of Object.keys(agg.songs)) { agg.songs[sk].listeners = ensureObj(agg.songs[sk].listeners); }
    for (const fk of Object.keys(agg.fms)) { agg.fms[fk].listeners = ensureObj(agg.fms[fk].listeners); }
    for (const sk of Object.keys(agg.sections)) { agg.sections[sk].users = ensureObj(agg.sections[sk].users); }
    return agg;
}

async function mergeEvents(env, events) {
    const now = Date.now(); const cutoff = now - 7 * 86400000;
    let raw = await readJSON(env, ANALYTICS_R2_KEY) || [];
    raw = raw.filter(e => e.ts > cutoff);
    raw = raw.concat(events);
    if (raw.length > 50000) raw = raw.slice(raw.length - 50000);
    await writeJSON(env, ANALYTICS_R2_KEY, raw);
    let agg = ensureAgg(await readJSON(env, ANALYTICS_AGG_KEY));
    for (const ev of events) updateAgg(agg, ev);
    await writeJSON(env, ANALYTICS_AGG_KEY, agg);
    let rt = ensureObj(await readJSON(env, REALTIME_KEY));
    rt.active = ensureObj(rt.active); rt.currentSongs = ensureObj(rt.currentSongs); rt.currentFMs = ensureObj(rt.currentFMs);
    updateRealtime(rt, events);
    await writeJSON(env, REALTIME_KEY, rt);
}

export async function handleAnalyticsEventPost(request, env) {
    try {
        const { events } = await request.json();
        if (!events || !Array.isArray(events) || events.length === 0) return new Response(JSON.stringify({ error: 'No events' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        await mergeEvents(env, events);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function handleAnalyticsAggregateGet(env) {
    let agg = ensureAgg(await readJSON(env, ANALYTICS_AGG_KEY));
    return new Response(JSON.stringify(serializeAgg(agg)), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
}

export async function handleAnalyticsRealtimeGet(env) {
    let rt = ensureObj(await readJSON(env, REALTIME_KEY));
    rt.active = ensureObj(rt.active); rt.currentSongs = ensureObj(rt.currentSongs); rt.currentFMs = ensureObj(rt.currentFMs);
    const now = Date.now(); const T = 5 * 60000;
    const activeCount = Object.values(rt.active).filter(t => now - t < T).length;
    const songs = Object.values(rt.currentSongs).filter(s => now - s.ts < T);
    const fms = Object.values(rt.currentFMs).filter(f => now - f.ts < T);
    return new Response(JSON.stringify({ activeUsers: activeCount, songs, fms }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
}

export async function handleAnalyticsRawGet(env, url) {
    const params = new URL(url).searchParams;
    const limit = Math.min(parseInt(params.get('limit') || '1000'), 5000);
    let raw = await readJSON(env, ANALYTICS_R2_KEY) || [];
    const from = params.get('from'); const to = params.get('to');
    if (from) raw = raw.filter(e => e.ts >= parseInt(from));
    if (to) raw = raw.filter(e => e.ts <= parseInt(to));
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
