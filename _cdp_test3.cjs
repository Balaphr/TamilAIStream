// Find exact exception in playSong flow
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

  const expr = `(() => {
    let result = {};
    try {
      const songs = DataStore.getSongs();
      const song = songs[0];
      const mock = {
        paused: true, currentTime: 0, duration: 180, volume: 0.7, src: '', preload: 'auto',
        _listeners: {},
        addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
        removeEventListener(){}, load() { this.duration = 180; },
        play() { this.paused = false; return Promise.resolve(); },
        pause() { this.paused = true; }
      };
      eval('audioPlayer = mock');
      const ret = window.playSong(song, []);
      result.chainType = typeof ret;
      return Promise.resolve(ret).then(() => {
        result.done = true;
        result.track = (typeof currentPlaybackTrack !== 'undefined' && currentPlaybackTrack) ? currentPlaybackTrack.title : null;
        result.mode = typeof currentPlaybackMode !== 'undefined' ? currentPlaybackMode : null;
        result.history = (typeof ListeningHistory !== 'undefined') ? ListeningHistory.getHistory().length : -1;
        return JSON.stringify(result);
      }).catch(err => {
        result.done = false;
        result.err = String(err && err.stack ? err.stack : err);
        return JSON.stringify(result);
      });
    } catch (e) {
      result.syncErr = String(e && e.stack ? e.stack : e);
      return Promise.resolve(JSON.stringify(result));
    }
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(r.result.value);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });