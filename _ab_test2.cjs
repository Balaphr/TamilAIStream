// Per-element backdrop-filter cost test
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
  await ev(`(() => {
    window.__perf = { frames: [], scrolling: false };
    let last = performance.now();
    function sample(ts) { const dt = ts - last; last = ts; if (window.__perf.scrolling) window.__perf.frames.push(dt); requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
    if (!document.getElementById('__exp')) { const s = document.createElement('style'); s.id = '__exp'; document.head.appendChild(s); }
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
    const stats = await ev(`(() => { const f = window.__perf.frames.slice(); window.__perf.scrolling = false; if (f.length<5) return JSON.stringify({err:1}); const avg=f.reduce((a,b)=>a+b,0)/f.length; const s=f.slice().sort((a,b)=>a-b); return JSON.stringify({ fps:+(1000/avg).toFixed(1), p95:+s[Math.floor(s.length*0.95)].toFixed(1) }); })()`);
    console.log(`${label.padEnd(50)} ${stats}`);
  };

  const OFF = (sel) => `${sel} { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`;

  await measure('BASELINE');
  await setExp(OFF('.ai-sidebar')); await new Promise(r=>setTimeout(r,500));
  await measure('- ai-sidebar (240x730 blur48)');
  await setExp(OFF('.ai-sidebar') + OFF('.premium-top-nav, #premiumTopNav')); await new Promise(r=>setTimeout(r,500));
  await measure('- sidebar - topnav (1286x61 blur28)');
  await setExp(OFF('.ai-sidebar') + OFF('.premium-top-nav, #premiumTopNav') + OFF('#upBottomBar, .up-bottom-bar')); await new Promise(r=>setTimeout(r,500));
  await measure('- + upBottomBar (480x78 blur22)');
  await setExp(OFF('.ai-sidebar') + OFF('.premium-top-nav, #premiumTopNav') + OFF('#upBottomBar, .up-bottom-bar') + OFF('.top-header-bar')); await new Promise(r=>setTimeout(r,500));
  await measure('- + top-header-bar (full width blur16)');
  await setExp(OFF('.ai-sidebar') + OFF('.premium-top-nav, #premiumTopNav') + OFF('#upBottomBar, .up-bottom-bar') + OFF('.top-header-bar') + OFF('.ytm-ticker')); await new Promise(r=>setTimeout(r,500));
  await measure('- + ytm-ticker (full width blur16)');
  await setExp(`* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`); await new Promise(r=>setTimeout(r,500));
  await measure('- ALL backdrop-filter (target 60fps)');

  // Now: keep glass look with reduced radii on all
  await setExp(``);
  await new Promise(r=>setTimeout(r,500));
  await measure('RESTORED');

  await setExp(`
    .ai-sidebar { backdrop-filter: blur(16px) saturate(1.6) !important; -webkit-backdrop-filter: blur(16px) saturate(1.6) !important; }
    .premium-top-nav, #premiumTopNav { backdrop-filter: blur(12px) saturate(1.4) !important; -webkit-backdrop-filter: blur(12px) saturate(1.4) !important; }
    #upBottomBar, .up-bottom-bar { backdrop-filter: blur(12px) saturate(1.4) !important; -webkit-backdrop-filter: blur(12px) saturate(1.4) !important; }
    .top-header-bar, .ytm-ticker { backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; }
  `); await new Promise(r=>setTimeout(r,500));
  await measure('REDUCED radii (48/28/22/16 -> 16/12/12/10)');

  ws.close(); process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
