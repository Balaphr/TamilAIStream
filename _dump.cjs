const fs = require('fs');
const f = process.argv[2];
const s = parseInt(process.argv[3] || '1', 10);
const e = parseInt(process.argv[4] || '99999', 10);
const a = fs.readFileSync(f, 'utf8').split('\n');
for (let i = s - 1; i < Math.min(e, a.length); i++) console.log((i + 1) + '|' + a[i]);
