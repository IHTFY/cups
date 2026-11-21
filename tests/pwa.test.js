import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const path = (name) => new URL(`../${name}`, import.meta.url);
const read = (name) => readFileSync(path(name), 'utf8');
const html = read('index.html');

const manifest = () => JSON.parse(read('manifest.webmanifest'));
const pngSize = (name) => {
  const bytes = readFileSync(path(name));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
};

test('the page links the manifest, the touch icon, and registers the worker', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /<link rel="apple-touch-icon" href="apple-touch-icon\.png"/);
  assert.match(html, /serviceWorker\.register\('sw\.js'\)/);
});

test('the manifest installs as a standalone app on the site root', () => {
  const m = manifest();
  assert.equal(m.name, 'Cups');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.ok(m.theme_color && m.background_color);
});

test('the manifest icons exist at their declared sizes, with a maskable one', () => {
  const icons = manifest().icons;
  for (const size of ['192x192', '512x512']) {
    assert.ok(icons.some((i) => i.sizes === size && i.purpose === 'any'), `${size} icon`);
  }
  assert.ok(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'), 'maskable icon');
  for (const icon of icons) assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  assert.equal(pngSize('apple-touch-icon.png'), '180x180');
});

test('every precached file exists and the page files are in the list', () => {
  const list = read('sw.js').match(/const PRECACHE = \[([^\]]*)\]/)[1];
  const files = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const file of files) assert.ok(file === './' || existsSync(path(file)), file);
  for (const file of ['index.html', 'style.css', 'script.js', 'ads.js', 'cup.svg', 'manifest.webmanifest']) {
    assert.ok(files.includes(file), file);
  }
  for (const icon of manifest().icons) assert.ok(files.includes(icon.src), icon.src);
});

test('the worker stays on same-origin GETs, network first, with reloaded precache', () => {
  const sw = read('sw.js');
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /origin !== self\.location\.origin\) return/);
  assert.match(sw, /cache: 'reload'/);
  assert.match(sw, /fetch\(request\)[\s\S]*\.catch\(\(\) => caches\.match/);
  assert.match(sw, /caches\.delete/);
});
