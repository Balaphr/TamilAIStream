// A/B experiment: toggle expensive styles, measure scroll FPS each time
async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const p = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error))) : q.resolve(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (m, pr = {}) => new Promise((res, rej) => { const i = ++id; p.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };

  await send('Page.enable');
  // ensure fresh load
  await send('Page.navigate', { url: 'http://localhost:4173/index.html' });
  await new Promise(r => setTimeout(r, 9000));

  await ev(`(() => {
    window.__perf = { frames: [], scrolling: false };
    let last = performance.now();
    function sample(ts) {
      const dt = ts - last; last = ts;
      if (window.__perf.scrolling) window.__perf.frames.push(dt);
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    // experiment control styles
    const s = document.createElement('style'); s.id = '__exp'; document.head.appendChild(s);
    return 'ok';
  })()`);

  const setExp = (css) => ev(`document.getElementById('__exp').textContent = ${JSON.stringify(css)}; 'ok'`);

  const measure = async (label) => {
    await ev(`window.__perf.frames = []; window.__perf.scrolling = true;`);
    await ev(`(async () => {
      const max = Math.max(0, document.body.scrollHeight - innerHeight);
      const start = performance.now(); const dur = 2500;
      return await new Promise(res => { function step(t){ const p=Math.min(1,(t-start)/dur); window.scrollTo(0, max*p); if(p<1) requestAnimationFrame(step); else res('done'); } requestAnimationFrame(step); });
    })()`, true);
    const stats = await ev(`(() => {
      const f = window.__perf.frames.slice(); window.__perf.scrolling = false;
      if (f.length < 5) return JSON.stringify({ err: 'no frames' });
      const avg = f.reduce((a,b)=>a+b,0)/f.length;
      const sorted = f.slice().sort((a,b)=>a-b);
      return JSON.stringify({ fps: +(1000/avg).toFixed(1), p95: +sorted[Math.floor(sorted.length*0.95)].toFixed(1), max: +Math.max(...f).toFixed(1) });
    })()`);
    console.log(`${label.padEnd(42)} ${stats}`);
    return JSON.parse(stats);
  };

  await measure('BASELINE');

  await setExp(`* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`);
  await new Promise(r => setTimeout(r, 600));
  await measure('NO backdrop-filter');

  await setExp(`* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    .ytm-main-content::before, .ytm-main-content::after { animation: none !important; filter: none !important; }`);
  await new Promise(r => setTimeout(r, 600));
  await measure('NO backdrop + NO orb blur');

  await setExp(`* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    .ytm-main-content::before, .ytm-main-content::after { animation: none !important; filter: none !important; }
    *, *::before, *::after { animation-play-state: paused !important; }`);
  await new Promise(r => setTimeout(r, 600));
  await measure('NO backdrop + NO orbs + PAUSE ALL anim');

  await setExp(`* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    .ytm-main-content::before, .ytm-main-content::after { animation: none !important; filter: none !important; }
    *, *::before, *::after { animation-play-state: paused !important; }
    * { box-shadow: none !important; text-shadow: none !important; }`);
  await new Promise(r => setTimeout(r, 600));
  await measure('+ NO shadows');

  // restore, then only reduce blur radii (keep glass look)
  await setExp(``);
  await new Promise(r => setTimeout(r, 600));
  await measure('RESTORED baseline check');

  await setExp(`.ai-sidebar { backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; }
    .premium-top-nav, #premiumTopNav { backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; }`);
  await new Promise(r => setTimeout(r, 600));
  await measure('blur radii reduced (48/28 -> 12)');

  ws.close(); process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
