import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import { beforeEach, test } from 'node:test';

// Script tags the module added, recorded instead of fetched.
let added;
let shown;
let online = true;

const storage = new Map();
let storageReadable = true;
globalThis.localStorage = {
  getItem: (k) => {
    if (!storageReadable) throw new Error('blocked');
    return storage.get(k) ?? null;
  },
};

Object.defineProperty(globalThis, 'navigator', { get: () => ({ onLine: online }) });

let now = 0;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });

// The screen's size, as the rail's media queries see it.
let screenSize = '300x600';
const queries = new Map();
globalThis.matchMedia = (query) => {
  if (!queries.has(query)) {
    const list = new EventTarget();
    Object.defineProperty(list, 'matches', {
      get: () => (query.includes('1653px') ? screenSize === '300x600' : screenSize !== null),
    });
    queries.set(query, list);
  }
  return queries.get(query);
};
const resize = (size) => {
  screenSize = size;
  for (const list of queries.values()) list.dispatchEvent(new Event('change'));
};

// The window's events: the rail waits for the player's first tap or key press.
const events = new EventTarget();
// Each fresh copy of the module adds its own listeners.
setMaxListeners(Infinity, events);
const press = () => events.dispatchEvent(new Event('keydown'));

// A minimal page: the module only creates script tags and adds them to `head`.
const body = new Set();
class FakeNode extends EventTarget {
  removed = false;
  style = {};
  dataset = {};
  children = [];
  parent = null;
  constructor(tag) {
    super();
    this.tag = tag;
  }
  get isConnected() {
    return body.has(this) || Boolean(this.parent?.isConnected);
  }
  append(...nodes) {
    for (const node of nodes) node.parent = this;
    this.children.push(...nodes);
  }
  after(node) {
    body.add(node);
  }
  remove() {
    this.removed = true;
    body.delete(this);
  }
}
Object.assign(globalThis, {
  window: globalThis,
  addEventListener: events.addEventListener.bind(events),
  document: {
    cookie: '',
    createElement: (tag) => new FakeNode(tag),
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
  storageReadable = true;
  document.cookie = '';
  now = 0;
  screenSize = '300x600';
  queries.clear();
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

test('loadForBuyer still finds the cookie when storage cannot be read', async () => {
  storageReadable = false;
  document.cookie = 'ihtfy-ad-free=token';
  const { loadForBuyer } = await loadAds();
  loadForBuyer();
  assert.equal(added.length, 1);
});

// The aside beside the trick, holding the boxes the rail adds.
const rail = () => {
  const el = { hidden: true, boxes: [] };
  el.append = (child) => {
    body.add(child);
    el.boxes.push(child);
  };
  return el;
};
const current = (el) => el.boxes.filter((b) => b.isConnected);

test('the rail gets a box of the screen size, and loads nothing before the first tap or key press', async () => {
  const { startRail, PLAY_AD_SLOT } = await loadAds();
  const el = rail();
  startRail(el);
  assert.equal(el.hidden, false);
  const [a] = current(el);
  assert.deepEqual(a.style, { width: '300px', height: '600px' });
  assert.deepEqual(a.dataset, { adSlot: PLAY_AD_SLOT, adSize: '300x600' });
  await tick();
  assert.equal(added.length, 0);
  press();
  await tick();
  assert.equal(added.length, 1);
  added[0].dispatchEvent(new Event('load'));
  await tick();
  assert.deepEqual(shown, [[a, 'play/1']]);
});

test('a buyer or a narrow screen gets no rail box', async () => {
  const { startRail } = await loadAds();
  screenSize = null;
  const narrow = rail();
  startRail(narrow);
  assert.equal(narrow.hidden, true);
  assert.equal(narrow.boxes.length, 0);

  screenSize = '300x600';
  storage.set('ihtfy-ad-free', 'token');
  const buyer = rail();
  startRail(buyer);
  assert.equal(buyer.hidden, true);
  assert.equal(buyer.boxes.length, 0);
});

test('a game started within a minute of the last request keeps its ad; a later one gets a new box and key', async () => {
  const { startRail } = await loadAds();
  const el = rail();
  const newGame = startRail(el);
  press();
  now = 5_000;
  await tick();
  added[0].dispatchEvent(new Event('load'));
  await tick();
  now = 64_999;
  newGame();
  assert.equal(el.boxes.length, 1);
  now = 65_000;
  newGame();
  await tick();
  assert.equal(el.boxes.length, 2);
  assert.deepEqual(current(el), [el.boxes[1]]);
  assert.deepEqual(
    shown.map(([, key]) => key),
    ['play/1', 'play/2'],
  );
});

test('a new size gets a new box and key at once, and a narrow screen hides the rail', async () => {
  const { startRail } = await loadAds();
  const el = rail();
  startRail(el);
  resize('160x600');
  assert.deepEqual(current(el)[0].style, { width: '160px', height: '600px' });
  resize(null);
  assert.equal(el.hidden, true);
  assert.equal(current(el).length, 0);
  resize('160x600');
  press();
  await tick();
  added[0].dispatchEvent(new Event('load'));
  await tick();
  // Only the box still on the page asks for an ad.
  assert.deepEqual(shown, [[current(el)[0], 'play/3']]);
});

test('only the secret gets a box; the trick, the sandbox, and anything else never do', async () => {
  const { showsAd } = await loadAds();
  assert.equal(showsAd('secret'), true);
  for (const screen of ['trick', 'sandbox', 'play', 'home', undefined]) {
    assert.equal(showsAd(screen), false, String(screen));
  }
});

// The page's compare table, which the secret's ad goes after, and a window that fits the given sizes.
const anchor = () => new FakeNode('dl');
const fitting =
  (...names) =>
  (box) =>
    names.includes(box.dataset.adSize);
const boxOf = (aside) => aside.children.find((child) => child.dataset.adSlot);

test('the secret gets one labeled box after the anchor, with the Privacy link under it', async () => {
  const { placeScreenAd, SCREEN_AD_SLOT } = await loadAds();
  const aside = placeScreenAd('secret', anchor(), fitting('300x250'));
  assert.equal(aside.isConnected, true);
  assert.deepEqual(
    aside.children.map((child) => child.tag),
    ['small', 'div', 'a'],
  );
  assert.equal(aside.children[0].textContent, 'Advertisements');
  assert.equal(aside.children[2].href, 'https://ihtfy.com/privacy/');
  const box = boxOf(aside);
  assert.deepEqual(box.dataset, { adSlot: SCREEN_AD_SLOT, adSize: '300x250' });
  assert.equal(SCREEN_AD_SLOT, '6470163205');
  assert.deepEqual(box.style, { width: '300px', height: '250px', minHeight: '250px', maxHeight: '250px' });
});

test('the box is the tallest size that fits: 300x250, then 320x100, then 320x50, which stays where nothing fits', async () => {
  const { placeScreenAd } = await loadAds();
  const sizeOf = (aside) => boxOf(aside).dataset.adSize;
  assert.equal(sizeOf(placeScreenAd('secret', anchor(), fitting('300x250', '320x100', '320x50'))), '300x250');
  now = 60_000;
  assert.equal(sizeOf(placeScreenAd('secret', anchor(), fitting('320x100', '320x50'))), '320x100');
  now = 120_000;
  assert.equal(sizeOf(placeScreenAd('secret', anchor(), fitting('320x50'))), '320x50');
  now = 180_000;
  const none = placeScreenAd('secret', anchor(), fitting());
  assert.equal(sizeOf(none), '320x50');
  assert.deepEqual(boxOf(none).style, { width: '320px', height: '50px', minHeight: '50px', maxHeight: '50px' });
});

test('boxes that did not fit leave the page unpainted, so only one box is ever there', async () => {
  const { placeScreenAd } = await loadAds();
  const sizes = [];
  const aside = placeScreenAd('secret', anchor(), (box) => {
    sizes.push(box.dataset.adSize);
    return box.dataset.adSize === '320x50';
  });
  assert.deepEqual(sizes, ['300x250', '320x100', '320x50']);
  assert.equal([...body].filter((node) => node.tag === 'aside').length, 1);
  assert.equal(aside.isConnected, true);
});

test('the play screens never get a box', async () => {
  const { placeScreenAd } = await loadAds();
  for (const screen of ['trick', 'sandbox', 'play']) {
    assert.equal(placeScreenAd(screen, anchor(), fitting('300x250')), undefined, screen);
  }
  assert.equal(body.size, 0);
});

test('a buyer gets no box and no reserved space, whether the token is in storage or only in the cookie', async () => {
  const { placeScreenAd } = await loadAds();
  storage.set('ihtfy-ad-free', 'token');
  assert.equal(placeScreenAd('secret', anchor(), fitting('300x250')), undefined);
  storage.clear();
  document.cookie = 'ihtfy-ad-free=token';
  assert.equal(placeScreenAd('secret', anchor(), fitting('300x250')), undefined);
  press();
  await tick();
  assert.equal(body.size, 0);
  assert.equal(added.length, 0);
});

test('the secret loads nothing before the first tap or key press, then asks for its ad once', async () => {
  const { placeScreenAd } = await loadAds();
  const aside = placeScreenAd('secret', anchor(), fitting('300x250'));
  await tick();
  assert.equal(added.length, 0);
  press();
  await tick();
  assert.equal(added.length, 1);
  added[0].dispatchEvent(new Event('load'));
  await tick();
  assert.deepEqual(shown, [[boxOf(aside), 'secret/1']]);
});

test('a secret closed before the first input asks for nothing', async () => {
  const { placeScreenAd } = await loadAds();
  placeScreenAd('secret', anchor(), fitting('300x250')).remove();
  press();
  await tick();
  assert.equal(added.length, 0);
});

test('reopening the secret makes a new box and key, but not within a minute of the last ask', async () => {
  const { placeScreenAd } = await loadAds();
  press();
  const first = placeScreenAd('secret', anchor(), fitting('300x250'));
  await tick();
  added[0].dispatchEvent(new Event('load'));
  await tick();
  first.remove();
  now = 59_999;
  assert.equal(placeScreenAd('secret', anchor(), fitting('300x250')), undefined);
  now = 60_000;
  const second = placeScreenAd('secret', anchor(), fitting('300x250'));
  await tick();
  assert.notEqual(second, first);
  assert.deepEqual(
    shown.map(([, key]) => key),
    ['secret/1', 'secret/2'],
  );
});
