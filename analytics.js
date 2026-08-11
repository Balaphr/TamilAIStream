/* Analytics Dashboard - Core helpers */
let _analyticsData = null;
let _analyticsCharts = {};
const ANALYTICS_API = '/api/analytics';

async function fetchAnalyticsAggregate() {
    try { const r = await fetch(ANALYTICS_API + '/aggregate'); return await r.json(); } catch (e) { return null; }
}
async function fetchAnalyticsRealtime() {
    try { const r = await fetch(ANALYTICS_API + '/realtime'); return await r.json(); } catch (e) { return { activeUsers: 0, songs: [], fms: [] }; }
}
function filterByPeriod(data) {
    if (!data || !data.byDate) return data;
    const period = document.getElementById('analyticsPeriod')?.value || '7';
    const now = Date.now();
    let cutoff = 0;
    if (period === 'today') cutoff = now - 86400000;
    else if (period === 'yesterday') cutoff = now - 2 * 86400000;
    else if (period !== 'all') cutoff = now - parseInt(period) * 86400000;
    const filtered = { ...data, byDate: {} };
    for (const [dk, dv] of Object.entries(data.byDate || {})) {
        const dt = new Date(dk).getTime();
        if (dt >= cutoff) filtered.byDate[dk] = dv;
    }
    return filtered;
}
function _fmtN(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); }
function _fmtDur(ms) {
    if (!ms || ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}
function _dChart(id) { if (_analyticsCharts[id]) { _analyticsCharts[id].destroy(); delete _analyticsCharts[id]; } }
function drawBarChart(id, labels, data, color) {
    _dChart(id); const c = document.getElementById(id); if (!c) return;
    _analyticsCharts[id] = new Chart(c.getContext('2d'), { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: color || '#34d399', borderRadius: 6, barThickness: 28 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } }, y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
}
function drawLineChart(id, labels, datasets) {
    _dChart(id); const c = document.getElementById(id); if (!c) return;
    _analyticsCharts[id] = new Chart(c.getContext('2d'), { type: 'line', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d1d5db' } } }, scales: { x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
}
function drawPieChart(id, labels, data, colors) {
    _dChart(id); const c = document.getElementById(id); if (!c) return;
    _analyticsCharts[id] = new Chart(c.getContext('2d'), { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors || ['#34d399', '#60a5fa', '#f59e0b', '#ef4444', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db', padding: 12 } } } } });
}
function renderKPI(id, cards) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = cards.map(c => '<div class="analytics-kpi"><div class="analytics-kpi-icon" style="background:' + (c.color || 'rgba(52,211,153,0.15)') + '"><i class="' + (c.icon || 'fas fa-chart-bar') + '"></i></div><div class="analytics-kpi-info"><div class="analytics-kpi-value">' + c.value + '</div><div class="analytics-kpi-label">' + c.label + '</div></div></div>').join('');
}
function rankTable(items, cols) {
    if (!items || !items.length) return '<div class="analytics-empty">No data available</div>';
    let h = '<table class="analytics-table"><thead><tr>';
    cols.forEach(c => { h += '<th>' + c.l + '</th>'; });
    h += '</tr></thead><tbody>';
    items.forEach((it, i) => { h += '<tr>'; cols.forEach(c => { h += '<td>' + c.r(it, i) + '</td>'; }); h += '</tr>'; });
    h += '</tbody></table>'; return h;
}
/* ---- Main loader ---- */
function loadAnalyticsData() {
    fetchAnalyticsAggregate().then(data => {
        if (!data) return;
        _analyticsData = data;
        renderOverviewTab(data);
        renderUsersTab(data);
        renderMusicTab(data);
        renderFMTab(data);
        renderContentTab(data);
        renderPlayerTab(data);
        renderSearchTab(data);
        renderSectionsTab(data);
        renderFlowTab(data);
    });
    loadRealtimeData();
}

/* ---- Overview ---- */
function renderOverviewTab(d) {
    const ev = d.byEvent || {};
    const totalPlays = (ev.song_play || 0) + (ev.fm_play || 0);
    const totalListening = Object.values(d.songs || {}).reduce((a, s) => a + (s.totalDuration || 0), 0);
    renderKPI('analyticsKPI', [
        { icon: 'fas fa-users', label: 'Unique Users', value: _fmtN(d.uniqueUsers || 0), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-user-check', label: 'Sessions', value: _fmtN(d.uniqueSessions || 0), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-mouse-pointer', label: 'Total Events', value: _fmtN(d.totalEvents || 0), color: 'rgba(245,158,11,0.15)' },
        { icon: 'fas fa-play-circle', label: 'Total Plays', value: _fmtN(totalPlays), color: 'rgba(167,139,250,0.15)' },
        { icon: 'fas fa-headphones', label: 'Listening Time', value: _fmtDur(totalListening), color: 'rgba(244,114,182,0.15)' },
        { icon: 'fas fa-search', label: 'Searches', value: _fmtN((d.searches || {}).total || 0), color: 'rgba(56,189,248,0.15)' }
    ]);
    const dates = Object.keys(d.byDate || {}).sort();
    const evCounts = dates.map(dk => (d.byDate[dk] || {}).events || 0);
    drawLineChart('analyticsEventsChart', dates, [{ label: 'Events', data: evCounts, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', fill: true, tension: 0.3 }]);
    const evEntries = Object.entries(ev).sort((a, b) => b[1] - a[1]).slice(0, 10);
    drawBarChart('analyticsTopEventsChart', evEntries.map(e => e[0].replace(/_/g, ' ')), evEntries.map(e => e[1]), '#60a5fa');
    const dev = d.byDevice || {};
    drawPieChart('analyticsDeviceChart', Object.keys(dev).map(k => k.charAt(0).toUpperCase() + k.slice(1)), Object.values(dev));
    const pages = Object.entries(d.byPage || {}).sort((a, b) => b[1].views - a[1].views).slice(0, 8);
    drawBarChart('analyticsPageChart', pages.map(p => p[0].replace(/^\//, '').replace(/\.html$/, '') || 'home'), pages.map(p => p[1].views), '#a78bfa');
}

/* ---- Users ---- */
function renderUsersTab(d) {
    const u = d.users || {};
    renderKPI('analyticsUserKPI', [
        { icon: 'fas fa-sign-in-alt', label: 'Logins', value: _fmtN(u.login || 0), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-sign-out-alt', label: 'Logouts', value: _fmtN(u.logout || 0), color: 'rgba(239,68,68,0.15)' },
        { icon: 'fas fa-user-plus', label: 'Registrations', value: _fmtN(u.register || 0), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-user-shield', label: 'Login Failures', value: _fmtN(u.loginFail || 0), color: 'rgba(245,158,11,0.15)' },
        { icon: 'fas fa-user-secret', label: 'Guest Sessions', value: _fmtN(u.guest || 0), color: 'rgba(167,139,250,0.15)' },
        { icon: 'fas fa-desktop', label: 'Desktop', value: _fmtN((d.byDevice || {}).desktop || 0), color: 'rgba(56,189,248,0.15)' },
        { icon: 'fas fa-mobile-alt', label: 'Mobile', value: _fmtN((d.byDevice || {}).mobile || 0), color: 'rgba(244,114,182,0.15)' },
        { icon: 'fas fa-tablet-alt', label: 'Tablet', value: _fmtN((d.byDevice || {}).tablet || 0), color: 'rgba(251,146,60,0.15)' }
    ]);
    const dates = Object.keys(d.byDate || {}).sort();
    const userCounts = dates.map(dk => (d.byDate[dk] || {}).users || 0);
    drawLineChart('analyticsUserActivityChart', dates, [{ label: 'Active Users', data: userCounts, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', fill: true, tension: 0.3 }]);
    drawBarChart('analyticsLoginChart', ['Logins', 'Logouts', 'Registrations', 'Failures'], [u.login || 0, u.logout || 0, u.register || 0, u.loginFail || 0], ['#34d399', '#ef4444', '#60a5fa', '#f59e0b']);
}

/* ---- Music ---- */
function renderMusicTab(d) {
    const songs = d.songs || {};
    const totalPlays = Object.values(songs).reduce((a, s) => a + (s.plays || 0), 0);
    const totalSkips = Object.values(songs).reduce((a, s) => a + (s.skips || 0), 0);
    const totalComp = Object.values(songs).reduce((a, s) => a + (s.completions || 0), 0);
    const totalDur = Object.values(songs).reduce((a, s) => a + (s.totalDuration || 0), 0);
    const avgDur = totalPlays > 0 ? totalDur / totalPlays : 0;
    renderKPI('analyticsMusicKPI', [
        { icon: 'fas fa-music', label: 'Songs Played', value: _fmtN(totalPlays), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-headphones', label: 'Total Listening', value: _fmtDur(totalDur), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-clock', label: 'Avg Duration', value: _fmtDur(avgDur), color: 'rgba(245,158,11,0.15)' },
        { icon: 'fas fa-forward', label: 'Skips', value: _fmtN(totalSkips), color: 'rgba(239,68,68,0.15)' },
        { icon: 'fas fa-check-circle', label: 'Completions', value: _fmtN(totalComp), color: 'rgba(167,139,250,0.15)' },
        { icon: 'fas fa-list', label: 'Unique Songs', value: _fmtN(Object.keys(songs).length), color: 'rgba(244,114,182,0.15)' }
    ]);
    const topSongs = Object.entries(songs).sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0)).slice(0, 15);
    document.getElementById('analyticsTopSongs').innerHTML = rankTable(topSongs.map(([id, s]) => ({ id, ...s })), [
        { l: '#', r: (_, i) => i + 1 }, { l: 'Song', r: s => s.title || s.id }, { l: 'Artist', r: s => s.artist || '-' },
        { l: 'Plays', r: s => _fmtN(s.plays || 0) }, { l: 'Listeners', r: s => s.listeners || 0 },
        { l: 'Skips', r: s => s.skips || 0 }, { l: 'Complete', r: s => s.plays ? Math.round((s.completions || 0) / s.plays * 100) + '%' : '0%' }
    ]);
    drawPieChart('analyticsCompletionChart', ['Completed', 'Skipped', 'Other'], [totalComp, totalSkips, Math.max(0, totalPlays - totalComp - totalSkips)], ['#34d399', '#ef4444', '#6b7280']);
    const skipped = Object.entries(songs).sort((a, b) => (b[1].skips || 0) - (a[1].skips || 0)).filter(([, s]) => s.skips > 0).slice(0, 10);
    document.getElementById('analyticsMostSkipped').innerHTML = rankTable(skipped.map(([id, s]) => ({ id, ...s })), [
        { l: '#', r: (_, i) => i + 1 }, { l: 'Song', r: s => s.title || s.id }, { l: 'Skips', r: s => s.skips }, { l: 'Plays', r: s => s.plays || 0 }
    ]);
    const replayed = Object.entries(songs).filter(([, s]) => s.plays >= 3).sort((a, b) => ((b[1].completions || 0) / b[1].plays) - ((a[1].completions || 0) / a[1].plays)).slice(0, 10);
    document.getElementById('analyticsMostReplayed').innerHTML = rankTable(replayed.map(([id, s]) => ({ id, ...s })), [
        { l: '#', r: (_, i) => i + 1 }, { l: 'Song', r: s => s.title || s.id },
        { l: 'Rate', r: s => Math.round((s.completions || 0) / s.plays * 100) + '%' }, { l: 'Plays', r: s => s.plays || 0 }
    ]);
}

/* ---- FM ---- */
function renderFMTab(d) {
    const fms = d.fms || {};
    const totalFMPlays = Object.values(fms).reduce((a, f) => a + (f.plays || 0), 0);
    renderKPI('analyticsFMKPI', [
        { icon: 'fas fa-broadcast-tower', label: 'FM Plays', value: _fmtN(totalFMPlays), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-radio', label: 'Unique Stations', value: _fmtN(Object.keys(fms).length), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-headphones', label: 'Most Played', value: Object.entries(fms).sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0))[0]?.[1]?.name || '-', color: 'rgba(245,158,11,0.15)' }
    ]);
    const topFM = Object.entries(fms).sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0)).slice(0, 10);
    document.getElementById('analyticsTopFM').innerHTML = rankTable(topFM.map(([id, f]) => ({ id, ...f })), [
        { l: '#', r: (_, i) => i + 1 }, { l: 'Station', r: f => f.name || f.id },
        { l: 'Plays', r: f => _fmtN(f.plays || 0) }, { l: 'Listeners', r: f => f.listeners || 0 }
    ]);
    if (topFM.length > 0) drawPieChart('analyticsFMPieChart', topFM.map(([, f]) => f.name || f.id), topFM.map(([, f]) => f.plays || 0));
}

/* ---- Content ---- */
function renderContentTab(d) {
    const ev = d.byEvent || {};
    renderKPI('analyticsContentKPI', [
        { icon: 'fas fa-eye', label: 'Album Views', value: _fmtN(ev.album_view || 0), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-user-music', label: 'Artist Views', value: _fmtN(ev.artist_view || 0), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-film', label: 'Movie Views', value: _fmtN(ev.movie_view || 0), color: 'rgba(245,158,11,0.15)' },
        { icon: 'fas fa-list-ul', label: 'Playlist Plays', value: _fmtN(ev.playlist_play || 0), color: 'rgba(167,139,250,0.15)' },
        { icon: 'fas fa-newspaper', label: 'Content Clicks', value: _fmtN(ev.content_click || 0), color: 'rgba(244,114,182,0.15)' }
    ]);
    const ct = [{ label: 'Albums', count: ev.album_view || 0 }, { label: 'Artists', count: ev.artist_view || 0 }, { label: 'Movies', count: ev.movie_view || 0 }, { label: 'Playlists', count: ev.playlist_play || 0 }, { label: 'Content', count: ev.content_click || 0 }];
    drawBarChart('analyticsContentViewChart', ct.map(c => c.label), ct.map(c => c.count), '#60a5fa');
    document.getElementById('analyticsTopContent').innerHTML = rankTable(ct.sort((a, b) => b.count - a.count), [
        { l: '#', r: (_, i) => i + 1 }, { l: 'Type', r: c => c.label }, { l: 'Views', r: c => _fmtN(c.count) }
    ]);
}

/* ---- Player ---- */
function renderPlayerTab(d) {
    const p = d.players || {};
    renderKPI('analyticsPlayerKPI', [
        { icon: 'fas fa-play', label: 'Play/Pause', value: _fmtN(p.playPause || 0), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-forward', label: 'Next', value: _fmtN(p.next || 0), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-backward', label: 'Previous', value: _fmtN(p.prev || 0), color: 'rgba(245,158,11,0.15)' },
        { icon: 'fas fa-search-plus', label: 'Seeks', value: _fmtN(p.seek || 0), color: 'rgba(167,139,250,0.15)' },
        { icon: 'fas fa-music', label: 'Lyrics Opened', value: _fmtN(p.lyricsOpen || 0), color: 'rgba(244,114,182,0.15)' },
        { icon: 'fas fa-list', label: 'Queue Opens', value: _fmtN(p.queueOpen || 0), color: 'rgba(56,189,248,0.15)' },
        { icon: 'fas fa-volume-up', label: 'Volume Changes', value: _fmtN(p.volumeChange || 0), color: 'rgba(251,146,60,0.15)' },
        { icon: 'fas fa-window-restore', label: 'Mini Player Opens', value: _fmtN(p.miniOpen || 0), color: 'rgba(52,211,153,0.15)' }
    ]);
    drawBarChart('analyticsPlayerChart', ['Play/Pause', 'Next', 'Prev', 'Seek', 'Lyrics', 'Queue', 'Volume'], [p.playPause || 0, p.next || 0, p.prev || 0, p.seek || 0, p.lyricsOpen || 0, p.queueOpen || 0, p.volumeChange || 0], '#34d399');
    drawPieChart('analyticsMiniPlayerChart', ['Open', 'Close', 'Minimize'], [p.miniOpen || 0, p.miniClose || 0, p.miniMinimize || 0], ['#34d399', '#ef4444', '#f59e0b']);
}

/* ---- Search ---- */
function renderSearchTab(d) {
    const s = d.searches || {};
    const total = s.total || 0; const noRes = s.noResults || 0;
    const rate = total > 0 ? Math.round((1 - noRes / total) * 100) : 0;
    const clickTotal = Object.values(s.clicks || {}).reduce((a, b) => a + b, 0);
    renderKPI('analyticsSearchKPI', [
        { icon: 'fas fa-search', label: 'Total Searches', value: _fmtN(total), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-times-circle', label: 'No Results', value: _fmtN(noRes), color: 'rgba(239,68,68,0.15)' },
        { icon: 'fas fa-percentage', label: 'Success Rate', value: rate + '%', color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-mouse-pointer', label: 'Result Clicks', value: _fmtN(clickTotal), color: 'rgba(245,158,11,0.15)' }
    ]);
    const topSearches = Object.entries(s.keywords || {}).sort((a, b) => b[1] - a[1]).slice(0, 15);
    document.getElementById('analyticsTopSearches').innerHTML = rankTable(topSearches.map(([q, c]) => ({ q, c })), [
        { l: '#', r: (_, i) => i + 1 }, { l: 'Keyword', r: it => it.q }, { l: 'Count', r: it => it.c }
    ]);
    drawBarChart('analyticsSearchChart', ['Total', 'No Results', 'Clicks'], [total, noRes, clickTotal], ['#34d399', '#ef4444', '#60a5fa']);
}

/* ---- Sections ---- */
function renderSectionsTab(d) {
    const secs = d.sections || {};
    const totalViews = Object.values(secs).reduce((a, s) => a + (s.views || 0), 0);
    const totalTime = Object.values(secs).reduce((a, s) => a + (s.time || 0), 0);
    renderKPI('analyticsSectionKPI', [
        { icon: 'fas fa-th-large', label: 'Sections Tracked', value: _fmtN(Object.keys(secs).length), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-eye', label: 'Total Views', value: _fmtN(totalViews), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-clock', label: 'Total Time', value: _fmtDur(totalTime), color: 'rgba(245,158,11,0.15)' }
    ]);
    const sorted = Object.entries(secs).sort((a, b) => (b[1].views || 0) - (a[1].views || 0));
    drawBarChart('analyticsSectionChart', sorted.map(([k]) => k.substring(0, 12)), sorted.map(([, v]) => v.views || 0), '#a78bfa');
    drawBarChart('analyticsSectionTimeChart', sorted.map(([k]) => k.substring(0, 12)), sorted.map(([, v]) => Math.round((v.time || 0) / 1000)), '#f59e0b');
}

/* ---- Flow ---- */
function renderFlowTab(d) {
    const flow = d.flow || {};
    const total = Object.values(flow).reduce((a, b) => a + b, 0);
    const topFlow = Object.entries(flow).sort((a, b) => b[1] - a[1]);
    renderKPI('analyticsFlowKPI', [
        { icon: 'fas fa-project-diagram', label: 'Transitions', value: _fmtN(total), color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-route', label: 'Unique Paths', value: _fmtN(Object.keys(flow).length), color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-arrow-right', label: 'Top Path', value: topFlow[0] ? topFlow[0][0].substring(0, 30) : '-', color: 'rgba(245,158,11,0.15)' }
    ]);
    const diagram = document.getElementById('analyticsFlowDiagram');
    if (diagram) {
        diagram.innerHTML = '<div class="flow-list">' + topFlow.slice(0, 25).map(([path, count]) => {
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return '<div class="flow-item"><div class="flow-path">' + path + '</div><div class="flow-bar-wrap"><div class="flow-bar" style="width:' + pct + '%"></div></div><div class="flow-count">' + count + ' (' + pct + '%)</div></div>';
        }).join('') + '</div>';
    }
    document.getElementById('analyticsTopFlows').innerHTML = rankTable(topFlow.slice(0, 15).map(([p, c]) => ({ p, c, pct: total > 0 ? Math.round(c / total * 100) : 0 })), [
        { l: '#', r: (_, i) => i + 1 }, { l: 'Path', r: it => it.p }, { l: 'Count', r: it => it.c }, { l: '%', r: it => it.pct + '%' }
    ]);
}

/* ---- Real-Time ---- */
let _rtInterval = null;
async function loadRealtimeData() {
    const rt = await fetchAnalyticsRealtime();
    renderKPI('analyticsRealtimeKPI', [
        { icon: 'fas fa-circle', label: 'Active Users Now', value: rt.activeUsers || 0, color: 'rgba(52,211,153,0.15)' },
        { icon: 'fas fa-music', label: 'Songs Playing', value: (rt.songs || []).length, color: 'rgba(96,165,250,0.15)' },
        { icon: 'fas fa-broadcast-tower', label: 'FM Playing', value: (rt.fms || []).length, color: 'rgba(245,158,11,0.15)' }
    ]);
    const activeEl = document.getElementById('analyticsActiveUsers');
    if (activeEl) {
        activeEl.innerHTML = (rt.activeUsers || 0) === 0 ? '<div class="analytics-empty">No active users right now</div>' : '<div class="rt-active-count"><span class="rt-pulse"></span> ' + rt.activeUsers + ' user(s) online</div>';
    }
    const npEl = document.getElementById('analyticsNowPlaying');
    if (npEl) {
        const songs = (rt.songs || []).map(s => '<div class="rt-item"><i class="fas fa-music" style="color:#34d399"></i> ' + (s.title || s.id) + '</div>');
        const fms = (rt.fms || []).map(f => '<div class="rt-item"><i class="fas fa-broadcast-tower" style="color:#f59e0b"></i> ' + (f.name || f.id) + '</div>');
        npEl.innerHTML = songs.concat(fms).join('') || '<div class="analytics-empty">Nothing playing right now</div>';
    }
}

function startRealtimeRefresh() { if (!_rtInterval) _rtInterval = setInterval(loadRealtimeData, 10000); }
function stopRealtimeRefresh() { if (_rtInterval) { clearInterval(_rtInterval); _rtInterval = null; } }

/* ---- Export ---- */
function exportAnalytics() {
    if (!_analyticsData) { showToast('No data to export', 'info'); return; }
    const blob = new Blob([JSON.stringify(_analyticsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tamilai-analytics-' + new Date().toISOString().split('T')[0] + '.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Analytics exported!', 'success');
}

/* ---- Reset ---- */
async function resetAnalytics() {
    if (!confirm('Reset ALL analytics data? This cannot be undone.')) return;
    await fetch(ANALYTICS_API + '/reset', { method: 'POST' });
    showToast('Analytics reset', 'success');
    loadAnalyticsData();
}

/* ---- Analytics Tab Switching ---- */
function initAnalyticsTabs() {
    document.querySelectorAll('.analytics-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.analytics-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const panelId = 'analytics' + this.dataset.atab.charAt(0).toUpperCase() + this.dataset.atab.slice(1);
            const panel = document.getElementById(panelId);
            if (panel) panel.classList.add('active');
            if (this.dataset.atab === 'realtime') startRealtimeRefresh(); else stopRealtimeRefresh();
        });
    });
}
