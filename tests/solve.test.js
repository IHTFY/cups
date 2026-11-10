import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Runs the real script.js in a fake page. Timers are real; reduced motion is on so flips take no animation time.
function stub(defaults = {}) {
  const target = { textContent: '', value: '', hidden: false, disabled: false, listeners: {}, dataset: {}, ...defaults };
  target.addEventListener = (type, fn) => (target.listeners[type] ??= []).push(fn);
  target.click = () => (target.listeners.click || []).forEach((fn) => fn({ target: proxy }));
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

function loadPage() {
  const els = new Map();
  const $ = (id) => {
    if (!els.has(id)) els.set(id, stub({ id }));
    return els.get(id);
  };
  $('cupSlider').value = '3';
  const context = vm.createContext({
    console, Math, Number, Array, Promise, String, Set, Map, Error, setTimeout,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
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
  return { $, run: (code) => vm.runInContext(code, context) };
}

test('Solve pressed right after a pair tap does not flip that pair back', async () => {
  const { $, run } = loadPage();
  run('resetSandbox([UP, UP, DOWN])');
  const cup = (i) => run(`sandbox.cups[${i}]`);
  cup(0).click();
  cup(1).click();
  $('solveButton').click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(run('JSON.stringify(sandbox.states)'), JSON.stringify([0, 0, 0]));
  assert.equal(run('solving'), false);
});

test('Solve on a still sandbox pairs off the cups that are up', async () => {
  const { $, run } = loadPage();
  run('resetSandbox([UP, DOWN, UP, UP, UP])');
  $('solveButton').click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(run('JSON.stringify(sandbox.states)'), JSON.stringify([0, 0, 0, 0, 0]));
});
