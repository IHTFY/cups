import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Runs the real script.js in a fake page. Timers are real; reduced motion is on, so flips take no animation time, unless a test turns it off.
function stub(defaults = {}) {
  const target = { textContent: '', value: '', hidden: false, disabled: false, listeners: {}, dataset: {}, ...defaults };
  target.addEventListener = (type, fn) => (target.listeners[type] ??= []).push(fn);
  // Resolves when every click handler has finished, so a test waits for the work itself, not a guessed time.
  target.click = () => Promise.all((target.listeners.click || []).map((fn) => fn({ target: proxy })));
  const proxy = new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      if (typeof p === 'symbol') return undefined;
      if (p === 'content' || p === 'firstElementChild') return (t[p] = stub());
      return () => stub();
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  });
  return proxy;
}

// `stallNext(ms)` delays the next timer the page sets, as a stalled event loop would.
function loadPage({ reduceMotion = true } = {}) {
  let stall = 0;
  const els = new Map();
  const $ = (id) => {
    if (!els.has(id)) els.set(id, stub({ id }));
    return els.get(id);
  };
  $('cupSlider').value = '3';
  const context = vm.createContext({
    console, Math, Number, Array, Promise, String, Set, Map, Error,
    setTimeout: (fn, ms) => {
      const extra = stall;
      stall = 0;
      return setTimeout(fn, ms + extra);
    },
    matchMedia: () => ({ matches: reduceMotion, addEventListener() {} }),
    innerWidth: 400,
    scrollTo() {},
    addEventListener() {},
    document: {
      getElementById: $,
      querySelectorAll: () => [],
      createElement: () => stub(),
      addEventListener() {},
      body: stub(),
    },
  });
  const source = readFileSync(new URL('../script.js', import.meta.url), 'utf8').replace(
    "import('./ads.js')",
    'Promise.resolve({ loadForBuyer() {}, startRail: () => () => {}, placeScreenAd() {} })',
  );
  vm.runInContext(source, context, { filename: 'script.js' });
  return {
    $,
    run: (code) => vm.runInContext(code, context),
    stallNext: (ms) => {
      stall = ms;
    },
  };
}

test('Solve pressed right after a pair tap does not flip that pair back', async () => {
  const { $, run, stallNext } = loadPage();
  run('resetSandbox([UP, UP, DOWN])');
  const cup = (i) => run(`sandbox.cups[${i}]`);
  cup(0).click();
  stallNext(1000);
  cup(1).click();
  await $('solveButton').click();
  assert.equal(run('JSON.stringify(sandbox.states)'), JSON.stringify([0, 0, 0]));
  assert.equal(run('solving'), false);
});

test('Solve on a still sandbox pairs off the cups that are up', async () => {
  const { $, run } = loadPage();
  run('resetSandbox([UP, DOWN, UP, UP, UP])');
  await $('solveButton').click();
  assert.equal(run('JSON.stringify(sandbox.states)'), JSON.stringify([0, 0, 0, 0, 0]));
});

test('a pair tap whose animation fails does not lock Solve or the controls', async () => {
  const { $, run } = loadPage({ reduceMotion: false });
  run('resetSandbox([UP, UP, DOWN, UP, UP])');
  const cup = (i) => run(`sandbox.cups[${i}]`);
  run('sandbox.cups[0].firstElementChild').animate = () => {
    // Only the first animation fails; the next one succeeds.
    run('sandbox.cups[0].firstElementChild').animate = () => {};
    throw new Error('animation failed');
  };
  cup(0).click();
  // The failed flip rejects the tap handler; the page reports it and carries on.
  await assert.rejects(cup(1).click(), /animation failed/);
  assert.equal(run('sandbox.flipping'), false);

  run('resetSandbox([UP, UP, DOWN, UP, UP])');
  await $('solveButton').click();
  assert.equal(run('JSON.stringify(sandbox.states)'), JSON.stringify([0, 0, 0, 0, 0]));
  assert.equal(run('solving'), false);
  assert.equal($('cupSlider').disabled, false);
  assert.equal($('shuffleButton').disabled, false);
  assert.equal($('allUpButton').disabled, false);
  assert.equal(run('sandboxCups.inert'), false);
});
