// Instrument playSong flow: hook trackPlayback + capture exceptions
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
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    } else if (msg.method) events.push(msg);
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
  events.length = 0;

  const expr = `(async () => {
    const result = { callLog: [], windowErrors: [] };
    window.addEventListener('error', (e) => result.windowErrors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => result.windowErrors.push('UNHANDLED: ' + String(e.reason && e.reason.stack ? e.reason.stack : e.reason)));

    try {
      if (typeof ListeningHistory !== 'undefined') {
        const orig = ListeningHistory.trackPlayback;
        ListeningHistory.trackPlayback = function(track, mode) {
          result.callLog.push({ title: track && (track.title || track.id), mode });
          return orig(track, mode);
        };
      }
      const songs = DataStore.getSongs();
      const song = songs[0];
      const mock = {
        paused: true, currentTime: 7.5, duration: 180, volume: 0.7, src: '', preload: 'auto',
        _listeners: {}, error: null,
        addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
        removeEventListener(){}, removeAttribute(){},
        load() { this.duration = 180; },
        play() { this.paused = false; try { (this._listeners.play||[]).forEach(f => f()); } catch(e){} return Promise.resolve(); },
        pause() { this.paused = true; }
      };
      eval('audioPlayer = mock');
      result.before = eval('ListeningHistory.getHistory().length');
      try { window.playSong(song, []); }
      catch (e) { result.syncError = String(e && e.stack ? e.stack : e); }
      await new Promise(r => setTimeout(r, 1500));
      result.callLogFinal = result.callLog;
      result.after = eval('typeof ListeningHistory !== "undefined" ? ListeningHistory.getHistory().length : -1');
      result.storageLen = (() => { try { return JSON.parse(localStorage.getItem('lh_playback_history') || '[]').length; } catch(e){ return 'ERR'; } })();
      result.storageTop = (() => { try { const h = JSON.parse(localStorage.getItem('lh_playback_history') || '[]'); return h[0] ? { id: h[0].id, type: h[0].type, title: h[0].title, progress: h[0].progress } : null; } catch(e){ return null; } })();
    } catch (e) {
      result.err = String(e && e.stack ? e.stack : e);
    }
    return JSON.stringify(result);
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) console.log('EVAL EXCEPTION:', JSON.stringify(r.exceptionDetails));
  console.log(r.result.value);

  const excs = events
    .filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => {
      const d = e.params.exceptionDetails;
      return d.exception && d.exception.description ? d.exception.description : JSON.stringify(d).slice(0, 600);
    });
  console.log('=== EXCEPTIONS DURING FLOW ===');
  excs.slice(-5).forEach(x => console.log(x));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });