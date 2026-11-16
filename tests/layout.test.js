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
    'https://ihtfy.com/projects/',
  ]);
});

// Evaluates the width-based CSS lengths the stage uses (px, rem, vw, clamp, min, max, calc).
const lengthAt = (expression, viewport) =>
  Function(
    'clamp',
    'min',
    'max',
    `return ${expression
      .replace(/(-?[\d.]+)vw/g, (_, n) => `(${n}*${viewport}/100)`)
      .replace(/(-?[\d.]+)rem/g, (_, n) => `(${n}*16)`)
      .replace(/(-?[\d.]+)px/g, '$1')
      .replace(/\bcalc/g, '')}`,
  )(
    (low, value, high) => Math.min(Math.max(low, value), high),
    Math.min,
    Math.max,
  );

test('the three trick cups stay in one row on a 280 to 320 px screen', () => {
  const stage = css.match(/\n\.cups-stage\s*\{([^}]*)\}/)?.[1] ?? '';
  const size = stage.match(/--size:\s*([^;]+);/)?.[1];
  const gap = stage.match(/\n\s*gap:\s*([^;]+);/)?.[1];
  assert.ok(size && gap, 'the stage sets --size and gap');
  for (const viewport of [280, 300, 320]) {
    // The page keeps 1rem on each side; the card around the row adds 1rem of padding and a 1 px border on each.
    const room = viewport - 4 * 16 - 2;
    const row = 3 * lengthAt(size, viewport) + 2 * lengthAt(gap, viewport);
    assert.ok(row <= room, `${viewport} px: the row is ${row.toFixed(1)} px of ${room} px`);
  }
});
