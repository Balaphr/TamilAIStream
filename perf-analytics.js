/* ============================================
   Performance & Usage Analytics Collector
   Sends metrics via existing AnalyticsTracker pipeline
   ============================================ */
const PerfAnalytics = (() => {
    const SAMPLE_INTERVAL = 300000;
    const FLUSH_INTERVAL = 120000;
    const API_STATS_KEY = 'tamilAIStream_apiStats';
    let _sessionStart = Date.now();
    let _flushTimer = null;
    let _sampleTimer = null;
    let _currentSong = null;
    let _songStartTs = 0;
    let _bufferStartTs = 0;
    let _buffering = false;

    function _getBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Firefox/')) return 'Firefox';
        if (ua.includes('Edg/')) return 'Edge';
        if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
        if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
        if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
        return 'Other';
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

    function _track(eventType, data) {
        if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track(eventType, data);
    }

    function _sampleBattery() {
        if (!navigator.getBattery) return;
        navigator.getBattery().then(bat => {
            _track('perf_battery', { level: Math.round(bat.level * 100), charging: bat.charging });
        }).catch(() => {});
    }

    function _sampleNetwork() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!conn) return;
        _track('perf_network', { downlink: conn.downlink || 0, effectiveType: conn.effectiveType || 'unknown' });
    }

    function _sampleMemory() {
        if (!performance.memory) return;
        _track('perf_memory', {
            heapUsed: Math.round(performance.memory.usedJSHeapSize / 1048576),
            heapTotal: Math.round(performance.memory.totalJSHeapSize / 1048576)
        });
    }

    function _flushApiStats() {
        try {
            const raw = localStorage.getItem(API_STATS_KEY);
            if (!raw) return;
            const stats = JSON.parse(raw);
            if (stats.total > 0) {
                _track('perf_api', { total: stats.total, repeated: stats.repeated || 0, endpoints: stats.endpoints || {} });
                localStorage.setItem(API_STATS_KEY, JSON.stringify({ total: 0, repeated: 0, endpoints: {} }));
            }
        } catch (e) {}
    }

    function _flushSongStats() {
        if (!_currentSong || !_songStartTs) return;
        const dur = Date.now() - _songStartTs;
        if (dur > 2000) {
            const sid = _currentSong.id || _currentSong.title || 'unknown';
            _track('perf_song_stats', {
                songId: sid, title: _currentSong.title || '',
                plays: 1, duration: dur, skips: 0, errors: 0, buffering: 0
            });
        }
    }

    function _startSampling() {
        _sampleBattery();
        _sampleNetwork();
        _sampleMemory();
        _sampleTimer = setInterval(() => {
            if (!document.hidden) {
                _sampleBattery();
                _sampleNetwork();
                _sampleMemory();
                _flushApiStats();
                _flushSongStats();
            }
        }, SAMPLE_INTERVAL);
    }

    function _startAutoFlush() {
        _flushTimer = setInterval(() => {
            if (!document.hidden) { _flushApiStats(); _flushSongStats(); }
        }, FLUSH_INTERVAL);
        window.addEventListener('beforeunload', () => {
            _flushApiStats();
            _flushSongStats();
            const dur = Date.now() - _sessionStart;
            if (dur > 5000) {
                _track('session_end', {
                    duration: dur,
                    browser: _getBrowser(),
                    platform: _getPlatform(),
                    device: _getDevice()
                });
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') { _flushApiStats(); _flushSongStats(); }
        });
    }

    function _hookFetch() {
        if (window._perfFetchHooked) return;
        window._perfFetchHooked = true;
        const origFetch = window.fetch;
        window.fetch = function () {
            const url = typeof arguments[0] === 'string' ? arguments[0] : arguments[0]?.url || '';
            const method = arguments[1]?.method || 'GET';
            _incrementApiStats(url, method);
            return origFetch.apply(this, arguments);
        };
    }

    function _hookXHR() {
        if (window._perfXhrHooked) return;
        window._perfXhrHooked = true;
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            _incrementApiStats(url, method);
            return origOpen.apply(this, arguments);
        };
    }

    function _incrementApiStats(url, method) {
        try {
            const raw = localStorage.getItem(API_STATS_KEY);
            const stats = raw ? JSON.parse(raw) : { total: 0, repeated: 0, endpoints: {} };
            stats.total++;
            const endpoint = (url || '').replace(/\?.*$/, '').replace(/^https?:\/\/[^/]+/, '');
            if (!stats.endpoints[endpoint]) stats.endpoints[endpoint] = { count: 0, method: method || 'GET', lastSeen: Date.now() };
            stats.endpoints[endpoint].count++;
            stats.endpoints[endpoint].lastSeen = Date.now();
            if (stats.endpoints[endpoint].count > 10) stats.repeated++;
            localStorage.setItem(API_STATS_KEY, JSON.stringify(stats));
        } catch (e) {}
    }

    function _hookAudio() {
        const attachListeners = (audio) => {
            if (!audio || audio._perfHooked) return;
            audio._perfHooked = true;
            audio.addEventListener('playing', () => {
                _buffering = false;
            }, { once: false });
            audio.addEventListener('waiting', () => {
                if (!_buffering) { _buffering = true; _bufferStartTs = Date.now(); }
            }, { once: false });
            audio.addEventListener('error', () => {
                if (_currentSong) {
                    const sid = _currentSong.id || _currentSong.title || 'unknown';
                    const code = audio?.error?.code || 0;
                    _track('perf_error', { songId: sid, code });
                }
            }, { once: false });
            audio.addEventListener('ended', () => {
                if (_currentSong && _songStartTs) {
                    const dur = Date.now() - _songStartTs;
                    _track('perf_song_stats', {
                        songId: _currentSong.id || _currentSong.title || 'unknown',
                        title: _currentSong.title || '',
                        plays: 0, duration: dur, skips: 0, errors: 0, buffering: 0
                    });
                    _songStartTs = 0;
                }
            }, { once: false });
            audio.addEventListener('pause', () => {
                if (_currentSong && _songStartTs) {
                    const dur = Date.now() - _songStartTs;
                    if (dur > 3000 && dur < 10000) {
                        _track('perf_song_stats', {
                            songId: _currentSong.id || _currentSong.title || 'unknown',
                            title: _currentSong.title || '',
                            plays: 0, duration: 0, skips: 1, errors: 0, buffering: 0
                        });
                    }
                    _songStartTs = 0;
                }
            }, { once: false });
        };
        const audio = document.querySelector('audio');
        if (audio) {
            attachListeners(audio);
        }
        document.addEventListener('play', (e) => {
            if (e.target && e.target.tagName === 'AUDIO') attachListeners(e.target);
        }, true);
    }

    function _trackSessionStart() {
        _track('session_start', {
            referrer: document.referrer,
            browser: _getBrowser(),
            platform: _getPlatform(),
            device: _getDevice()
        });
    }

    function init() {
        _sessionStart = Date.now();
        if (typeof AnalyticsTracker === 'undefined') return;
        _trackSessionStart();
        _startSampling();
        _startAutoFlush();
        _hookFetch();
        _hookXHR();
        setTimeout(_hookAudio, 2000);
    }

    function setCurrentSong(song) {
        if (_currentSong && _songStartTs) {
            const dur = Date.now() - _songStartTs;
            if (dur > 2000) {
                _track('perf_song_stats', {
                    songId: _currentSong.id || _currentSong.title || 'unknown',
                    title: _currentSong.title || '',
                    plays: 0, duration: dur, skips: 0, errors: 0, buffering: 0
                });
            }
        }
        _currentSong = song;
        _songStartTs = Date.now();
    }

    function clearCurrentSong() {
        if (_currentSong && _songStartTs) {
            const dur = Date.now() - _songStartTs;
            if (dur > 2000) {
                _track('perf_song_stats', {
                    songId: _currentSong.id || _currentSong.title || 'unknown',
                    title: _currentSong.title || '',
                    plays: 0, duration: dur, skips: 0, errors: 0, buffering: 0
                });
            }
        }
        _currentSong = null;
        _songStartTs = 0;
    }

    return { init, setCurrentSong, clearCurrentSong };
})();

if (typeof window !== 'undefined') window.PerfAnalytics = PerfAnalytics;
