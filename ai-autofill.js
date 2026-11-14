/* ============================================================
   AI Auto-Fill Bot - Tamil AI Stream Builder companion
   ------------------------------------------------------------
   An in-browser semantic auto-fill engine. It reads the free-form
   metadata an admin pastes, recognises which value belongs to which
   field (English + Tamil labels & synonyms) and fills the matching
   fields for review before the admin hits Save/Publish.

   . No external AI API required - runs fully offline & instantly.
   . Every result is shown in a review panel (per-field Apply/Ignore).
   . All existing manual controls are preserved.
   . Audio duration is ALWAYS read from the actual uploaded audio file
     (HTML media metadata). It is never typed in or AI-guessed.
   ============================================================ */
(function (global) {
    'use strict';

    var AIAutoFill = {};

    // ---- Helpers ----
    function escRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function norm(s) {
        return String(s == null ? '' : s).toLowerCase()
            .replace(/\u200b/g, '')
            .replace(/[*()]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function stripParen(s) {
        return String(s || '').toLowerCase()
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function hasWord(hay, needle) {
        if (!needle) return false;
        hay = String(hay || '').toLowerCase();
        needle = String(needle).toLowerCase().trim();
        if (!needle) return false;
        if (hay === needle) return true;
        if (/[\u0080-\uFFFF]/.test(needle)) return hay.indexOf(needle) !== -1;
        return new RegExp('(?:^|[^a-z0-9])' + escRx(needle) + '(?:$|[^a-z0-9])', 'i').test(hay);
    }

    function formatMMSS(sec) {
        if (!Number.isFinite(sec) || sec <= 0) return null;
        var m = Math.floor(sec / 60);
        var s = Math.round(sec % 60);
        if (s === 60) { m += 1; s = 0; }
        return m + ':' + String(s).padStart(2, '0');
    }

    // ---- Canonical field definitions ----
    var FIELD_DEFS = [
        { key: 'starring', label: ['starring', 'star cast', 'cast', 'actors', 'actress', 'நடித்தவர்கள்', 'நடிகர்', 'நடிகை'], type: 'text' },
        { key: 'singer', label: ['singer(s)', 'singers', 'singer', 'vocal(s)', 'vocals', 'vocalist', 'பாடகர்', 'பாடகி'], type: 'text' },
        { key: 'artist', label: ['artist(s)', 'artists', 'artist', 'ஆர்டிஸ்ட்'], type: 'text' },
        { key: 'movie', label: ['movie', 'film', 'album', 'படம்', 'திரைப்படம்', 'சினிமா'], type: 'text' },
        { key: 'music', label: ['music director', 'composer(s)', 'composer', 'music', 'score', 'இசை அமைப்பாளர்', 'இசை'], type: 'text' },
        { key: 'director', label: ['director(s)', 'director', 'directed by', 'இயக்குநர்', 'இயக்கம்'], type: 'text' },
        { key: 'lyricist', label: ['lyricist(s)', 'lyricist', 'lyrics', 'lyric', 'writer', 'பாடலாசிரியர்', 'வரிகள்'], type: 'text' },
        { key: 'year', label: ['release year', 'year', 'ஆண்டு'], type: 'year' },
        { key: 'language', label: ['language', 'மொழி'], type: 'choice' },
        { key: 'genre', label: ['genre', 'வகை', 'type'], type: 'choice' },
        { key: 'mood', label: ['mood', 'உணர்வு', 'vibe', 'emotion'], type: 'text' },
        { key: 'description', label: ['description', 'about', 'notes', 'summary', 'details', 'விளக்கம்'], type: 'long' },
        { key: 'tags', label: ['tags', 'keywords', 'hashtags', 'டேக்'], type: 'tags' },
        { key: 'subtitle', label: ['subtitle', 'custom subtitle'], type: 'text' },
        { key: 'title', label: ['song title', 'title', 'track', 'heading', 'பாடலின் பெயர்', 'பாடல்'], type: 'text' },
        { key: 'name', label: ['display name', 'name', 'short title'], type: 'text' },
        { key: 'icon', label: ['icon', 'icon class', 'fontawesome'], type: 'text' },
        { key: 'songcount', label: ['song count', 'songs'], type: 'number' },
        { key: 'gradient', label: ['gradient'], type: 'text' },
        { key: 'freq', label: ['frequency', 'freq'], type: 'text' },
        { key: 'city', label: ['city', 'location'], type: 'text' }
    ];

    function fieldDefFromLabel(label) {
        var n = norm(stripParen(label));
        if (!n) return null;
        for (var i = 0; i < FIELD_DEFS.length; i++) {
            var def = FIELD_DEFS[i];
            for (var j = 0; j < def.label.length; j++) {
                var L = def.label[j];
                if (n === L || hasWord(n, L)) return def;
            }
        }
        return null;
    }

    // Reliable text markers for the choice fields (language / genre).
    var KNOWN_OPTIONS = {
        language: ['tamil', 'hindi', 'telugu', 'malayalam', 'kannada', 'english', 'தமிழ்'],
        genre: ['love', 'action', 'comedy', 'emotional', 'devotional', 'romantic', 'sad', 'item', 'melody', 'classical', 'folk', 'philosophical']
    };
    // ---- Enumerate editable fields of a form ----
    function collectFields(form, cfg) {
        var out = [];
        var controls = form.querySelectorAll('input, select, textarea');
        for (var i = 0; i < controls.length; i++) {
            var el = controls[i];
            var t = (el.type || el.tagName).toLowerCase();
            if (t === 'file' || t === 'hidden' || t === 'radio' || t === 'checkbox' ||
                t === 'submit' || t === 'button' || t === 'reset' || t === 'password' || t === 'email') {
                continue;
            }
            var field = { el: el, id: el.id || '', tag: el.tagName.toLowerCase(), type: t, label: getFieldLabel(el) || '', current: el.value };
            if (field.tag === 'select') {
                field.options = Array.prototype.map.call(el.options, function (o) {
                    return { value: o.value, text: o.textContent.trim() };
                });
            }
            out.push(field);
        }
        return out;
    }

    function getFieldLabel(el) {
        if (el.id) {
            var byFor = null;
            try { byFor = document.querySelector('label[for="' + cssEscape(el.id) + '"]'); } catch (e) {}
            if (byFor && byFor.textContent.trim()) return byFor.textContent.trim();
        }
        var group = el.closest ? el.closest('.form-group') : null;
        if (group) {
            var lab = group.querySelector('.form-label');
            if (lab && lab.textContent.trim()) return lab.textContent.trim();
        }
        var wrap = el.closest ? el.closest('label') : null;
        if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
        if (el.getAttribute && el.getAttribute('placeholder')) return el.getAttribute('placeholder');
        return '';
    }

    function cssEscape(s) {
        if (window.CSS && CSS.escape) return CSS.escape(s);
        return String(s).replace(/["\\]/g, '\\$&');
    }

    // ---- Text parsing ----
    function parseFieldValue(field, text, allFields) {
        if (!field || !text) return null;
        var def = fieldDefFromLabel(field.label);
        var value = null;
        var confidence = 0;
        var lines = splitIntoSegments(text);

        var labelHit = matchLabelled(lines, field, def);
        if (labelHit) {
            value = labelHit.value;
            confidence = labelHit.confidence;
        } else if (def && def.type === 'year') {
            var y = text.match(/\b(19|20)\d{2}\b/);
            if (y) { value = y[0]; confidence = 0.7; }
        } else if (def && def.type === 'choice') {
            value = matchChoice(field, text);
            if (value) confidence = 0.7;
        } else if (def && def.type === 'tags') {
            value = extractTags(lines, text);
            if (value) confidence = 0.6;
        } else if (def && def.type === 'number') {
            var m = text.match(/\b\d{1,4}\b/);
            if (m) { value = m[0]; confidence = 0.5; }
        }

        if (value == null || String(value).trim() === '') return null;

        return {
            field: field,
            key: def ? def.key : (field.id || field.label),
            label: field.label || field.id,
            value: String(value).trim(),
            confidence: confidence
        };
    }

    function splitIntoSegments(text) {
        return String(text || '').split(/\r?\n|;|\r/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    function matchLabelled(lines, field, def) {
        var phrases = [];
        if (def) phrases = def.label.slice();
        if (field.label) phrases.unshift(norm(field.label));
        var normed = phrases.map(norm).filter(Boolean);
        var best = null;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var ci = line.indexOf(':');
            if (ci === -1) ci = line.indexOf('=');
            if (ci === -1) continue;
            var left = norm(line.slice(0, ci));
            var right = line.slice(ci + 1).trim();
            if (!right) continue;
            var hit = false;
            for (var j = 0; j < normed.length; j++) {
                if (left === normed[j] || (left && normed[j] && normed[j].length > 2 && left.indexOf(normed[j]) !== -1)) {
                    hit = true;
                    break;
                }
            }
            if (!hit && def && left === def.key) hit = true;
            if (hit) return { value: right, confidence: 0.95 };
            if (!best && def) {
                for (var k = 0; k < normed.length; k++) {
                    if (left && hasWord(left, normed[k])) { best = { value: right, confidence: 0.6 }; break; }
                }
            }
        }
        return best;
    }

    function matchChoice(field, text) {
        var optionSet = field.options || [];
        function pick(list) {
            for (var i = 0; i < list.length; i++) {
                var val = list[i].value, txt = list[i].text;
                if (val && hasWord(text, val)) return val;
                if (txt && txt !== val && hasWord(text, txt)) return val;
            }
            return null;
        }
        var v = optionSet.length ? pick(optionSet) : null;
        if (v) return v;
        var def = fieldDefFromLabel(field.label);
        if (def && KNOWN_OPTIONS[def.key]) {
            for (var i = 0; i < KNOWN_OPTIONS[def.key].length; i++) {
                var kw = KNOWN_OPTIONS[def.key][i];
                if (hasWord(text, kw)) {
                    var map = { 'தமிழ்': 'Tamil' };
                    return map[kw] || kw;
                }
            }
        }
        return null;
    }

    function extractTags(lines, text) {
        for (var i = 0; i < lines.length; i++) {
            var ci = Math.max(lines[i].indexOf(':'), lines[i].indexOf('='));
            if (ci !== -1 && /tag|keyword|டேக்/i.test(lines[i].slice(0, ci))) {
                return lines[i].slice(ci + 1).trim();
            }
        }
        var tags = String(text).split(/[,#\s]+/).map(function (t) { return t.trim(); }).filter(Boolean);
        return tags.length ? tags.join(', ') : null;
    }

    function isSkippable(f) {
        return !!f && (f.tag === 'select' ||
            (f.el && f.el.getAttribute && f.el.getAttribute('type') === 'file'));
    }

    function fieldKey(f) {
        var def = f && fieldDefFromLabel(f.label);
        return def ? def.key : ((f && f.id) || (f && f.label)) || '';
    }

    function positionalGuess(fields, text) {
        var tokens = String(text).split(/\s*(?:\r?\n|\||;|,)\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
        var suggestions = [];
        var idx = 0;
        for (var i = 0; i < fields.length && idx < tokens.length; i++) {
            var f = fields[i];
            if (isSkippable(f)) continue;
            var def = fieldDefFromLabel(f.label);
            if (def && (def.type === 'year' || def.type === 'choice' || def.type === 'number' || def.type === 'long' || def.type === 'tags')) continue;
            if (!f.label || (f.current && String(f.current).trim() !== '')) continue;
            suggestions.push({
                field: f,
                key: (def ? def.key : f.label),
                label: f.label || f.id,
                value: tokens[idx],
                confidence: 0.35
            });
            idx++;
        }
        return suggestions;
    }
    // ---- Build the bot UI inside a form ----
    var INSTALLED = new WeakMap();

    function attachToForm(form, cfg) {
        if (!form || form.getAttribute('data-ai-autofill')) return null;
        form.setAttribute('data-ai-autofill', '1');
        cfg = cfg || {};

        var placeholder = cfg.placeholder ||
            'Paste metadata here in any simple format...\n\nExamples:\nTitle: Kadhal Rojave\nSingers: SP Balasubrahmanyam\nMusic Director: A R Rahman\nLyricist: Vairamuthu\nYear: 2024\nLanguage: Tamil\nGenre: Love';

        var panel = document.createElement('div');
        panel.className = 'ai-autofill';
        panel.innerHTML =
            '<div class="ai-autofill-head" role="button" tabindex="0" aria-expanded="false">' +
            '  <span class="ai-autofill-icon">&#129302;</span>' +
            '  <span class="ai-autofill-titles">' +
            '    <span class="ai-autofill-title">AI Auto-Fill Bot</span>' +
            '    <span class="ai-autofill-sub">Paste available details - I&rsquo;ll map them to the right fields for review.</span>' +
            '  </span>' +
            '  <svg class="ai-autofill-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</div>' +
            '<div class="ai-autofill-body" style="display:none;">' +
            '  <textarea class="ai-autofill-input" spellcheck="false" placeholder="' + esc(placeholder) + '"></textarea>' +
            '  <div class="ai-autofill-actions">' +
            '    <button type="button" class="ai-autofill-btn">&#10024; Analyze &amp; Auto-Fill</button>' +
            '  </div>' +
            '  <div class="ai-autofill-note ai-autofill-dur-note" data-durnote style="display:none;"></div>' +
            '  <div class="ai-autofill-status" data-status></div>' +
            '  <div class="ai-autofill-results" data-results></div>' +
            '</div>';

        var anchor = form.querySelector('.form-grid, .form-group') || form.firstChild;
        if (anchor && anchor.nodeType === 1) form.insertBefore(panel, anchor);
        else form.appendChild(panel);

        var body = panel.querySelector('.ai-autofill-body');
        var head = panel.querySelector('.ai-autofill-head');
        var input = panel.querySelector('.ai-autofill-input');
        var runBtn = panel.querySelector('.ai-autofill-btn');
        var status = panel.querySelector('[data-status]');
        var results = panel.querySelector('[data-results]');
        var durNote = panel.querySelector('[data-durnote]');

        head.addEventListener('click', function () {
            var open = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            head.setAttribute('aria-expanded', open ? 'false' : 'true');
        });
        head.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); head.click(); }
        });
        runBtn.addEventListener('click', function () { analyseAndRender(); });

        function analyseAndRender() {
            var text = input.value;
            status.innerHTML = '';
            results.innerHTML = '';
            if (!text || !text.trim()) {
                status.textContent = 'Paste some metadata above, then tap Analyze.';
                status.className = 'ai-autofill-status';
                return;
            }
            var fields = collectFields(form, cfg);
            var suggestions = [];
            var hadLabel = false;

            for (var i = 0; i < fields.length; i++) {
                var f = fields[i];
                if (f.tag === 'select') {
                    var cv = matchChoice(f, text);
                    if (cv) suggestions.push({ field: f, key: fieldKey(f), label: f.label, value: cv, confidence: 0.8 });
                    continue;
                }
                if (isSkippable(f)) continue;
                var s = parseFieldValue(f, text, fields);
                if (s) { suggestions.push(s); hadLabel = hadLabel || s.confidence >= 0.8; }
            }

            if (!hadLabel) {
                suggestions = suggestions.concat(positionalGuess(fields, text)).filter(function (x) { return x && x.value; });
            }

            renderResults(suggestions, status, results);
        }

        setupAudioDuration(form, durNote, cfg);
        INSTALLED.set(form, { panel: panel, durNote: durNote });
        return { panel: panel, body: body, head: head };
    }
    function renderResults(suggestions, status, results) {
        results.innerHTML = '';
        if (!suggestions.length) {
            status.textContent = 'I couldn\u2019t confidently map any value. Add labels like "Title:", "Singer:", "Year:" and try again.';
            status.className = 'ai-autofill-status ai-autofill-status-warn';
            return;
        }
        var count = suggestions.length;
        status.innerHTML = 'Found <b>' + count + '</b> field suggestion' + (count > 1 ? 's' : '') +
            '. Review below &mdash; untick anything you don\u2019t want applied. Manual fields stay editable.';
        status.className = 'ai-autofill-status ai-autofill-status-ok';

        var list = document.createElement('div');
        list.className = 'ai-autofill-list';

        suggestions.forEach(function (s, idx) {
            var conf = s.confidence >= 0.8 ? 'high' : (s.confidence >= 0.6 ? 'med' : 'low');
            var confLabel = conf === 'high' ? 'labelled' : (conf === 'med' ? 'matched' : 'guess');
            var row = document.createElement('label');
            row.className = 'ai-autofill-row';
            row.innerHTML =
                '<input type="checkbox" class="ai-autofill-check" checked data-idx="' + idx + '">' +
                '<span class="ai-autofill-row-label"><span class="ai-autofill-row-name">' + esc(s.label) + '</span>' +
                '<span class="ai-autofill-badge ' + conf + '">' + confLabel + '</span></span>' +
                '<input type="text" class="ai-autofill-row-value" data-idx="' + idx + '" value="' + esc(s.value) + '">';
            list.appendChild(row);
        });

        var controlsRow = document.createElement('div');
        controlsRow.className = 'ai-autofill-list-actions';
        controlsRow.innerHTML =
            '<button type="button" class="ai-autofill-btn primary" data-apply>Apply checked</button>' +
            '<button type="button" class="ai-autofill-btn ghost" data-clear>Clear</button>';

        results.appendChild(list);
        results.appendChild(controlsRow);
        results.querySelector('[data-apply]').addEventListener('click', function () {
            applySuggestions(suggestions, results);
        });
        results.querySelector('[data-clear]').addEventListener('click', function () {
            results.innerHTML = '';
        });
    }

    function applySuggestions(suggestions, results) {
        var applied = 0;
        suggestions.forEach(function (s, idx) {
            var check = results.querySelector('input.ai-autofill-check[data-idx="' + idx + '"]');
            var valueEl = results.querySelector('input.ai-autofill-row-value[data-idx="' + idx + '"]');
            if (!check || !check.checked || !s.field || !s.field.el) return;
            var val = valueEl ? valueEl.value : s.value;
            if (val == null || String(val).trim() === '') return;
            setFieldValue(s.field, String(val).trim());
            applied++;
        });
        var body = results.closest('.ai-autofill-body');
        var st = body ? body.querySelector('[data-status]') : null;
        if (st) {
            st.innerHTML = applied
                ? 'Applied <b>' + applied + '</b> field' + (applied > 1 ? 's' : '') + ' to the form. Review, then Save/Publish.'
                : 'Nothing applied \u2014 tick the boxes you want, then Apply.';
            st.className = 'ai-autofill-status ai-autofill-status-ok';
        }
    }

    function setFieldValue(field, value) {
        var el = field.el;
        if (!el) return;
        if (el.tagName === 'SELECT') {
            var opt = Array.prototype.find.call(el.options, function (o) {
                return o.value === value || o.textContent.trim().toLowerCase() === value.toLowerCase();
            });
            if (opt) el.value = opt.value;
            return;
        }
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // ---- Audio duration auto-detection (from the actual file - never guessed) ----
    function setupAudioDuration(form, durNote, cfg) {
        var audioInput = form.querySelector(
            'input[type="file"][accept*="audio"], input[type="file"]#audioFile, input[type="file"]#songFileInput'
        );
        if (!audioInput) return;

        function findDurationField() {
            var fields = collectFields(form, cfg);
            for (var i = 0; i < fields.length; i++) {
                if (fields[i].tag === 'input' && /duration/i.test(fields[i].label || '')) return fields[i].el;
            }
            return document.getElementById('songDuration') || null;
        }

        function onFile() {
            var file = audioInput.files && audioInput.files[0];
            if (!file) return;
            if (durNote) {
                durNote.style.display = 'block';
                durNote.textContent = 'Reading audio duration from \u201c' + file.name + '\u201d\u2026';
            }
            detectAudioDuration(file, function (dur) {
                var durEl = findDurationField();
                if (durEl) {
                    durEl.value = dur || '';
                    durEl.setAttribute('readonly', 'readonly');
                    durEl.title = 'Duration is read automatically from the uploaded audio file';
                }
                if (durNote) {
                    if (dur) {
                        durNote.style.display = 'block';
                        durNote.innerHTML = '&#128266; Duration auto-detected from the uploaded audio file: <b>' + esc(dur) + '</b> &nbsp;(never guessed - no need to type it).';
                    } else {
                        durNote.style.display = 'block';
                        durNote.textContent = '\u26A0\uFE0F Could not read audio duration from this file.';
                    }
                }
            });
        }

        audioInput.addEventListener('change', onFile);
        if (audioInput.files && audioInput.files[0]) onFile();
    }

    function detectAudioDuration(file, cb) {
        if (!file || !file.type || file.type.indexOf('audio/') !== 0) { cb(null); return; }
        var url;
        try { url = URL.createObjectURL(file); } catch (e) { cb(null); return; }
        var a = new Audio();
        a.preload = 'metadata';
        a.src = url;
        var done = false;
        function finish(dur) {
            if (done) return;
            done = true;
            try { URL.revokeObjectURL(url); } catch (e) {}
            a.removeAttribute('src');
            cb(dur);
        }
        a.onloadedmetadata = function () {
            var d = (typeof a.duration === 'number' && isFinite(a.duration)) ? a.duration : null;
            finish(d ? formatMMSS(d) : null);
        };
        a.onerror = function () { finish(null); };
        a.load();
    }
    // ---- Init & public API ----
    AIAutoFill.skipForms = ['settingsForm', 'playerForm', 'navigationForm'];

    function attach(name_or_form, cfg) {
        var el = (typeof name_or_form === 'string') ? document.getElementById(name_or_form) : name_or_form;
        if (!el) return null;
        return attachToForm(el, cfg);
    }

    function init() {
        // Main Song form (static in builder.html)
        if (document.getElementById('songForm')) {
            attachToForm(document.getElementById('songForm'), {
                placeholder: 'Paste song / movie details in any simple format...\n\nExamples:\nTitle: Kadhal Rojave\nSingers: SP Balasubrahmanyam, K.S. Chithra\nStarring: Vijay, Samantha\nMusic Director: A R Rahman\nLyricist: Vairamuthu\nYear: 2024\nLanguage: Tamil\nGenre: Love\nMood: Romantic'
            });
            // Duration is ALWAYS auto-detected from the uploaded audio file.
            var durField = document.getElementById('songDuration');
            if (durField) {
                durField.setAttribute('readonly', 'readonly');
                durField.title = 'Duration is read automatically from the uploaded audio file';
                durField.placeholder = 'auto (from audio file)';
            }
        }

        // Quick Add Song modal (static in builder.html)
        if (document.getElementById('quickSongForm')) attachToForm(document.getElementById('quickSongForm'), {
            placeholder: 'Paste in any simple format, e.g.\nTitle: Kadhal Rojave\nArtist: SPB\nMovie: Dosth'
        });

        // Inline station & splash forms
        attach('stationForm');
        attach('splashForm');

        // Auto-attach to dynamically created modal forms (featured, trending,
        // categories, artist hits, moods, AI radio, notifications, quotes, etc.)
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var added = mutations[i].addedNodes;
                    if (!added) continue;
                    for (var j = 0; j < added.length; j++) {
                        var node = added[j];
                        if (!node || node.nodeType !== 1) continue;
                        var modal = null;
                        if (node.matches && node.matches('.modal')) modal = node;
                        else if (node.querySelector) modal = node.querySelector('.modal');
                        if (!modal) continue;
                        var forms = modal.querySelectorAll('form');
                        for (var k = 0; k < forms.length; k++) {
                            var f = forms[k];
                            if (!f.id || AIAutoFill.skipForms.indexOf(f.id) === -1) attachToForm(f, {});
                        }
                    }
                }
            });
            var target = document.body || document.documentElement;
            observer.observe(target, { childList: true, subtree: true });
        }
    }

    AIAutoFill.init = init;
    AIAutoFill.attach = attach;
    AIAutoFill.attachToForm = attachToForm;
    AIAutoFill.detectAudioDuration = detectAudioDuration;
    AIAutoFill.formatMMSS = formatMMSS;


    // Internal helpers (exposed for testing / advanced use)
    AIAutoFill._internals = {
        fieldDefFromLabel: fieldDefFromLabel,
        parseFieldValue: parseFieldValue,
        matchChoice: matchChoice,
        positionalGuess: positionalGuess,
        collectFields: collectFields,
        hasWord: hasWord,
        norm: norm
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    global.AIAutoFill = AIAutoFill;
})(window);
