// A cup is 1 when its mouth faces up and 0 when it faces down, so the XOR of a
// row is the parity of its mouth-up cups.
const UP = 1;
const DOWN = 0;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FLIP_MS = reduceMotion ? 0 : 500;
const cupTemplate = document.getElementById('cupTemplate');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const countUp = (states) => states.filter((s) => s === UP).length;

// A row of cups. Interactive rows flip a pair of cups once two have been tapped.
class CupRow {
  constructor(container, { interactive = true, onMove } = {}) {
    this.container = container;
    this.interactive = interactive;
    this.onMove = onMove;
    this.states = [];
    this.cups = [];
    this.selected = null;
    this.flipping = false;
    // Bumped by set(), so a flip that started before it doesn't count as a move.
    this.generation = 0;

    if (interactive) {
      container.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.clearSelection();
      });
    }
  }

  // Shows `states`, adding or removing cups to match its length. Cups whose
  // facing changes turn over.
  set(states) {
    this.selected = null;
    this.generation += 1;
    while (this.cups.length < states.length) this.cups.push(this.createCup(this.cups.length));
    while (this.cups.length > states.length) this.cups.pop().remove();
    this.states = [...states];
    this.cups.forEach((_, i) => this.render(i));
  }

  createCup(index) {
    const cup = document.createElement(this.interactive ? 'button' : 'span');
    cup.className = 'cup';
    cup.append(cupTemplate.content.cloneNode(true));
    if (this.interactive) {
      cup.type = 'button';
      cup.setAttribute('aria-pressed', 'false');
      cup.addEventListener('click', () => this.choose(index));
    } else {
      cup.setAttribute('role', 'img');
    }
    this.container.append(cup);
    return cup;
  }

  render(index) {
    const facing = this.states[index] === UP ? 'up' : 'down';
    this.cups[index].dataset.facing = facing;
    this.cups[index].setAttribute('aria-label', `Cup ${index + 1}, mouth ${facing}`);
    if (this.interactive) this.setSelected(index, false);
  }

  setSelected(index, selected) {
    this.cups[index].setAttribute('aria-pressed', String(selected));
  }

  clearSelection() {
    if (this.selected !== null) this.setSelected(this.selected, false);
    this.selected = null;
  }

  async choose(index) {
    if (this.flipping) return;
    if (this.selected === index) {
      this.clearSelection();
      return;
    }
    if (this.selected === null) {
      this.selected = index;
      this.setSelected(index, true);
      return;
    }
    const pair = [this.selected, index];
    this.setSelected(index, true);
    this.selected = null;
    if (await this.flip(pair, 120)) this.onMove?.(pair);
  }

  // Lifts the cups at `indices`, then turns them over together. Resolves to
  // false if set() replaced the row before the flip finished.
  async flip(indices, liftMs) {
    const generation = this.generation;
    this.flipping = true;
    indices.forEach((i) => this.setSelected(i, true));
    await wait(liftMs);
    if (generation !== this.generation) {
      this.flipping = false;
      return false;
    }
    for (const i of indices) {
      this.setSelected(i, false);
      this.states[i] ^= 1;
      this.render(i);
      if (!reduceMotion) {
        this.cups[i].firstElementChild.animate(
          [{ translate: '0 0' }, { translate: '0 -18%' }, { translate: '0 0' }],
          { duration: FLIP_MS, easing: 'ease-in-out' },
        );
      }
    }
    await wait(FLIP_MS);
    this.flipping = false;
    return generation === this.generation;
  }
}

// Static rows in the explanation, written as strings of U and D.
document.querySelectorAll('[data-cups]').forEach((el) => {
  const row = new CupRow(el, { interactive: false });
  row.set([...el.dataset.cups].map((c) => (c === 'U' ? UP : DOWN)));
});

// The trick: solve up-down-up in three moves, then hand the player down-up-down.

const DEMO_START = [UP, DOWN, UP];
const DEMO_MOVES = [
  { pair: [0, 1], caption: 'Flip the first two cups…' },
  { pair: [0, 2], caption: 'now the two on the ends…' },
  { pair: [0, 1], caption: 'and the first two again.' },
];

const trickCups = document.getElementById('trickCups');
const trickCaption = document.getElementById('trickCaption');
const trickMoves = document.getElementById('trickMoves');
const trickButtons = {
  yourTurn: document.getElementById('yourTurnButton'),
  startOver: document.getElementById('startOverButton'),
  replay: document.getElementById('replayButton'),
  secret: document.getElementById('secretButton'),
};
const secret = document.getElementById('secret');

let playerMoves = 0;
let secretOffered = false;
const trick = new CupRow(trickCups, { onMove: onPlayerMove });

function showTrickButtons(...names) {
  for (const [name, button] of Object.entries(trickButtons)) {
    button.hidden = !names.includes(name);
  }
}

function setMoves(n) {
  trickMoves.textContent = n === 0 ? '' : `${n} ${n === 1 ? 'move' : 'moves'}`;
}

