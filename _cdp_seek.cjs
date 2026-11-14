// Test seek across all progress bars with instrumented mock audio
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
  await send('Page.navigate', { url: 'http://localhost:8777/index.html' });
  await new Promise(r => setTimeout(r, 9000));

  const expr = `(async () => {
    const out = { assignments: [], srcSets: [], loads: [], plays: [] };
    let _ct = 25; // playing at 0:25
    const mock = {
      get currentTime() { return _ct; },
      set currentTime(v) {
        out.assignments.push(v);
        _ct = v;
      },
      paused: false, duration: 300, volume: 0.7,
      _src: 'https://example.com/song.mp3',
      get src() { return this._src; },
      set src(v) { out.srcSets.push(v); this._src = v; },
      preload: 'auto',
      _listeners: {}, error: null,
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      removeEventListener(){}, removeAttribute(){},
      load() { out.loads.push(1); },
      play() { out.plays.push(1); return Promise.resolve(); },
      pause() { this.paused = true; }
    };
    eval('audioPlayer = mock');

    // Give the popup module a current playback state and open it
    if (typeof MiniAudioPlayer !== 'undefined') {
      try { MiniAudioPlayer.openPopup({ title: 'Test Song', artist: 'Artist', thumbnail: '', audioUrl: 'x' }, {}); } catch (e) { out.openPopupErr = String(e); }
    }

    const fire = (el, type, clientX) => {
      if (!el) return 'NOEL';
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 10, view: window }));
      return 'ok';
    };

    const bars = {
      mapPopup: document.getElementById('mapProgressWrap'),
      ytmMini: document.querySelector('.ytm-mini-player-progress'),
      playerUiMini: document.getElementById('miniProgressWrap'),
      ytmFs: document.getElementById('ytmFsProgressBar'),
    };
    const info = {};
    for (const [k, el] of Object.entries(bars)) {
      if (el) {
        const r = el.getBoundingClientRect();
        info[k] = { w: r.width, left: r.left, display: getComputedStyle(el).display, visible: r.width > 0 };
      } else info[k] = null;
    }
    out.bars = info;

    const targetFraction = 90 / 300; // seek to 1:30 (90s) of 300s
    out.beforeCT = _ct;

    // 1. mini-audio-player popup mousedown seek
    if (bars.mapPopup) {
      const r = bars.mapPopup.getBoundingClientRect();
      const x = r.left + r.width * targetFraction;
      fire(bars.mapPopup, 'mousedown', x);
      fire(bars.mapPopup, 'mouseup', x);
      out.afterMapPopupSeek = _ct;
    }

    // 2. ytm mini player click+mousedown
    if (bars.ytmMini) {
      const r = bars.ytmMini.getBoundingClientRect();
      const x = r.left + r.width * targetFraction;
      fire(bars.ytmMini, 'mousedown', x);
      fire(bars.ytmMini, 'mouseup', x);
      fire(bars.ytmMini, 'click', x);
      out.afterYtmMiniSeek = _ct;
    }

    // 3. player-ui mini player (PlayerEngine seek)
    if (bars.playerUiMini) {
      const r = bars.playerUiMini.getBoundingClientRect();
      const x = r.left + r.width * targetFraction;
      fire(bars.playerUiMini, 'mousedown', x);
      fire(bars.playerUiMini, 'mouseup', x);
      out.afterPlayerUiMiniSeek = _ct;
    }

    out.finalCT = _ct;
    out.srcSetsFinal = out.srcSets;
    out.loadsFinal = out.loads;
    out.playsFinal = out.plays;
    out.assignments = out.assignments.slice(0, 20);
    return JSON.stringify(out);
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) console.log('EXCEPTION', JSON.stringify(r.exceptionDetails));
  console.log(r.result.value);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });