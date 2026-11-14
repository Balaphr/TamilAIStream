// Deep CDP test: mobile hit-test + full history flow with mocked audio element
const args = process.argv.slice(2);
const WIDTH = args.includes('--desktop') ? 1280 : 390;
const HEIGHT = args.includes('--desktop') ? 900 : 844;

async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) events.push(msg);
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onclose = () => process.exit(0);

  function send(m, p = {}) {
    return new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method: m, params: p }));
    });
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 3, mobile: WIDTH < 600 });
  await send('Page.navigate', { url: 'http://localhost:8777/index.html' });
  await new Promise(r => setTimeout(r, 9000)); // wait for splash dismissal + init

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'EXCEPTION: ' + r.exceptionDetails.text;
    return r.result.value;
  };

  // 1. Hit-test the FAB
  const fabInfo = await evalJs(`(() => {
    const fab = document.getElementById('lhFab');
    if (!fab) return 'NO FAB';
    const r = fab.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = document.elementFromPoint(cx, cy);
    return JSON.stringify({
      rect: { left: r.left, top: r.top, w: r.width, h: r.height },
      center: { x: cx, y: cy },
      elementAtCenter: at ? (at.id || at.className || at.tagName) : null,
      isFab: !!at && (at.id === 'lhFab'),
      aiFabRect: (() => { const a = document.getElementById('ytmAiFab'); return a ? JSON.parse(JSON.stringify(a.getBoundingClientRect())) : null; })()
    });
  })()`);
  console.log('=== FAB HIT TEST @' + WIDTH + 'x' + HEIGHT + ' ===');
  console.log(fabInfo);

  // 2. Real tap at FAB center
  const tapResult = await evalJs(`(() => {
    const fab = document.getElementById('lhFab');
    const r = fab.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(type => {
      fab.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window }));
    });
    return new Promise(res => setTimeout(() => {
      const panel = document.getElementById('lhPanel');
      res(JSON.stringify({ panelActive: panel.classList.contains('active'), display: getComputedStyle(panel).display }));
    }, 100));
  })()`);
  console.log('=== TAP FAB (dispatch) ===');
  console.log(tapResult);

  // 3. Inject mock audio + play a song, verify history records
  const playFlow = await evalJs(`(async () => {
    const out = {};
    if (typeof DataStore === 'undefined') { out.noDataStore = true; return JSON.stringify(out); }
    const songs = typeof DataStore.getSongs === 'function' ? DataStore.getSongs() : JSON.parse(localStorage.getItem('tamilAIStream_songs') || '[]');
    out.songCount = songs.length;
    if (!songs.length) return JSON.stringify(out);
    const song = songs[0];
    out.song = song.title;

    const mock = {
      paused: true, currentTime: 0, duration: 180, volume: 0.7, src: '', preload: 'auto',
      _listeners: {},
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      load() { this.duration = 180; },
      play() { this.paused = false; return Promise.resolve(); },
      pause() { this.paused = true; }
    };
    eval('audioPlayer = mock');
    await eval('playSong(' + JSON.stringify(song) + ', [])');

    out.playedTrack = eval('currentPlaybackTrack ? currentPlaybackTrack.title : null');
    out.mode = eval('currentPlaybackMode');
    const history = eval('ListeningHistory.getHistory()');
    out.historyCount = history.length;
    out.historyTop = history[0] ? { id: history[0].id, type: history[0].type, title: history[0].title, progress: history[0].progress } : null;

    // 4. Open panel and read markup
    eval('ListeningHistory.openPanel()');
    await new Promise(r => setTimeout(r, 100));
    const panel = document.getElementById('lhPanel');
    const body = document.getElementById('lhBody');
    out.panelActiveAfterOpen = panel.classList.contains('active');
    out.renderText = (body ? body.innerText : '').slice(0, 300);
    return JSON.stringify(out);
  })()`);
  console.log('=== FULL HISTORY FLOW ===');
  console.log(playFlow);

  // 5. Console errors of note
  const errs = events
    .filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(e.params.type)))
    .map(e => e.method === 'Runtime.exceptionThrown'
      ? 'EXCEPTION: ' + e.params.exceptionDetails.text
      : 'CONSOLE.' + e.params.type + ': ' + e.params.args.map(a => a.value !== undefined ? a.value : (a.description||'')).join(' '));
  console.log('=== SCROLL OF ERRORS/WARNINGS ===');
  errs.slice(-30).forEach(e => console.log(e));

  ws.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });