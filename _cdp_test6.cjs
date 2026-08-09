// Check song.audioUrl and playback branch state
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
    const out = {};
    const songs = DataStore.getSongs();
    out.totalSongs = songs.length;
    out.song0 = { title: songs[0] && songs[0].title, hasAudioUrl: !!(songs[0] && songs[0].audioUrl), audioUrl: (songs[0] && songs[0].audioUrl || '').slice(0, 80), status: songs[0] && songs[0].status };
    const song = songs[0];
    const mock = {
      paused: true, currentTime: 0, duration: 180, volume: 0.7, src: '', preload: 'auto',
      _listeners: {}, error: null, playCalled: 0, loadCalled: 0,
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      removeEventListener(){}, removeAttribute(){},
      load() { this.loadCalled++; this.duration = 180; },
      play() { this.playCalled++; this.paused = false; try { (this._listeners.play||[]).forEach(f => f()); } catch(e){} return Promise.resolve(); },
      pause() { this.paused = true; }
    };
    eval('audioPlayer = mock');
    try { window.playSong(song, []); } catch (e) { out.syncErr = String(e && e.stack ? e.stack : e); }
    await new Promise(r => setTimeout(r, 1500));
    out.playCalled = mock.playCalled;
    out.loadCalled = mock.loadCalled;
    out.isStreamPlaying = eval('typeof isStreamPlaying !== "undefined" ? isStreamPlaying : null');
    out.currentStation = eval('typeof currentStation !== "undefined" ? currentStation : null');
    out.streamConnecting = eval('typeof streamConnecting !== "undefined" ? streamConnecting : null');
    out.mode = eval('typeof currentPlaybackMode !== "undefined" ? currentPlaybackMode : null');
    out.trackTitle = eval('currentPlaybackTrack ? currentPlaybackTrack.title : null');
    out.toasts = (() => { const c = document.getElementById('ytmToastContainer'); return c ? c.innerText.slice(0,120) : ''; })();
    return JSON.stringify(out);
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(r.result.value);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });