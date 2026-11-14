const fs = require('fs');
const p = 'builder.js';
let s = fs.readFileSync(p, 'utf8');
const re = /\n[ \t]*updatedAt: new Date\(\)\.toISOString\(\),/;
const had = re.test(s);
s = s.replace(re, '\n        updatedAt: new Date().toISOString(),');
fs.writeFileSync(p, s);
console.log('found-and-fixed:', had);
