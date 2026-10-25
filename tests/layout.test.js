import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('style.css');

// script.js fills these after the page paints. The blank cups in the HTML hold their
// space, wrapped the way the real ones wrap, so the cards below don't jump down.
const blankCups = (id) => {
  const match = html.match(new RegExp(`id="${id}">((?:<span class="cup" aria-hidden="true"></span>)*)</div>`));
  assert.ok(match, `#${id} holds only blank cups`);
  return match[1].split('</span>').length - 1;
};

test('the trick row starts with its three cups', () => {
  assert.equal(blankCups('trickCups'), 3);
});

test('the sandbox starts with as many cups as the slider does', () => {
  assert.equal(blankCups('sandboxCups'), Number(html.match(/id="cupSlider"[^>]*value="(\d+)"/)[1]));
});

test('the stats and verdict lines reserve a line each', () => {
  for (const selector of ['.stats', '.verdict']) {
    const rule = css.match(new RegExp(`\\n\\${selector}\\s*\\{([^}]*)\\}`));
    assert.match(rule?.[1] ?? '', /min-height:/, selector);
  }
});

test('the page holds no ad box until the script adds one', () => {
  assert.doesNotMatch(html, /data-ad-slot/);
  assert.doesNotMatch(html, /class="ad"/);
});

test('every link to a shared ihtfy.com page ends in a slash', () => {
  const links = [...html.matchAll(/href="(https:\/\/ihtfy\.com\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(links.sort(), [
    'https://ihtfy.com/privacy/',
    'https://ihtfy.com/privacy/',
    'https://ihtfy.com/support/',
  ]);
});
