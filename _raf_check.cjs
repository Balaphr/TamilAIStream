async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const r = await send('Runtime.evaluate', { expression: 'document.hidden', returnByValue: true });
  console.log('document.hidden:', r.result.value);
  const r2 = await send('Runtime.evaluate', {
    expression: 'new Promise(res => { const t = setTimeout(() => res("raf-timeout"), 3000); requestAnimationFrame(() => { clearTimeout(t); res("raf-fired"); }); })',
    returnByValue: true, awaitPromise: true
  });
  console.log('raf test:', r2.result.value);
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