async function runDemo() {
  trickCups.inert = true;
  showTrickButtons();
  setMoves(0);
  trick.set(DEMO_START);
  trickCaption.textContent = 'Watch. I can turn all three mouth down.';
  await wait(1800);
  for (const [n, move] of DEMO_MOVES.entries()) {
    trickCaption.textContent = move.caption;
    await trick.flip(move.pair, 600);
    setMoves(n + 1);
    await wait(900);
  }
  trickCaption.textContent = 'All three mouth down. Easy! Now you try.';
  showTrickButtons('yourTurn', 'replay');
}

async function setUpForPlayer() {
  showTrickButtons();
  setMoves(0);
  trick.set([DOWN, DOWN, DOWN]);
  trickCaption.textContent = 'Let me set them up for you…';
  await wait(700);
  // The cheat: a single flip of the middle cup makes the up count odd.
  await trick.flip([1], 0);
  await wait(400);
  startPlaying();
}

function startPlaying() {
  playerMoves = 0;
  setMoves(0);
  trick.set([DOWN, UP, DOWN]);
  trickCups.inert = false;
  trickCaption.textContent = 'Your turn. Tap two cups to flip them.';
  showTrickButtons('startOver', 'replay', ...(secretOffered ? ['secret'] : []));
}

function onPlayerMove() {
  playerMoves += 1;
  setMoves(playerMoves);
  if (playerMoves === 3) {
    trickCaption.textContent = 'Three moves. That was all I needed…';
  } else if (playerMoves === 6) {
    trickCaption.textContent = 'Stuck? Want to know the secret?';
    secretOffered = true;
    showTrickButtons('startOver', 'replay', 'secret');
  } else if (playerMoves === 12) {
    trickCaption.textContent = "It's not you. It can't be done.";
  }
}

trickButtons.yourTurn.addEventListener('click', setUpForPlayer);
trickButtons.startOver.addEventListener('click', startPlaying);
trickButtons.replay.addEventListener('click', runDemo);
trickButtons.secret.addEventListener('click', () => {
  secret.open = true;
  secret.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
});

runDemo();

// Sandbox: any number of cups, with the parity shown.

const cupSlider = document.getElementById('cupSlider');
const cupCount = document.getElementById('cupCount');
const sandboxCups = document.getElementById('sandboxCups');
const sandboxStats = document.getElementById('sandboxStats');
const sandboxVerdict = document.getElementById('sandboxVerdict');
const shuffleButton = document.getElementById('shuffleButton');
const allUpButton = document.getElementById('allUpButton');
const solveButton = document.getElementById('solveButton');

let sandboxMoves = 0;
let solving = false;
const sandbox = new CupRow(sandboxCups, {
  onMove: () => {
    sandboxMoves += 1;
    updateSandbox();
  },
});

function updateSandbox() {
  const n = sandbox.states.length;
  const up = countUp(sandbox.states);
  cupCount.value = n;
  sandboxStats.textContent = `Mouth up: ${up} · Mouth down: ${n - up} · Moves: ${sandboxMoves}`;

  if (up === 0) {
    sandboxVerdict.textContent = 'All mouth down. Solved!';
  } else if (up % 2 === 0) {
    sandboxVerdict.textContent = `${up} up is even, so all mouth down is reachable.`;
  } else {
    // All mouth up is the same puzzle with the roles swapped: it needs an even down count.
    const allUp = (n - up) % 2 === 0 ? 'All mouth up still is.' : 'Neither is all mouth up.';
    sandboxVerdict.textContent = `${up} up is odd, so all mouth down is impossible. ${allUp}`;
  }
  solveButton.disabled = solving || up === 0 || up % 2 === 1;
}

function resetSandbox(states) {
  sandboxMoves = 0;
  sandbox.set(states);
  updateSandbox();
}

function randomStates(n) {
  return Array.from({ length: n }, () => (Math.random() < 0.5 ? UP : DOWN));
}

cupSlider.addEventListener('input', () => {
  const n = Number(cupSlider.value);
  const states = sandbox.states.slice(0, n);
  while (states.length < n) states.push(UP);
  resetSandbox(states);
});
shuffleButton.addEventListener('click', () => resetSandbox(randomStates(sandbox.states.length)));
allUpButton.addEventListener('click', () => resetSandbox(sandbox.states.map(() => UP)));

// Pairs off the mouth-up cups and flips each pair.
solveButton.addEventListener('click', async () => {
  solving = true;
  sandbox.clearSelection();
  sandboxCups.inert = true;
  cupSlider.disabled = shuffleButton.disabled = allUpButton.disabled = true;
  updateSandbox();

  const ups = sandbox.states.flatMap((s, i) => (s === UP ? [i] : []));
  for (let i = 0; i < ups.length; i += 2) {
    await sandbox.flip([ups[i], ups[i + 1]], 250);
    sandboxMoves += 1;
    updateSandbox();
  }

  solving = false;
  sandboxCups.inert = false;
  cupSlider.disabled = shuffleButton.disabled = allUpButton.disabled = false;
  updateSandbox();
});

resetSandbox(randomStates(Number(cupSlider.value)));
