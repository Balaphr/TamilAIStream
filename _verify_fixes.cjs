// Verify backdrop removal + mobile FPS + basic functionality + console errors
async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      console.log('JS EXCEPTION:', JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      const args = m.params.args.map(a => a.value || a.description || '').join(' ');
      console.log('CONSOLE[' + m.params.type + ']:', String(args).slice(0, 300));
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async (expression, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Performance.enable');
  await send('Log.enable');

  // ---- 1. Desktop: backdrop audit ----
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/index.html' });
  await new Promise(r => setTimeout(r, 9000));

  const audit = await evalJs(`(() => {
    const panel = document.querySelector('.ai-panel');
    const cs = panel ? getComputedStyle(panel) : null;
    window.scrollTo(0, Math.max(0, (document.body.scrollHeight - innerHeight) * 0.35));
    const visible = [...document.querySelectorAll('*')].filter(el => {
      const c = getComputedStyle(el);
      if (c.backdropFilter === 'none' && (!c.webkitBackdropFilter || c.webkitBackdropFilter === 'none')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 50 && r.height > 50 && r.bottom > -100 && r.top < innerHeight + 100 && r.right > -100 && r.left < innerWidth + 100 && c.display !== 'none' && c.visibility !== 'hidden';
    }).map(el => {
      const c = getComputedStyle(el); const r = el.getBoundingClientRect();
      return (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' [' + c.backdropFilter + ']';
    });
    return JSON.stringify({
      panelBackdrop: cs ? (cs.backdropFilter || 'n/a') : 'NO PANEL FOUND',
      panelBg: cs ? cs.backgroundImage.slice(0, 60) : '',
      panelBorder: cs ? cs.borderTopWidth + ' ' + cs.borderTopColor : '',
      panelShadow: cs ? cs.boxShadow.slice(0, 50) : '',
      visibleBackdropCount: visible.length,
      visible: visible.slice(0, 12),
      panelsCount: document.querySelectorAll('.ai-panel').length
    }, null, 1);
  })()`);
  console.log('=== DESKTOP BACKDROP AUDIT ===');
  console.log(audit);

  // ---- 2. Desktop scroll FPS (same as baseline test) ----
  await evalJs(`(() => {
    window.__perf = { frames: [], dropped: 0, scrolling: false };
    let last = performance.now();
    function sample(ts) { const dt = ts - last; last = ts;
      if (window.__perf.scrolling) { window.__perf.frames.push(dt); if (dt > 34) window.__perf.dropped++; }
      requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
    window.scrollTo(0, 0);
    return 'ok';
  })()`);
  await evalJs(`window.__perf.frames = []; window.__perf.dropped = 0; window.__perf.scrolling = true;`);
  await evalJs(`(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now(); const dur = 2500;
    return await new Promise(res => { function step(t) { const p = Math.min(1, (t - start) / dur); window.scrollTo(0, max * p); if (p < 1) requestAnimationFrame(step); else res('done'); } requestAnimationFrame(step); });
  })()`, true);
  await new Promise(r => setTimeout(r, 300));
  const d = await evalJs(`(() => { const f = window.__perf.frames.slice(); window.__perf.scrolling = false;
    const avg = f.reduce((a,b)=>a+b,0)/f.length; const s = f.slice().sort((a,b)=>a-b);
    return JSON.stringify({ frames: f.length, fps: +(1000/avg).toFixed(1), p95: +s[Math.floor(s.length*0.95)].toFixed(1), max: +Math.max(...f).toFixed(1), dropped: window.__perf.dropped }); })()`);
  console.log('=== DESKTOP SCROLL FPS (2.5s) ===');
  console.log(d);

  // ---- 3. Functionality checks ----
  console.log('=== FUNCTIONALITY (desktop) ===');
  const fn = await evalJs(`(() => {
    const out = {};
    out.navLinks = document.querySelectorAll('header a, .premium-top-nav a, nav a').length;
    out.sections = ['songsCollectionsSection','albumsSection','radioSection'].map(id => id + ':' + (document.getElementById(id) ? 'present' : 'missing')).join(', ');
    out.playerBar = !!document.querySelector('.up-bottom-bar');
    out.voiceTrigger = !!document.getElementById('vaTrigger');
    out.sidebarVisible = getComputedStyle(document.querySelector('.ai-sidebar')).display !== 'none';
    out.topnavBg = getComputedStyle(document.querySelector('.premium-top-nav')).backgroundImage.slice(0,50);
    out.topnavBackdrop = getComputedStyle(document.querySelector('.premium-top-nav')).backdropFilter;
    out.errs = window.__jsErrCount || 0;
    return JSON.stringify(out, null, 1);
  })()`);
  console.log(fn);

  // click a nav item to switch page (Music / radio), check no crash
  const navClick = await evalJs(`(() => {
    const link = [...document.querySelectorAll('a, button')].find(a => /music|radio|explore|songs/i.test(a.textContent || '') && a.offsetParent);
    if (!link) return 'no nav link found';
    link.click();
    return 'clicked: ' + (link.textContent || '').trim().slice(0, 30);
  })()`);
  console.log('nav click:', navClick);
  await new Promise(r => setTimeout(r, 1500));
  const afterNav = await evalJs(`JSON.stringify({ scrollY: Math.round(scrollY), title: document.title, ytmPageVisible: [...document.querySelectorAll('.ytm-page')].filter(p => getComputedStyle(p).display !== 'none' && p.offsetHeight > 0).map(p => p.className).slice(0,3) })`);
  console.log('after nav:', afterNav);

  // ---- 4. Mobile viewport scroll FPS ----
  console.log('=== MOBILE SCROLL FPS ===');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:4173/index.html' });
  await new Promise(r => setTimeout(r, 9000));
  await evalJs(`(() => {
    window.__perf = { frames: [], dropped: 0, scrolling: false };
    let last = performance.now();
    function sample(ts) { const dt = ts - last; last = ts;
      if (window.__perf.scrolling) { window.__perf.frames.push(dt); if (dt > 34) window.__perf.dropped++; }
      requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
    return 'ok';
  })()`);
  await evalJs(`window.__perf.frames = []; window.__perf.dropped = 0; window.__perf.scrolling = true;`);
  await evalJs(`(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now(); const dur = 2500;
    return await new Promise(res => { function step(t) { const p = Math.min(1, (t - start) / dur); window.scrollTo(0, max * p); if (p < 1) requestAnimationFrame(step); else res('done'); } requestAnimationFrame(step); });
  })()`, true);
  await new Promise(r => setTimeout(r, 300));
  const m = await evalJs(`(() => { const f = window.__perf.frames.slice(); window.__perf.scrolling = false;
    const avg = f.reduce((a,b)=>a+b,0)/f.length; const s = f.slice().sort((a,b)=>a-b);
    return JSON.stringify({ frames: f.length, fps: +(1000/avg).toFixed(1), p95: +s[Math.floor(s.length*0.95)].toFixed(1), max: +Math.max(...f).toFixed(1), dropped: window.__perf.dropped }); })()`);
  console.log('mobile scroll:', m);
  const mobileAudit = await evalJs(`(() => {
    const panel = document.querySelector('.ai-panel');
    const cs = panel ? getComputedStyle(panel) : null;
    return JSON.stringify({ panelBackdrop: cs ? cs.backdropFilter : 'none', panels: document.querySelectorAll('.ai-panel').length, bottomNav: !!document.querySelector('.tamilai-bottom-nav') });
  })()`);
  console.log('mobile audit:', mobileAudit);

  // reset emulation
  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
