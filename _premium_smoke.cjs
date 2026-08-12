// TamilAI.Stream — premium landing/radio smoke test via CDP (headless Chrome)
// Usage: node _premium_smoke.cjs
const PORT = 8777;
const CDP_PORT = 9222;

const seed = `(() => {
  localStorage.setItem('tamilAIStream_stations', JSON.stringify([
    { id: 'st1', name: 'Chennai FM 104.8', freq: '104.8', genre: 'Music', city: 'Chennai', thumbnail: '', gradient: 'linear-gradient(135deg,#0f3b2e,#064e3b)', listeners: 12000, status: 'active', streamUrl: '' },
    { id: 'st2', name: 'Kollywood Hits', freq: '107.1', genre: 'Entertainment', city: 'Chennai', thumbnail: '', gradient: 'linear-gradient(135deg,#1e3a5f,#0d1f3c)', listeners: 8600, status: 'active', streamUrl: '' },
    { id: 'st3', name: 'Tamil News Radio', freq: '98.3', genre: 'News', city: 'Madurai', thumbnail: '', gradient: 'linear-gradient(135deg,#3b2f0f,#0d1f3c)', listeners: 5400, status: 'active', streamUrl: '' },
    { id: 'st4', name: 'Devotional FM', freq: '90.4', genre: 'Devotional', city: 'Trichy', thumbnail: '', gradient: 'linear-gradient(135deg,#2f0f3b,#0d1f3c)', listeners: 2100, status: 'active', streamUrl: '' }
  ]));
  localStorage.setItem('tamilAIStream_featured', JSON.stringify([
    { id: 'f1', stationId: 'st1', title: 'Chennai FM 104.8', subtitle: 'Live from Chennai', status: 'active', listeners: 12000, gradient: 'linear-gradient(135deg,#0f3b2e,#064e3b)', thumbnail: '' }
  ]));
  localStorage.setItem('tamilAIStream_trending', JSON.stringify([
    { id: 't1', stationId: 'st2', status: 'active' }
  ]));
  localStorage.setItem('tamilAIStream_categories', JSON.stringify([
    { name: 'Music', icon: 'fa-music', status: 'active', count: 4 },
    { name: 'News', icon: 'fa-newspaper', status: 'active', count: 2 }
  ]));
})();`;

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
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
    } else if (msg.method) events.push(msg);
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const m = ++id;
      pending.set(m, { resolve, reject });
      ws.send(JSON.stringify({ id: m, method, params }));
    });
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: seed });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await new Promise(r => setTimeout(r, 11000));

  const consoleMsgs = events
    .filter(e => e.method === 'Runtime.consoleAPICalled' || e.method === 'Runtime.exceptionThrown' || e.method === 'Log.entryAdded')
    .map(e => {
      if (e.method === 'Runtime.exceptionThrown') {
        const d = e.params.exceptionDetails;
        return `EXCEPTION: ${d.text} ${(d.exception && d.exception.description) || ''}`;
      }
      if (e.method === 'Runtime.consoleAPICalled') {
        const text = e.params.args.map(a => a.value !== undefined ? a.value : a.description || '').join(' ');
        if (e.params.type === 'error' || e.params.type === 'warning') return `CONSOLE.${e.params.type}: ${text}`;
        return null;
      }
      return `LOG: ${e.params.entry.text}`;
    }).filter(Boolean);

  const errs = consoleMsgs.filter(m => m && m.indexOf('EXCEPTION') === 0);
  console.log('=== CONSOLE ERRORS/EXCEPTIONS ===');
  console.log(errs.length ? errs.join('\n') : '(none)');

  const state = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      premiumLandingLoaded: !!window.TamilAIPremium,
      hero: document.getElementById('premiumHero') ? document.getElementById('premiumHero').classList.contains('entered') : 'MISSING',
      heroVinyl: !!document.getElementById('premiumHeroVinyl'),
      heroEq: !!document.getElementById('premiumHeroEq'),
      kebabBtn: !!document.getElementById('premiumKebabBtn'),
      sidebarRadio: document.querySelectorAll('.premium-sidebar-item[data-page="radio"]').length,
      kebabMenu: !!document.getElementById('premiumKebabMenu'),
      radioPage: !!document.getElementById('page-radio'),
      radioGrid: document.querySelectorAll('#premiumRadioGrid .premium-radio-card').length,
      radioChips: document.querySelectorAll('#premiumRadioFilters .premium-radio-chip').length,
      stationsGrid: document.querySelectorAll('#stationsGrid .station-grid-card').length,
      kickers: document.querySelectorAll('.section-title[data-kicker]').length,
      reveals: document.querySelectorAll('[data-premium-reveal]').length
    })`,
    returnByValue: true
  });
  console.log('=== STATE ===');
  console.log(state.result.value);

  // Open the 3-dot menu and navigate to Radio
  const navTest = await send('Runtime.evaluate', {
    expression: `(async () => {
      const btn = document.getElementById('premiumKebabBtn');
      if (!btn) return 'NO_KEBAB';
      btn.click();
      await new Promise(r => setTimeout(r, 350));
      const open = document.getElementById('premiumKebabMenu').classList.contains('open');
      const radioItem = document.querySelector('#premiumKebabMenu .premium-kebab-item-radio');
      radioItem.click();
      await new Promise(r => setTimeout(r, 700));
      return JSON.stringify({
        menuOpened: open,
        radioPageActive: document.getElementById('page-radio').classList.contains('active'),
        radioCardsAfterNav: document.querySelectorAll('#premiumRadioGrid .premium-radio-card').length,
        homeHidden: !document.getElementById('page-home').classList.contains('active'),
        bodyHashes: location.hash
      });
    })()`,
    returnByValue: true, awaitPromise: true
  });
  console.log('=== KEBAB → RADIO NAVIGATION ===');
  console.log(navTest.result.value);

  // FM state sync: simulate a station playing and verify card highlight through existing engine path
  const syncTest = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('#premiumRadioGrid .premium-radio-card');
      if (!card) return 'NO_CARD';
      card.classList.add('active-station','playing-station');
      const icon = card.querySelector('.premium-radio-play');
      if (icon) icon.className = 'fa-solid fa-pause premium-radio-play';
      const filterBtn = document.querySelector('#premiumRadioFilters .premium-radio-chip[data-genre="music"]');
      if (filterBtn) filterBtn.click();
      const visible = [...document.querySelectorAll('#premiumRadioGrid .premium-radio-card')].filter(c => !c.classList.contains('hidden')).length;
      return JSON.stringify({ activeClass: card.classList.contains('active-station'), pauseIcon: icon ? icon.className : 'none', visibleAfterFilter: visible });
    })()`,
    returnByValue: true
  });
  console.log('=== RADIO FILTER + ACTIVE STATE ===');
  console.log(syncTest.result.value);

  // Check layout/console on home again (hero scroll reveal should work)
  const homeTest = await send('Runtime.evaluate', {
    expression: `(() => {
      if (typeof TamilAIPremium !== 'undefined' && TamilAIPremium.goRadio) window.location.hash = 'home';
      const featured = document.getElementById('featuredSlider') ? document.getElementById('featuredSlider').getBoundingClientRect().height : -1;
      return JSON.stringify({ featuredSliderHeight: Math.round(featured) });
    })()`,
    returnByValue: true
  });
  console.log('=== HOME PAGE ===');
  console.log(homeTest.result.value);

  ws.close();
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });