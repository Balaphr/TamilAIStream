// Trace during scroll, then analyze main-thread + compositor costs
async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const p = new Map(); const events = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error))) : q.resolve(m.result); }
    if (m.method === 'Tracing.dataCollected') events.push(...m.params.value);
    if (m.method === 'Tracing.tracingComplete') { p.get('__done')?.resolve(true); }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (m, pr = {}) => new Promise((res, rej) => { const i = ++id; p.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };

  await send('Page.enable');
  await send('Performance.enable');

  const categories = [
    'devtools.timeline', 'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame',
    'compositor', 'blink', 'loading', 'disabled-by-default.gpu',
    'disabled-by-default.input', 'toplevel', 'viz', 'cc'
  ];
  p.set('__done', { resolve: () => {}, reject: () => {} });
  await send('Tracing.start', { categories: categories.join(','), options: 'sampling-frequency=1000' });

  // Warm up then scroll
  await new Promise(r => setTimeout(r, 1000));
  await ev(`(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now(); const dur = 3000;
    return await new Promise(res => { function step(t){ const p=Math.min(1,(t-start)/dur); window.scrollTo(0, max*p); if(p<1) requestAnimationFrame(step); else res('done'); } requestAnimationFrame(step); });
  })()`, true);
  await new Promise(r => setTimeout(r, 500));

  const done = new Promise(res => { p.set('__done', { resolve: res, reject: res }); });
  await send('Tracing.end');
  await done;
  await new Promise(r => setTimeout(r, 500));

  // Analyze
  const byName = {};
  for (const e of events) {
    if (e.ph === 'X' || e.ph === 'B') {
      const dur = e.dur || 0;
      byName[e.name] = byName[e.name] || { count: 0, totalUs: 0, maxUs: 0 };
      byName[e.name].count++; byName[e.name].totalUs += dur; byName[e.name].maxUs = Math.max(byName[e.name].maxUs, dur);
    }
  }
  const top = Object.entries(byName).sort((a, b) => b[1].totalUs - a[1].totalUs).slice(0, 35);
  console.log('=== TOP EVENTS BY TOTAL TIME (during ~4.5s incl. 3s scroll) ===');
  for (const [n, v] of top) console.log(`${n.padEnd(48)} count=${String(v.count).padStart(5)} total=${(v.totalUs / 1000).toFixed(1)}ms max=${(v.maxUs / 1000).toFixed(1)}ms`);

  // Frame analysis
  const frames = events.filter(e => e.name === 'DrawFrame' || e.name === 'AnimationFrame' || (e.cat || '').includes('frame'));
  const drawFrames = events.filter(e => e.name === 'DrawFrame');
  if (drawFrames.length) {
    const gaps = [];
    for (let i = 1; i < drawFrames.length; i++) gaps.push(drawFrames[i].ts - drawFrames[i - 1].ts);
    gaps.sort((a, b) => a - b);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    console.log(`\nDrawFrames: ${drawFrames.length}, avg interval ${avg.toFixed(1)}us (${(1000000 / avg).toFixed(1)} fps), p95 ${gaps[Math.floor(gaps.length * 0.95)].toFixed(0)}us, max ${gaps[gaps.length - 1].toFixed(0)}us`);
  }

  // Long tasks
  const longTasks = events.filter(e => e.name === 'RunTask' && (e.dur || 0) > 16000);
  console.log(`Long RunTask (>16ms): ${longTasks.length}`, longTasks.slice(0, 10).map(t => (t.dur / 1000).toFixed(1) + 'ms'));

  // Renderer bottlenecks
  for (const key of ['UpdateLayoutTree', 'Layout', 'RecalcStyles', 'Paint', 'RasterTask', 'CompositeLayers', 'PrePaint', 'StyleChange']) {
    const v = byName[key];
    if (v) console.log(`${key}: count=${v.count} total=${(v.totalUs / 1000).toFixed(1)}ms max=${(v.maxUs / 1000).toFixed(1)}ms`);
  }

  // Input/scroll handling
  for (const key of ['HandleInputEvent', 'ScrollUpdate', 'HitTest', 'EventDispatch', 'TimerFire']) {
    const v = byName[key];
    if (v) console.log(`${key}: count=${v.count} total=${(v.totalUs / 1000).toFixed(1)}ms max=${(v.maxUs / 1000).toFixed(1)}ms`);
  }

  ws.close(); process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
