// Music page scroll FPS + player interaction + screenshots
const fs = require('fs');
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
      console.log('JS EXCEPTION:', JSON.stringify(m.params.exceptionDetails).slice(0, 400));
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
  const screenshot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(name, Buffer.from(r.data, 'base64'));
    console.log('screenshot saved:', name);
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/index.html' });
  await new Promise(r => setTimeout(r, 9000));

  await screenshot('_shot_home_top.png');
  await evalJs(`window.scrollTo(0, Math.max(0, (document.body.scrollHeight - innerHeight) * 0.4))`);
  await new Promise(r => setTimeout(r, 800));
  await screenshot('_shot_home_mid.png');

  // open Music/Explore page
  await evalJs(`(() => { const l = [...document.querySelectorAll('a, button, [role=tab], .nav-item, li')].find(a => /^\\s*music\\s*$/i.test(a.textContent || '') && a.offsetParent); if (l) { l.click(); return 'clicked'; } return 'not found'; })()`);
  await new Promise(r => setTimeout(r, 2000));

  // scroll FPS on music page
  await evalJs(`(() => {
    window.__perf = { frames: [], dropped: 0, scrolling: false };
    let last = performance.now();
    function sample(ts) { const dt = ts - last; last = ts;
      if (window.__perf.scrolling) { window.__perf.frames.push(dt); if (dt > 34) window.__perf.dropped++; }
      requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
    window.scrollTo(0, 0); return 'ok';
  })()`);
  await evalJs(`window.__perf.frames = []; window.__perf.dropped = 0; window.__perf.scrolling = true;`);
  await evalJs(`(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now(); const dur = 2500;
    return await new Promise(res => { function step(t) { const p = Math.min(1, (t - start) / dur); window.scrollTo(0, max * p); if (p < 1) requestAnimationFrame(step); else res('done'); } requestAnimationFrame(step); });
  })()`, true);
  await new Promise(r => setTimeout(r, 300));
  const mus = await evalJs(`(() => { const f = window.__perf.frames.slice(); window.__perf.scrolling = false;
    const avg = f.reduce((a,b)=>a+b,0)/f.length; const s = f.slice().sort((a,b)=>a-b);
    return JSON.stringify({ frames: f.length, fps: +(1000/avg).toFixed(1), p95: +s[Math.floor(s.length*0.95)].toFixed(1), max: +Math.max(...f).toFixed(1), dropped: window.__perf.dropped }); })()`);
  console.log('MUSIC PAGE scroll:', mus);

  await evalJs(`window.scrollTo(0, 0)`);
  await new Promise(r => setTimeout(r, 600));
  await screenshot('_shot_music_top.png');

  // player interaction: click first playable item (play buttons / cards)
  const playRes = await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button, .play-btn, .ytm-play, [aria-label*="play" i], [title*="play" i]')].find(b => b.offsetParent && b.getBoundingClientRect().width > 10);
    if (!btn) return 'no play button found';
    btn.click();
    return 'clicked play: ' + (btn.getAttribute('aria-label') || btn.title || btn.className).slice(0, 60);
  })()`);
  console.log('play interaction:', playRes);
  await new Promise(r => setTimeout(r, 2500));

  const playerState = await evalJs(`JSON.stringify({
    audioPlaying: !!(window.audioPlayer && !window.audioPlayer.paused && window.audioPlayer.src),
    bottomBarVisible: !!document.querySelector('.up-bottom-bar.visible'),
    voiceRoot: !!document.getElementById('vaRoot'),
    voiceRootBottom: document.getElementById('vaRoot') ? document.getElementById('vaRoot').style.bottom : null
  })`);
  console.log('player state:', playerState);

  // scroll while playing (tests voice bot rAF scroll handler + sticky bars)
  await evalJs(`window.__perf.frames = []; window.__perf.dropped = 0; window.__perf.scrolling = true;`);
  await evalJs(`(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now(); const dur = 2000;
    return await new Promise(res => { function step(t) { const p = Math.min(1, (t - start) / dur); window.scrollTo(0, max * p); if (p < 1) requestAnimationFrame(step); else res('done'); } requestAnimationFrame(step); });
  })()`, true);
  await new Promise(r => setTimeout(r, 300));
  const playing = await evalJs(`(() => { const f = window.__perf.frames.slice(); window.__perf.scrolling = false;
    const avg = f.reduce((a,b)=>a+b,0)/f.length; const s = f.slice().sort((a,b)=>a-b);
    return JSON.stringify({ frames: f.length, fps: +(1000/avg).toFixed(1), p95: +s[Math.floor(s.length*0.95)].toFixed(1), max: +Math.max(...f).toFixed(1), dropped: window.__perf.dropped }); })()`);
  console.log('SCROLL WHILE PLAYING:', playing);

  // pause playback
  await evalJs(`(() => { if (window.audioPlayer && !window.audioPlayer.paused) window.audioPlayer.pause(); return 'paused'; })()`);

  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
