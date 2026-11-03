// Writes js/art-list.js: the picture files that exist, so the game doesn't guess filenames (that cost ~78 failed downloads per open).
// Run it after adding or removing any picture in img/, img/places/ or img/scenes/:  node tools/make-art-list.js
// check() is used by tools/check-screens.js to catch a list that's out of date.
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const PIC = /\.(jpe?g|png|webp)$/i;
const list = () => Object.fromEntries(['img', 'img/places', 'img/scenes'].map(d => [d.split('/').pop(), fs.readdirSync(path.join(ROOT, d)).filter(f => PIC.test(f)).sort()]));
const text = () => `// Made by tools/make-art-list.js: the picture files in img/, img/places/ and img/scenes/. Don't edit by hand.\nconst ART_FILES = ${JSON.stringify(list())};\n`;
const OUT = path.join(ROOT, 'js', 'art-list.js');
function check(){ return fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === text(); }
if (require.main === module) { fs.writeFileSync(OUT, text()); const l = list(); console.log(`Wrote js/art-list.js (${l.img.length} portraits, ${l.places.length} places, ${l.scenes.length} scenes)`); }
module.exports = { check };
