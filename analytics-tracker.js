/* ============================================
   TamilAI.Stream Analytics Tracker
   Centralized event tracking for all user interactions
   ============================================ */
const AnalyticsTracker = (() => {
    let _events = [];
    let _sessionId = null;
    let _userId = null;
    let _flushTimer = null;
    let _pageLoadTime = Date.now();
    let _lastPage = null;
    let _sectionTimers = {};
    const FLUSH_INTERVAL = 15000;
    const MAX_QUEUE = 50;
    const API_BASE = '/api/analytics';

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

    function _initSession() {
        let sid = sessionStorage.getItem('tamilai_session');
        if (!sid) {
            sid = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            sessionStorage.setItem('tamilai_session', sid);
        }
        _sessionId = sid;
        try {
            const uid = localStorage.getItem('tamilai_user_id');
            if (uid) _userId = uid;
        } catch (e) {}
    }

    function _buildPayload(eventType, data) {
        return {
            event: eventType,
            ts: Date.now(),
            sid: _sessionId,
            uid: _userId,
            device: _getDevice(),
            platform: _getPlatform(),
            page: window.location.pathname,
            ...data
        };
    }

    function _enqueue(payload) {
        _events.push(payload);
        if (_events.length >= MAX_QUEUE) _flush();
    }

    async function _flush() {
        if (_events.length === 0) return;
        const batch = _events.splice(0, _events.length);
        try {
            await fetch(API_BASE + '/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: batch })
            });
        } catch (e) {
            // Re-queue on failure (up to a limit)
            if (_events.length < 200) _events = batch.concat(_events);
        }
    }

    function _startAutoFlush() {
        if (_flushTimer) return;
        _flushTimer = setInterval(() => { if (!document.hidden) _flush(); }, FLUSH_INTERVAL);
        window.addEventListener('beforeunload', () => _flush());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') _flush();
        });
    }

    // Public API
    function init() {
        _initSession();
        _startAutoFlush();
        track('session_start', { referrer: document.referrer });
    }

    function setUserId(uid) { _userId = uid; }

    function track(eventType, data = {}) {
        _enqueue(_buildPayload(eventType, data));
    }

    function trackPageView(page) {
        if (_lastPage === page) return;
        const prev = _lastPage;
        _lastPage = page;
        track('page_view', { page, prev });
    }

    function trackSectionView(section) {
        const now = Date.now();
        if (_sectionTimers[section]) {
            const spent = now - _sectionTimers[section];
            track('section_time', { section, duration: spent });
        }
        _sectionTimers[section] = now;
        track('section_view', { section });
    }

    function trackSongPlay(song) {
        track('song_play', {
            contentId: song.id || song.title,
            title: song.title,
            artist: song.artist || '',
            movie: song.movie || ''
        });
    }

    function trackSongEvent(eventType, song, extra = {}) {
        track(eventType, {
            contentId: song?.id || song?.title || '',
            title: song?.title || '',
            ...extra
        });
    }

    function trackFMPlay(station) {
        track('fm_play', {
            contentId: station?.id || station?.name || '',
            name: station?.name || ''
        });
    }

    function trackSearch(query, resultCount) {
        track('search', { query, resultCount });
    }

    function trackContent(type, action, data = {}) {
        track(type + '_' + action, data);
    }

    function flush() { _flush(); }

    return {
        init, setUserId, track, trackPageView, trackSectionView,
        trackSongPlay, trackSongEvent, trackFMPlay, trackSearch,
        trackContent, flush
    };
})();

if (typeof window !== 'undefined') window.AnalyticsTracker = AnalyticsTracker;
