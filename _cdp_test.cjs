// Minimal CDP driver using Node's global WebSocket (Node >= 22)
// Usage: node _cdp_test.js [--mobile]
const args = process.argv.slice(2);
const MOBILE = args.includes('--mobile');

async function main() {
  // 1. Get the page target
  const list = await (await fetch('http://localhost:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  if (!page) { console.error('No page target'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const m = ++id;
      pending.set(m, { resolve, reject });
      ws.send(JSON.stringify({ id: m, method, params }));
    });
  }

  ws.onclose = () => process.exit(0);

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  // Reload the page fresh
  await send('Page.navigate', { url: 'http://localhost:8777/index.html' });
  await new Promise(r => setTimeout(r, 9000));

  // Collect console messages
  const consoleMsgs = events
    .filter(e => e.method === 'Runtime.consoleAPICalled' || e.method === 'Runtime.exceptionThrown' || e.method === 'Log.entryAdded')
    .map(e => {
      if (e.method === 'Runtime.exceptionThrown') {
        const d = e.params.exceptionDetails;
        return `EXCEPTION: ${d.text} ${(d.exception && d.exception.description) || ''}`;
      }
      if (e.method === 'Runtime.consoleAPICalled') {
        const text = e.params.args.map(a => a.value !== undefined ? a.value : a.description || '').join(' ');
        return `CONSOLE.${e.params.type}: ${text}`;
      }
      return `LOG: ${e.params.entry.text}`;
    });

  console.log('=== CONSOLE OUTPUT (after 9s) ===');
  consoleMsgs.slice(-80).forEach(m => console.log(m));

  // Evaluate key state
  const state = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      hasFab: !!document.getElementById('lhFab'),
      hasPanel: !!document.getElementById('lhPanel'),
      listeningHistoryDefined: typeof window.ListeningHistory !== 'undefined',
      hasAudio: typeof audioPlayer !== 'undefined' && !!audioPlayer,
      currentPlaybackTrack: (typeof currentPlaybackTrack !== 'undefined' && currentPlaybackTrack) ? currentPlaybackTrack.title : null,
      historyLen: (typeof ListeningHistory !== 'undefined') ? ListeningHistory.getHistory().length : -1,
      bodyOverflow: document.body.style.overflow,
      viewport: window.innerWidth + 'x' + window.innerHeight
    })`,
    returnByValue: true
  });
  console.log('=== STATE ===');
  console.log(state.result.value);

  // Try clicking the FAB (need to wait for splash to be dismissed)
  const clickResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const fab = document.getElementById('lhFab');
      if (!fab) return 'NO FAB';
      let err = null;
      try { fab.click(); } catch (e) { err = String(e); }
      const panel = document.getElementById('lhPanel');
      return JSON.stringify({ clicked: true, err, panelActive: panel ? panel.classList.contains('active') : false, panelDisplay: panel ? getComputedStyle(panel).display : 'none', fabActive: fab.classList.contains('active') });
    })()`,
    returnByValue: true
  });
  console.log('=== FAB CLICK ===');
  console.log(clickResult.result.value);

  ws.close();
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });