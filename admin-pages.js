'use strict';
(function() {
    const $ = id => document.getElementById(id);

    window.closeModal = id => { const el = $(id); if (el) el.classList.remove('open'); };
    function openModal(id) { const el = $(id); if (el) el.classList.add('open'); }
    function toast(msg, type) {
        const t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.innerHTML = '<i class="fas fa-' + (type === 'ok' ? 'check-circle' : type === 'err' ? 'exclamation-circle' : 'info-circle') + '"></i> ' + msg;
        const box = $('toast-box'); if (box) box.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3000);
    }
    function esc(str) { return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    function formField(label, type, field, value) {
        return '<div class="fg"><div class="fg-label">' + label + '</div><input type="' + type + '" data-field="' + field + '" value="' + esc(value || '') + '"></div>';
    }
    function showProgress(pct, text) {
        const bar = $('progress-bar'); if (bar) bar.classList.add('show');
        const fill = $('progressFill'); if (fill) fill.style.width = pct + '%';
        const txt = $('progressText'); if (txt) txt.textContent = text || 'Saving...';
    }
    function hideProgress() {
        const fill = $('progressFill'); if (fill) fill.style.width = '100%';
        const txt = $('progressText'); if (txt) txt.textContent = 'Done!';
        setTimeout(() => { const bar = $('progress-bar'); if (bar) bar.classList.remove('show'); if (fill) fill.style.width = '0'; }, 800);
    }

    /* ═══════════ SIDEBAR NAV ═══════════ */
    let _currentPage = 'dashboard';
    function navigateTo(page) {
        _currentPage = page;
        document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
        const target = $('page-' + page);
        if (target) target.classList.add('active');
        document.querySelectorAll('#sidebarNav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
        const renderers = { dashboard: renderDashboard, content: renderContent, sections: renderSectionSettings, design: renderDesign, header: renderHeaderSettings, logo: renderLogoSettings, splash: renderSplashSettings, player: renderPlayerSettings, platform: renderPlatformSettings };
        if (renderers[page]) renderers[page]();
        if (page === 'visual-editor') setTimeout(() => { try { if (typeof AdminEditor !== 'undefined') { AdminEditor.detectSections(); AdminEditor.detectElements(); } } catch(e) {} }, 100);
    }
    window.navigateTo = navigateTo;
    document.querySelectorAll('#sidebarNav button').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    /* ═══════════ DASHBOARD ═══════════ */
    function renderDashboard() {
        const songs = DataStore.getSongs();
        const stations = DataStore.getStations();
        const sections = DataStore.getSectionSettings();
        const sectionCount = Object.keys(sections).length;
        const enabledCount = Object.values(sections).filter(s => s.enabled).length;
        const el = $('dashStats');
        if (el) el.innerHTML = [
            { icon: 'fa-music', value: songs.length, label: 'Songs', color: '#6366f1' },
            { icon: 'fa-radio', value: stations.length, label: 'Stations', color: '#10b981' },
            { icon: 'fa-layer-group', value: sectionCount, label: 'Sections', color: '#f59e0b', sub: enabledCount + ' enabled' },
        ].map(s => '<div class="stat-card"><div class="stat-icon" style="color:' + s.color + '"><i class="fas ' + s.icon + '"></i></div><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + (s.sub ? ' (' + s.sub + ')' : '') + '</div></div>').join('');

        const hist = (typeof PublishManager !== 'undefined' && PublishManager.getChangesHistory ? PublishManager.getChangesHistory() : []).slice(0, 5);
        const histEl = $('dashHistory');
        if (histEl) histEl.innerHTML = hist.length ? hist.map(e =>
            '<div class="h-entry"><div class="h-icon h-icon-sync"><i class="fas fa-pen"></i></div><div class="h-info"><div class="h-title">' + (e.type || 'edit') + '</div><div class="h-detail">' + (e.details || '') + '</div><div class="h-meta"><span>' + new Date(e.timestamp).toLocaleString() + '</span></div></div></div>'
        ).join('') : '<div class="empty-state"><p>No changes yet</p></div>';
    }

    /* ═══════════ CONTENT MANAGEMENT ═══════════ */
    let _contentTab = 'songs';
    window.setContentTab = function(tab) { _contentTab = tab; renderContent(); };

    document.querySelectorAll('#contentTabs button').forEach(btn => {
        btn.addEventListener('click', () => { _contentTab = btn.dataset.ctab; renderContent(); });
    });

    function renderContent() {
        document.querySelectorAll('#contentTabs button').forEach(b => b.classList.toggle('active', b.dataset.ctab === _contentTab));
        const body = $('contentBody');
        const renderers = { songs: renderSongs, stations: renderStations, albums: renderAlbums, 'songs-collections': renderSongsCollections, 'music-collections': renderMusicCollections, movies: renderMovies, yearly: renderYearly, upcoming: renderUpcoming };
        if (renderers[_contentTab]) renderers[_contentTab](body);
    }

    function renderSongs(body) {
        const songs = DataStore.getSongs();
        body.innerHTML = '<div class="search-bar"><input type="text" id="songSearch" placeholder="Search songs..."><button class="btn btn-green" onclick="editSong(-1)"><i class="fas fa-plus"></i> Add Song</button></div><table class="data-table"><thead><tr><th>Title</th><th>Artist</th><th>Album</th><th>Actions</th></tr></thead><tbody id="songsTable"></tbody></table>';
        function filter(q) {
            const f = q ? songs.filter(s => (s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q)) : songs;
            const tb = $('songsTable');
            if (tb) tb.innerHTML = f.length ? f.map(s =>
                '<tr><td>' + (s.title||'Untitled') + '</td><td>' + (s.artist||'-') + '</td><td>' + (s.album||'-') + '</td><td class="td-actions"><button class="btn btn-sm" onclick="editSong(' + songs.indexOf(s) + ')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-red" onclick="deleteSong(' + songs.indexOf(s) + ')"><i class="fas fa-trash"></i></button></td></tr>'
            ).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px;">No songs</td></tr>';
        }
        filter('');
        const searchEl = $('songSearch');
        if (searchEl) searchEl.addEventListener('input', e => filter(e.target.value.toLowerCase()));
    }

    window.editSong = function(idx) {
        const songs = DataStore.getSongs();
        const s = idx >= 0 ? songs[idx] : { id: 'song_' + Date.now(), title: '', artist: '', album: '', thumbnail: '', audioUrl: '', duration: 0 };
        const titleEl = $('mContentEditTitle');
        const bodyEl = $('mContentEditBody');
        const saveBtn = $('mContentEditSave');
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-' + (idx < 0 ? 'plus' : 'pen') + '"></i> ' + (idx < 0 ? 'Add Song' : 'Edit Song');
        if (bodyEl) bodyEl.innerHTML = formField('Title','text','title',s.title) + formField('Artist','text','artist',s.artist) + formField('Album','text','album',s.album) + formField('Thumbnail URL','url','thumbnail',s.thumbnail) + formField('Audio URL','url','audioUrl',s.audioUrl) + formField('Duration (sec)','number','duration',s.duration);
        if (saveBtn) saveBtn.onclick = () => {
            const data = {};
            ['title','artist','album','thumbnail','audioUrl','duration'].forEach(f => { const el = document.querySelector('#mContentEditBody [data-field="'+f+'"]'); if (el) data[f] = el.value; });
            data.id = s.id; data.duration = Number(data.duration) || 0;
            if (idx < 0) songs.push(data); else songs[idx] = { ...songs[idx], ...data };
            DataStore.setSongs(songs); closeModal('mContentEdit'); renderContent(); toast(idx < 0 ? 'Song added' : 'Song updated', 'ok');
        };
        openModal('mContentEdit');
    };

    window.deleteSong = function(idx) { if (!confirm('Delete?')) return; const s = DataStore.getSongs(); s.splice(idx,1); DataStore.setSongs(s); renderContent(); toast('Deleted','ok'); };

    function renderStations(body) {
        const stations = DataStore.getStations();
        body.innerHTML = '<div class="search-bar"><input type="text" id="stationSearch" placeholder="Search..."><button class="btn btn-green" onclick="editStation(-1)"><i class="fas fa-plus"></i> Add Station</button></div><table class="data-table"><thead><tr><th>Name</th><th>Freq</th><th>Genre</th><th>City</th><th>Actions</th></tr></thead><tbody id="stationsTable"></tbody></table>';
        function filter(q) {
            const f = q ? stations.filter(s => (s.name||'').toLowerCase().includes(q)) : stations;
            const tb = $('stationsTable');
            if (tb) tb.innerHTML = f.length ? f.map(s =>
                '<tr><td>' + (s.name||'Untitled') + '</td><td>' + (s.freq||'-') + '</td><td>' + (s.genre||'-') + '</td><td>' + (s.city||'-') + '</td><td class="td-actions"><button class="btn btn-sm" onclick="editStation(' + stations.indexOf(s) + ')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-red" onclick="deleteStation(' + stations.indexOf(s) + ')"><i class="fas fa-trash"></i></button></td></tr>'
            ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px;">No stations</td></tr>';
        }
        filter('');
        const searchEl = $('stationSearch');
        if (searchEl) searchEl.addEventListener('input', e => filter(e.target.value.toLowerCase()));
    }

    window.editStation = function(idx) {
        const stations = DataStore.getStations();
        const s = idx >= 0 ? stations[idx] : { id: 'st_' + Date.now(), name: '', freq: '', streamUrl: '', genre: '', city: '', status: 'active', thumbnail: '' };
        const titleEl = $('mContentEditTitle');
        const bodyEl = $('mContentEditBody');
        const saveBtn = $('mContentEditSave');
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen"></i> ' + (idx < 0 ? 'Add Station' : 'Edit Station');
        if (bodyEl) bodyEl.innerHTML = formField('Name','text','name',s.name) + formField('Frequency','text','freq',s.freq) + formField('Stream URL','url','streamUrl',s.streamUrl) + formField('Genre','text','genre',s.genre) + formField('City','text','city',s.city) + formField('Thumbnail','url','thumbnail',s.thumbnail);
        if (saveBtn) saveBtn.onclick = () => {
            const data = {};
            ['name','freq','streamUrl','genre','city','thumbnail'].forEach(f => { const el = document.querySelector('#mContentEditBody [data-field="'+f+'"]'); if (el) data[f] = el.value; });
            data.id = s.id; data.status = 'active';
            if (idx < 0) stations.push(data); else stations[idx] = { ...stations[idx], ...data };
            DataStore.setStations(stations); closeModal('mContentEdit'); renderContent(); toast('Saved','ok');
        };
        openModal('mContentEdit');
    };

    window.deleteStation = function(idx) { if (!confirm('Delete?')) return; const s = DataStore.getStations(); s.splice(idx,1); DataStore.setStations(s); renderContent(); toast('Deleted','ok'); };

    function renderAlbums(body) {
        const albums = DataStore.getNewAlbums();
        body.innerHTML = '<div class="search-bar"><input type="text" placeholder="Search..."><button class="btn btn-green" onclick="editAlbum(-1)"><i class="fas fa-plus"></i> Add Album</button></div><table class="data-table"><thead><tr><th>Title</th><th>Artist</th><th>Actions</th></tr></thead><tbody>' + (albums.length ? albums.map((a,i) => '<tr><td>' + (a.title||'Untitled') + '</td><td>' + (a.artist||'-') + '</td><td class="td-actions"><button class="btn btn-sm" onclick="editAlbum('+i+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-red" onclick="deleteAlbum('+i+')"><i class="fas fa-trash"></i></button></td></tr>').join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px;">No albums</td></tr>') + '</tbody></table>';
    }
    window.editAlbum = function(idx) {
        const albums = DataStore.getNewAlbums();
        const a = idx >= 0 ? albums[idx] : { id: 'album_' + Date.now(), title: '', artist: '', thumbnail: '', songs: [] };
        const titleEl = $('mContentEditTitle');
        const bodyEl = $('mContentEditBody');
        const saveBtn = $('mContentEditSave');
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen"></i> ' + (idx < 0 ? 'Add Album' : 'Edit Album');
        if (bodyEl) bodyEl.innerHTML = formField('Title','text','title',a.title) + formField('Artist','text','artist',a.artist) + formField('Thumbnail','url','thumbnail',a.thumbnail);
        if (saveBtn) saveBtn.onclick = () => {
            const data = {}; ['title','artist','thumbnail'].forEach(f => { const el = document.querySelector('#mContentEditBody [data-field="'+f+'"]'); if (el) data[f] = el.value; });
            data.id = a.id; data.songs = a.songs || [];
            if (idx < 0) albums.push(data); else albums[idx] = { ...albums[idx], ...data };
            DataStore.setNewAlbums(albums); closeModal('mContentEdit'); renderContent(); toast('Saved','ok');
        };
        openModal('mContentEdit');
    };
    window.deleteAlbum = function(i) { if (confirm('Delete?')) { const d = DataStore.getNewAlbums(); d.splice(i,1); DataStore.setNewAlbums(d); renderContent(); } };

    function renderSongsCollections(body) {
        const data = DataStore.getSongsCollections();
        body.innerHTML = '<h3 style="font-size:12px;font-weight:600;margin-bottom:8px;">Left Column</h3><div id="scLeft"></div><h3 style="font-size:12px;font-weight:600;margin:12px 0 8px;">Right Column</h3><div id="scRight"></div>';
        ['left','right'].forEach(side => {
            const container = $(side === 'left' ? 'scLeft' : 'scRight');
            if (container) container.innerHTML = (data[side] || []).map((item, i) =>
                '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);"><span style="flex:1;font-size:12px;">' + (item.title || item.name || 'Item ' + (i+1)) + '</span><button class="btn btn-sm btn-red" onclick="removeSCItem(\'' + side + '\',' + i + ')"><i class="fas fa-trash"></i></button></div>'
            ).join('') || '<p style="color:var(--text3);font-size:11px;">No items</p>';
        });
    }
    window.removeSCItem = function(side, i) { const d = DataStore.getSongsCollections(); if (d[side]) { d[side].splice(i,1); DataStore.setSongsCollections(d); renderContent(); } };

    function renderMusicCollections(body) {
        const cols = DataStore.getMusicCollections();
        body.innerHTML = '<div class="search-bar"><button class="btn btn-green" onclick="editMC(-1)"><i class="fas fa-plus"></i> Add</button></div><table class="data-table"><thead><tr><th>Name</th><th>Songs</th><th>Actions</th></tr></thead><tbody>' + (cols.length ? cols.map((c,i) => '<tr><td>' + (c.name||'Untitled') + '</td><td>' + (c.songs?c.songs.length:0) + '</td><td class="td-actions"><button class="btn btn-sm" onclick="editMC('+i+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-red" onclick="deleteMC('+i+')"><i class="fas fa-trash"></i></button></td></tr>').join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px;">No collections</td></tr>') + '</tbody></table>';
    }
    window.editMC = function(idx) {
        const cols = DataStore.getMusicCollections();
        const c = idx >= 0 ? cols[idx] : { id: 'mc_' + Date.now(), name: '', songs: [] };
        const titleEl = $('mContentEditTitle');
        const bodyEl = $('mContentEditBody');
        const saveBtn = $('mContentEditSave');
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen"></i> Collection';
        if (bodyEl) bodyEl.innerHTML = formField('Name','text','name',c.name);
        if (saveBtn) saveBtn.onclick = () => {
            const data = {}; ['name'].forEach(f => { const el = document.querySelector('#mContentEditBody [data-field="'+f+'"]'); if (el) data[f] = el.value; });
            data.id = c.id; data.songs = c.songs || [];
            if (idx < 0) cols.push(data); else cols[idx] = { ...cols[idx], ...data };
            DataStore.setMusicCollections(cols); closeModal('mContentEdit'); renderContent(); toast('Saved','ok');
        };
        openModal('mContentEdit');
    };
    window.deleteMC = function(i) { if (confirm('Delete?')) { const d = DataStore.getMusicCollections(); d.splice(i,1); DataStore.setMusicCollections(d); renderContent(); } };

    function renderMovies(body) {
        const items = DataStore.getMoviesCollections();
        body.innerHTML = '<div class="search-bar"><button class="btn btn-green" onclick="editMovie(-1)"><i class="fas fa-plus"></i> Add</button></div><table class="data-table"><thead><tr><th>Title</th><th>Year</th><th>Actions</th></tr></thead><tbody>' + (items.length ? items.map((m,i) => '<tr><td>' + (m.title||'Untitled') + '</td><td>' + (m.year||'-') + '</td><td class="td-actions"><button class="btn btn-sm" onclick="editMovie('+i+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-red" onclick="deleteMovie('+i+')"><i class="fas fa-trash"></i></button></td></tr>').join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px;">No items</td></tr>') + '</tbody></table>';
    }
    window.editMovie = function(idx) {
        const items = DataStore.getMoviesCollections();
        const m = idx >= 0 ? items[idx] : { id: 'mv_' + Date.now(), title: '', year: '', thumbnail: '' };
        const titleEl = $('mContentEditTitle');
        const bodyEl = $('mContentEditBody');
        const saveBtn = $('mContentEditSave');
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen"></i> Movie';
        if (bodyEl) bodyEl.innerHTML = formField('Title','text','title',m.title) + formField('Year','text','year',m.year) + formField('Thumbnail','url','thumbnail',m.thumbnail);
        if (saveBtn) saveBtn.onclick = () => {
            const data = {}; ['title','year','thumbnail'].forEach(f => { const el = document.querySelector('#mContentEditBody [data-field="'+f+'"]'); if (el) data[f] = el.value; });
            data.id = m.id;
            if (idx < 0) items.push(data); else items[idx] = { ...items[idx], ...data };
            DataStore.setMoviesCollections(items); closeModal('mContentEdit'); renderContent(); toast('Saved','ok');
        };
        openModal('mContentEdit');
    };
    window.deleteMovie = function(i) { if (confirm('Delete?')) { const d = DataStore.getMoviesCollections(); d.splice(i,1); DataStore.setMoviesCollections(d); renderContent(); } };

    function renderYearly(body) {
        const items = DataStore.getYearlyCollections();
        body.innerHTML = '<div class="search-bar"><button class="btn btn-green" onclick="editYearly(-1)"><i class="fas fa-plus"></i> Add</button></div><table class="data-table"><thead><tr><th>Year</th><th>Title</th><th>Actions</th></tr></thead><tbody>' + (items.length ? items.map((y,i) => '<tr><td>' + (y.year||'-') + '</td><td>' + (y.title||'Untitled') + '</td><td class="td-actions"><button class="btn btn-sm" onclick="editYearly('+i+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-red" onclick="deleteYearly('+i+')"><i class="fas fa-trash"></i></button></td></tr>').join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px;">No items</td></tr>') + '</tbody></table>';
    }
    window.editYearly = function(idx) {
        const items = DataStore.getYearlyCollections();
        const y = idx >= 0 ? items[idx] : { id: 'yr_' + Date.now(), year: '', title: '', thumbnail: '' };
        const titleEl = $('mContentEditTitle');
        const bodyEl = $('mContentEditBody');
        const saveBtn = $('mContentEditSave');
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen"></i> Year';
        if (bodyEl) bodyEl.innerHTML = formField('Year','text','year',y.year) + formField('Title','text','title',y.title) + formField('Thumbnail','url','thumbnail',y.thumbnail);
        if (saveBtn) saveBtn.onclick = () => {
            const data = {}; ['year','title','thumbnail'].forEach(f => { const el = document.querySelector('#mContentEditBody [data-field="'+f+'"]'); if (el) data[f] = el.value; });
            data.id = y.id;
            if (idx < 0) items.push(data); else items[idx] = { ...items[idx], ...data };
            DataStore.setYearlyCollections(items); closeModal('mContentEdit'); renderContent(); toast('Saved','ok');
        };
        openModal('mContentEdit');
    };
    window.deleteYearly = function(i) { if (confirm('Delete?')) { const d = DataStore.getYearlyCollections(); d.splice(i,1); DataStore.setYearlyCollections(d); renderContent(); } };

    function renderUpcoming(body) {
        const items = DataStore.getUpcomingReleases();
        body.innerHTML = '<div class="search-bar"><button class="btn btn-green" onclick="editUpcoming(-1)"><i class="fas fa-plus"></i> Add</button></div><table class="data-table"><thead><tr><th>Title</th><th>Date</th><th>Actions</th></tr></thead><tbody>' + (items.length ? items.map((u,i) => '<tr><td>' + (u.title||'Untitled') + '</td><td>' + (u.date||'-') + '</td><td class="td-actions"><button class="btn btn-sm" onclick="editUpcoming('+i+')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-red" onclick="deleteUpcoming('+i+')"><i class="fas fa-trash"></i></button></td></tr>').join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px;">No items</td></tr>') + '</tbody></table>';
    }
    window.editUpcoming = function(idx) {
        const items = DataStore.getUpcomingReleases();
        const u = idx >= 0 ? items[idx] : { id: 'up_' + Date.now(), title: '', date: '', thumbnail: '' };
        const titleEl = $('mContentEditTitle');
        const bodyEl = $('mContentEditBody');
        const saveBtn = $('mContentEditSave');
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen"></i> Upcoming';
        if (bodyEl) bodyEl.innerHTML = formField('Title','text','title',u.title) + formField('Date','text','date',u.date) + formField('Thumbnail','url','thumbnail',u.thumbnail);
        if (saveBtn) saveBtn.onclick = () => {
            const data = {}; ['title','date','thumbnail'].forEach(f => { const el = document.querySelector('#mContentEditBody [data-field="'+f+'"]'); if (el) data[f] = el.value; });
            data.id = u.id;
            if (idx < 0) items.push(data); else items[idx] = { ...items[idx], ...data };
            DataStore.setUpcomingReleases(items); closeModal('mContentEdit'); renderContent(); toast('Saved','ok');
        };
        openModal('mContentEdit');
    };
    window.deleteUpcoming = function(i) { if (confirm('Delete?')) { const d = DataStore.getUpcomingReleases(); d.splice(i,1); DataStore.setUpcomingReleases(d); renderContent(); } };

    /* ═══════════ SECTION SETTINGS ═══════════ */
    function renderSectionSettings() {
        const settings = DataStore.getSectionSettings();
        const el = $('sectionsList');
        if (!el) return;
        el.innerHTML = Object.entries(settings).map(([id, sec]) =>
            '<div class="section-card"><div class="section-card-head"><div class="section-card-title"><i class="fas fa-layer-group" style="color:var(--accent);font-size:12px;"></i> ' + (sec.title || id) + '</div><label class="toggle"><input type="checkbox" data-sid="' + id + '" data-field="enabled"' + (sec.enabled ? ' checked' : '') + '><span class="slider"></span></label></div><div class="section-card-body">' +
            '<div class="fg" style="flex:1;min-width:140px;"><div class="fg-label">Title</div><input type="text" data-sid="' + id + '" data-field="title" value="' + esc(sec.title || '') + '"></div>' +
            '<div class="fg" style="flex:1;min-width:140px;"><div class="fg-label">Subtitle</div><input type="text" data-sid="' + id + '" data-field="subtitle" value="' + esc(sec.subtitle || '') + '"></div>' +
            '<div class="fg" style="width:80px;"><div class="fg-label">Top Space</div><input type="number" data-sid="' + id + '" data-field="topSpacing" value="' + (sec.topSpacing || 0) + '"></div>' +
            '<div class="fg" style="width:80px;"><div class="fg-label">Bottom Space</div><input type="number" data-sid="' + id + '" data-field="bottomSpacing" value="' + (sec.bottomSpacing || 0) + '"></div>' +
            '<div class="fg" style="width:120px;"><div class="fg-label">Background</div><div class="fg-row"><input type="color" class="fg-color" data-sid="' + id + '" data-field="bg" value="' + (sec.bg || '#000000') + '"><input type="text" data-sid="' + id + '" data-field="bg" value="' + esc(sec.bg || '') + '" style="flex:1;"></div></div>' +
            '<div class="fg" style="width:120px;"><div class="fg-label">Animation</div><select data-sid="' + id + '" data-field="animation"><option value="none"' + (sec.animation === 'none' ? ' selected' : '') + '>none</option><option value="fadeIn"' + (sec.animation === 'fadeIn' ? ' selected' : '') + '>fadeIn</option><option value="slideUp"' + (sec.animation === 'slideUp' ? ' selected' : '') + '>slideUp</option><option value="slideLeft"' + (sec.animation === 'slideLeft' ? ' selected' : '') + '>slideLeft</option></select></div>' +
            '<div class="fg" style="width:100px;"><div class="fg-label">Anim Speed</div><input type="number" data-sid="' + id + '" data-field="animationSpeed" value="' + (sec.animationSpeed || 0.3) + '" step="0.1" min="0.1" max="3"></div>' +
            '</div></div>'
        ).join('');

        el.querySelectorAll('input, select').forEach(inp => {
            inp.addEventListener('change', () => {
                const settings = DataStore.getSectionSettings();
                const sid = inp.dataset.sid;
                if (!settings[sid]) return;
                settings[sid][inp.dataset.field] = inp.type === 'checkbox' ? inp.checked : inp.value;
                DataStore.setSectionSettings(settings);
            });
        });
    }

    /* ═══════════ DESIGN ═══════════ */
    let _designTab = 'colors';
    document.querySelectorAll('#designTabs button').forEach(btn => {
        btn.addEventListener('click', () => { _designTab = btn.dataset.dtab; renderDesign(); });
    });

    function renderDesign() {
        document.querySelectorAll('#designTabs button').forEach(b => b.classList.toggle('active', b.dataset.dtab === _designTab));
        const body = $('designBody');
        if (!body) return;
        const settings = DataStore.getSiteSettings();
        const styles = settings.styles || {};

        switch (_designTab) {
            case 'colors': {
                const c = styles.colors || {};
                body.innerHTML = '<div class="fg-half">' +
                    ['Primary','Secondary','Accent','Success','Warning','Danger','Background','Surface','Text','Text Secondary'].map((label, i) => {
                        const keys = ['primary','secondary','accent','success','warning','danger','background','surface','text','textSecondary'];
                        const defaults = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#0d1b2a','rgba(255,255,255,0.05)','#ffffff','rgba(255,255,255,0.7)'];
                        return '<div class="fg"><div class="fg-label">' + label + '</div><div class="fg-row"><input type="color" class="fg-color" data-dfield="colors.' + keys[i] + '" value="' + ((c[keys[i]] && c[keys[i]].startsWith('#')) ? c[keys[i]] : defaults[i]) + '"><input type="text" data-dfield="colors.' + keys[i] + '" value="' + esc(c[keys[i]] || defaults[i]) + '" style="flex:1;"></div></div>';
                    }).join('') + '</div>';
                break;
            }
            case 'typography': {
                const f = styles.fonts || {};
                body.innerHTML = formField('Font Family','text','fonts.family',f.family||'Inter, sans-serif');
                break;
            }
            case 'effects': {
                const fx = styles.effects || {};
                const g = fx.glass || {};
                body.innerHTML = '<h4 style="font-size:12px;margin-bottom:10px;">Glass Effect</h4><div class="fg-half">' +
                    formField('Blur','number','effects.glass.blur',g.blur||10) + formField('Opacity','number','effects.glass.opacity',g.opacity||0.1) + '</div>';
                break;
            }
            case 'buttons': {
                const b = styles.buttons || {};
                body.innerHTML = formField('Border Radius','number','buttons.borderRadius',b.borderRadius||8) + formField('Padding X','number','buttons.paddingX',b.paddingX||16) + formField('Font Size','number','buttons.fontSize',b.fontSize||14);
                break;
            }
        }

        body.querySelectorAll('[data-dfield]').forEach(inp => {
            inp.addEventListener('change', () => {
                const settings = DataStore.getSiteSettings();
                if (!settings.styles) settings.styles = {};
                const parts = inp.dataset.dfield.split('.');
                let obj = settings.styles;
                for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
                obj[parts[parts.length - 1]] = inp.type === 'number' ? Number(inp.value) : inp.value;
                DataStore.setSiteSettings(settings);
            });
        });
    }

    /* ═══════════ HEADER & NAVIGATION ═══════════ */
    function renderHeaderSettings() {
        const nav = DataStore.getNavigation();
        const items = nav.items || [
            { id: 'home', label: 'Home', icon: 'fa-house', visible: true },
            { id: 'stations', label: 'Stations', icon: 'fa-radio', visible: true },
            { id: 'explore', label: 'Explore', icon: 'fa-compass', visible: true },
            { id: 'library', label: 'Library', icon: 'fa-book-open', visible: true },
            { id: 'liked', label: 'Liked', icon: 'fa-heart', visible: true }
        ];
        const el = $('headerBody');
        if (!el) return;
        el.innerHTML = '<h3 style="font-size:12px;font-weight:600;margin-bottom:10px;">Logo</h3>' +
            formField('Logo Text','text','logoText',nav.logoText||'Tamil AI Stream') + formField('Logo Icon','text','logoIcon',nav.logoIcon||'fa-headphones-alt') +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Navigation Items</h3>' +
            '<div id="navItemsList">' + items.map((item, i) =>
                '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);"><label class="toggle"><input type="checkbox" data-nidx="' + i + '" data-nfield="visible"' + (item.visible ? ' checked' : '') + '><span class="slider"></span></label><input type="text" data-nidx="' + i + '" data-nfield="label" value="' + esc(item.label) + '" style="flex:1;padding:4px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-size:11px;"><input type="text" data-nidx="' + i + '" data-nfield="icon" value="' + esc(item.icon) + '" style="width:100px;padding:4px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-size:11px;"></div>'
            ).join('') + '</div>';

        el.querySelectorAll('[data-nidx]').forEach(inp => {
            inp.addEventListener('change', () => {
                const nav = DataStore.getNavigation();
                if (!nav.items) nav.items = items;
                nav.items[parseInt(inp.dataset.nidx)][inp.dataset.nfield] = inp.type === 'checkbox' ? inp.checked : inp.value;
                DataStore.setNavigation(nav);
            });
        });
    }

    /* ═══════════ LOGO & BRANDING ═══════════ */
    function renderLogoSettings() {
        const logo = DataStore.getLogoSettings();
        const el = $('logoBody');
        if (!el) return;
        el.innerHTML = formField('Logo URL','url','logo',logo.logo||'') +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Sizes</h3><div class="fg-third">' +
            formField('Desktop','number','sizeDesktop',logo.sizeDesktop||40) + formField('Tablet','number','sizeTablet',logo.sizeTablet||36) + formField('Mobile','number','sizeMobile',logo.sizeMobile||32) + '</div>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">3D Animation</h3>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:8px;"><label class="toggle"><input type="checkbox" data-field="animation3d"' + (logo.animation3d ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Enable 3D</span></label>' +
            '<div class="fg-half">' + formField('Style','text','animationStyle',logo.animationStyle||'float') + formField('Speed','number','animationSpeed',logo.animationSpeed||3) + '</div>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Visibility</h3>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:6px;"><label class="toggle"><input type="checkbox" data-field="showSplash"' + (logo.showSplash!==false ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Splash</span></label>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:6px;"><label class="toggle"><input type="checkbox" data-field="showPwa"' + (logo.showPwa!==false ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">PWA</span></label>';

        el.querySelectorAll('[data-field]').forEach(inp => {
            inp.addEventListener('change', () => {
                const logo = DataStore.getLogoSettings();
                logo[inp.dataset.field] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
                DataStore.setLogoSettings(logo);
            });
        });
    }

    /* ═══════════ SPLASH & ENTRANCE ═══════════ */
    let _splashPlatform = 'desktop';
    document.querySelectorAll('#splashTabs button').forEach(btn => {
        btn.addEventListener('click', () => { _splashPlatform = btn.dataset.stab; renderSplashSettings(); });
    });

    function renderSplashSettings() {
        document.querySelectorAll('#splashTabs button').forEach(b => b.classList.toggle('active', b.dataset.stab === _splashPlatform));
        const entrance = DataStore.getEntranceLogo();
        const cfg = entrance[_splashPlatform] || {};
        const el = $('splashBody');
        if (!el) return;
        el.innerHTML = '<label class="fg-row" style="gap:6px;margin-bottom:10px;"><label class="toggle"><input type="checkbox" data-field="enabled"' + (cfg.enabled ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Enabled on ' + _splashPlatform + '</span></label>' +
            formField('Logo URL','url','logo',cfg.logo||'') + formField('Brand Name','text','brandName',cfg.brandName||'Tamil AI Stream') + formField('Logo Size','number','logoSize',cfg.logoSize||120) + formField('Background','text','background',cfg.background||'transparent') +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Animation</h3>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:8px;"><label class="toggle"><input type="checkbox" data-field="animEnabled"' + (cfg.animEnabled ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Enable Animation</span></label>' +
            '<div class="fg-half">' + formField('Type','text','animType',cfg.animType||'zoom') + formField('Speed','number','animSpeed',cfg.animSpeed||1) + formField('Duration (ms)','number','animDuration',cfg.animDuration||1000) + formField('Easing','text','animEasing',cfg.animEasing||'ease-out') + '</div>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:6px;"><label class="toggle"><input type="checkbox" data-field="anim3D"' + (cfg.anim3D ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">3D Animation</span></label>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Sound</h3>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:8px;"><label class="toggle"><input type="checkbox" data-field="soundEnabled"' + (cfg.soundEnabled ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Enable Sound</span></label>' +
            formField('Sound URL','url','soundUrl',cfg.soundUrl||'') + '<div class="fg-half">' + formField('Volume','number','soundVolume',cfg.soundVolume||0.5) + formField('Duration (ms)','number','soundDuration',cfg.soundDuration||3000) + '</div>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Behavior</h3>' +
            formField('Frequency','text','frequency',cfg.frequency||'first-visit') + formField('Load Duration (ms)','number','loadDuration',cfg.loadDuration||2000) +
            '<label class="fg-row" style="gap:6px;margin-bottom:6px;"><label class="toggle"><input type="checkbox" data-field="skipBtn"' + (cfg.skipBtn ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Skip Button</span></label>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:6px;"><label class="toggle"><input type="checkbox" data-field="autoTransition"' + (cfg.autoTransition ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Auto Transition</span></label>';

        el.querySelectorAll('[data-field]').forEach(inp => {
            inp.addEventListener('change', () => {
                const entrance = DataStore.getEntranceLogo();
                if (!entrance[_splashPlatform]) entrance[_splashPlatform] = {};
                entrance[_splashPlatform][inp.dataset.field] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
                DataStore.setEntranceLogo(entrance);
            });
        });
    }

    /* ═══════════ PLAYER SETTINGS ═══════════ */
    function renderPlayerSettings() {
        const prefs = DataStore.getPlayerPrefs();
        const mini = prefs.mini || {};
        const ctrl = prefs.controls || {};
        const btns = prefs.buttons || {};
        const prog = prefs.progress || {};
        const art = prefs.artwork || {};
        const el = $('playerBody');
        if (!el) return;
        el.innerHTML = '<h3 style="font-size:12px;font-weight:600;margin-bottom:10px;">Mini Player</h3>' +
            '<label class="fg-row" style="gap:6px;margin-bottom:8px;"><label class="toggle"><input type="checkbox" data-pfield="mini.show"' + (mini.show!==false ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">Show Mini Player</span></label>' +
            '<div class="fg-half">' + formField('Height','number','mini.height',mini.height||80) + formField('Background','text','mini.backgroundColor',mini.backgroundColor||'rgba(13,27,42,0.95)') + '</div>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Controls</h3><div class="fg-half">' +
            ['PlayPause','Prev','Next','Shuffle','Repeat','Progress','Volume','Like','Queue'].map(c => {
                const key = 'show' + c;
                return '<label class="fg-row" style="gap:6px;"><label class="toggle"><input type="checkbox" data-pfield="controls.' + key + '"' + (ctrl[key] !== false ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:11px;">' + c + '</span></label>';
            }).join('') + '</div>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Buttons</h3><div class="fg-third">' +
            formField('Size','number','buttons.size',btns.size||36) + formField('Color','text','buttons.color',btns.color||'#ffffff') + formField('Hover','text','buttons.hoverColor',btns.hoverColor||'#6366f1') + '</div>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Progress Bar</h3><div class="fg-third">' +
            formField('Height','number','progress.height',prog.height||4) + formField('Color','text','progress.color',prog.color||'#6366f1') + '</div>' +
            '<h3 style="font-size:12px;font-weight:600;margin:14px 0 10px;">Artwork</h3><div class="fg-third">' +
            formField('Size','number','artwork.size',art.size||56) + formField('Radius','number','artwork.borderRadius',art.borderRadius||8) + '</div>';

        el.querySelectorAll('[data-pfield]').forEach(inp => {
            inp.addEventListener('change', () => {
                const prefs = DataStore.getPlayerPrefs();
                const parts = inp.dataset.pfield.split('.');
                let obj = prefs;
                for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
                obj[parts[parts.length - 1]] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
                DataStore.setPlayerPrefs(prefs);
            });
        });
    }

    /* ═══════════ PLATFORM ISOLATION ═══════════ */
    let _platformTab = 'desktop';
    document.querySelectorAll('#platformTabs button').forEach(btn => {
        btn.addEventListener('click', () => { _platformTab = btn.dataset.ptab; renderPlatformSettings(); });
    });

    function renderPlatformSettings() {
        document.querySelectorAll('#platformTabs button').forEach(b => b.classList.toggle('active', b.dataset.ptab === _platformTab));
        const sections = DataStore.getSectionSettings();
        const el = $('platformBody');
        if (!el) return;
        el.innerHTML = '<p style="font-size:11px;color:var(--text3);margin-bottom:14px;">Per-platform card sizes for <strong>' + _platformTab + '</strong> only.</p><div class="section-grid">' +
            Object.entries(sections).filter(([,s]) => s.card).map(([id, sec]) => {
                const p = (sec.responsive || {})[_platformTab] || {};
                return '<div class="section-card"><div class="section-card-head"><div class="section-card-title">' + (sec.title || id) + '</div></div><div class="section-card-body">' +
                    '<div class="fg" style="width:80px;"><div class="fg-label">Width</div><input type="number" data-psid="' + id + '" data-pfield="width" value="' + (p.width || sec.card.width || 160) + '"></div>' +
                    '<div class="fg" style="width:80px;"><div class="fg-label">Gap</div><input type="number" data-psid="' + id + '" data-pfield="gap" value="' + (p.gap || sec.card.gap || 12) + '"></div>' +
                    '<div class="fg" style="width:80px;"><div class="fg-label">Radius</div><input type="number" data-psid="' + id + '" data-pfield="radius" value="' + (p.radius || sec.card.radius || 14) + '"></div>' +
                    '</div></div>';
            }).join('') + '</div>';

        el.querySelectorAll('[data-psid]').forEach(inp => {
            inp.addEventListener('change', () => {
                const settings = DataStore.getSectionSettings();
                const sid = inp.dataset.psid;
                if (!settings[sid]) return;
                if (!settings[sid].responsive) settings[sid].responsive = {};
                if (!settings[sid].responsive[_platformTab]) settings[sid].responsive[_platformTab] = {};
                settings[sid].responsive[_platformTab][inp.dataset.pfield] = Number(inp.value);
                DataStore.setSectionSettings(settings);
            });
        });
    }

    /* ═══════════ SYNC VE ORDER → SECTIONSETTINGS ═══════════ */
    function _syncVEOrderToSectionSettings(overrides) {
        try {
            var order = overrides.order || [];
            var hidden = overrides.hidden || {};
            var ssRaw = localStorage.getItem('tamilAIStream_sectionSettings');
            var ss = ssRaw ? JSON.parse(ssRaw) : null;
            if (!ss || typeof ss !== 'object') return;
            // Sync order
            order.forEach(function(id, i) {
                if (ss[id]) ss[id].order = i + 1;
            });
            Object.keys(ss).forEach(function(id) {
                if (order.indexOf(id) === -1 && ss[id]) ss[id].order = 999;
            });
            // Sync visibility (VE hidden → sectionSettings enabled)
            Object.keys(ss).forEach(function(id) {
                if (hidden.hasOwnProperty(id)) ss[id].enabled = !hidden[id];
            });
            localStorage.setItem('tamilAIStream_sectionSettings', JSON.stringify(ss));
        } catch(e) { console.warn('[Admin] Failed to sync VE order to sectionSettings:', e); }
    }

    function _broadcastContentUpdate() {
        try {
            var bc = new BroadcastChannel('tamilAIStream_sync');
            bc.postMessage({ type: 'content-updated', timestamp: Date.now() });
            bc.close();
        } catch(e) { /* BroadcastChannel not supported */ }
        try { window.dispatchEvent(new CustomEvent('tamilAIStream-content-synced', { detail: { timestamp: Date.now() } })); } catch(e) {}
    }

    /* ═══════════ CONVERT OVERRIDES TO MAIN SITE FORMAT ═══════════ */
    function writeOverridesToLocalStorage(overrides) {
        try {
            var sectionStates = [];
            var veOverrides = {};
            var sections = overrides.sections || {};
            var order = overrides.order || Object.keys(sections);
            var hidden = overrides.hidden || {};
            order.forEach(function(id) {
                sectionStates.push({ id: id, hidden: !!hidden[id], display: hidden[id] ? 'none' : '', order: order.indexOf(id) });
                if (sections[id]) {
                    veOverrides['[data-section="' + id + '"]'] = {};
                    Object.keys(sections[id]).forEach(function(device) {
                        veOverrides['[data-section="' + id + '"]'][device] = sections[id][device];
                    });
                }
            });
            Object.keys(sections).forEach(function(id) {
                if (order.indexOf(id) === -1) {
                    sectionStates.push({ id: id, hidden: !!hidden[id], display: hidden[id] ? 'none' : '', order: 999 });
                    veOverrides['[data-section="' + id + '"]'] = {};
                    Object.keys(sections[id]).forEach(function(device) {
                        veOverrides['[data-section="' + id + '"]'][device] = sections[id][device];
                    });
                }
            });
            var payload = { sectionStates: sectionStates, overrides: veOverrides, timestamp: Date.now() };
            localStorage.setItem('tamilAIStream_veOverrides', JSON.stringify(payload));
        } catch(e) { console.warn('[Admin] Failed to write VE overrides to localStorage:', e); }
    }

    /* ═══════════ SAVE / PUBLISH / TOPBAR ═══════════ */
    async function saveToStaging() {
        showProgress(20, 'Saving...');
        try {
            let overrides = { sections: {}, order: [], hidden: {} };
            let gs = {};
            if (typeof AdminEditor !== 'undefined') {
                try { overrides = AdminEditor.exportOverrides(); } catch(e) {}
                try { gs = AdminEditor.getGlobalSettings(); } catch(e) {}
            }
            writeOverridesToLocalStorage(overrides);
            _syncVEOrderToSectionSettings(overrides);
            showProgress(50, 'Uploading...');
            var saveRes = await fetch('/api/admin-overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-direct', overrides, admin: 'Admin' }) });
            var saveData = await saveRes.json().catch(function() { return null; });
            if (!saveRes.ok || (saveData && !saveData.success)) { throw new Error('Overrides save failed: ' + (saveData && saveData.error || saveRes.status)); }
            showProgress(75, 'Syncing...');
            var gsRes = await fetch('/api/global-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: gs, admin: 'Admin', publish: true }) });
            var gsData = await gsRes.json().catch(function() { return null; });
            if (!gsRes.ok || (gsData && !gsData.success)) { console.warn('[Admin] Global settings save warning:', gsData); }
            if (typeof ContentSync !== 'undefined') {
                try {
                    const mPayload = ContentSync.buildContentPayload();
                    mPayload.updatedAt = new Date().toISOString();
                    await ContentSync.uploadManifest(mPayload);
                    ContentSync.persistLocalContent(mPayload);
                } catch(e) { console.warn('[Admin] Manifest upload failed:', e); }
            }
            if (typeof AdminEditor !== 'undefined') { try { AdminEditor.markClean(); } catch(e) {} }
            if (typeof AdminEditor !== 'undefined') { try { AdminEditor.applyAllOverrides(); } catch(e) {} }
            _broadcastContentUpdate();
            showProgress(100, 'Live!');
            toast('Saved & deployed', 'ok'); refreshStatus(); hideProgress();
        } catch (e) { toast('Save failed: ' + e.message, 'err'); hideProgress(); }
    }

    window.saveAllSettings = async function() {
        showProgress(10, 'Saving...');
        try {
            showProgress(20, 'Saving overrides...');
            let overrides = { sections: {}, order: [], hidden: {} };
            if (typeof AdminEditor !== 'undefined') { try { overrides = AdminEditor.exportOverrides(); } catch(e) {} }
            writeOverridesToLocalStorage(overrides);
            _syncVEOrderToSectionSettings(overrides);
            showProgress(40, 'Uploading to R2...');
            var saveRes2 = await fetch('/api/admin-overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-direct', overrides, admin: 'Admin' }) });
            var saveData2 = await saveRes2.json().catch(function() { return null; });
            if (!saveRes2.ok || (saveData2 && !saveData2.success)) { throw new Error('Overrides save failed: ' + (saveData2 && saveData2.error || saveRes2.status)); }
            showProgress(60, 'Saving global settings...');
            let gs = {};
            if (typeof AdminEditor !== 'undefined') { try { gs = AdminEditor.getGlobalSettings(); } catch(e) {} }
            var gsRes2 = await fetch('/api/global-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: gs, admin: 'Admin', publish: true }) });
            var gsData2 = await gsRes2.json().catch(function() { return null; });
            if (!gsRes2.ok || (gsData2 && !gsData2.success)) { console.warn('[Admin] Global settings save warning:', gsData2); }
            showProgress(80, 'Syncing content to R2...');
            if (typeof ContentSync !== 'undefined') {
                try {
                    const mPayload2 = ContentSync.buildContentPayload();
                    mPayload2.updatedAt = new Date().toISOString();
                    await ContentSync.uploadManifest(mPayload2);
                    ContentSync.persistLocalContent(mPayload2);
                } catch(e) { console.warn('[Admin] Manifest upload failed:', e); }
            }
            showProgress(95, 'Applying...');
            if (typeof AdminEditor !== 'undefined') { try { AdminEditor.markClean(); } catch(e) {} }
            if (typeof AdminEditor !== 'undefined') { try { AdminEditor.applyAllOverrides(); } catch(e) {} }
            _broadcastContentUpdate();
            showProgress(100, 'All changes live!');
            toast('All settings saved & published', 'ok');
            hideProgress();
        } catch (e) { toast('Save failed: ' + e.message, 'err'); hideProgress(); }
    };

    async function doPublish() { if (!confirm('Publish all changes?')) return; await saveToStaging(); toast('Published!', 'ok'); }
    async function refreshStatus() { try { if (typeof PublishManager !== 'undefined') { await PublishManager.refreshStatus(); } const el = $('tbStatus'); if (el) el.textContent = 'All changes live'; } catch (e) {} }

    const btnSave = $('btnSave'); if (btnSave) btnSave.addEventListener('click', saveToStaging);
    const btnPublish = $('btnPublish'); if (btnPublish) btnPublish.addEventListener('click', doPublish);

    let _previewMode = false;
    const btnPreview = $('btnPreview');
    if (btnPreview) btnPreview.addEventListener('click', () => {
        _previewMode = !_previewMode;
        btnPreview.classList.toggle('active', _previewMode);
        btnPreview.innerHTML = _previewMode ? '<i class="fas fa-pen"></i> Edit' : '<i class="fas fa-eye"></i> Preview';
        if (_currentPage === 'visual-editor') {
            const lp = $('left-panel'); if (lp) lp.style.display = _previewMode ? 'none' : '';
            const rp = $('right-panel'); if (rp) rp.style.display = _previewMode ? 'none' : '';
            const ca = $('center-area'); if (ca) { ca.style.left = _previewMode ? '0' : ''; ca.style.right = _previewMode ? '0' : ''; }
        }
    });

    const btnHistory = $('btnHistory');
    if (btnHistory) btnHistory.addEventListener('click', () => {
        openModal('mHistory');
        const entries = (typeof PublishManager !== 'undefined' && PublishManager.getChangesHistory) ? PublishManager.getChangesHistory() : [];
        const body = $('mHistoryBody');
        if (body) body.innerHTML = entries.length ? entries.slice(0, 80).map(e =>
            '<div class="h-entry"><div class="h-icon h-icon-sync"><i class="fas fa-pen"></i></div><div class="h-info"><div class="h-title">' + (e.type || 'edit') + '</div><div class="h-detail">' + (e.details || '') + '</div><div class="h-meta"><span>' + new Date(e.timestamp).toLocaleString() + '</span></div></div></div>'
        ).join('') : '<div class="empty-state"><p>No changes yet</p></div>';
    });

    const btnVersions = $('btnVersions');
    if (btnVersions) btnVersions.addEventListener('click', async () => {
        openModal('mVersions');
        const body = $('mVersionsBody');
        if (body) body.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
        try {
            const res = await PublishManager.getVersions();
            const versions = res.versions || [];
            if (body) body.innerHTML = versions.length ? versions.map(v =>
                '<div class="h-entry"><div class="h-icon h-icon-sync"><i class="fas fa-code-commit"></i></div><div class="h-info"><div class="h-title">' + (v.label || v.id) + '</div><div class="h-meta"><span>' + new Date(v.savedAt).toLocaleString() + '</span></div></div><button class="tb-btn" style="flex-shrink:0;" onclick="restoreVersion(\'' + v.id + '\',\'' + (v.label||'').replace(/'/g,"\\'") + '\')"><i class="fas fa-rotate-left"></i></button></div>'
            ).join('') : '<div class="empty-state"><p>No versions yet</p></div>';
        } catch (e) { if (body) body.innerHTML = '<div class="empty-state"><p>Error: ' + e.message + '</p></div>'; }
    });
    const mSaveSnap = $('mSaveSnap');
    if (mSaveSnap) mSaveSnap.addEventListener('click', async () => { try { await PublishManager.saveVersionSnapshot('Manual snapshot'); toast('Snapshot saved', 'ok'); if (btnVersions) btnVersions.click(); } catch (e) { toast('Failed', 'err'); } });
    window.restoreVersion = async (id, label) => { if (!confirm('Restore to "' + label + '"?')) return; try { await PublishManager.revertToVersion(id); toast('Restored', 'ok'); closeModal('mVersions'); refreshStatus(); } catch (e) { toast('Failed', 'err'); } };

    document.querySelectorAll('[data-device]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-device]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (typeof AdminEditor !== 'undefined') { try { AdminEditor.setDevice(btn.dataset.device); } catch(e) {} }
        });
    });

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToStaging(); }
        if (typeof AdminEditor !== 'undefined') {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); try { AdminEditor.undo(); } catch(e) {} }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); try { AdminEditor.redo(); } catch(e) {} }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !window.getSelection().toString()) { try { AdminEditor.copyProperties(); } catch(e) {} }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') { try { AdminEditor.pasteProperties(); } catch(e) {} }
        }
    });

    /* ═══════════ VISUAL EDITOR (preserved) ═══════════ */
    try {
        if (typeof AdminEditor === 'undefined') { console.warn('[Admin] AdminEditor not loaded — visual editor disabled'); return; }
        const frame = $('site-frame');
        if (!frame) { console.warn('[Admin] site-frame not found — visual editor disabled'); return; }

        AdminEditor.init(frame);

        let _selectedCat = 'layout';

        function renderSectionList() {
            const sections = AdminEditor.getSections();
            const el = $('sectionList'); if (!el) return;
            el.innerHTML = sections.map(sec => {
                const sel = AdminEditor.getSelectedSectionId() === sec.id;
                const hid = AdminEditor.getAllOverrides().hidden?.[sec.id];
                return '<div class="lp-item' + (sel ? ' selected' : '') + (hid ? ' hidden-section' : '') + '" data-sid="' + sec.id + '">' +
                    '<span class="lp-item-icon"><i class="fas ' + (hid ? 'fa-eye-slash' : 'fa-eye') + '"></i></span>' +
                    '<span class="lp-item-label">' + sec.label + '</span>' +
                    '<span class="lp-item-actions"><button class="lp-act" data-act="up"><i class="fas fa-arrow-up"></i></button><button class="lp-act" data-act="down"><i class="fas fa-arrow-down"></i></button><button class="lp-act" data-act="toggle"><i class="fas fa-eye"></i></button><button class="lp-act" data-act="dup"><i class="fas fa-copy"></i></button><button class="lp-act red" data-act="del"><i class="fas fa-trash"></i></button></span></div>';
            }).join('');

            el.querySelectorAll('.lp-item').forEach(item => {
                item.addEventListener('click', e => { if (e.target.closest('.lp-act')) return; AdminEditor.selectSection(item.dataset.sid); AdminEditor.setElementMode(false); renderSectionList(); renderPropertyPanel(); updateElementModeUI(); });
            });
            el.querySelectorAll('.lp-act').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const sid = btn.closest('.lp-item').dataset.sid;
                    const act = btn.dataset.act;
                    if (act === 'up') AdminEditor.moveSection(sid, 'up');
                    else if (act === 'down') AdminEditor.moveSection(sid, 'down');
                    else if (act === 'toggle') AdminEditor.toggleVisibility(sid);
                    else if (act === 'dup') { AdminEditor.duplicateSection(sid); toast('Duplicated', 'ok'); }
                    else if (act === 'del') { if (confirm('Delete?')) AdminEditor.deleteSection(sid); }
                    renderSectionList(); renderPropertyPanel();
                });
            });
        }

        function renderLayerList() {
            const tree = AdminEditor.getElementTree();
            function renderNode(node, depth) {
                let html = '<div class="lp-item' + (AdminEditor.getSelectedElementId() === node.id ? ' selected' : '') + (node.locked ? ' hidden-section' : '') + '" data-eid="' + node.id + '" style="padding-left:' + (12 + depth * 14) + 'px;"><span class="lp-item-icon" style="width:12px;font-size:8px;">' + (node.children && node.children.length ? '<i class="fas fa-caret-down"></i>' : '<i class="fas fa-minus"></i>') + '</span><span class="lp-item-icon"><i class="fas fa-' + (node.locked ? 'lock' : node.visible ? 'eye' : 'eye-slash') + '" style="font-size:9px;"></i></span><span class="lp-item-label" style="font-size:10px;">' + node.label + '</span><span class="lp-item-actions"><button class="lp-act" data-act="lock"><i class="fas fa-' + (node.locked ? 'lock' : 'unlock') + '"></i></button></span></div>';
                if (node.children) node.children.forEach(c => { html += renderNode(c, depth + 1); });
                return html;
            }
            const el = $('layerList'); if (!el) return;
            el.innerHTML = tree.map(n => renderNode(n, 0)).join('');
            el.querySelectorAll('.lp-item').forEach(item => {
                item.addEventListener('click', e => { if (e.target.closest('.lp-act')) return; AdminEditor.setElementMode(true); AdminEditor.selectElement(item.dataset.eid); renderLayerList(); renderPropertyPanel(); updateElementModeUI(); });
            });
            el.querySelectorAll('.lp-act').forEach(btn => {
                btn.addEventListener('click', e => { e.stopPropagation(); AdminEditor.toggleLock(btn.closest('.lp-item').dataset.eid); renderLayerList(); });
            });
        }

        AdminEditor.on('sections-detected', renderSectionList);
        AdminEditor.on('section-selected', () => { renderSectionList(); renderPropertyPanel(); });
        AdminEditor.on('visibility-changed', renderSectionList);
        AdminEditor.on('section-moved', renderSectionList);
        AdminEditor.on('sections-reordered', renderSectionList);
        AdminEditor.on('undo', () => { renderSectionList(); renderLayerList(); renderPropertyPanel(); updateUndoRedo(); });
        AdminEditor.on('redo', () => { renderSectionList(); renderLayerList(); renderPropertyPanel(); updateUndoRedo(); });
        AdminEditor.on('override-changed', updateUndoRedo);
        AdminEditor.on('element-selected', () => { renderLayerList(); renderPropertyPanel(); });
        AdminEditor.on('elements-detected', renderLayerList);
        AdminEditor.on('element-override-changed', updateUndoRedo);

        const tabSections = $('tabSections');
        const tabLayers = $('tabLayers');
        if (tabSections) tabSections.addEventListener('click', () => { tabSections.classList.add('active'); if (tabLayers) tabLayers.classList.remove('active'); const sl = $('sectionList'); if (sl) sl.style.display = ''; const ll = $('layerList'); if (ll) ll.style.display = 'none'; });
        if (tabLayers) tabLayers.addEventListener('click', () => { tabLayers.classList.add('active'); if (tabSections) tabSections.classList.remove('active'); const ll = $('layerList'); if (ll) ll.style.display = ''; const sl = $('sectionList'); if (sl) sl.style.display = 'none'; AdminEditor.detectElements(); renderLayerList(); });

        function renderPropertyPanel() {
            const sid = AdminEditor.getSelectedSectionId();
            const body = $('rpBody');
            const tabs = $('rpTabs');
            const nameEl = $('rpSectionName');
            if (!body || !tabs || !nameEl) return;
            if (!sid) { nameEl.textContent = ''; tabs.innerHTML = ''; body.innerHTML = '<div class="rp-empty"><i class="fas fa-arrow-pointer"></i><h4>Select a Section</h4><p>Click a section to edit its CSS properties.</p></div>'; return; }
            const sec = AdminEditor.getSections().find(s => s.id === sid);
            nameEl.textContent = sec ? sec.label : sid;
            const cats = Object.entries(AdminEditor.CSS_CATEGORIES);
            tabs.innerHTML = cats.map(([key, cat]) => '<button class="rp-tab' + (key === _selectedCat ? ' active' : '') + '" data-cat="' + key + '"><i class="fas ' + cat.icon + '"></i> ' + cat.label + '</button>').join('');
            tabs.querySelectorAll('.rp-tab').forEach(tab => { tab.addEventListener('click', () => { _selectedCat = tab.dataset.cat; renderPropertyPanel(); }); });
            const cat = AdminEditor.CSS_CATEGORIES[_selectedCat];
            if (!cat) { body.innerHTML = ''; return; }
            const overrides = AdminEditor.getOverrides(sid);
            body.innerHTML = '<div class="rp-props">' + cat.properties.map(prop => {
                const val = overrides[prop.key] || '';
                let input = '';
                if (prop.type === 'color') input = '<div class="rp-prop-row"><input type="color" class="rp-input-color" data-prop="' + prop.key + '" value="' + (val || '#000000') + '"><input type="text" class="rp-input" data-prop="' + prop.key + '" value="' + val + '"></div>';
                else if (prop.type === 'select') input = '<select class="rp-select" data-prop="' + prop.key + '"><option value="">—</option>' + prop.options.map(o => '<option value="' + o + '"' + (val === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>';
                else if (prop.type === 'range') input = '<div class="rp-prop-row"><input type="range" class="rp-range" data-prop="' + prop.key + '" min="' + (prop.min||0) + '" max="' + (prop.max||1) + '" step="' + (prop.step||0.05) + '" value="' + (val || prop.max || 1) + '"><span style="font-size:10px;color:var(--text3);min-width:28px;text-align:right;">' + (val || '1') + '</span></div>';
                else if (prop.type === 'number') input = '<input type="number" class="rp-input" data-prop="' + prop.key + '" value="' + val + '">';
                else if (prop.type === 'size') input = '<div class="rp-prop-row"><input type="text" class="rp-input" data-prop="' + prop.key + '" value="' + val + '" placeholder="e.g. 20px"></div>';
                else input = '<input type="text" class="rp-input" data-prop="' + prop.key + '" value="' + val + '">';
                return '<div class="rp-prop"><div class="rp-prop-label"><span>' + prop.label + '</span>' + (val ? '<button class="rp-prop-reset" data-prop="' + prop.key + '"><i class="fas fa-xmark"></i></button>' : '') + '</div>' + input + '</div>';
            }).join('') + '</div>';

            body.querySelectorAll('.rp-input, .rp-select, .rp-input-color, .rp-range').forEach(inp => {
                const handler = () => { AdminEditor.setOverride(sid, inp.dataset.prop, inp.value); if (inp.type === 'range') { const span = inp.parentElement.querySelector('span'); if (span) span.textContent = inp.value; } };
                inp.addEventListener('input', handler);
                inp.addEventListener('change', handler);
            });
            body.querySelectorAll('.rp-input-color').forEach(ci => { ci.addEventListener('input', () => { const ti = ci.parentElement.querySelector('.rp-input'); if (ti) ti.value = ci.value; }); });
            body.querySelectorAll('.rp-prop-reset').forEach(btn => { btn.addEventListener('click', () => { AdminEditor.setOverride(sid, btn.dataset.prop, ''); renderPropertyPanel(); }); });
        }

        function updateUndoRedo() { const u = $('btnUndo'); const r = $('btnRedo'); if (u) u.disabled = !AdminEditor.canUndo(); if (r) r.disabled = !AdminEditor.canRedo(); }
        const btnUndo = $('btnUndo'); if (btnUndo) btnUndo.addEventListener('click', () => { AdminEditor.undo(); toast('Undo', 'info'); });
        const btnRedo = $('btnRedo'); if (btnRedo) btnRedo.addEventListener('click', () => { AdminEditor.redo(); toast('Redo', 'info'); });

        function renderGlobalSettings() {
            const gs = AdminEditor.getGlobalSettings();
            const body = $('globalPanelBody'); if (!body) return;
            const vars = [
                { key: '--bg-primary', label: 'Background', cat: 'colors' }, { key: '--bg-secondary', label: 'Surface', cat: 'colors' },
                { key: '--text-primary', label: 'Text', cat: 'colors' }, { key: '--emerald-500', label: 'Accent', cat: 'colors' },
                { key: '--font-family', label: 'Font Family', cat: 'fonts' },
                { key: '--radius-sm', label: 'Radius SM', cat: 'spacing' }, { key: '--radius-md', label: 'Radius MD', cat: 'spacing' },
            ];
            body.innerHTML = vars.map(v => {
                const val = gs[v.cat]?.[v.key] || '';
                const isColor = v.key.includes('color') || v.key.includes('bg') || v.key.includes('text') || v.key.includes('emerald');
                return '<div class="fg"><div class="fg-label">' + v.label + '</div>' + (isColor ? '<div class="fg-row"><input type="color" class="fg-color" data-gcat="' + v.cat + '" data-gkey="' + v.key + '" value="' + (val || '#000000') + '"><input type="text" class="rp-input" data-gcat="' + v.cat + '" data-gkey="' + v.key + '" value="' + val + '" style="flex:1;"></div>' : '<input type="text" class="rp-input" data-gcat="' + v.cat + '" data-gkey="' + v.key + '" value="' + val + '">') + '</div>';
            }).join('');

            body.querySelectorAll('.rp-input, .fg-color').forEach(inp => {
                inp.addEventListener('change', () => {
                    const gs2 = AdminEditor.getGlobalSettings();
                    if (!gs2[inp.dataset.gcat]) gs2[inp.dataset.gcat] = {};
                    gs2[inp.dataset.gcat][inp.dataset.gkey] = inp.value;
                    AdminEditor.setGlobalSettings(gs2);
                });
            });
        }

        AdminEditor.on('frame-loaded', async () => {
            try { const r = await fetch('/api/admin-overrides'); const d = await r.json(); if (d.overrides) AdminEditor.importOverrides(d.overrides); } catch (e) {}
            try { const r2 = await fetch('/api/global-settings'); const d2 = await r2.json(); if (d2.settings) AdminEditor.setGlobalSettings(d2.settings); } catch (e) {}
            AdminEditor.detectSections(); AdminEditor.detectElements(); renderSectionList(); renderLayerList(); renderGlobalSettings(); refreshStatus();
        });

        AdminEditor.on('override-changed', () => { clearTimeout(window._autoSaveTimer); window._autoSaveTimer = setTimeout(() => saveToStaging(), 3000); });
        AdminEditor.on('global-settings-changed', () => { clearTimeout(window._autoSaveTimer); window._autoSaveTimer = setTimeout(() => saveToStaging(), 3000); });

        const btnRefreshSections = $('btnRefreshSections');
        if (btnRefreshSections) btnRefreshSections.addEventListener('click', () => { AdminEditor.detectSections(); AdminEditor.detectElements(); renderSectionList(); renderLayerList(); toast('Refreshed', 'info'); });

        function updateElementModeUI() { const on = AdminEditor.isElementMode(); const pill = $('pillElementMode'); const text = $('pillElementModeText'); if (pill) { pill.classList.toggle('on', on); pill.classList.toggle('off', !on); } if (text) text.textContent = on ? 'Element Mode ON' : 'Element Mode'; }
        const pillElementMode = $('pillElementMode');
        if (pillElementMode) pillElementMode.addEventListener('click', () => { AdminEditor.setElementMode(!AdminEditor.isElementMode()); updateElementModeUI(); toast(AdminEditor.isElementMode() ? 'Element mode on' : 'Section mode', 'info'); });
        AdminEditor.on('element-mode-changed', updateElementModeUI);

        const btnCopy = $('btnCopy'); if (btnCopy) btnCopy.addEventListener('click', () => { AdminEditor.copyProperties(); toast('Copied', 'info'); });
        const btnPaste = $('btnPaste'); if (btnPaste) btnPaste.addEventListener('click', () => { AdminEditor.pasteProperties(); toast('Pasted', 'ok'); renderPropertyPanel(); });

        const btnLock = $('btnLock');
        if (btnLock) btnLock.addEventListener('click', () => { const id = AdminEditor.getSelectedElementId() || AdminEditor.getSelectedSectionId(); if (!id) { toast('Select first', 'err'); return; } AdminEditor.toggleLock(id); toast(AdminEditor.isLocked(id) ? 'Locked' : 'Unlocked', 'info'); renderLayerList(); });

        const btnGlobal = $('btnGlobal');
        if (btnGlobal) btnGlobal.addEventListener('click', () => {
            const panel = $('globalPanel');
            const rightBody = $('rpBody');
            const rpTabs = document.querySelector('#right-panel .rp-tabs');
            if (panel && rightBody) {
                if (panel.style.display === 'none') { panel.style.display = ''; rightBody.style.display = 'none'; if (rpTabs) rpTabs.style.display = 'none'; const t = $('rpTitle'); if (t) t.innerHTML = '<i class="fas fa-globe"></i> Global Settings'; renderGlobalSettings(); }
                else { panel.style.display = 'none'; rightBody.style.display = ''; if (rpTabs) rpTabs.style.display = ''; const t = $('rpTitle'); if (t) t.innerHTML = '<i class="fas fa-sliders"></i> Properties'; renderPropertyPanel(); }
            }
        });

        updateUndoRedo();
    } catch(e) { console.error('[Admin] Visual editor init failed:', e); }
})();
