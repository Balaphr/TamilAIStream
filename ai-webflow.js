'use strict';
/* AI Webflow Builder - Visual Website Builder for Tamil AI Stream */
const AIWebflow = (function () {
    let active = false, selectedEl = null, hoveredEl = null, currentDevice = 'desktop';
    let currentZoom = 100, undoStack = [], redoStack = [], maxUndo = 60;
    let clipboard = null, dragData = null, elementMap = new Map();
    let aiPanelOpen = false, aiMessages = [], leftTab = 'navigator', rightTab = 'style';

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    /* Component Registry */
    const COMPONENTS = {
        'section': {icon:'fa-square',label:'Section',category:'layout',tag:'section',defaults:{padding:'40px 20px',margin:'0 0 20px 0',background:'transparent',borderRadius:'0'}},
        'container': {icon:'fa-table-cells',label:'Container',category:'layout',tag:'div',defaults:{maxWidth:'1200px',margin:'0 auto',padding:'0 20px'}},
        'columns': {icon:'fa-table-columns',label:'Columns',category:'layout',tag:'div',defaults:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px'}},
        'grid': {icon:'fa-table-cells-large',label:'Grid',category:'layout',tag:'div',defaults:{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'16px'}},
        'divider': {icon:'fa-minus',label:'Divider',category:'layout',tag:'hr',defaults:{border:'none',borderTop:'1px solid rgba(255,255,255,0.1)',margin:'20px 0'}},
        'spacer': {icon:'fa-arrows-up-down',label:'Spacer',category:'layout',tag:'div',defaults:{height:'40px'}},
        'heading': {icon:'fa-heading',label:'Heading',category:'content',tag:'h2',defaults:{fontSize:'28px',fontWeight:'700',color:'#ffffff',margin:'0 0 12px 0'},text:'Heading Text'},
        'text': {icon:'fa-paragraph',label:'Text',category:'content',tag:'p',defaults:{fontSize:'16px',color:'rgba(255,255,255,0.7)',lineHeight:'1.6',margin:'0 0 12px 0'},text:'Enter your text here...'},
        'image': {icon:'fa-image',label:'Image',category:'content',tag:'img',defaults:{width:'100%',borderRadius:'12px'},attrs:{src:'',alt:'Image'}},
        'button': {icon:'fa-button-pointer',label:'Button',category:'content',tag:'button',defaults:{padding:'12px 28px',borderRadius:'10px',background:'linear-gradient(135deg,#10b981,#059669)',color:'#ffffff',fontWeight:'600',fontSize:'14px',border:'none',cursor:'pointer'},text:'Click Me'},
        'link': {icon:'fa-link',label:'Link',category:'content',tag:'a',defaults:{color:'#34d399',textDecoration:'underline',fontSize:'14px'},text:'Link Text',attrs:{href:'#'}},
        'list': {icon:'fa-list-ul',label:'List',category:'content',tag:'ul',defaults:{paddingLeft:'20px',color:'rgba(255,255,255,0.7)',fontSize:'14px'},children:['Item 1','Item 2','Item 3']},
        'icon': {icon:'fa-star',label:'Icon',category:'content',tag:'i',defaults:{fontSize:'24px',color:'#10b981'},attrs:{class:'fas fa-star'}},
        'music-hero': {icon:'fa-music',label:'Music Hero',category:'tamilai',tag:'section',defaults:{padding:'60px 20px',background:'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.05))'},tamilaiComponent:'ai-music-hero'},
        'trending-playlists': {icon:'fa-fire',label:'Trending Playlists',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'ai-trending'},
        'live-fm': {icon:'fa-tower-broadcast',label:'Live FM Stations',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'ai-live-fm'},
        'live-news': {icon:'fa-newspaper',label:'Live Tamil News',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'ai-live-news'},
        'recently-played': {icon:'fa-clock-rotate-left',label:'Recently Played',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'ai-recently'},
        'ai-recommendations': {icon:'fa-wand-magic-sparkles',label:'AI Recommendations',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'ai-ai-rec'},
        'music-by-era': {icon:'fa-clock',label:'Music by Era',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'ai-decades'},
        'favourite-songs': {icon:'fa-heart',label:'Favourite Songs',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'ai-favorites'},
        'audio-player': {icon:'fa-play-circle',label:'Audio Player',category:'tamilai',tag:'div',defaults:{padding:'16px',background:'rgba(0,0,0,0.3)',borderRadius:'16px'},tamilaiComponent:'global-player'},
        'song-card': {icon:'fa-music',label:'Song Card',category:'tamilai',tag:'div',defaults:{padding:'12px',background:'rgba(255,255,255,0.04)',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.08)'}},
        'station-card': {icon:'fa-broadcast-tower',label:'Station Card',category:'tamilai',tag:'div',defaults:{padding:'12px',background:'rgba(255,255,255,0.04)',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.08)'}},
        'artist-card': {icon:'fa-user',label:'Artist Card',category:'tamilai',tag:'div',defaults:{padding:'12px',background:'rgba(255,255,255,0.04)',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.08)'}},
        'carousel': {icon:'fa-arrows-left-right',label:'Carousel',category:'tamilai',tag:'div',defaults:{display:'flex',gap:'16px',overflowX:'auto',padding:'8px 0'}},
        'chart-list': {icon:'fa-ranking-star',label:'Chart List',category:'tamilai',tag:'div',defaults:{padding:'16px',background:'rgba(255,255,255,0.03)',borderRadius:'12px'}},
        'search-bar': {icon:'fa-search',label:'Search Bar',category:'tamilai',tag:'div',defaults:{padding:'12px 16px',background:'rgba(255,255,255,0.06)',borderRadius:'24px',border:'1px solid rgba(255,255,255,0.1)'}},
        'playlist-view': {icon:'fa-list',label:'Playlist View',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'page-playlists'},
        'fm-stations-view': {icon:'fa-radio',label:'FM Stations View',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'page-radio'},
        'news-section': {icon:'fa-newspaper',label:'News Section',category:'tamilai',tag:'section',defaults:{padding:'32px 0'},tamilaiComponent:'page-news'},
        'user-profile': {icon:'fa-user-circle',label:'User Profile',category:'tamilai',tag:'div',defaults:{padding:'24px',background:'rgba(255,255,255,0.04)',borderRadius:'16px'}},
        'footer': {icon:'fa-grip-lines',label:'Footer',category:'tamilai',tag:'footer',defaults:{padding:'40px 20px',background:'rgba(0,0,0,0.2)',textAlign:'center'}}
    };

    /* Section Templates */
    const TEMPLATES = {
        'hero-section': {name:'Hero Section',desc:'Full-width hero with title and CTA',icon:'fa-image',
            html:'<section style="padding:80px 20px;text-align:center;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(59,130,246,0.08));border-radius:16px;margin:0 0 24px 0;" data-aw-element="section" data-aw-label="Hero Section"><h1 style="font-size:42px;font-weight:800;color:#fff;margin:0 0 16px 0;" data-aw-element="heading" data-aw-label="Hero Title">Welcome to Tamil AI Stream</h1><p style="font-size:18px;color:rgba(255,255,255,0.6);margin:0 0 28px 0;max-width:600px;margin-left:auto;margin-right:auto;" data-aw-element="text" data-aw-label="Hero Subtitle">AI-Powered Tamil Radio Experience</p><button style="padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer;" data-aw-element="button" data-aw-label="CTA Button">Get Started</button></section>'},
        'music-section': {name:'Music Section',desc:'Tamil AI Stream music hero with player',icon:'fa-music',
            html:'<section style="padding:40px 20px;" data-aw-element="section" data-aw-label="Music Section"><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1200px;margin:0 auto;" data-aw-element="grid" data-aw-label="Music Grid"><div style="padding:32px;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(59,130,246,0.06));border-radius:16px;border:1px solid rgba(255,255,255,0.08);" data-aw-element="div" data-aw-label="Hero Card"><h2 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 8px 0;" data-aw-element="heading" data-aw-label="Title">Tamil Music</h2><p style="font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 16px 0;" data-aw-element="text" data-aw-label="Description">Select a song to play</p><button style="padding:10px 24px;border-radius:10px;background:#10b981;color:#fff;font-weight:600;border:none;cursor:pointer;" data-aw-element="button" data-aw-label="Play Button">Play Now</button></div><div style="padding:32px;background:rgba(255,255,255,0.04);border-radius:16px;border:1px solid rgba(255,255,255,0.08);" data-aw-element="div" data-aw-label="Playlist Card"><h3 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 12px 0;" data-aw-element="heading" data-aw-label="Trending Title">Trending Playlists</h3><div style="display:flex;gap:12px;" data-aw-element="div" data-aw-label="Playlist Row"><div style="width:80px;height:80px;border-radius:10px;background:rgba(255,255,255,0.06);"></div><div style="width:80px;height:80px;border-radius:10px;background:rgba(255,255,255,0.06);"></div><div style="width:80px;height:80px;border-radius:10px;background:rgba(255,255,255,0.06);"></div></div></div></div></section>'},
        'fm-section': {name:'FM Stations Section',desc:'Live FM radio stations grid',icon:'fa-tower-broadcast',
            html:'<section style="padding:32px 20px;" data-aw-element="section" data-aw-label="FM Section"><h2 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 20px 0;" data-aw-element="heading" data-aw-label="FM Title">Live FM Stations</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;" data-aw-element="grid" data-aw-label="FM Grid"><div style="padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);text-align:center;" data-aw-element="div" data-aw-label="Station 1"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);margin:0 auto 8px;"></div><div style="font-size:14px;font-weight:600;color:#fff;">Radio Mirchi</div><div style="font-size:12px;color:rgba(255,255,255,0.4);">98.3 FM</div></div><div style="padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);text-align:center;" data-aw-element="div" data-aw-label="Station 2"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#2563eb);margin:0 auto 8px;"></div><div style="font-size:14px;font-weight:600;color:#fff;">Suryan FM</div><div style="font-size:12px;color:rgba(255,255,255,0.4);">103.5 FM</div></div><div style="padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);text-align:center;" data-aw-element="div" data-aw-label="Station 3"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);margin:0 auto 8px;"></div><div style="font-size:14px;font-weight:600;color:#fff;">Hi FM</div><div style="font-size:12px;color:rgba(255,255,255,0.4);">106.4 FM</div></div></div></section>'},
        'news-section': {name:'News Section',desc:'Live Tamil News cards',icon:'fa-newspaper',
            html:'<section style="padding:32px 20px;" data-aw-element="section" data-aw-label="News Section"><h2 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 20px 0;" data-aw-element="heading" data-aw-label="News Title">Live Tamil News</h2><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;" data-aw-element="grid" data-aw-label="News Grid"><div style="padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);" data-aw-element="div" data-aw-label="News Card 1"><div style="font-size:12px;color:#f59e0b;font-weight:600;margin-bottom:6px;">POLITICS</div><div style="font-size:15px;font-weight:600;color:#fff;margin-bottom:6px;line-height:1.4;">Tamil Nadu Assembly Session Begins Today</div><div style="font-size:12px;color:rgba(255,255,255,0.4);">2 hours ago</div></div><div style="padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);" data-aw-element="div" data-aw-label="News Card 2"><div style="font-size:12px;color:#10b981;font-weight:600;margin-bottom:6px;">SPORTS</div><div style="font-size:15px;font-weight:600;color:#fff;margin-bottom:6px;line-height:1.4;">CSK Wins Thrilling Match in Final Over</div><div style="font-size:12px;color:rgba(255,255,255,0.4);">3 hours ago</div></div></div></section>'},
        'two-column': {name:'Two Column Layout',desc:'Side by side content columns',icon:'fa-table-columns',
            html:'<section style="padding:32px 20px;" data-aw-element="section" data-aw-label="Two Column"><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1200px;margin:0 auto;" data-aw-element="grid" data-aw-label="Columns"><div style="padding:24px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);" data-aw-element="div" data-aw-label="Column 1"><h3 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 12px 0;">Left Column</h3><p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">Content for the left column goes here.</p></div><div style="padding:24px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);" data-aw-element="div" data-aw-label="Column 2"><h3 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 12px 0;">Right Column</h3><p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">Content for the right column goes here.</p></div></div></section>'},
        'cta-section': {name:'Call to Action',desc:'CTA banner with action button',icon:'fa-bullhorn',
            html:'<section style="padding:60px 20px;text-align:center;background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(59,130,246,0.08));border-radius:16px;margin:0 0 24px 0;" data-aw-element="section" data-aw-label="CTA Section"><h2 style="font-size:28px;font-weight:700;color:#fff;margin:0 0 12px 0;">Start Listening Now</h2><p style="font-size:16px;color:rgba(255,255,255,0.5);margin:0 0 24px 0;">Experience AI-powered Tamil radio like never before</p><button style="padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer;">Explore Now</button></section>'},
        'footer-section': {name:'Footer',desc:'Website footer with links',icon:'fa-grip-lines',
            html:'<footer style="padding:48px 20px 24px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.06);margin-top:40px;" data-aw-element="footer" data-aw-label="Footer"><div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:32px;" data-aw-element="grid" data-aw-label="Footer Grid"><div data-aw-element="div" data-aw-label="Footer Brand"><h3 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 8px 0;">Tamil AI Stream</h3><p style="font-size:13px;color:rgba(255,255,255,0.4);line-height:1.5;">AI-Powered Tamil Radio Experience.</p></div><div data-aw-element="div" data-aw-label="Footer Links"><h4 style="font-size:14px;font-weight:600;color:#fff;margin:0 0 12px 0;">Music</h4><div style="font-size:13px;color:rgba(255,255,255,0.4);line-height:2;">Trending<br>Playlists<br>Artists</div></div><div data-aw-element="div" data-aw-label="Footer Links 2"><h4 style="font-size:14px;font-weight:600;color:#fff;margin:0 0 12px 0;">Radio</h4><div style="font-size:13px;color:rgba(255,255,255,0.4);line-height:2;">Live FM<br>Stations<br>News</div></div><div data-aw-element="div" data-aw-label="Footer Links 3"><h4 style="font-size:14px;font-weight:600;color:#fff;margin:0 0 12px 0;">About</h4><div style="font-size:13px;color:rgba(255,255,255,0.4);line-height:2;">Privacy<br>Terms<br>Contact</div></div></div><div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3);" data-aw-element="text" data-aw-label="Copyright">&copy; 2026 Tamil AI Stream. All rights reserved.</div></footer>'}
    };

    function init() { bindToolbar(); bindLeftPanel(); bindRightPanel(); bindCanvasEvents(); bindAI(); bindKeyboard(); bindContextMenu(); console.log('[AIWebflow] Initialized'); }

    function activate() {
        active = true;
        var frame = $('awFrame');
        if (frame) { frame.src = 'index.html'; frame.onload = function () { setTimeout(function () { scanCanvas(); buildNavigator(); }, 1500); }; }
    }

    function deactivate() { active = false; selectedEl = null; clearOverlay(); }

    /* ===== TOOLBAR ===== */
    function bindToolbar() {
        document.querySelectorAll('.aw-device-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var device = this.dataset.awDevice;
                if (!device) return;
                currentDevice = device;
                document.querySelectorAll('.aw-device-btn').forEach(function(b) { b.classList.remove('active'); });
                document.querySelectorAll('[data-aw-device="'+device+'"]').forEach(function(b) { b.classList.add('active'); });
                var w = $('awCanvasWrapper'); if (w) w.className = 'aw-canvas-frame-wrapper ' + device;
                var l = $('awDeviceLabel'); if (l) l.textContent = device.charAt(0).toUpperCase() + device.slice(1);
                toast('Switched to ' + device + ' view', 'info');
            });
        });
        var zi = $('awZoomIn'), zo = $('awZoomOut'), zf = $('awZoomFit');
        if (zi) zi.addEventListener('click', function() { setZoom(currentZoom + 10); });
        if (zo) zo.addEventListener('click', function() { setZoom(currentZoom - 10); });
        if (zf) zf.addEventListener('click', function() { setZoom(100); });
        var ub = $('awUndoBtn'), rb = $('awRedoBtn');
        if (ub) ub.addEventListener('click', undo);
        if (rb) rb.addEventListener('click', redo);
        var sv = $('awSaveBtn'), pv = $('awPreviewBtn'), pb = $('awPublishBtn');
        if (sv) sv.addEventListener('click', saveDraft);
        if (pv) pv.addEventListener('click', previewSite);
        if (pb) pb.addEventListener('click', publishSite);
        var tl = $('awToggleLeft'), tr = $('awToggleRight');
        if (tl) tl.addEventListener('click', function() { var p = document.querySelector('.aw-left-panel'); if (p) p.classList.toggle('collapsed'); });
        if (tr) tr.addEventListener('click', function() { var p = document.querySelector('.aw-right-panel'); if (p) p.classList.toggle('collapsed'); });
        var at = $('awAIToggle'); if (at) at.addEventListener('click', toggleAIPanel);
        var rf = $('awRefreshBtn');
        if (rf) rf.addEventListener('click', function() {
            var f = $('awFrame'); if (!f) return;
            f.src = 'index.html'; f.onload = function() { setTimeout(function() { scanCanvas(); buildNavigator(); toast('Canvas refreshed', 'success'); }, 1500); };
        });
    }

    function setZoom(v) {
        currentZoom = Math.max(50, Math.min(150, v));
        var l = $('awZoomLabel'); if (l) l.textContent = currentZoom + '%';
        var f = $('awFrame'); if (f) { f.style.transform = 'scale(' + (currentZoom/100) + ')'; f.style.transformOrigin = 'top left'; }
    }

    /* ===== CANVAS SCANNING ===== */
    function scanCanvas() {
        var f = $('awFrame'); if (!f || !f.contentDocument) return;
        var doc = f.contentDocument; elementMap.clear();
        var sels = ['[data-section]','[data-ai-page]','.ai-home','.ai-panel','.ai-sidebar','.premium-top-nav','.ytm-main-content','.tamilai-bottom-nav','.ai-music-hero','.ai-trending','.ai-live-fm','.ai-live-news','.ai-recently','.ai-ai-rec','.ai-decades','.ai-favorites','header','footer','section','nav','.ytm-page','.ai-home-row'];
        sels.forEach(function(sel) { try { doc.querySelectorAll(sel).forEach(function(el) {
            if (!el.getAttribute('data-aw-id')) el.setAttribute('data-aw-id','aw-'+Math.random().toString(36).substr(2,9));
            var id = el.getAttribute('data-aw-id');
            elementMap.set(id, {el:el, label:getElementLabel(el), tag:el.tagName.toLowerCase(), id:id});
        }); } catch(e) {} });
        updateStatusBar('Scanned ' + elementMap.size + ' elements');
    }

    function getElementLabel(el) {
        var s = el.getAttribute('data-section'); if (s) return s;
        var a = el.getAttribute('data-ai-page'); if (a) return 'Page: ' + a;
        var c = typeof el.className === 'string' ? el.className : '';
        if (c.includes('ai-music-hero')) return 'Music Hero';
        if (c.includes('ai-trending')) return 'Trending Playlists';
        if (c.includes('ai-live-fm')) return 'Live FM';
        if (c.includes('ai-live-news')) return 'Live News';
        if (c.includes('ai-recently')) return 'Recently Played';
        if (c.includes('ai-ai-rec')) return 'AI Recommendations';
        if (c.includes('ai-decades')) return 'Music by Era';
        if (c.includes('ai-favorites')) return 'Favourites';
        if (c.includes('ai-home-row')) return 'Home Row';
        if (c.includes('ai-home')) return 'AI Home';
        if (c.includes('ai-sidebar')) return 'Sidebar';
        if (c.includes('premium-top-nav')) return 'Top Navigation';
        if (c.includes('tamilai-bottom-nav')) return 'Bottom Nav';
        if (c.includes('ytm-page')) return 'Page: ' + (el.id || 'unknown');
        if (el.tagName === 'HEADER') return 'Header';
        if (el.tagName === 'FOOTER') return 'Footer';
        if (el.tagName === 'NAV') return 'Navigation';
        if (el.tagName === 'SECTION') return 'Section';
        if (el.id) return el.id;
        return el.tagName.toLowerCase();
    }

    function bindCanvasEvents() {
        var f = $('awFrame'); if (!f) return;
        f.addEventListener('load', function() {
            try {
                var doc = f.contentDocument; if (!doc) return;
                doc.addEventListener('click', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    var t = e.target;
                    while (t && t !== doc.body && !t.getAttribute('data-aw-id')) t = t.parentElement;
                    if (t && t.getAttribute('data-aw-id')) selectElement(t.getAttribute('data-aw-id'));
                }, true);
                doc.addEventListener('mouseover', function(e) {
                    var t = e.target;
                    while (t && t !== doc.body && !t.getAttribute('data-aw-id')) t = t.parentElement;
                    if (t && t.getAttribute('data-aw-id')) hoverElement(t.getAttribute('data-aw-id'));
                }, true);
            } catch(e) {}
        });
    }

    function selectElement(id) {
        var data = elementMap.get(id); if (!data) return;
        selectedEl = data;
        var f = $('awFrame');
        if (f && f.contentDocument) {
            f.contentDocument.querySelectorAll('.aw-selected').forEach(function(el) { el.classList.remove('aw-selected'); });
            data.el.classList.add('aw-selected');
            showOverlay(data.el, data.label);
        }
        document.querySelectorAll('.aw-tree-item.selected').forEach(function(el) { el.classList.remove('selected'); });
        var ti = document.querySelector('[data-aw-tree-id="'+id+'"]');
        if (ti) { ti.classList.add('selected'); ti.scrollIntoView({block:'nearest'}); }
        renderProperties(data);
        updateStatusBar('Selected: ' + data.label);
    }

    function hoverElement(id) {
        var data = elementMap.get(id); if (!data) return;
        hoveredEl = data;
        var f = $('awFrame'); if (!f || !f.contentDocument) return;
        var doc = f.contentDocument;
        var old = doc.querySelector('.aw-canvas-hover'); if (old) old.remove();
        if (selectedEl && selectedEl.el === data.el) return;
        var r = data.el.getBoundingClientRect();
        var o = doc.createElement('div'); o.className = 'aw-canvas-hover';
        o.style.cssText = 'position:absolute;border:1px solid rgba(59,130,246,0.5);background:rgba(59,130,246,0.04);pointer-events:none;z-index:99998;left:'+(r.left+doc.defaultView.scrollX)+'px;top:'+(r.top+doc.defaultView.scrollY)+'px;width:'+r.width+'px;height:'+r.height+'px;';
        doc.body.appendChild(o);
    }

    function showOverlay(el, label) {
        var f = $('awFrame'); if (!f || !f.contentDocument) return;
        var doc = f.contentDocument;
        var old = doc.querySelector('.aw-canvas-selection'); if (old) old.remove();
        var r = el.getBoundingClientRect();
        var o = doc.createElement('div'); o.className = 'aw-canvas-selection';
        o.style.cssText = 'position:absolute;border:2px solid #10b981;background:rgba(16,185,129,0.06);pointer-events:none;z-index:99999;transition:all 0.15s ease;left:'+(r.left+doc.defaultView.scrollX)+'px;top:'+(r.top+doc.defaultView.scrollY)+'px;width:'+r.width+'px;height:'+r.height+'px;';
        var b = doc.createElement('div'); b.style.cssText = 'position:absolute;top:-22px;left:-2px;padding:2px 8px;background:#10b981;color:#04120c;font-size:11px;font-weight:700;border-radius:4px 4px 0 0;white-space:nowrap;font-family:Inter,sans-serif;';
        b.textContent = label; o.appendChild(b); doc.body.appendChild(o);
    }

    function clearOverlay() {
        var f = $('awFrame'); if (!f || !f.contentDocument) return;
        var s = f.contentDocument.querySelector('.aw-canvas-selection'); if (s) s.remove();
        var h = f.contentDocument.querySelector('.aw-canvas-hover'); if (h) h.remove();
    }

    /* ===== NAVIGATOR ===== */
    function buildNavigator() {
        var c = $('awNavigatorTree'); if (!c) return; c.innerHTML = '';
        var f = $('awFrame'); if (!f || !f.contentDocument) return;
        var doc = f.contentDocument;
        var roots = []; var body = doc.body;
        if (body) Array.from(body.children).forEach(function(ch) {
            if (ch.classList && (ch.classList.contains('splash-overlay')||ch.classList.contains('bg-container')||ch.classList.contains('noise-overlay')||ch.classList.contains('ai-app-glow')||ch.classList.contains('ytm-app')||ch.classList.contains('preview-player')||ch.id==='previewAudio')) roots.push(ch);
        });
        roots.forEach(function(el) { var n = buildTreeNode(el, 0); if (n) c.appendChild(n); });
    }

    function buildTreeNode(el, depth) {
        var id = el.getAttribute('data-aw-id');
        if (!id) { id = 'aw-'+Math.random().toString(36).substr(2,9); el.setAttribute('data-aw-id', id); }
        var label = getElementLabel(el), children = getSignificantChildren(el), hasCh = children.length > 0;
        elementMap.set(id, {el:el, label:label, tag:el.tagName.toLowerCase(), id:id});
        var node = document.createElement('div'); node.className = 'aw-tree-node';
        var item = document.createElement('div'); item.className = 'aw-tree-item'+(selectedEl&&selectedEl.id===id?' selected':'');
        item.dataset.awTreeId = id; item.style.paddingLeft = (12+depth*16)+'px';
        var toggle = document.createElement('span'); toggle.className = 'aw-tree-toggle'+(hasCh?' expanded':'');
        toggle.innerHTML = hasCh?'<i class="fas fa-chevron-right"></i>':''; item.appendChild(toggle);
        var icon = document.createElement('span'); icon.className = 'aw-tree-icon'; icon.innerHTML = getElementIcon(el); item.appendChild(icon);
        var lbl = document.createElement('span'); lbl.className = 'aw-tree-label'; lbl.textContent = label; item.appendChild(lbl);
        var badge = document.createElement('span'); badge.className = 'aw-tree-badge'; badge.textContent = el.tagName.toLowerCase(); item.appendChild(badge);
        var acts = document.createElement('span'); acts.className = 'aw-tree-actions';
        var db = document.createElement('button'); db.className='aw-tree-action-btn'; db.innerHTML='<i class="fas fa-copy"></i>'; db.title='Duplicate';
        db.addEventListener('click', function(e) { e.stopPropagation(); duplicateElement(id); }); acts.appendChild(db);
        var dl = document.createElement('button'); dl.className='aw-tree-action-btn delete'; dl.innerHTML='<i class="fas fa-trash"></i>'; dl.title='Delete';
        dl.addEventListener('click', function(e) { e.stopPropagation(); deleteElement(id); }); acts.appendChild(dl);
        item.appendChild(acts);
        item.addEventListener('click', function(e) { e.stopPropagation(); selectElement(id); }); node.appendChild(item);
        if (hasCh) {
            var cc = document.createElement('div'); cc.className = 'aw-tree-children';
            children.forEach(function(ch) { var cn = buildTreeNode(ch, depth+1); if (cn) cc.appendChild(cn); });
            node.appendChild(cc);
            toggle.addEventListener('click', function(e) { e.stopPropagation(); this.classList.toggle('expanded'); cc.classList.toggle('collapsed'); });
        }
        return node;
    }

    function getSignificantChildren(el) {
        var r = []; Array.from(el.children).forEach(function(ch) {
            var t = ch.tagName.toLowerCase();
            if (t==='script'||t==='style'||t==='link'||t==='meta') return;
            if (ch.classList&&(ch.classList.contains('aw-canvas-selection')||ch.classList.contains('aw-canvas-hover'))) return;
            if (ch.offsetWidth>0||ch.offsetHeight>0||t==='section'||t==='footer'||t==='nav'||t==='header') r.push(ch);
        }); return r;
    }

    function getElementIcon(el) {
        var c = typeof el.className==='string'?el.className:'';
        if (c.includes('ai-music-hero')) return '<i class="fas fa-music"></i>';
        if (c.includes('ai-trending')) return '<i class="fas fa-fire"></i>';
        if (c.includes('ai-live-fm')) return '<i class="fas fa-tower-broadcast"></i>';
        if (c.includes('ai-live-news')) return '<i class="fas fa-newspaper"></i>';
        if (c.includes('ai-recently')) return '<i class="fas fa-clock-rotate-left"></i>';
        if (c.includes('ai-ai-rec')) return '<i class="fas fa-wand-magic-sparkles"></i>';
        if (c.includes('ai-decades')) return '<i class="fas fa-clock"></i>';
        if (c.includes('ai-favorites')) return '<i class="fas fa-heart"></i>';
        if (c.includes('ai-sidebar')) return '<i class="fas fa-bars"></i>';
        if (c.includes('premium-top-nav')) return '<i class="fas fa-navicon"></i>';
        if (c.includes('tamilai-bottom-nav')) return '<i class="fas fa-mobile-screen-button"></i>';
        if (c.includes('ytm-app')) return '<i class="fas fa-layer-group"></i>';
        if (el.tagName==='HEADER') return '<i class="fas fa-heading"></i>';
        if (el.tagName==='FOOTER') return '<i class="fas fa-grip-lines"></i>';
        if (el.tagName==='NAV') return '<i class="fas fa-compass"></i>';
        if (el.tagName==='SECTION') return '<i class="fas fa-square"></i>';
        if (el.tagName==='BUTTON') return '<i class="fas fa-button-pointer"></i>';
        if (el.tagName==='A') return '<i class="fas fa-link"></i>';
        if (el.tagName==='IMG') return '<i class="fas fa-image"></i>';
        if (el.tagName==='H1'||el.tagName==='H2'||el.tagName==='H3') return '<i class="fas fa-heading"></i>';
        if (el.tagName==='P') return '<i class="fas fa-paragraph"></i>';
        return '<i class="fas fa-table-cells"></i>';
    }

    /* ===== COMPONENTS PANEL ===== */
    function bindLeftPanel() {
        document.querySelectorAll('.aw-panel-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                leftTab = this.dataset.awLtab;
                document.querySelectorAll('.aw-panel-tab').forEach(function(t){t.classList.remove('active');});
                this.classList.add('active');
                document.querySelectorAll('.aw-panel-content').forEach(function(c){c.style.display='none';});
                var id = 'aw'+leftTab.charAt(0).toUpperCase()+leftTab.slice(1)+'Content';
                var el = $(id); if (el) el.style.display='';
            });
        });
        buildComponentsList(); buildTemplatesList();
        var si = $('awCompSearch');
        if (si) si.addEventListener('input', function() { filterComponents(this.value); });
    }

    function buildComponentsList() {
        var c = $('awComponentsList'); if (!c) return; c.innerHTML = '';
        var cats = {layout:{label:'Layout',icon:'fa-table-cells'},content:{label:'Content',icon:'fa-file-lines'},tamilai:{label:'Tamil AI Stream',icon:'fa-music'}};
        Object.keys(cats).forEach(function(ck) {
            var cat = cats[ck], g = document.createElement('div'); g.className='aw-comp-group';
            var t = document.createElement('div'); t.className='aw-comp-group-title'; t.innerHTML='<i class="fas '+cat.icon+'"></i> '+cat.label; g.appendChild(t);
            var gr = document.createElement('div'); gr.className='aw-comp-grid';
            Object.keys(COMPONENTS).forEach(function(key) {
                var comp = COMPONENTS[key]; if (comp.category!==ck) return;
                var it = document.createElement('div'); it.className='aw-comp-item'; it.draggable=true; it.dataset.compType=key;
                it.innerHTML='<i class="fas '+comp.icon+'"></i><span>'+comp.label+'</span>';
                it.addEventListener('dragstart', function(e) { dragData={type:'component',compType:key}; e.dataTransfer.setData('text/plain',key); e.dataTransfer.effectAllowed='copy'; });
                it.addEventListener('click', function() { addComponentToCanvas(key); });
                gr.appendChild(it);
            });
            g.appendChild(gr); c.appendChild(g);
        });
    }

    function buildTemplatesList() {
        var c = $('awTemplatesList'); if (!c) return; c.innerHTML = '';
        Object.keys(TEMPLATES).forEach(function(key) {
            var tpl = TEMPLATES[key], it = document.createElement('div'); it.className='aw-template-item';
            it.innerHTML='<div class="aw-template-icon"><i class="fas '+tpl.icon+'"></i></div><div class="aw-template-info"><div class="aw-template-name">'+tpl.name+'</div><div class="aw-template-desc">'+tpl.desc+'</div></div>';
            it.addEventListener('click', function() { addTemplateToCanvas(key); }); c.appendChild(it);
        });
    }

    function filterComponents(q) {
        document.querySelectorAll('.aw-comp-item').forEach(function(it) { it.style.display=it.textContent.toLowerCase().includes(q.toLowerCase())?'':'none'; });
    }

    function addComponentToCanvas(compType) {
        var comp = COMPONENTS[compType]; if (!comp) return;
        var f = $('awFrame'); if (!f || !f.contentDocument) return; var doc = f.contentDocument;
        var el = doc.createElement(comp.tag);
        var id = 'aw-'+Math.random().toString(36).substr(2,9);
        el.setAttribute('data-aw-id',id); el.setAttribute('data-aw-element',compType); el.setAttribute('data-aw-label',comp.label);
        if (comp.defaults) Object.keys(comp.defaults).forEach(function(k) { try { el.style[k]=comp.defaults[k]; } catch(e){} });
        if (comp.attrs) Object.keys(comp.attrs).forEach(function(k) { el.setAttribute(k,comp.attrs[k]); });
        if (comp.text) el.textContent = comp.text;
        if (comp.tamilaiComponent) el.innerHTML='<div style="padding:20px;text-align:center;border:2px dashed rgba(16,185,129,0.3);border-radius:12px;background:rgba(16,185,129,0.05);"><i class="fas '+comp.icon+'" style="font-size:24px;color:#10b981;margin-bottom:8px;display:block;"></i><span style="font-size:14px;font-weight:600;color:#10b981;">'+comp.label+'</span><br><span style="font-size:12px;color:rgba(255,255,255,0.4);">Live component - renders on publish</span></div>';
        if (selectedEl && selectedEl.el) {
            var st = selectedEl.el.tagName.toLowerCase();
            if (st==='section'||st==='div'||st==='footer'||st==='nav') selectedEl.el.appendChild(el);
            else selectedEl.el.parentElement.insertBefore(el, selectedEl.el.nextSibling);
        } else {
            var mc = doc.querySelector('.ytm-main-content')||doc.querySelector('.ytm-app')||doc.body; mc.appendChild(el);
        }
        pushUndo('Add '+comp.label); scanCanvas(); buildNavigator(); selectElement(id); toast('Added '+comp.label,'success');
    }

    function addTemplateToCanvas(tplKey) {
        var tpl = TEMPLATES[tplKey]; if (!tpl) return;
        var f = $('awFrame'); if (!f || !f.contentDocument) return; var doc = f.contentDocument;
        var temp = doc.createElement('div'); temp.innerHTML = tpl.html; var ne = temp.firstElementChild;
        ne.querySelectorAll('[data-aw-element]').forEach(function(ch) { if(!ch.getAttribute('data-aw-id')) ch.setAttribute('data-aw-id','aw-'+Math.random().toString(36).substr(2,9)); });
        var id = 'aw-'+Math.random().toString(36).substr(2,9); ne.setAttribute('data-aw-id',id);
        if (selectedEl && selectedEl.el) {
            var st = selectedEl.el.tagName.toLowerCase();
            if (st==='section'||st==='div'||st==='footer') selectedEl.el.appendChild(ne);
            else selectedEl.el.parentElement.insertBefore(ne, selectedEl.el.nextSibling);
        } else { var mc = doc.querySelector('.ytm-main-content')||doc.body; mc.appendChild(ne); }
        pushUndo('Add Template: '+tpl.name); scanCanvas(); buildNavigator(); selectElement(id); toast('Added: '+tpl.name,'success');
    }

    /* ===== PROPERTIES PANEL ===== */
    function bindRightPanel() {
        document.querySelectorAll('.aw-props-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                rightTab = this.dataset.awRtab;
                document.querySelectorAll('.aw-props-tab').forEach(function(t){t.classList.remove('active');});
                this.classList.add('active');
                if (selectedEl) renderProperties(selectedEl);
            });
        });
    }

    function renderProperties(data) {
        var body = $('awPropsBody'); if (!body) return; body.innerHTML = '';
        if (!data || !data.el) { body.innerHTML='<div class="aw-empty-state"><i class="fas fa-mouse-pointer"></i><p>Click any element on the canvas to edit its properties</p></div>'; return; }
        var el = data.el, cs = el.ownerDocument.defaultView.getComputedStyle(el);
        var info = document.createElement('div'); info.className='aw-prop-group';
        info.innerHTML='<div class="aw-prop-group-header"><div class="aw-prop-group-title"><i class="fas fa-info-circle"></i> Element Info</div></div><div class="aw-prop-group-body"><div class="aw-prop-row"><span class="aw-prop-label">Tag</span><span style="color:var(--aw-primary);font-weight:600;font-size:0.8rem;">'+el.tagName.toLowerCase()+'</span></div><div class="aw-prop-row"><span class="aw-prop-label">Label</span><input class="aw-prop-input" value="'+esc(data.label)+'" data-prop="label"></div></div>';
        body.appendChild(info);
        if (rightTab==='style') { renderStyleProps(body,el,cs); }
        else if (rightTab==='layout') { renderLayoutProps(body,el,cs); }
        else if (rightTab==='text') { renderTextProps(body,el,cs); }
        else if (rightTab==='effects') { renderEffectsProps(body,el,cs); }
        body.querySelectorAll('.aw-prop-input,.aw-prop-select').forEach(function(inp) {
            inp.addEventListener('change', function(){ applyProperty(this.dataset.prop,this.value,this.type); });
            inp.addEventListener('input', function(){ if(this.type==='range'||this.type==='color') applyProperty(this.dataset.prop,this.value,this.type); });
        });
        var li = body.querySelector('[data-prop="label"]');
        if (li) li.addEventListener('change', function(){ data.label=this.value; buildNavigator(); });
    }

    function renderStyleProps(body,el,cs) {
        var bg=pg('Background','fa-palette'); addCP(bg,'Background Color','backgroundColor',rgb2hex(cs.backgroundColor)); addRP(bg,'Opacity','opacity',cs.opacity,0,1,0.05); body.appendChild(bg);
        var bd=pg('Border','fa-border-all'); addTP(bd,'Border Width','borderWidth',cs.borderWidth); addSP(bd,'Border Style','borderStyle',cs.borderStyle,['none','solid','dashed','dotted','double']); addCP(bd,'Border Color','borderColor',rgb2hex(cs.borderColor)); addTP(bd,'Border Radius','borderRadius',cs.borderRadius); body.appendChild(bd);
        var sp=pg('Spacing','fa-arrows-up-down'); addTP(sp,'Padding Top','paddingTop',cs.paddingTop); addTP(sp,'Padding Right','paddingRight',cs.paddingRight); addTP(sp,'Padding Bottom','paddingBottom',cs.paddingBottom); addTP(sp,'Padding Left','paddingLeft',cs.paddingLeft); addTP(sp,'Margin Top','marginTop',cs.marginTop); addTP(sp,'Margin Right','marginRight',cs.marginRight); addTP(sp,'Margin Bottom','marginBottom',cs.marginBottom); addTP(sp,'Margin Left','marginLeft',cs.marginLeft); body.appendChild(sp);
        var sz=pg('Size','fa-expand'); addTP(sz,'Width','width',cs.width); addTP(sz,'Height','height',cs.height); addTP(sz,'Max Width','maxWidth',cs.maxWidth); addTP(sz,'Max Height','maxHeight',cs.maxHeight); body.appendChild(sz);
    }

    function renderLayoutProps(body,el,cs) {
        var d=pg('Display','fa-table-cells'); addSP(d,'Display','display',cs.display,['block','flex','grid','inline','inline-block','none','inline-flex']); addSP(d,'Position','position',cs.position,['static','relative','absolute','fixed','sticky']); addTP(d,'Z-Index','zIndex',cs.zIndex); body.appendChild(d);
        if (cs.display==='flex'||cs.display==='inline-flex') { var fx=pg('Flex','fa-arrows-left-right'); addSP(fx,'Direction','flexDirection',cs.flexDirection,['row','row-reverse','column','column-reverse']); addSP(fx,'Wrap','flexWrap',cs.flexWrap,['nowrap','wrap']); addSP(fx,'Justify','justifyContent',cs.justifyContent,['flex-start','flex-end','center','space-between','space-around','space-evenly']); addSP(fx,'Align','alignItems',cs.alignItems,['flex-start','flex-end','center','stretch','baseline']); addTP(fx,'Gap','gap',cs.gap); body.appendChild(fx); }
        if (cs.display==='grid'||cs.display==='inline-grid') { var g=pg('Grid','fa-table-cells-large'); addTP(g,'Grid Columns','gridTemplateColumns',cs.gridTemplateColumns); addTP(g,'Grid Rows','gridTemplateRows',cs.gridTemplateRows); addTP(g,'Gap','gap',cs.gap); body.appendChild(g); }
    }

    function renderTextProps(body,el,cs) {
        if (el.textContent.trim()) { var ty=pg('Typography','fa-font'); addSP(ty,'Font Weight','fontWeight',cs.fontWeight,['300','400','500','600','700','800','900']); addTP(ty,'Font Size','fontSize',cs.fontSize); addTP(ty,'Line Height','lineHeight',cs.lineHeight); addSP(ty,'Text Align','textAlign',cs.textAlign,['left','center','right','justify']); addCP(ty,'Text Color','color',rgb2hex(cs.color)); body.appendChild(ty); }
        if (el.childNodes.length<=3 && el.textContent.trim().length<200) { var ct=pg('Content','fa-file-lines'); addTP(ct,'Text','textContent',el.textContent.trim(),true); body.appendChild(ct); }
    }

    function renderEffectsProps(body,el,cs) {
        var sh=pg('Box Shadow','fa-cloud'); addTP(sh,'Box Shadow','boxShadow',cs.boxShadow==='none'?'':cs.boxShadow); body.appendChild(sh);
        var tr=pg('Transition','fa-clock'); addTP(tr,'Transition','transition',cs.transition==='none'?'':cs.transition); body.appendChild(tr);
    }

    function pg(title,icon) { var g=document.createElement('div'); g.className='aw-prop-group'; var h=document.createElement('div'); h.className='aw-prop-group-header'; h.innerHTML='<div class="aw-prop-group-title"><i class="fas '+icon+'"></i> '+title+'</div><span class="aw-prop-group-toggle"><i class="fas fa-chevron-down"></i></span>'; g.appendChild(h); var b=document.createElement('div'); b.className='aw-prop-group-body'; g.appendChild(b); h.addEventListener('click',function(){b.classList.toggle('collapsed');var t=this.querySelector('.aw-prop-group-toggle');if(t)t.classList.toggle('collapsed');}); return g; }
    function addTP(g,l,p,v,ml) { var b=g.querySelector('.aw-prop-group-body'),r=document.createElement('div'); r.className='aw-prop-row'; r.innerHTML='<label class="aw-prop-label">'+l+'</label>'; if(ml){var ta=document.createElement('textarea');ta.className='aw-prop-input';ta.value=v||'';ta.dataset.prop=p;ta.rows=2;ta.style.resize='vertical';r.appendChild(ta);}else{var i=document.createElement('input');i.type='text';i.className='aw-prop-input';i.value=v||'';i.dataset.prop=p;r.appendChild(i);} b.appendChild(r); }
    function addCP(g,l,p,v) { var b=g.querySelector('.aw-prop-group-body'),r=document.createElement('div'); r.className='aw-prop-row'; r.innerHTML='<label class="aw-prop-label">'+l+'</label><div class="aw-color-row"><div class="aw-color-swatch"><input type="color" value="'+(v||'#000000')+'" data-prop="'+p+'"></div><input type="text" class="aw-prop-input" value="'+(v||'')+'" data-prop="'+p+'" style="flex:1;"></div>'; b.appendChild(r); }
    function addSP(g,l,p,v,opts) { var b=g.querySelector('.aw-prop-group-body'),r=document.createElement('div'); r.className='aw-prop-row'; var h='<label class="aw-prop-label">'+l+'</label><select class="aw-prop-select" data-prop="'+p+'">'; opts.forEach(function(o){h+='<option value="'+o+'"'+(v===o?' selected':'')+'>'+o+'</option>';}); h+='</select>'; r.innerHTML=h; b.appendChild(r); }
    function addRP(g,l,p,v,min,max,step) { var b=g.querySelector('.aw-prop-group-body'),r=document.createElement('div'); r.className='aw-prop-row'; r.innerHTML='<label class="aw-prop-label">'+l+'</label><div style="display:flex;align-items:center;gap:8px;"><input type="range" class="aw-prop-input" data-prop="'+p+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+(v||0)+'" style="flex:1;"><span style="font-size:0.75rem;color:var(--aw-text-dim);min-width:30px;">'+(v||0)+'</span></div>'; b.appendChild(r); }

    function applyProperty(prop,value,type) {
        if (!selectedEl||!selectedEl.el) return;
        if (prop==='textContent') selectedEl.el.textContent=value;
        else if (prop==='label') {}
        else { try { selectedEl.el.style[prop]=value; } catch(e){} }
        pushUndo('Change '+prop); showOverlay(selectedEl.el,selectedEl.label);
    }

    /* ===== ELEMENT ACTIONS ===== */
    function duplicateElement(id) {
        var d=elementMap.get(id); if(!d||!d.el) return;
        var cl=d.el.cloneNode(true), nid='aw-'+Math.random().toString(36).substr(2,9);
        cl.setAttribute('data-aw-id',nid); cl.querySelectorAll('[data-aw-id]').forEach(function(ch){ch.setAttribute('data-aw-id','aw-'+Math.random().toString(36).substr(2,9));});
        d.el.parentElement.insertBefore(cl,d.el.nextSibling);
        pushUndo('Duplicate '+d.label); scanCanvas(); buildNavigator(); selectElement(nid); toast('Duplicated '+d.label,'success');
    }

    function deleteElement(id) {
        var d=elementMap.get(id); if(!d||!d.el) return;
        d.el.remove(); elementMap.delete(id); selectedEl=null; clearOverlay();
        pushUndo('Delete '+d.label); scanCanvas(); buildNavigator(); renderProperties(null); toast('Deleted '+d.label,'info');
    }

    function moveElement(id,dir) {
        var d=elementMap.get(id); if(!d||!d.el) return;
        var p=d.el.parentElement;
        if (dir==='up') { var pv=d.el.previousElementSibling; if(pv) p.insertBefore(d.el,pv); }
        else { var nx=d.el.nextElementSibling; if(nx) p.insertBefore(nx,d.el); }
        pushUndo('Move '+d.label); scanCanvas(); buildNavigator();
    }

    function wrapInContainer(id) {
        var d=elementMap.get(id); if(!d||!d.el) return;
        var f=$('awFrame'); if(!f||!f.contentDocument) return; var doc=f.contentDocument;
        var w=doc.createElement('div'), wid='aw-'+Math.random().toString(36).substr(2,9);
        w.setAttribute('data-aw-id',wid); w.setAttribute('data-aw-element','container'); w.setAttribute('data-aw-label','Container');
        w.style.cssText='max-width:1200px;margin:0 auto;padding:0 20px;';
        d.el.parentElement.insertBefore(w,d.el); w.appendChild(d.el);
        pushUndo('Wrap in Container'); scanCanvas(); buildNavigator(); selectElement(wid); toast('Wrapped in container','success');
    }

    /* ===== UNDO/REDO ===== */
    function pushUndo(action) {
        var f=$('awFrame'); if(!f||!f.contentDocument) return;
        undoStack.push({action:action,html:f.contentDocument.body.innerHTML,selected:selectedEl?selectedEl.id:null});
        if(undoStack.length>maxUndo) undoStack.shift(); redoStack=[]; updateURBtns();
    }
    function undo() { if(!undoStack.length) return; var f=$('awFrame'); if(!f||!f.contentDocument) return; redoStack.push({action:'current',html:f.contentDocument.body.innerHTML,selected:selectedEl?selectedEl.id:null}); var prev=undoStack.pop(); f.contentDocument.body.innerHTML=prev.html; scanCanvas(); buildNavigator(); if(prev.selected) selectElement(prev.selected); updateURBtns(); toast('Undo: '+prev.action,'info'); }
    function redo() { if(!redoStack.length) return; var f=$('awFrame'); if(!f||!f.contentDocument) return; undoStack.push({action:'current',html:f.contentDocument.body.innerHTML,selected:selectedEl?selectedEl.id:null}); var next=redoStack.pop(); f.contentDocument.body.innerHTML=next.html; scanCanvas(); buildNavigator(); if(next.selected) selectElement(next.selected); updateURBtns(); toast('Redo','info'); }
    function updateURBtns() { var u=$('awUndoBtn'),r=$('awRedoBtn'); if(u)u.style.opacity=undoStack.length>0?'1':'0.3'; if(r)r.style.opacity=redoStack.length>0?'1':'0.3'; }

    /* ===== CLIPBOARD ===== */
    function copyElement() { if(!selectedEl||!selectedEl.el) return; clipboard=selectedEl.el.outerHTML; toast('Copied','success'); }
    function pasteElement() { if(!clipboard) return; var f=$('awFrame'); if(!f||!f.contentDocument) return; var doc=f.contentDocument; var tmp=doc.createElement('div'); tmp.innerHTML=clipboard; var ne=tmp.firstElementChild; if(!ne)return; var nid='aw-'+Math.random().toString(36).substr(2,9); ne.setAttribute('data-aw-id',nid); ne.querySelectorAll('[data-aw-id]').forEach(function(ch){ch.setAttribute('data-aw-id','aw-'+Math.random().toString(36).substr(2,9));}); if(selectedEl&&selectedEl.el)selectedEl.el.parentElement.insertBefore(ne,selectedEl.el.nextSibling); else{var mc=doc.querySelector('.ytm-main-content')||doc.body;mc.appendChild(ne);} pushUndo('Paste'); scanCanvas(); buildNavigator(); selectElement(nid); toast('Pasted','success'); }

    /* ===== SAVE/PREVIEW/PUBLISH ===== */
    function saveDraft() {
        var f=$('awFrame'); if(!f||!f.contentDocument) return; var html=f.contentDocument.body.innerHTML;
        try { localStorage.setItem('ai_webflow_draft',html); localStorage.setItem('ai_webflow_draft_time',new Date().toISOString()); } catch(e){}
        if(window.DataStore&&typeof DataStore.set==='function') { try{DataStore.set('aiWebflowDraft',{html:html,timestamp:Date.now()});}catch(e){} }
        toast('Draft saved','success'); updateStatusBar('Draft saved at '+new Date().toLocaleTimeString());
    }
    function previewSite() { window.open('index.html','_blank'); toast('Preview opened','info'); }
    function publishSite() {
        var f=$('awFrame'); if(!f||!f.contentDocument) return; var html=f.contentDocument.body.innerHTML;
        try{localStorage.setItem('ai_webflow_published',JSON.stringify({html:html,timestamp:Date.now(),device:currentDevice}));}catch(e){}
        if(typeof publishChanges==='function') try{publishChanges();}catch(e){}
        toast('Published!','success'); updateStatusBar('Published at '+new Date().toLocaleTimeString());
        var b=$('awPublishBadge'); if(b){b.className='aw-publish-badge published';b.textContent='PUBLISHED';}
    }

    /* ===== CONTEXT MENU ===== */
    function bindContextMenu() {
        var f=$('awFrame'); if(!f) return;
        f.addEventListener('load',function(){ try{var doc=f.contentDocument; doc.addEventListener('contextmenu',function(e){e.preventDefault();var t=e.target;while(t&&t!==doc.body&&!t.getAttribute('data-aw-id'))t=t.parentElement;if(t&&t.getAttribute('data-aw-id')){selectElement(t.getAttribute('data-aw-id'));showCtx(e.clientX,e.clientY);}}); }catch(e){} });
        document.addEventListener('click',hideCtx);
    }
    function showCtx(x,y) { var m=$('awContextMenu'); if(!m)return; m.style.left=x+'px'; m.style.top=y+'px'; m.classList.add('visible'); }
    function hideCtx() { var m=$('awContextMenu'); if(m)m.classList.remove('visible'); }

    /* ===== KEYBOARD ===== */
    function bindKeyboard() {
        document.addEventListener('keydown',function(e) {
            if(!active) return;
            if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
            if(e.ctrlKey||e.metaKey) { switch(e.key.toLowerCase()) {
                case 'z': e.preventDefault(); e.shiftKey?redo():undo(); break;
                case 'y': e.preventDefault(); redo(); break;
                case 'c': e.preventDefault(); copyElement(); break;
                case 'v': e.preventDefault(); pasteElement(); break;
                case 'd': e.preventDefault(); if(selectedEl)duplicateElement(selectedEl.id); break;
                case 's': e.preventDefault(); saveDraft(); break;
            }} else { switch(e.key) {
                case 'Delete': case 'Backspace': if(selectedEl){e.preventDefault();deleteElement(selectedEl.id);} break;
                case 'Escape': selectedEl=null; clearOverlay(); renderProperties(null); document.querySelectorAll('.aw-tree-item.selected').forEach(function(el){el.classList.remove('selected');}); break;
            }}
        });
    }

    /* ===== AI ASSISTANT ===== */
    function bindAI() {
        var inp=$('awAIInput'),btn=$('awAISend');
        if(inp) inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAIMessage();}});
        if(btn) btn.addEventListener('click',sendAIMessage);
        document.querySelectorAll('.aw-ai-suggestion').forEach(function(b){b.addEventListener('click',function(){var i=$('awAIInput');if(i){i.value=this.textContent;sendAIMessage();}});});
    }
    function toggleAIPanel() { var p=$('awAIPanel'); if(!p)return; aiPanelOpen=!aiPanelOpen; p.classList.toggle('open',aiPanelOpen); }
    function sendAIMessage() { var i=$('awAIInput'); if(!i||!i.value.trim())return; var m=i.value.trim(); i.value=''; addAIMsg('user',m); processAI(m); }
    function addAIMsg(type,text) { var c=$('awAIMessages'); if(!c)return; var m=document.createElement('div'); m.className='aw-ai-msg '+type; m.textContent=text; c.appendChild(m); c.scrollTop=c.scrollHeight; aiMessages.push({type:type,text:text}); }
    function addAITyping() { var c=$('awAIMessages'); if(!c)return; var t=document.createElement('div'); t.className='aw-ai-typing'; t.id='awAITyping'; t.innerHTML='<div class="aw-ai-typing-dot"></div><div class="aw-ai-typing-dot"></div><div class="aw-ai-typing-dot"></div>'; c.appendChild(t); c.scrollTop=c.scrollHeight; }
    function removeAITyping() { var t=$('awAITyping'); if(t)t.remove(); }

    function processAI(cmd) {
        addAITyping(); var l=cmd.toLowerCase();
        setTimeout(function(){ removeAITyping();
            if(l.includes('add')&&l.includes('music')){addComponentToCanvas('music-hero');addAIMsg('assistant','Added Music Hero section.');}
            else if(l.includes('add')&&l.includes('news')){addComponentToCanvas('live-news');addAIMsg('assistant','Added Live Tamil News section.');}
            else if(l.includes('add')&&l.includes('fm')){addComponentToCanvas('live-fm');addAIMsg('assistant','Added Live FM Stations section.');}
            else if(l.includes('add')&&l.includes('trending')){addComponentToCanvas('trending-playlists');addAIMsg('assistant','Added Trending Playlists section.');}
            else if(l.includes('add')&&l.includes('hero')){addTemplateToCanvas('hero-section');addAIMsg('assistant','Added Hero Section template.');}
            else if(l.includes('add')&&l.includes('footer')){addTemplateToCanvas('footer-section');addAIMsg('assistant','Added Footer section.');}
            else if(l.includes('add')&&l.includes('section')){addComponentToCanvas('section');addAIMsg('assistant','Added empty Section.');}
            else if(l.includes('add')&&l.includes('button')){addComponentToCanvas('button');addAIMsg('assistant','Added Button.');}
            else if(l.includes('add')&&l.includes('text')){addComponentToCanvas('text');addAIMsg('assistant','Added Text paragraph.');}
            else if(l.includes('add')&&l.includes('heading')){addComponentToCanvas('heading');addAIMsg('assistant','Added Heading.');}
            else if(l.includes('add')&&l.includes('image')){addComponentToCanvas('image');addAIMsg('assistant','Added Image. Set URL in properties.');}
            else if(l.includes('add')&&l.includes('grid')){addComponentToCanvas('grid');addAIMsg('assistant','Added 3-column Grid.');}
            else if(l.includes('duplicate')||l.includes('copy')){if(selectedEl){duplicateElement(selectedEl.id);addAIMsg('assistant','Duplicated: '+selectedEl.label);}else addAIMsg('assistant','Select an element first.');}
            else if(l.includes('delete')||l.includes('remove')){if(selectedEl){deleteElement(selectedEl.id);addAIMsg('assistant','Deleted element.');}else addAIMsg('assistant','Select an element first.');}
            else if(l.includes('mobile')&&(l.includes('responsive')||l.includes('layout'))){setDevice('mobile');addAIMsg('assistant','Switched to mobile view (375px).');}
            else if(l.includes('tablet')&&(l.includes('responsive')||l.includes('layout'))){setDevice('tablet');addAIMsg('assistant','Switched to tablet view (768px).');}
            else if(l.includes('desktop')&&(l.includes('responsive')||l.includes('layout'))){setDevice('desktop');addAIMsg('assistant','Switched to desktop view (1440px).');}
            else if(l.includes('save')){saveDraft();addAIMsg('assistant','Draft saved.');}
            else if(l.includes('publish')){publishSite();addAIMsg('assistant','Published to live site!');}
            else if(l.includes('undo')){undo();addAIMsg('assistant','Undone.');}
            else if(l.includes('redo')){redo();addAIMsg('assistant','Redone.');}
            else if(l.includes('refresh')||l.includes('reload')){var f=$('awFrame');if(f){f.src='index.html';f.onload=function(){setTimeout(function(){scanCanvas();buildNavigator();},1500);};}addAIMsg('assistant','Canvas refreshed.');}
            else if(l.includes('change')&&l.includes('color')){if(selectedEl&&selectedEl.el){var c='#10b981';if(l.includes('blue'))c='#3b82f6';else if(l.includes('red'))c='#ef4444';else if(l.includes('purple'))c='#8b5cf6';else if(l.includes('orange'))c='#f97316';selectedEl.el.style.backgroundColor=c;pushUndo('Change color');showOverlay(selectedEl.el,selectedEl.label);addAIMsg('assistant','Changed color to '+c+'.');}else addAIMsg('assistant','Select an element first.');}
            else if(l.includes('move')&&(l.includes('above')||l.includes('before')||l.includes('up'))){if(selectedEl){moveElement(selectedEl.id,'up');addAIMsg('assistant','Moved up.');}else addAIMsg('assistant','Select an element first.');}
            else if(l.includes('move')&&(l.includes('below')||l.includes('after')||l.includes('down'))){if(selectedEl){moveElement(selectedEl.id,'down');addAIMsg('assistant','Moved down.');}else addAIMsg('assistant','Select an element first.');}
            else if(l.includes('wrap')&&l.includes('container')){if(selectedEl){wrapInContainer(selectedEl.id);addAIMsg('assistant','Wrapped in container.');}else addAIMsg('assistant','Select an element first.');}
            else if(l.includes('create')&&l.includes('modern')&&l.includes('music')){addTemplateToCanvas('music-section');addAIMsg('assistant','Created modern Music Section.');}
            else if(l.includes('create')&&l.includes('modern')&&l.includes('news')){addTemplateToCanvas('news-section');addAIMsg('assistant','Created modern News Section.');}
            else if(l.includes('list')||l.includes('component')||l.includes('what can')){addAIMsg('assistant','Commands: Add [music/news/fm/hero/section/button/text/heading/image/grid], Duplicate, Delete, Move, Change color, Switch view, Wrap, Save, Publish, Undo, Redo, Refresh');}
            else{addAIMsg('assistant','Try: "Add music section", "Add Tamil News", "Change color to blue", "Switch to mobile", "Duplicate", "Wrap in container", "Save", "Publish"');}
        }, 600+Math.random()*600);
    }

    function setDevice(d) {
        currentDevice=d;
        document.querySelectorAll('.aw-device-btn').forEach(function(b){b.classList.remove('active');});
        document.querySelectorAll('[data-aw-device="'+d+'"]').forEach(function(b){b.classList.add('active');});
        var w=$('awCanvasWrapper'); if(w) w.className='aw-canvas-frame-wrapper '+d;
        var l=$('awDeviceLabel'); if(l) l.textContent=d.charAt(0).toUpperCase()+d.slice(1);
    }

    /* ===== UTILITIES ===== */
    function rgb2hex(rgb) { if(!rgb||rgb==='transparent'||rgb==='rgba(0, 0, 0, 0)')return'#000000'; var m=rgb.match(/\d+/g); if(!m||m.length<3)return'#000000'; return'#'+m.slice(0,3).map(function(x){return parseInt(x).toString(16).padStart(2,'0');}).join(''); }
    function updateStatusBar(msg) { var s=$('awStatusBar'); if(s) s.textContent=msg; }
    function toast(msg,type) {
        var c=$('awToastContainer'); if(!c)return;
        var t=document.createElement('div'); t.className='aw-toast '+(type||'success');
        var icon=type==='error'?'fa-exclamation-circle':type==='info'?'fa-info-circle':'fa-check-circle';
        t.innerHTML='<i class="fas '+icon+'"></i><span>'+msg+'</span>';
        c.appendChild(t); setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(20px)';setTimeout(function(){t.remove();},300);},3000);
    }

    return { init:init, activate:activate, deactivate:deactivate, toggleAIPanel:toggleAIPanel, toast:toast };
})();
