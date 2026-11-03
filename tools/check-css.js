// The stylesheet must have balanced braces: one unclosed block swallows every rule after it (it happened, Nov 3, 2026).
const fs = require('fs'), s = fs.readFileSync(require('path').join(__dirname, '..', 'css', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
let d = 0, line = 1, bad = 0;
for (const ch of s) { if (ch === '\n') line++; if (ch === '{') d++; if (ch === '}') { d--; if (d < 0 && !bad) bad = line; } }
// these were defined twice before the check existed and look right as they are; anything new must have its own name
const OLD_DUPS = ['rise','pulse','stamp','healglow','finalflash','barin'];
const names = [...s.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]), dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))].filter(n => !OLD_DUPS.includes(n));
if (dup.length) { console.log('style.css has @keyframes names defined twice (the last one wins everywhere): ' + dup.join(', ')); process.exitCode = 1; }
if (d !== 0 || bad) { console.log(`style.css braces are unbalanced (depth ${d}${bad ? ', extra } at line ' + bad : ''})`); process.exitCode = 1; } else console.log('style.css braces balanced.');
