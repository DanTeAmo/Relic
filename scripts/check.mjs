// Pre-deploy check for Relict. Runs as Vercel's build command: if it fails,
// the deployment fails and the live site keeps the last good version.
//   1. no leftover merge-conflict markers in tracked text files
//   2. the inline <script> in index.html parses
//   3. every photo referenced in PHOTOS exists in img/
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const errors = [];
const html = readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');

for (const file of ['index.html', 'README.md', 'img/photos.json']) {
  if (!existsSync(file)) continue;
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (/^(<<<<<<<|>>>>>>>)( |$)/.test(line) || /^=======$/.test(line)) errors.push(`${file}:${i + 1}: merge-conflict marker`);
  });
}

const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) errors.push('index.html: inline <script> not found');
else {
  const tmp = join(mkdtempSync(join(tmpdir(), 'relict-')), 'app.js');
  writeFileSync(tmp, m[1]);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { errors.push('index.html <script>: ' + String(e.stderr || e.message).split('\n').slice(0, 6).join('\n')); }
}

const pm = html.match(/const PHOTOS = (\{.*?\});\n/);
if (pm) {
  const photos = JSON.parse(pm[1]);
  for (const [id, list] of Object.entries(photos))
    list.forEach((_, n) => ['lg', 'sm'].forEach(sz => {
      const f = `img/${id}/${n + 1}-${sz}.jpg`;
      if (!existsSync(f)) errors.push(`missing photo: ${f}`);
    }));
} else errors.push('index.html: PHOTOS data not found');

if (errors.length) { console.error('Relict check FAILED:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Relict check passed: no conflict markers, script parses, all photos present.');
