async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const p = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error))) : q.resolve(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (m, pr = {}) => new Promise((res, rej) => { const i = ++id; p.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };

  // scroll to middle so more elements are in view, then enumerate
  await ev(`window.scrollTo(0, document.body.scrollHeight * 0.35); 'ok'`);
  await new Promise(r => setTimeout(r, 800));

  const out = await ev(`JSON.stringify([...document.querySelectorAll('*')].map(el => {
    const cs = getComputedStyle(el);
    if (!cs.backdropFilter || cs.backdropFilter === 'none') return null;
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    // in viewport?
    const inVp = r.bottom > -100 && r.top < innerHeight + 100 && r.right > -100 && r.left < innerWidth + 100;
    if (!inVp) return null;
    return { sel: (el.id ? '#'+el.id : '') + '.' + (typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0,3).join('.') : ''), pos: cs.position, bf: cs.backdropFilter, w: Math.round(r.width), h: Math.round(r.height), area: Math.round(r.width*r.height), z: cs.zIndex, anim: cs.animationName };
  }).filter(Boolean).sort((a,b)=>b.area-a.area), null, 1)`);
  const arr = JSON.parse(out);
  console.log(`Visible backdrop-filter elements at 35% scroll: ${arr.length}`);
  let totalArea = 0;
  for (const e of arr) { totalArea += e.area; console.log(`  ${e.sel.padEnd(55)} ${e.pos.padEnd(7)} ${String(e.w+'x'+e.h).padEnd(12)} area=${String(e.area).padEnd(9)} ${e.bf}`); }
  console.log('total area:', totalArea);

  // also count ALL backdrop-filter elements in DOM regardless of view
  const all = await ev(`JSON.stringify([...document.querySelectorAll('*')].filter(el=>{const cs=getComputedStyle(el); return cs.backdropFilter && cs.backdropFilter!=='none';}).length)`);
  console.log('total backdrop-filter elements in DOM:', all);

  ws.close(); process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
