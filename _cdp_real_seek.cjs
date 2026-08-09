// REAL media seek test on the mini-audio popup progress bar
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

  const expr = `(async () => {
    const out = {};
    try {
      // Use a REAL Audio element
      const ep = new Audio();
      eval('audioPlayer = ep');
      out.initialDuration = ep.duration;

      const song = { id: 'song_wav', title: 'Silence Test', artist: 'Test', movie: '', albumCover: '', audioUrl: 'http://localhost:8777/_silence.wav' };
      window.playSong(song, [song]);

      // Wait for metadata
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250));
        if (isFinite(ep.duration) && ep.duration > 0) break;
      }
      out.duration = ep.duration;
      out.pausedAfterPlay = ep.paused;
      await new Promise(r => setTimeout(r, 1200));
      out.currentTimeAfterStart = ep.currentTime;

      // Open popup and simulate a tap at 30%
      if (typeof MiniAudioPlayer !== 'undefined') {
        MiniAudioPlayer.openPopup({ title: 'Silence Test', artist: 'Test', audioUrl: 'x' }, {});
      }
      const bar = document.getElementById('mapProgressWrap');
      const r = bar.getBoundingClientRect();
      out.bar = { left: r.left, width: r.width };
      const targetX = r.left + r.width * 0.3;

      ['mousedown', 'mouseup', 'click'].forEach(t => {
        bar.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: targetX, clientY: 10, view: window }));
      });

      await new Promise(r2 => setTimeout(r2, 800));
      out.currentTimeAfterSeek = ep.currentTime;
      out.timeLabel = document.getElementById('mapCurrentTime').textContent;
      out.progressFilledWidth = document.getElementById('mapProgressFilled').style.width;
      out.assignEvents = [];
      ['timeupdate', 'play', 'pause', 'ended'].forEach(t => {
        const orig = 'xx';
      });
    } catch (e) {
      out.err = String(e && e.stack ? e.stack : e);
    }
    return JSON.stringify(out);
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) console.log('EXCEPTION', JSON.stringify(r.exceptionDetails).slice(0, 800));
  console.log(r.result.value);

  const errs = events
    .filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => { const d = e.params.exceptionDetails; return (d.exception && d.exception.description || d.text || '').slice(0, 500); });
  console.log('EXCEPTIONS:', JSON.stringify(errs));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });