// Diagnose ListeningHistory internals
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
    const out = {};
    try { out.typeofLH = typeof ListeningHistory; } catch(e) { out.typeofLH = 'ERR:' + e.message; }
    try {
      // Direct call to trackPlayback
      ListeningHistory.trackPlayback({ id: 'diag', title: 'Diag Song', artist: 'Diag Artist' }, 'song');
      out.afterTrackPlayback = ListeningHistory.getHistory().map(h => ({ id: h.id, type: h.type, title: h.title, progress: h.progress }));
      out.storageAfter = (() => { try { return JSON.parse(localStorage.getItem('lh_playback_history') || '[]').length; } catch(e) { return 'parse err ' + e.message; } })();
    } catch (e) {
      out.trackPlaybackErr = String(e.stack || e);
    }
    try {
      ListeningHistory.openPanel();
      const body = document.getElementById('lhBody');
      out.openPanel = document.getElementById('lhPanel').classList.contains('active');
      out.renderText = (body ? body.innerText : '').slice(0, 200);
    } catch (e) {
      out.openPanelErr = String(e.stack || e);
    }
    return JSON.stringify(out);
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) console.log('EVAL EXCEPTION', JSON.stringify(r.exceptionDetails));
  console.log(r.result.value);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });