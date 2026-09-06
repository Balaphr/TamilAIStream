/* ============================================
   Performance & Usage Analytics Collector
   Lightweight background metrics collection
   ============================================ */
const PerfAnalytics = (() => {
    const STORAGE_KEY = 'tamilAIStream_perfMetrics';
    const FLUSH_INTERVAL = 120000; // 2 minutes
    const MAX_SESSIONS = 200;
    const MAX_EVENTS = 500;
    const SAMPLE_INTERVAL = 300000; // 5 min battery/network sampling
    let _audioEl = null;
    let _sessionStart = Date.now();
    let _flushTimer = null;
    let _sampleTimer = null;
    let _currentSong = null;
    let _songStartTs = 0;
    let _bufferStartTs = 0;
    let _buffering = false;
    let _apiCounts = {};

    function _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return { sessions: [], battery: [], network: [], buffering: [], errors: [], api: { total: 0, repeated: 0, endpoints: {} }, perf: [], dataPerSong: {} };
    }

    function _save(data) {
        try {
            if (data.sessions.length > MAX_SESSIONS) data.sessions = data.sessions.slice(-MAX_SESSIONS);
            if (data.battery.length > 60) data.battery = data.battery.slice(-60);
            if (data.network.length > 60) data.network = data.network.slice(-60);
            if (data.buffering.length > MAX_EVENTS) data.buffering = data.buffering.slice(-MAX_EVENTS);
            if (data.errors.length > MAX_EVENTS) data.errors = data.errors.slice(-MAX_EVENTS);
            if (data.perf.length > 60) data.perf = data.perf.slice(-60);
            const keys = Object.keys(data.api.endpoints);
            if (keys.length > 100) {
                const sorted = keys.sort((a, b) => data.api.endpoints[a].count - data.api.endpoints[b].count);
                sorted.slice(0, 50).forEach(k => delete data.api.endpoints[k]);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function _sampleBattery() {
        if (!navigator.getBattery) return;
        navigator.getBattery().then(bat => {
            const data = _load();
            data.battery.push({ level: Math.round(bat.level * 100), charging: bat.charging, ts: Date.now() });
            _save(data);
        }).catch(() => {});
    }

    function _sampleNetwork() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!conn) return;
        const data = _load();
        data.network.push({
            downlink: conn.downlink || 0,
            effectiveType: conn.effectiveType || 'unknown',
            saveData: conn.saveData || false,
            ts: Date.now()
        });
        _save(data);
    }

    function _samplePerformance() {
        if (!performance.memory) return;
        const data = _load();
        data.perf.push({
            heapUsed: Math.round(performance.memory.usedJSHeapSize / 1048576),
            heapTotal: Math.round(performance.memory.totalJSHeapSize / 1048576),
            ts: Date.now()
        });
        _save(data);
    }

    function _startSampling() {
        _sampleBattery();
        _sampleNetwork();
        _samplePerformance();
        _sampleTimer = setInterval(() => {
            if (!document.hidden) {
                _sampleBattery();
                _sampleNetwork();
                _samplePerformance();
            }
        }, SAMPLE_INTERVAL);
    }

    function _startAutoFlush() {
        _flushTimer = setInterval(() => {
            if (!document.hidden) _flushSession();
        }, FLUSH_INTERVAL);
        window.addEventListener('beforeunload', () => _flushSession());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') _flushSession();
        });
    }

    function _flushSession() {
        const data = _load();
        const elapsed = Date.now() - _sessionStart;
        if (elapsed > 10000) {
            const existing = data.sessions.find(s => s.id === _sessionId());
            if (!existing) {
                data.sessions.push({
                    id: _sessionId(),
                    start: _sessionStart,
                    end: Date.now(),
                    duration: elapsed,
                    platform: _getPlatform(),
                    device: _getDevice(),
                    browser: _getBrowser(),
                    pages: 0
                });
            } else {
                existing.end = Date.now();
                existing.duration = Date.now() - existing.start;
            }
            _save(data);
        }
    }

    function _sessionId() {
        return sessionStorage.getItem('tamilai_session') || 's_' + _sessionStart;
    }

    function _getDevice() {
        const w = window.innerWidth;
        if (w <= 480) return 'mobile';
        if (w <= 768) return 'tablet';
        return 'desktop';
    }

    function _getPlatform() {
        if (navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) return 'pwa';
        return 'web';
    }

    function _getBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Firefox/')) return 'Firefox';
        if (ua.includes('Edg/')) return 'Edge';
        if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
        if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
        if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
        return 'Other';
    }

    function _trackApiRequest(url, method) {
        const data = _load();
        data.api.total++;
        const endpoint = (url || '').replace(/\?.*$/, '').replace(/^https?:\/\/[^/]+/, '');
        if (!data.api.endpoints[endpoint]) {
            data.api.endpoints[endpoint] = { count: 0, method: method || 'GET', lastSeen: Date.now() };
        }
        data.api.endpoints[endpoint].count++;
        data.api.endpoints[endpoint].lastSeen = Date.now();
        if (data.api.endpoints[endpoint].count > 10) data.api.repeated++;
        _save(data);
    }

    function _hookFetch() {
        if (window._perfFetchHooked) return;
        window._perfFetchHooked = true;
        const origFetch = window.fetch;
        window.fetch = function () {
            const url = typeof arguments[0] === 'string' ? arguments[0] : arguments[0]?.url || '';
            const method = arguments[1]?.method || 'GET';
            _trackApiRequest(url, method);
            return origFetch.apply(this, arguments);
        };
    }

    function _hookXHR() {
        if (window._perfXhrHooked) return;
        window._perfXhrHooked = true;
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            _trackApiRequest(url, method);
            return origOpen.apply(this, arguments);
        };
    }

    function _hookAudio() {
        const findAudio = () => {
            const audio = document.querySelector('audio');
            if (audio && audio !== _audioEl) {
                _audioEl = audio;
                audio.addEventListener('playing', () => {
                    if (_currentSong) {
                        const data = _load();
                        const sid = _currentSong.id || _currentSong.title || 'unknown';
                        if (!data.dataPerSong[sid]) data.dataPerSong[sid] = { plays: 0, duration: 0, skips: 0, errors: 0, buffering: 0, title: _currentSong.title || sid };
                        data.dataPerSong[sid].plays++;
                        _save(data);
                    }
                    _songStartTs = Date.now();
                    if (_buffering) {
                        _buffering = false;
                        const bufDur = Date.now() - _bufferStartTs;
                        if (bufDur > 500 && _currentSong) {
                            const data = _load();
                            const sid = _currentSong.id || _currentSong.title || 'unknown';
                            data.buffering.push({ songId: sid, duration: bufDur, ts: Date.now() });
                            if (!data.dataPerSong[sid]) data.dataPerSong[sid] = { plays: 0, duration: 0, skips: 0, errors: 0, buffering: 0, title: _currentSong.title || sid };
                            data.dataPerSong[sid].buffering += bufDur;
                            _save(data);
                        }
                    }
                });
                audio.addEventListener('pause', () => {
                    if (_currentSong && _songStartTs) {
                        const dur = Date.now() - _songStartTs;
                        if (dur > 3000) {
                            const data = _load();
                            const sid = _currentSong.id || _currentSong.title || 'unknown';
                            if (!data.dataPerSong[sid]) data.dataPerSong[sid] = { plays: 0, duration: 0, skips: 0, errors: 0, buffering: 0, title: _currentSong.title || sid };
                            data.dataPerSong[sid].duration += dur;
                            if (dur < 10000) data.dataPerSong[sid].skips++;
                            _save(data);
                        }
                        _songStartTs = 0;
                    }
                });
                audio.addEventListener('ended', () => {
                    if (_currentSong && _songStartTs) {
                        const dur = Date.now() - _songStartTs;
                        const data = _load();
                        const sid = _currentSong.id || _currentSong.title || 'unknown';
                        if (!data.dataPerSong[sid]) data.dataPerSong[sid] = { plays: 0, duration: 0, skips: 0, errors: 0, buffering: 0, title: _currentSong.title || sid };
                        data.dataPerSong[sid].duration += dur;
                        _save(data);
                        _songStartTs = 0;
                    }
                });
                audio.addEventListener('waiting', () => {
                    if (!_buffering) { _buffering = true; _bufferStartTs = Date.now(); }
                });
                audio.addEventListener('error', () => {
                    if (_currentSong) {
                        const data = _load();
                        const sid = _currentSong.id || _currentSong.title || 'unknown';
                        const errCode = _audioEl?.error?.code || 0;
                        data.errors.push({ songId: sid, code: errCode, ts: Date.now() });
                        if (!data.dataPerSong[sid]) data.dataPerSong[sid] = { plays: 0, duration: 0, skips: 0, errors: 0, buffering: 0, title: _currentSong.title || sid };
                        data.dataPerSong[sid].errors++;
                        _save(data);
                    }
                });
            }
        };
        findAudio();
        setInterval(findAudio, 3000);
    }

    function init() {
        _sessionStart = Date.now();
        _startSampling();
        _startAutoFlush();
        _hookFetch();
        _hookXHR();
        setTimeout(_hookAudio, 2000);
    }

    function setCurrentSong(song) {
        _currentSong = song;
        _songStartTs = Date.now();
    }

    function clearCurrentSong() { _currentSong = null; _songStartTs = 0; }

    function getData() { return _load(); }

    function getAggregated() {
        const d = _load();
        const now = Date.now();
        const DAY = 86400000;
        const sessions7d = d.sessions.filter(s => s.end > now - 7 * DAY);
        const sessions30d = d.sessions.filter(s => s.end > now - 30 * DAY);
        const totalDuration = sessions7d.reduce((a, s) => a + (s.duration || 0), 0);
        const avgSession = sessions7d.length ? Math.round(totalDuration / sessions7d.length) : 0;
        const platformCounts = {};
        const deviceCounts = {};
        const browserCounts = {};
        sessions30d.forEach(s => {
            platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
            deviceCounts[s.device] = (deviceCounts[s.device] || 0) + 1;
            browserCounts[s.browser] = (browserCounts[s.browser] || 0) + 1;
        });
        const dailySessions = {};
        sessions30d.forEach(s => {
            const day = new Date(s.end).toLocaleDateString();
            if (!dailySessions[day]) dailySessions[day] = { sessions: 0, duration: 0 };
            dailySessions[day].sessions++;
            dailySessions[day].duration += s.duration || 0;
        });
        const songs = Object.entries(d.dataPerSong).map(([id, v]) => ({
            id, title: v.title || id, plays: v.plays || 0, duration: v.duration || 0,
            skips: v.skips || 0, errors: v.errors || 0, buffering: v.buffering || 0
        })).sort((a, b) => b.plays - a.plays);
        const totalPlays = songs.reduce((a, s) => a + s.plays, 0);
        const totalListenTime = songs.reduce((a, s) => a + s.duration, 0);
        const totalSkips = songs.reduce((a, s) => a + s.skips, 0);
        const totalErrors = d.errors.length;
        const totalBuffering = d.buffering.reduce((a, b) => a + (b.duration || 0), 0);
        const latestBattery = d.battery.length ? d.battery[d.battery.length - 1] : null;
        const batteryDrain = d.battery.length >= 2 ?
            Math.max(0, d.battery[0].level - d.battery[d.battery.length - 1].level) : 0;
        const latestNetwork = d.network.length ? d.network[d.network.length - 1] : null;
        const latestPerf = d.perf.length ? d.perf[d.perf.length - 1] : null;
        const topEndpoints = Object.entries(d.api.endpoints)
            .sort((a, b) => b[1].count - a[1].count).slice(0, 20);
        const dailyErrors = {};
        d.errors.forEach(e => {
            const day = new Date(e.ts).toLocaleDateString();
            dailyErrors[day] = (dailyErrors[day] || 0) + 1;
        });
        return {
            summary: {
                totalSessions: sessions30d.length,
                totalDuration,
                avgSession,
                totalPlays,
                totalListenTime,
                totalSkips,
                totalErrors,
                totalBuffering,
                batteryLevel: latestBattery?.level ?? null,
                batteryCharging: latestBattery?.charging ?? null,
                batteryDrain,
                networkSpeed: latestNetwork?.downlink ?? null,
                networkType: latestNetwork?.effectiveType ?? 'unknown',
                memoryUsed: latestPerf?.heapUsed ?? null,
                memoryTotal: latestPerf?.heapTotal ?? null,
                apiRequests: d.api.total,
                repeatedRequests: d.api.repeated
            },
            songs,
            platformCounts,
            deviceCounts,
            browserCounts,
            dailySessions,
            topEndpoints,
            dailyErrors,
            batteryHistory: d.battery.slice(-30),
            networkHistory: d.network.slice(-30),
            perfHistory: d.perf.slice(-30),
            recentErrors: d.errors.slice(-20),
            recentBuffering: d.buffering.slice(-20)
        };
    }

    return { init, setCurrentSong, clearCurrentSong, getData, getAggregated };
})();

if (typeof window !== 'undefined') window.PerfAnalytics = PerfAnalytics;
