const fs = require('fs');
async function main() {
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') console.log('JS EXCEPTION:', JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(name, Buffer.from(r.data, 'base64')); console.log('saved:', name); };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/index.html' });
  await new Promise(r => setTimeout(r, 9000));

  const nav = await evalJs(`(() => {
    try { YTMusic.navigateTo('home', { _force: true }); return 'navigateTo home ok, current=' + YTMusic.currentPage; }
    catch (e) { return 'err: ' + e.message; }
  })()`);
  console.log('nav:', nav);
  await new Promise(r => setTimeout(r, 1500));
  await evalJs(`window.scrollTo(0, 0)`);
  await new Promise(r => setTimeout(r, 500));
  await shot('_shot_home_real_top.png');

  await evalJs(`(() => { const s = document.getElementById('songsCollectionsSection') || document.querySelector('.ai-panel'); if (s) s.scrollIntoView({ block: 'start' }); return 'scrolled to ' + (s ? (s.id || 'panel') : 'none'); })()`);
  await new Promise(r => setTimeout(r, 900));
  await shot('_shot_home_real_panels.png');

  // verify panels have backdrop none and look right in DOM
  const info = await evalJs(`(() => {
    const panels = [...document.querySelectorAll('.ai-panel')].filter(p => p.offsetHeight > 0);
    return JSON.stringify({
      visiblePanels: panels.length,
      backdrops: [...new Set(panels.map(p => getComputedStyle(p).backdropFilter))],
      sampleBg: panels[0] ? getComputedStyle(panels[0]).backgroundImage.slice(0, 70) : null,
      musicCollections: !!document.getElementById('songsCollectionsSection')
    });
  })()`);
  console.log('panels:', info);

  ws.close(); process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
