// One command before every push (CK, Nov 16, 2026): checks everything, rebuilds the docs, and says exactly what to stage.
//   node tools/prepush.js            all checks + rebuild the guide, playbook (also js/sim-rates.js for admin), stats and search pages
//   node tools/prepush.js --no-docs  checks only (quicker, for a look mid-work)
// It never commits or pushes. Exit code 1 = something to fix (listed at the end).
const fs = require('fs'), path = require('path'), { execSync, spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const NO_DOCS = process.argv.includes('--no-docs');
const problems = [], notes = [];
const fail = m => { problems.push(m); console.log('  ✗ ' + m); }, ok = m => console.log('  ✓ ' + m);
const sh = c => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const head = t => console.log('\n' + t);

// Run a node script and capture its output (several at once: they don't share anything)
const run = (file, args = []) => new Promise(done => { const t0 = Date.now(), p = spawn(process.execPath, [file, ...args], { cwd: ROOT }); let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => done({ file, code, out, s: ((Date.now() - t0) / 1000).toFixed(0) })); });

(async () => {
  head('1. Syntax (node --check)');
  const jsFiles = ['sw.js', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
    ...fs.readdirSync(__dirname).filter(f => f.endsWith('.js')).map(f => 'tools/' + f)];
  let bad = 0; for (const f of jsFiles) { try { sh(`node --check "${f}"`); } catch (e) { bad++; fail(`${f}: ${String(e.stderr).split('\n').slice(0, 4).join(' ').trim()}`); } }
  if (!bad) ok(`${jsFiles.length} files`);

  head('2. Version');
  const cache = +(rd('sw.js').match(/const CACHE = 'squad-draft-v(\d+)'/) || [])[1];
  const log = require('./changelog')[0], upd = +(rd('js/updates.js').match(/LATEST_UPDATE\s*=\s*\{\s*version:\s*(\d+)/) || [])[1];
  let pushed = null; try { sh('git fetch -q origin main'); pushed = +(sh('git show origin/main:sw.js').match(/squad-draft-v(\d+)/) || [])[1]; } catch (e) { notes.push('Could not reach GitHub to compare with the live version.'); }
  const changed = (() => { try { return sh('git diff --name-only origin/main').split('\n').concat(sh('git ls-files --others --exclude-standard').split('\n')).filter(Boolean); } catch (e) { return []; } })();
  const gameChanged = changed.filter(f => !/^(tools|worker)\/|^README\.md$|^CLAUDE\.md$|^\.github\//.test(f) && f !== 'js/sim-rates.js');
  if (pushed && gameChanged.length && cache <= pushed) fail(`The game changed since the last push (v${pushed}) but CACHE in sw.js is still v${cache}: bump it, or phones keep the old game.`);
  else ok(`sw.js CACHE v${cache}${pushed ? ` (live: v${pushed})` : ''}`);
  if (log[0] !== cache) fail(`tools/changelog.js has no line for v${cache} (newest is v${log[0]}).`); else ok(`changelog line for v${cache}`);
  if (upd !== cache) fail(`js/updates.js LATEST_UPDATE is v${upd}, not v${cache}: replace it with this push's notes.`); else ok(`Latest Updates tile is v${cache}`);

  head('3. Offline list and publishing');
  const shell = (rd('sw.js').match(/const SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
  const scripts = [...rd('index.html').matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  const missing = scripts.filter(s => !shell.includes(`'${s}'`)); missing.length ? fail(`index.html loads ${missing.join(', ')} but sw.js SHELL doesn't list it (no offline copy).`) : ok(`every script in index.html is in SHELL`);
  const gone = [...shell.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './' && !fs.existsSync(path.join(ROOT, f))); gone.length ? fail(`SHELL lists files that don't exist: ${gone.join(', ')}`) : ok('every SHELL file exists');
  const jek = [...rd('_config.yml').matchAll(/^\s*-\s*(\S+)/gm)].map(m => m[1].replace(/\/$/, '')).sort();
  const rs = [...(fs.readdirSync(path.join(ROOT, '.github/workflows')).map(f => rd('.github/workflows/' + f)).join('\n')).matchAll(/--exclude=\/([^\s]+)/g)].map(m => m[1].replace(/\/$/, ''))
    .filter(x => !['_site', '.git', '.github', '.gitignore', '_config.yml'].includes(x)).sort();
  JSON.stringify(jek) === JSON.stringify(rs) ? ok(`both sites hide the same files (${jek.join(', ')})`) : fail(`_config.yml hides [${jek}] but the slayersquad.app workflow hides [${rs}]: change both together.`);
  if (fs.existsSync(path.join(ROOT, 'CNAME'))) fail('A CNAME file exists: delete it (it would move the old address and lose saves).');

  head('4. Game checks (screens, online, own-pace; a few minutes)');
  const checks = await Promise.all(['tools/check-screens.js', 'tools/check-online.js', 'tools/check-async.js'].map(f => run(f)));
  for (const c of checks) { const last = c.out.trim().split('\n').slice(-2).join(' / ');
    if (c.code) { fail(`${c.file} failed (${c.s} s): ${c.out.trim().split('\n').slice(-6).join('\n      ')}`); } else ok(`${c.file} (${c.s} s): ${last.slice(0, 140)}`); }

  if (!NO_DOCS) {
    head('5. Docs (guide, playbook + admin sim numbers, stats sheet, search pages)');
    for (const f of ['tools/make-guide.js', 'tools/make-playbook.js', 'tools/make-stats.js', 'tools/make-pages.js']) {
      const r = await run(f); if (r.code) fail(`${f} failed: ${r.out.trim().split('\n').slice(-4).join(' / ')}`);
      else { ok(`${f} (${r.s} s)`); const w = r.out.split('\n').filter(l => /warn|ahead/i.test(l)); w.forEach(l => fail(`${f}: ${l.trim()}`)); } }
  }

  head('6. What to stage');
  const status = sh('git status --porcelain').split('\n').filter(Boolean).map(l => [l.slice(0, 2), l.slice(3).replace(/^"|"$/g, '')]);
  const files = status.map(([, f]) => f).filter(f => f !== 'CLAUDE.md');
  if (!files.length) ok('nothing changed');
  else {
    const odd = files.filter(f => /^img\//.test(f) && /\s|[A-Z]/.test(path.basename(f).replace(/\.[^.]+$/, '')));
    odd.forEach(f => fail(`${f}: picture names are card ids in lower case (check it against the roster before it goes public).`));
    const imgs = files.filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f)); if (imgs.length) notes.push(`${imgs.length} picture(s) changed: look at each before pushing (the repo is public).`);
    const q = f => /[\s'"]/.test(f) ? `"${f}"` : f;
    console.log('  Changed:'); status.filter(([, f]) => f !== 'CLAUDE.md').forEach(([s, f]) => console.log(`    ${s.trim() || 'M'}  ${f}`));
    console.log(`\n  git add ${files.map(q).join(' ')}`);
  }

  console.log('\n' + (problems.length ? `✗ ${problems.length} thing(s) to fix before pushing:\n` + problems.map(p => '  - ' + p).join('\n') : '✓ Ready to push (to origin and slayersquad, then check the live CACHE).'));
  notes.forEach(n => console.log('  Note: ' + n));
  process.exitCode = problems.length ? 1 : 0;
})();
