/* ============================================================
   ULTRA PERF JS — Performance Helpers
   Passive listeners, RAF optimization, debounce, throttle
   ============================================================ */
'use strict';

window.UltraPerf = (function() {
    const doc = document;
    const win = window;

    // Check if tab is visible
    function isTabVisible() {
        return !doc.hidden;
    }

    // Passive event listener support
    let _passiveSupported = false;
    try {
        const opts = Object.defineProperty({}, 'passive', {
            get: function() { _passiveSupported = true; return true; }
        });
        win.addEventListener('testPassive', null, opts);
        win.removeEventListener('testPassive', null, opts);
    } catch(e) {}

    // Safe addEventListener with passive by default
    function addPassive(el, event, handler, options) {
        if (options === undefined) options = {};
        if (_passiveSupported && options.passive === undefined) {
            // scroll/touchmove/touchstart default to passive
            if (['scroll', 'touchstart', 'touchmove', 'wheel'].indexOf(event) !== -1) {
                options.passive = true;
            }
        }
        el.addEventListener(event, handler, options);
        return function() { el.removeEventListener(event, handler, options); };
    }

    // RAF that pauses when tab hidden
    function createVisibleRAF(callback) {
        let rafId = null;
        let running = false;

        function tick() {
            if (!running) return;
            if (!doc.hidden) {
                callback();
            }
            rafId = requestAnimationFrame(tick);
        }

        return {
            start: function() {
                if (running) return;
                running = true;
                rafId = requestAnimationFrame(tick);
            },
            stop: function() {
                running = false;
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
            },
            isRunning: function() { return running; }
        };
    }

    // Debounce
    function debounce(fn, delay) {
        let timer = null;
        return function() {
            const ctx = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
        };
    }

    // Throttle (requestAnimationFrame-based for scroll/resize)
    function throttleRAF(fn) {
        let ticking = false;
        return function() {
            const ctx = this, args = arguments;
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(function() {
                    fn.apply(ctx, args);
                    ticking = false;
                });
            }
        };
    }

    // Throttle (time-based)
    function throttle(fn, limit) {
        let inThrottle = false;
        let lastArgs = null;
        let lastCtx = null;
        return function() {
            if (!inThrottle) {
                fn.apply(this, arguments);
                inThrottle = true;
                setTimeout(function() {
                    inThrottle = false;
                    if (lastArgs) {
                        fn.apply(lastCtx, lastArgs);
                        lastArgs = null;
                        lastCtx = null;
                    }
                }, limit);
            } else {
                lastArgs = arguments;
                lastCtx = this;
            }
        };
    }

    // Pause all RAF loops when tab hidden
    const _rafLoops = [];
    let _hiddenListenersSetup = false;

    function registerRAFLoop(loop) {
        _rafLoops.push(loop);
        if (!_hiddenListenersSetup) {
            _hiddenListenersSetup = true;
            doc.addEventListener('visibilitychange', function() {
                _rafLoops.forEach(function(loop) {
                    if (doc.hidden && loop.pause) loop.pause();
                    else if (!doc.hidden && loop.resume) loop.resume();
                });
            });
        }
    }

    // IntersectionObserver lazy loading
    function lazyLoad(selector, options) {
        const defaults = { root: null, rootMargin: '100px', threshold: 0.1 };
        const opts = Object.assign({}, defaults, options || {});

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    if (entry.target.dataset.src) {
                        entry.target.src = entry.target.dataset.src;
                        entry.target.removeAttribute('data-src');
                    }
                    if (entry.target.dataset.bg) {
                        entry.target.style.backgroundImage = 'url(' + entry.target.dataset.bg + ')';
                        entry.target.removeAttribute('data-bg');
                    }
                    observer.unobserve(entry.target);
                }
            });
        }, opts);

        doc.querySelectorAll(selector).forEach(function(el) {
            observer.observe(el);
        });

        return observer;
    }

    // Image lazy loading with IntersectionObserver
    function lazyLoadImages() {
        const images = doc.querySelectorAll('img[data-src]');
        if (!images.length) return;

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
                    img.removeAttribute('data-src');
                    img.removeAttribute('data-srcset');
                    observer.unobserve(img);
                }
            });
        }, { rootMargin: '200px' });

        images.forEach(function(img) { observer.observe(img); });
    }

    // Preload critical resources
    function preloadImage(url) {
        const img = new Image();
        img.src = url;
    }

    function preloadCSS(url) {
        const link = doc.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = url;
        doc.head.appendChild(link);
    }

    // Reduce layout thrashing — batch DOM reads then writes
    function batchDOM(callback) {
        // Read phase
        const reads = [];
        const writes = [];

        const api = {
            read: function(fn) { reads.push(fn); return api; },
            write: function(fn) { writes.push(fn); return api; },
            execute: function() {
                // Execute all reads first
                const readResults = reads.map(function(fn) { return fn(); });
                // Then all writes
                writes.forEach(function(fn, i) { fn(readResults[i]); });
                return readResults;
            }
        };

        if (callback) {
            callback(api);
            return api.execute();
        }
        return api;
    }

    return {
        isTabVisible: isTabVisible,
        addPassive: addPassive,
        createVisibleRAF: createVisibleRAF,
        debounce: debounce,
        throttleRAF: throttleRAF,
        throttle: throttle,
        registerRAFLoop: registerRAFLoop,
        lazyLoad: lazyLoad,
        lazyLoadImages: lazyLoadImages,
        preloadImage: preloadImage,
        preloadCSS: preloadCSS,
        batchDOM: batchDOM
    };
})();
