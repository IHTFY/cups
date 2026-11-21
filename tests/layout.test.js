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

// Evaluates the CSS lengths the stage uses (px, rem, vw, var, clamp, min, max, calc) for a viewport width and a root font size.
const lengthAt = (expression, viewport, rem = 16) => {
  const resolved = expression.replace(/var\((--[\w-]+)\)/g, (_, name) => `(${css.match(new RegExp(`${name}:\\s*([^;]+);`))[1]})`);
  return Function(
    'clamp',
    'min',
    'max',
    `return ${resolved
      .replace(/(-?[\d.]+)vw/g, (_, n) => `(${n}*${viewport}/100)`)
      .replace(/(-?[\d.]+)rem/g, (_, n) => `(${n}*${rem})`)
      .replace(/(-?[\d.]+)px/g, '$1')
      .replace(/\bcalc/g, '')}`,
  )(
    (low, value, high) => Math.min(Math.max(low, value), high),
    Math.min,
    Math.max,
  );
};

// Each case is a viewport width and the browser's default font size, both in px.
const stageRow = (viewport, rem) => {
  const stage = css.match(/\n\.cups-stage\s*\{([^}]*)\}/)?.[1] ?? '';
  const size = stage.match(/--size:\s*([^;]+);/)?.[1];
  const gap = stage.match(/\n\s*gap:\s*([^;]+);/)?.[1];
  assert.ok(size && gap, 'the stage sets --size and gap');
  // The page keeps 1rem on each side; the card around the row adds its padding and a 1 px border on each.
  const room = viewport - 2 * rem - 2 * lengthAt('var(--card-pad)', viewport, rem) - 2;
  const row = 3 * lengthAt(size, viewport, rem) + 2 * lengthAt(gap, viewport, rem);
  return { room, row };
};

test('the three trick cups stay in one row on a 280 to 320 px screen', () => {
  for (const viewport of [280, 300, 320]) {
    const { room, row } = stageRow(viewport, 16);
    assert.ok(row <= room, `${viewport} px: the row is ${row.toFixed(1)} px of ${room.toFixed(1)} px`);
  }
});

test('the three trick cups stay in one row on a phone with a larger browser font', () => {
  for (const viewport of [360, 390, 412]) {
    for (const rem of [16, 20, 24]) {
      const { room, row } = stageRow(viewport, rem);
      assert.ok(row <= room, `${viewport} px at ${rem} px: the row is ${row.toFixed(1)} px of ${room.toFixed(1)} px`);
    }
  }
});

test('the rail needs a viewport tall enough for its 600 px ad, which ends 736 px down the page', () => {
  const adsSource = read('ads.js');
  const heights = [...adsSource.matchAll(/min-height: (\d+)px/g)].map((m) => Number(m[1]));
  const cssHeight = Number(css.match(/@media \(min-width: 1373px\) and \(min-height: (\d+)px\)/)?.[1]);
  assert.equal(heights.length, 2);
  for (const height of [...heights, cssHeight]) assert.ok(height >= 736, `${height} px is too short`);
  assert.deepEqual(new Set([...heights, cssHeight]).size, 1, 'ads.js and style.css use one height');
});
