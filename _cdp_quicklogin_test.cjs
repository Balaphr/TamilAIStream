// Reproduce: builder.html Quick Login as Admin issue
// Usage: node _cdp_quicklogin_test.cjs
async function main() {
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
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  function send(m, p = {}) {
    return new Promise((resolve, reject) => {
      const mid = ++id; pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method: m, params: p }));
    });
  }
  async function nav(url, wait) {
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, wait));
  }
  async function evalJS(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result ? r.result.value : ('ERR:' + JSON.stringify(r.exceptionDetails));
  }
  async function fresh(url, wait) {
    await nav(url, 800);
    await send('Runtime.evaluate', { expression: `localStorage.clear(); sessionStorage.clear();` });
    await nav(url, wait);
  }
  await send('Runtime.enable');
  await send('Page.enable');

  // ============ FLOW 1: builder.html → Quick Login as Admin (no session) ============
  await fresh('http://localhost:8777/builder.html', 1800);
  console.log('=== FLOW 1: builder.html quick login (fresh) ===');
  console.log(await evalJS(`JSON.stringify({
    login: getComputedStyle(document.getElementById('loginScreen')).display,
    dash: getComputedStyle(document.getElementById('builderDashboard')).display,
    quickLoginFn: typeof window.quickAdminLogin
  })`));
  await evalJS(`document.getElementById('builderQuickLogin').click()`);
  await new Promise(r => setTimeout(r, 1000));
  console.log('after click:', await evalJS(`JSON.stringify({
    login: getComputedStyle(document.getElementById('loginScreen')).display,
    dash: getComputedStyle(document.getElementById('builderDashboard')).display,
    adminSession: !!localStorage.getItem('adminSession'),
    loggedIn: localStorage.getItem('tamilAIStream_loggedIn')
  })`));

  // ============ FLOW 2: login.html → Quick Login as Admin → ?auto=1 (direct to dashboard) ============
  await fresh('http://localhost:8777/login.html', 1800);
  console.log('=== FLOW 2: login.html demo login → builder auto ===');
  await evalJS(`document.getElementById('demoLoginBtn').click()`);
  await new Promise(r => setTimeout(r, 2400));
  console.log('after demo login:', await evalJS(`JSON.stringify({
    url: location.href,
    login: document.getElementById('loginScreen') ? getComputedStyle(document.getElementById('loginScreen')).display : 'MISSING',
    dash: document.getElementById('builderDashboard') ? getComputedStyle(document.getElementById('builderDashboard')).display : 'MISSING',
    gate: document.getElementById('builderAccessGate') ? getComputedStyle(document.getElementById('builderAccessGate')).display : 'MISSING',
    adminSession: !!localStorage.getItem('adminSession')
  })`));

  // ============ FLOW 3: existing admin session → builder.html opens dashboard directly ============
  await fresh('http://localhost:8777/builder.html', 1800);
  await evalJS(`localStorage.setItem('adminSession', JSON.stringify({ username: 'admin@tamilaistream.com', email: 'admin@tamilaistream.com', displayName: 'Admin', role: 'admin', loginTime: Date.now(), expiry: Date.now() + 86400000 }))`);
  await nav('http://localhost:8777/builder.html', 1800);
  console.log('=== FLOW 3: existing session → builder ===');
  console.log('on builder load:', await evalJS(`JSON.stringify({
    login: getComputedStyle(document.getElementById('loginScreen')).display,
    gate: getComputedStyle(document.getElementById('builderAccessGate')).display,
    dash: getComputedStyle(document.getElementById('builderDashboard')).display
  })`));

  // ============ FLOW 4: Builder visibility on website (index.html) ============
  await fresh('http://localhost:8777/index.html', 2000);
  console.log('=== FLOW 4: Builder visibility (guest/no session) ===');
  console.log('no session:', await evalJS(`JSON.stringify({
    desktopBuilder: document.getElementById('premiumNavBuilder') ? getComputedStyle(document.getElementById('premiumNavBuilder')).display : 'MISSING',
    mobileBuilder: document.getElementById('premiumMobileNavBuilder') ? getComputedStyle(document.getElementById('premiumMobileNavBuilder')).display : 'MISSING',
    legacyBuilder: document.getElementById('builderNavLink') ? getComputedStyle(document.getElementById('builderNavLink')).display : 'MISSING'
  })`));

  // Log in as admin (simulate admin session)
  await evalJS(`localStorage.setItem('tamilAIStream_loggedIn', 'true');
    localStorage.setItem('tamilAIStream_user', JSON.stringify({ uid: 'admin-local', name: 'Admin', email: 'admin@tamilaistream.com', expiry: Date.now() + 86400000 }));
    localStorage.setItem('adminSession', JSON.stringify({ username: 'admin@tamilaistream.com', email: 'admin@tamilaistream.com', displayName: 'Admin', role: 'admin', loginTime: Date.now(), expiry: Date.now() + 86400000 }));`);
  await nav('http://localhost:8777/index.html', 2000);
  console.log('as admin:', await evalJS(`JSON.stringify({
    desktopBuilder: document.getElementById('premiumNavBuilder') ? getComputedStyle(document.getElementById('premiumNavBuilder')).display : 'MISSING',
    mobileBuilder: document.getElementById('premiumMobileNavBuilder') ? getComputedStyle(document.getElementById('premiumMobileNavBuilder')).display : 'MISSING',
    legacyBuilder: document.getElementById('builderNavLink') ? getComputedStyle(document.getElementById('builderNavLink')).display : 'MISSING'
  })`));

  // Non-admin regular user
  await evalJS(`localStorage.setItem('tamilAIStream_loggedIn', 'true');
    localStorage.setItem('tamilAIStream_user', JSON.stringify({ uid: 'u1', name: 'User', email: 'user@example.com', expiry: Date.now() + 86400000 }));
    localStorage.removeItem('adminSession');`);
  await nav('http://localhost:8777/index.html', 2000);
  console.log('as regular user:', await evalJS(`JSON.stringify({
    desktopBuilder: document.getElementById('premiumNavBuilder') ? getComputedStyle(document.getElementById('premiumNavBuilder')).display : 'MISSING',
    mobileBuilder: document.getElementById('premiumMobileNavBuilder') ? getComputedStyle(document.getElementById('premiumMobileNavBuilder')).display : 'MISSING',
    legacyBuilder: document.getElementById('builderNavLink') ? getComputedStyle(document.getElementById('builderNavLink')).display : 'MISSING'
  })`));

  // ============ Console exceptions (JS errors) ============
  const errs = events
    .filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => {
      const d = e.params.exceptionDetails;
      return `EXCEPTION: ${d.text} ${(d.exception && d.exception.description) || ''}`;
    });
  console.log('=== JS EXCEPTIONS ACROSS ALL FLOWS ===');
  if (errs.length === 0) console.log('(none)');
  else errs.slice(-20).forEach(m => console.log(m));

  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
