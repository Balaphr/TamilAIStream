// Scroll FPS / jank benchmark via CDP (no deps, Node 22+ WebSocket)
async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  if (!page) throw new Error('no page target');
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
  const evalJs = async (expression, awaitPromise = false) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Performance.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/index.html' });
  await new Promise(r => setTimeout(r, 9000));

  // Install frame sampler + long task observer
  await evalJs(`(() => {
    window.__perf = { frames: [], longTasks: [], dropped: 0, scrolling: false };
    if (window.__perfSampler) { cancelAnimationFrame(window.__perfSampler); }
    let last = performance.now();
    function sample(ts) {
      const dt = ts - last; last = ts;
      if (window.__perf.scrolling) {
        window.__perf.frames.push(dt);
        if (dt > 34) window.__perf.dropped++;
      }
      window.__perfSampler = requestAnimationFrame(sample);
    }
    window.__perfSampler = requestAnimationFrame(sample);
    if ('PerformanceObserver' in window) {
      try {
        window.__perfLT = new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__perf.longTasks.push(Math.round(e.duration));
        });
        window.__perfLT.observe({ entryTypes: ['longtask'] });
      } catch (e) {}
    }
    return 'ok';
  })()`);

  const scrollTest = async (label, jsScroll) => {
    await evalJs(`window.__perf.frames = []; window.__perf.dropped = 0; window.__perf.scrolling = true;`);
    await evalJs(jsScroll, true);
    await new Promise(r => setTimeout(r, 400));
    const stats = await evalJs(`(() => {
      const f = window.__perf.frames.slice();
      window.__perf.scrolling = false;
      if (!f.length) return JSON.stringify({ count: 0 });
      const avg = f.reduce((a,b)=>a+b,0)/f.length;
      const max = Math.max(...f);
      const sorted = f.slice().sort((a,b)=>a-b);
      const p95 = sorted[Math.floor(sorted.length*0.95)] || 0;
      const fps = 1000/avg;
      return JSON.stringify({ count: f.length, avgMs: +avg.toFixed(2), maxMs: +max.toFixed(1), p95Ms: +p95.toFixed(1), fps: +fps.toFixed(1), dropped: window.__perf.dropped });
    })()`);
    console.log(`[${label}] ${stats}`);
    return JSON.parse(stats);
  };

  // Smooth programmatic scroll over ~1.5s covering full page
  const smoothScroll = `(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now();
    const dur = 1500;
    return await new Promise(res => {
      function step(t) {
        const p = Math.min(1, (t - start) / dur);
        window.scrollTo(0, max * p);
        if (p < 1) requestAnimationFrame(step); else res('done');
      }
      requestAnimationFrame(step);
    });
  })()`;

  const down = await scrollTest('scroll-down', smoothScroll);
  const up = await scrollTest('scroll-up', `(async () => {
    const max = Math.max(0, document.body.scrollHeight - innerHeight);
    const start = performance.now();
    const dur = 1500;
    return await new Promise(res => {
      function step(t) {
        const p = Math.min(1, (t - start) / dur);
        window.scrollTo(0, max * (1 - p));
        if (p < 1) requestAnimationFrame(step); else res('done');
      }
      requestAnimationFrame(step);
    });
  })()`);

  const longTasks = await evalJs(`JSON.stringify(window.__perf.longTasks.slice(0,40))`);
  console.log('longTasks(ms):', longTasks);

  // Page metrics
  const metrics = await send('Performance.getMetrics');
  const m = {};
  for (const x of metrics.metrics) m[x.name] = x.value;
  console.log('metrics:', JSON.stringify({
    Nodes: m.Nodes, JSHeapUsedSize: m.JSHeapUsedSize && Math.round(m.JSHeapUsedSize/1048576) + 'MB',
    LayoutCount: m.LayoutCount, RecalcStyleCount: m.RecalcStyleCount, ScriptDuration: +m.ScriptDuration.toFixed(2), TaskDuration: +m.TaskDuration.toFixed(2)
  }));

  // DOM node count + css animation count
  const info = await evalJs(`JSON.stringify({
    domNodes: document.querySelectorAll('*').length,
    imgsNoDims: [...document.querySelectorAll('img')].filter(i => !i.getAttribute('width') && !i.clientWidth).length,
    imgsTotal: document.querySelectorAll('img').length,
    anims: document.getAnimations ? document.getAnimations().length : -1,
    runningAnims: document.getAnimations ? document.getAnimations().filter(a=>a.playState==='running').length : -1,
    scrollH: document.body.scrollHeight
  })`);
  console.log('page info:', info);

  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
