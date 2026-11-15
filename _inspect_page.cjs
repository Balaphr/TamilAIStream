async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const p = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error))) : q.resolve(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (m, pr = {}) => new Promise((res, rej) => { const i = ++id; p.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const out = await ev(`JSON.stringify({
    url: location.href,
    title: document.title,
    bodyStart: document.body.innerText.slice(0, 400),
    scrollH: document.body.scrollHeight,
    splashVisible: (() => { const s = document.querySelector('.splash-overlay'); return s ? getComputedStyle(s).display + '/' + getComputedStyle(s).opacity : 'none'; })(),
    visibleSections: [...document.querySelectorAll('.ytm-page, section, .section')].slice(0, 25).map(s => ({ id: s.id, cls: (s.className || '').toString().slice(0, 50), h: Math.round(s.getBoundingClientRect().height), display: getComputedStyle(s).display }))
  })`);
  console.log(JSON.stringify(JSON.parse(out), null, 2));
  ws.close(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
