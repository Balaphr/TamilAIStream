// Mobile scroll test: is vertical page scroll blocked anywhere in the Songs section?
async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  function send(m, p = {}) {
    return new Promise((resolve, reject) => {
      const mid = ++id; pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method: m, params: p }));
    });
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:8777/index.html' });
  await new Promise(r => setTimeout(r, 10000));

  const evalJs = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    return res.result.value;
  };

  const info = await evalJs(`(() => {
    const out = {};
    out.htmlScrollBehavior = getComputedStyle(document.documentElement).scrollBehavior;
    out.bodyOverflow = getComputedStyle(document.body).overflow + ' / ' + getComputedStyle(document.body).overflowX;
    out.scrollY = window.scrollY;
    const songs = document.getElementById('songsContainer');
    if (songs) {
      const r = songs.getBoundingClientRect();
      out.songsSectionRect = { top: r.top, bottom: r.bottom, height: r.height };
    }
    const th = document.getElementById('tamilHitsGrid');
    if (th) {
      const r = th.getBoundingClientRect();
      out.tamilHitsRect = { top: r.top, bottom: r.bottom, height: r.height };
      out.tamilHitsTouchAction = getComputedStyle(th).touchAction;
      out.tamilHitsScrollSnap = getComputedStyle(th).scrollSnapType;
    }
    const cards = document.querySelectorAll('.tamil-hit-card, .song-card');
    out.firstCardTouchAction = cards[0] ? getComputedStyle(cards[0]).touchAction : null;

    // find what element is at the center of the songs section
    if (songs) {
      const cx = 195;
      const cy = Math.min(songs.getBoundingClientRect().top + 100, window.innerHeight - 40);
      const el = document.elementFromPoint(cx, cy);
      out.elAtSongsTop = el ? (el.id || el.className || el.tagName) : null;
      // Walk up to find scroll/touch restrictions
      let node = el; const chain = [];
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (cs.touchAction !== 'auto') chain.push({ tag: node.tagName, cls: (node.className || '').toString().slice(0,40), touchAction: cs.touchAction, overflow: cs.overflow });
        node = node.parentElement;
      }
      out.restrictedChain = chain;
    }
    return JSON.stringify(out);
  })()`);
  console.log('=== INFO ===');
  console.log(info);

  // Scroll the page by dispatching a touchsweep starting on the songs section
  const t = JSON.parse(info);
  let startY = 500, endY = 950;
  if (t.songsSectionRect && t.songsSectionRect.top > 0) startY = Math.min(t.songsSectionRect.top + 80, 800);
  const scrollResult = await evalJs(`(async () => {
    const start = window.scrollY;
    return JSON.stringify({ start });
  })()`);
  console.log('=== BEFORE SCROLL ===', scrollResult);

  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: startY }] });
  for (let i = 1; i <= 6; i++) {
    const y = startY + ((endY - startY) * i) / 6;
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] });
    await new Promise(r => setTimeout(r, 30));
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 600));

  const afterScroll = await evalJs(`JSON.stringify({ scrollY: window.scrollY, bodyScrollTop: document.body.scrollTop, docScrollTop: document.documentElement.scrollTop })`);
  console.log('=== AFTER SCROLL ===', afterScroll);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });