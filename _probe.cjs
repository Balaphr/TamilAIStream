const fs = require('fs');
const path = require('path');
const cands = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
let found = null;
for (const c of cands) { try { if (fs.existsSync(c)) { found = c; break; } } catch (e) {} }
console.log('CHROME:', found || 'NOT FOUND in common paths');
const nm = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nm)) {
  const d = fs.readdirSync(nm);
  const hits = d.filter(n => /puppeteer|playwright|chrome-remote|chromium|chrome/.test(n));
  console.log('node_modules browser libs:', hits.length ? hits.join(', ') : 'none');
}
console.log('NODE:', process.version);
