async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const p = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error))) : q.resolve(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (m, pr = {}) => new Promise((res, rej) => { const i = ++id; p.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };

  // 1. List running animations
  const anims = await ev(`JSON.stringify(document.getAnimations().filter(a=>a.playState==='running').map(a=>{
    const t = a.effect && a.effect.target;
    const props = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes().map(k=>Object.keys(k).filter(x=>x!=='offset'&&x!=='computedOffset'&&x!=='easing'&&x!=='composite')).flat() : [];
    return { sel: t ? (t.id || t.className||'').toString().slice(0,50) : 'none', tag: t&&t.tagName, props: [...new Set(props)], dur: a.effect&&a.effect.getTiming().duration };
  }))`);
  console.log('=== RUNNING ANIMATIONS ===');
  console.log(JSON.parse(anims).map(a => `${a.tag}#${a.sel} [${a.props.join(',')}] ${a.dur}ms`).join('\n'));

  // 2. Expensive always-on styles
  const expensive = await ev(`JSON.stringify({
    fixedBackdrop: [...document.querySelectorAll('*')].filter(el=>{
      const cs = getComputedStyle(el);
      if ((cs.position==='fixed'||cs.position==='sticky') && cs.backdropFilter && cs.backdropFilter!=='none') {
        const r = el.getBoundingClientRect();
        if (r.width>0 && r.height>0 && cs.display!=='none' && cs.visibility!=='hidden') return true;
      }
      return false;
    }).map(el=>({ sel:(el.id||el.className||'').toString().slice(0,45), pos:getComputedStyle(el).position, bf:getComputedStyle(el).backdropFilter, w:Math.round(el.getBoundingClientRect().width), h:Math.round(el.getBoundingClientRect().height) })),
    blurFixed: [...document.querySelectorAll('*')].filter(el=>{
      const cs = getComputedStyle(el);
      return cs.position==='fixed' && cs.filter && cs.filter!=='none' && cs.display!=='none' && el.getBoundingClientRect().width>0;
    }).map(el=>({ sel:(el.id||el.className||'').toString().slice(0,45), filter:cs=>0, f:getComputedStyle(el).filter, w:Math.round(el.getBoundingClientRect().width), h:Math.round(el.getBoundingClientRect().height) }))
  })`);
  console.log('\n=== FIXED/STICKY BACKDROP-FILTER (visible) ===');
  console.log(JSON.stringify(JSON.parse(expensive).fixedBackdrop, null, 1));

  // 3. Metrics delta during scroll
  const m0 = await send('Performance.getMetrics');
  const g0 = Object.fromEntries(m0.metrics.map(x => [x.name, x.value]));
  await ev(`(() => { window.__s = true; return 'go'; })()`);
  await ev(`(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now(); const dur = 2000;
    return await new Promise(res => { function step(t){ const p=Math.min(1,(t-start)/dur); window.scrollTo(0, max*p); if(p<1) requestAnimationFrame(step); else res('done'); } requestAnimationFrame(step); });
  })()`, true);
  const m1 = await send('Performance.getMetrics');
  const g1 = Object.fromEntries(m1.metrics.map(x => [x.name, x.value]));
  console.log('\n=== METRICS DELTA over 2s full scroll ===');
  const keys = ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration', 'DevToolsCommandCount', 'JSHeapUsedSize'];
  for (const k of keys) console.log(`${k}: ${g0[k]} -> ${g1[k]} (delta ${(g1[k]-g0[k]).toFixed ? (g1[k]-g0[k]).toFixed(3) : (g1[k]-g0[k])})`);

  // 4. Layers info
  const layers = await ev(`JSON.stringify({
    fixedWithBackdrop: [...document.querySelectorAll('*')].length,
    willChangeCount: [...document.querySelectorAll('*')].filter(el=>getComputedStyle(el).willChange!=='auto').length,
    transformCount: [...document.querySelectorAll('*')].filter(el=>{const t=getComputedStyle(el).transform; return t&&t!=='none';}).length
  })`);
  console.log('\nlayer info:', layers);

  ws.close(); process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
