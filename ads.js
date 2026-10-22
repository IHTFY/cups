// The ad below the secret comes from the shared IHTFY loader, which ihtfy.com
// serves for all the games (its source is in the IHTFY/com.ihtfy repo).
// Nothing ad-related loads until the secret is opened: the loader arrives
// then, and AdSense after it at browser idle. A visitor who may have bought
// ad-free gets the loader at startup instead (loadForBuyer), so it can hide
// the ad box before the secret opens.
const LOADER = 'https://ihtfy.com/ads/v1.js';

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

// Loads the loader now if this browser holds an ad-free token; the loader checks it.
export function loadForBuyer() {
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
  if (found) load().catch(() => {});
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
