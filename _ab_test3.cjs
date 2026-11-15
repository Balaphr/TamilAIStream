// Targeted fix validation
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
    const stats = await ev(`(() => { const f = window.__perf.frames.slice(); window.__perf.scrolling = false; if (f.length<5) return JSON.stringify({err:1}); const avg=f.reduce((a,b)=>a+b,0)/f.length; const s=f.slice().sort((a,b)=>a-b); return JSON.stringify({ fps:+(1000/avg).toFixed(1), p95:+s[Math.floor(s.length*0.95)].toFixed(1), max:+Math.max(...f).toFixed(1) }); })()`);
    console.log(`${label.padEnd(58)} ${stats}`);
  };

  // FIX 1: remove backdrop-filter only from big content panels
  await setExp(`.ai-panel { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`);
  await new Promise(r=>setTimeout(r,500));
  await measure('FIX1: .ai-panel backdrop off (big sections)');

  // FIX 2: + reduce chrome blur radii (keep frosted look)
  await setExp(`
    .ai-panel { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    .ai-sidebar { backdrop-filter: blur(16px) saturate(1.6) !important; -webkit-backdrop-filter: blur(16px) saturate(1.6) !important; }
    .premium-top-nav, #premiumTopNav { backdrop-filter: blur(12px) saturate(1.4) !important; -webkit-backdrop-filter: blur(12px) saturate(1.4) !important; }
    #upBottomBar, .up-bottom-bar { backdrop-filter: blur(12px) saturate(1.4) !important; -webkit-backdrop-filter: blur(12px) saturate(1.4) !important; }
    .top-header-bar { backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; }
    .ytm-ticker { backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; }
    .premium-topnav-search-box { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  `);
  await new Promise(r=>setTimeout(r,500));
  await measure('FIX2: + chrome radii reduced (48/28/22/16->16/12/12/10)');

  // FIX 3: + nested search box off only (keep chrome original radii) - isolate
  await setExp(`
    .ai-panel { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    .premium-topnav-search-box { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  `);
  await new Promise(r=>setTimeout(r,500));
  await measure('FIX3: panels off + nested search off (chrome original)');

  // FIX 4: panels blur 4px instead of off (keep tiny frost)
  await setExp(`
    .ai-panel { backdrop-filter: blur(4px) !important; -webkit-backdrop-filter: blur(4px) !important; }
  `);
  await new Promise(r=>setTimeout(r,500));
  await measure('FIX4: .ai-panel blur(4px) instead of off');

  // baseline again
  await setExp(``);
  await new Promise(r=>setTimeout(r,500));
  await measure('BASELINE again');

  ws.close(); process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
