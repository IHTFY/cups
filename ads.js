// The ad below the secret comes from the shared IHTFY loader, which ihtfy.com
// serves for all the games (its source is in the IHTFY/com.ihtfy repo).
// Nothing ad-related loads until the secret is opened: the loader arrives
// then, and AdSense after it at browser idle.
const LOADER = 'https://ihtfy.com/ads/v1.js';

let loader = null;

// Fills `box` with an ad for the game over named `key`; offline or on failure it stays empty.
export function showAd(box, key) {
  if (!navigator.onLine) return;
  loader ??= new Promise((resolve, reject) => {
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
  });
  // A box that left the page meanwhile would hold the key and block its replacement.
  loader.then(
    () => box.isConnected && window.ihtfyAds.show(box, key),
    () => {},
  );
}
