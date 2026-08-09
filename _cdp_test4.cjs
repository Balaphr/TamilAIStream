// Async playSong flow with complete mock audio
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
    const result = {};
    try {
      const songs = DataStore.getSongs();
      const song = songs[0];
      const mock = {
        paused: true, currentTime: 0, duration: 180, volume: 0.7, src: '', preload: 'auto',
        _listeners: {},
        error: null,
        addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
        removeEventListener(){},
        removeAttribute(){},
        load() { this.duration = 180; },
        play() { this.paused = false; try { (this._listeners.play||[]).forEach(f => f()); } catch(e){} return Promise.resolve(); },
        pause() { this.paused = true; }
      };
      eval('audioPlayer = mock');
      window.playSong(song, []);
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200));
        const t = eval('typeof currentPlaybackTrack !== "undefined" && currentPlaybackTrack');
        if (t) {
          result.track = eval('currentPlaybackTrack.title');
          result.mode = eval('typeof currentPlaybackMode !== "undefined" ? currentPlaybackMode : null');
          result.history = eval('typeof ListeningHistory !== "undefined" ? ListeningHistory.getHistory().length : -1');
          break;
        }
      }
      result.finalTrack = eval('currentPlaybackTrack ? currentPlaybackTrack.title : null');
      result.popupOpen = eval('document.getElementById("miniAudioPopup") ? document.getElementById("miniAudioPopup").classList.contains("open") : false');
      result.historyList = eval('typeof ListeningHistory !== "undefined" ? ListeningHistory.getHistory().map(h => ({id:h.id, type:h.type, title:h.title})) : []');
    } catch (e) {
      result.err = String(e && e.stack ? e.stack : e);
    }
    return JSON.stringify(result);
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(r.result.value);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });