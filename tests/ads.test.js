import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// Script tags the module added, recorded instead of fetched.
let added;
let shown;
let online = true;

const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null };

Object.defineProperty(globalThis, 'navigator', { get: () => ({ onLine: online }) });

// A minimal page: the module only creates script tags and adds them to `head`.
const body = new Set();
class FakeNode extends EventTarget {
  removed = false;
  get isConnected() {
    return body.has(this);
  }
  remove() {
    this.removed = true;
    body.delete(this);
  }
}
Object.assign(globalThis, {
  window: globalThis,
  document: {
    cookie: '',
    createElement: () => new FakeNode(),
    head: { appendChild: (el) => added.push(el) },
  },
});

const tick = () => new Promise((resolve) => setTimeout(resolve));
let fresh = 0;
// A new copy of the module, so each test starts with no loader.
const loadAds = () => import(`../ads.js?${fresh++}`);
// An ad box attached to the page.
const box = () => {
  const el = new FakeNode();
  body.add(el);
  return el;
};

beforeEach(() => {
  added = [];
  body.clear();
  shown = [];
  online = true;
  storage.clear();
  document.cookie = '';
  Object.assign(globalThis, {
    ihtfyAds: { show: (...args) => shown.push(args) },
  });
});

test('the loader is added once, then gets each box', async () => {
  const { showAd } = await loadAds();
  const a = box();
  showAd(a, 'a');
  showAd(a, 'b');
  assert.equal(added.length, 1);
  assert.equal(added[0].src, 'https://ihtfy.com/ads/v1.js');
  added[0].dispatchEvent(new Event('load'));
  await tick();
  assert.deepEqual(shown, [
    [a, 'a'],
    [a, 'b'],
  ]);
});

test('nothing loads offline', async () => {
  online = false;
  const { showAd } = await loadAds();
  showAd(box(), 'a');
  assert.equal(added.length, 0);
});

test('a failed load stays quiet, and the next opening tries again', async () => {
  const { showAd } = await loadAds();
  showAd(box(), 'a');
  added[0].dispatchEvent(new Event('error'));
  await tick();
  assert.equal(shown.length, 0);
  assert.equal(added[0].removed, true);
  showAd(box(), 'b');
  assert.equal(added.length, 2);
});

test('a box removed before the loader arrives gets no ad, so its replacement can', async () => {
  const { showAd } = await loadAds();
  const a = box();
  const b = box();
  showAd(a, 'same');
  a.remove();
  showAd(b, 'same');
  added[0].dispatchEvent(new Event('load'));
  await tick();
  assert.deepEqual(shown, [[b, 'same']]);
});

test('loadForBuyer loads nothing for a visitor without an ad-free token', async () => {
  const { loadForBuyer } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 0);
});

test('loadForBuyer loads the loader at startup when localStorage holds a token', async () => {
  storage.set('ihtfy-ad-free', 'token');
  const { loadForBuyer, showAd } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 1);
  assert.equal(added[0].src, 'https://ihtfy.com/ads/v1.js');
  showAd(box(), 'a');
  assert.equal(added.length, 1);
});

test('loadForBuyer loads the loader at startup when only the cookie holds a token', async () => {
  document.cookie = 'a=b; ihtfy-ad-free=token';
  const { loadForBuyer } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 1);
});
