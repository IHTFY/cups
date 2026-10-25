// The ads in the secret and beside the trick come from the shared IHTFY
// loader, which ihtfy.com serves for all the games (its source is in the
// IHTFY/com.ihtfy repo). Nothing ad-related loads until the player's first tap
// or key press: the loader arrives then, and AdSense after it at browser idle.
// A visitor who may have bought ad-free gets no box at all, and the loader at
// startup instead (loadForBuyer), so it can check and renew the token.
const LOADER = 'https://ihtfy.com/ads/v1.js';

// The shared 300×250 display unit for the games' result screens.
export const SCREEN_AD_SLOT = '6470163205';

// The sizes of the secret's box, tallest first. 320×50 is the last resort and
// stays where nothing fits.
export const AD_SIZES = [
  { name: '300x250', width: 300, height: 250 },
  { name: '320x100', width: 320, height: 100 },
  { name: '320x50', width: 320, height: 50 },
];

// The screens where nobody is playing and the ad may go: the secret, once the
// trick is over. The trick and the sandbox are play and never get one.
export const showsAd = (screen) => screen === 'secret';

// The games-play unit: 300×600 in AdSense; the 160×600 box uses it too.
export const PLAY_AD_SLOT = '7239875855';

// The size of the ad beside the trick, by screen, first match wins; style.css
// widens the page from the smallest. The page's 704 px column stays centered,
// so each needs, on both sides of it, 150 px to the ad, the ad, and the body's
// 16 px padding, plus 17 px for a scrollbar: 704 + 2 × (166 + width) + 17.
export const PLAY_AD_SIZES = [
  { query: '(min-width: 1653px) and (min-height: 700px)', size: '300x600' },
  { query: '(min-width: 1373px) and (min-height: 700px)', size: '160x600' },
];

let loader = null;

const load = () =>
  (loader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = LOADER;
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => {
      script.remove();
      loader = null;
      reject(new Error('The ad loader did not load'));
    });
    document.head.appendChild(script);
  }));

// Whether this browser holds an ad-free token, unchecked; the loader checks it.
function mayBeAdFree() {
  let found = false;
  try {
    found = Boolean(localStorage.getItem('ihtfy-ad-free'));
  } catch {
    // Storage off: the cookie may still hold the token.
  }
  try {
    found ||= /(?:^|;\s*)ihtfy-ad-free=/.test(document.cookie);
  } catch {
    // Cookies off too: there is no token to find.
  }
  return found;
}

// Loads the loader now if this browser holds an ad-free token, so it can hide the ad box.
export function loadForBuyer() {
  if (mayBeAdFree()) load().catch(() => {});
}

// Fills `box` with an ad for the game over named `key`; offline or on failure it stays empty.
export function showAd(box, key) {
  if (!navigator.onLine) return;
  // A box that left the page meanwhile would hold the key and block its replacement.
  load().then(
    () => box.isConnected && window.ihtfyAds.show(box, key),
    () => {},
  );
}

// The player's first tap or key press. The ads wait for it, so nothing
// ad-related loads with the page.
const firstInput = new Promise((resolve) => {
  for (const type of ['pointerdown', 'keydown']) {
    addEventListener(type, resolve, { once: true, capture: true });
  }
});

// Builds the box's aside: the label, a box of `size` that keeps its size
// whether or not an ad fills it, and the Privacy link at least 50px below it.
function buildAd(size) {
  const aside = document.createElement('aside');
  aside.className = 'ad';
  const label = document.createElement('small');
  label.textContent = 'Advertisements';
  const box = document.createElement('div');
  box.className = 'ad-box';
  box.style.width = `${size.width}px`;
  box.style.height = `${size.height}px`;
  box.style.minHeight = `${size.height}px`;
  box.style.maxHeight = `${size.height}px`;
  box.dataset.adSlot = SCREEN_AD_SLOT;
  box.dataset.adSize = size.name;
  const privacy = document.createElement('a');
  privacy.href = 'https://ihtfy.com/privacy/';
  privacy.target = '_blank';
  privacy.rel = 'noopener';
  privacy.textContent = 'Privacy';
  aside.append(label, box, privacy);
  return { aside, box };
}

// One request a minute at most: a player can open and close the secret in seconds.
const SCREEN_AD_INTERVAL = 60_000;
let screenAds = 0;
let screenAdAt = -Infinity;

// Puts the ad for `screen` after `anchor`, in a new box for each call: the
// tallest size `fits` accepts, else the smallest. Boxes `fits` rejects leave
// before anything is painted or requested. Returns the aside to remove when
// the screen goes, or nothing where the screen gets no ad: play, a visitor who
// may have bought ad-free, or a second ask within a minute.
export function placeScreenAd(screen, anchor, fits) {
  if (!showsAd(screen) || mayBeAdFree()) return;
  if (performance.now() - screenAdAt < SCREEN_AD_INTERVAL) return;

  let placed;
  for (const size of AD_SIZES) {
    placed?.aside.remove();
    placed = buildAd(size);
    anchor.after(placed.aside);
    if (fits(placed.box)) break;
  }
  const { aside, box } = placed;
  screenAdAt = performance.now();
  screenAds += 1;
  const key = `${screen}/${screenAds}`;
  firstInput.then(() => box.isConnected && showAd(box, key));
  return aside;
}

// The ad beside the trick changes when the player starts a game, but at most
// once a minute, since a game takes seconds. Its keys start with `play/`, apart
// from the secret's.
let plays = 0;
let requestedAt = -Infinity;

// Shows the ad beside the trick in `rail` while the screen fits one, in a new
// box for each new key. Returns what to call when the player starts a game.
export function startRail(rail) {
  if (mayBeAdFree()) return () => {};
  const queries = PLAY_AD_SIZES.map((p) => matchMedia(p.query));
  let size;
  let box;

  const update = (newGame) => {
    const next = PLAY_AD_SIZES.find((_, i) => queries[i].matches)?.size;
    const due = newGame && performance.now() - requestedAt >= 60_000;
    if (next === size && !due) return;
    size = next;
    box?.remove();
    box = undefined;
    rail.hidden = !size;
    if (!size) return;

    plays += 1;
    const key = `play/${plays}`;
    const [width, height] = size.split('x');
    box = document.createElement('div');
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.dataset.adSlot = PLAY_AD_SLOT;
    box.dataset.adSize = size;
    rail.append(box);
    const shown = box;
    firstInput.then(() => {
      if (!shown.isConnected) return;
      requestedAt = performance.now();
      showAd(shown, key);
    });
  };

  for (const query of queries) query.addEventListener('change', () => update(false));
  update(false);
  return () => update(true);
}
