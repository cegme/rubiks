/**
 * Cube editor and solution player. The search runs in solver.worker.js.
 */

import { FACE_LETTERS, SOLVED, applyMoves, invertMoves, parseMove, randomScramble, validate } from './cube.js';
import { CubeStage } from './view3d.js';

const COLOR = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
const FACE = { U: 'top', R: 'right', F: 'front', D: 'bottom', L: 'left', B: 'back' };
const KEYS = { w: 'U', r: 'R', g: 'F', y: 'D', o: 'L', b: 'B' };
const $ = (selector) => document.querySelector(selector);

const state = {
  stickers: Array(54).fill(null),
  paint: 'U',
  solution: null,
  start: '',
  step: 0,
  solving: false,
  playing: null,
};
const setCenters = () => FACE_LETTERS.split('').forEach((letter, f) => (state.stickers[f * 9 + 4] = letter));
setCenters();

const stage = new CubeStage([$('#view-front'), $('#view-back')]);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
/** Milliseconds for the turn animation of a move. Half turns take 1.5 times as long. */
const turnMs = (move) => (reducedMotion.matches ? 0 : Number($('#speed').value) * (move.endsWith('2') ? 1.5 : 1));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let goToId = 0;

/* ---------- worker ---------- */

let worker = null;
let workerReady = false;
let solveId = 0;

function startWorker() {
  workerReady = false;
  worker = new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = onWorkerMessage;
  worker.onerror = () => {
    state.solving = false;
    setStatus('The solver could not start in this browser.', 'error');
    updateControls();
  };
}

function onWorkerMessage({ data }) {
  if (data.type === 'ready') {
    workerReady = true;
    if (!state.solving && $('#status').classList.contains('busy')) updateStatus();
    updateControls();
    return;
  }
  if (data.id !== solveId) return;
  if (data.type === 'solution') {
    showSolution(data.moves);
    setStatus(`Found ${data.moves.length} moves. Looking for a shorter one…`, 'busy');
  } else if (data.type === 'done') {
    state.solving = false;
    if (data.ok) {
      if (data.moves.join(' ') !== state.solution?.join(' ')) showSolution(data.moves);
      setStatus(
        data.moves.length === 0
          ? 'This cube is already solved.'
          : `Done. ${data.moves.length} moves, searched for ${(data.elapsedMs / 1000).toFixed(1)} s.`,
      );
    } else {
      setStatus(data.error, 'error');
    }
    updateControls();
  } else if (data.type === 'error') {
    state.solving = false;
    setStatus(data.message, 'error');
    updateControls();
  }
}

/* ---------- editor ---------- */

const palette = $('#palette');
const net = $('#net');
const stickerEls = [];

FACE_LETTERS.split('').forEach((letter) => {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'swatch';
  swatch.dataset.paint = letter;
  swatch.innerHTML = `<i style="--c: var(--c-${letter})"></i>${COLOR[letter]}`;
  swatch.addEventListener('click', () => setPaint(letter));
  palette.append(swatch);
});

FACE_LETTERS.split('').forEach((letter, f) => {
  const face = document.createElement('div');
  face.className = 'face';
  face.dataset.face = letter;
  for (let i = 0; i < 9; i++) {
    const index = f * 9 + i;
    const sticker = document.createElement('button');
    sticker.type = 'button';
    sticker.className = 'sticker';
    sticker.dataset.index = index;
    if (i === 4) {
      sticker.classList.add('center');
      sticker.tabIndex = -1;
    }
    face.append(sticker);
    stickerEls[index] = sticker;
  }
  net.append(face);
});

function setPaint(letter) {
  state.paint = letter;
  palette.querySelectorAll('.swatch').forEach((el) => {
    el.setAttribute('aria-pressed', String(el.dataset.paint === letter));
  });
}

function paintSticker(index) {
  if (index % 9 === 4) return;
  if (state.solution) clearSolution();
  if (state.stickers[index] === state.paint) return;
  state.stickers[index] = state.paint;
  changed();
}

let dragging = false;
net.addEventListener('pointerdown', (event) => {
  const sticker = event.target.closest('.sticker');
  if (!sticker) return;
  event.preventDefault();
  dragging = true;
  paintSticker(Number(sticker.dataset.index));
});
net.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const sticker = document.elementFromPoint(event.clientX, event.clientY)?.closest('.sticker');
  if (sticker) paintSticker(Number(sticker.dataset.index));
});
['pointerup', 'pointercancel'].forEach((name) => window.addEventListener(name, () => (dragging = false)));
net.addEventListener('click', (event) => {
  const sticker = event.target.closest('.sticker');
  if (sticker && event.detail === 0) paintSticker(Number(sticker.dataset.index));
});

$('#letters').addEventListener('change', (event) => net.classList.toggle('letters', event.target.checked));

/* ---------- rendering ---------- */

const facelets = () =>
  state.solution
    ? applyMoves(state.start, state.solution.slice(0, state.step))
    : state.stickers.map((s) => s ?? '.').join('');

function render() {
  const shown = facelets();
  stickerEls.forEach((el, index) => {
    const letter = shown[index];
    const known = letter !== '.';
    if (known) el.dataset.c = letter;
    else delete el.dataset.c;
    el.textContent = known ? COLOR[letter][0].toUpperCase() : '';
    const face = FACE_LETTERS[(index / 9) | 0];
    const where = `${FACE[face]} face, row ${Math.floor((index % 9) / 3) + 1}, column ${(index % 3) + 1}`;
    el.setAttribute('aria-label', `${where}: ${known ? COLOR[letter] : 'not set'}`);
  });
  net.querySelectorAll('.face').forEach((el) => {
    const next = state.solution?.[state.step];
    el.classList.toggle('next', Boolean(next) && next[0] === el.dataset.face);
  });
}

function setStatus(text, kind = '') {
  const el = $('#status');
  el.textContent = text;
  el.className = `status ${kind}`.trim();
}

function updateStatus() {
  const left = state.stickers.filter((s) => s === null).length;
  if (left > 0) {
    setStatus(`${left} stickers still need a color. Pick a color above, then click the stickers.`);
  } else if (!workerReady) {
    setStatus('Preparing the solver…', 'busy');
  } else {
    setStatus('Ready to solve.');
  }
}

function updateControls() {
  const complete = state.stickers.every((s) => s !== null);
  const solve = $('#solve');
  solve.textContent = state.solving ? 'Stop' : 'Solve';
  solve.disabled = !state.solving && !(complete && workerReady);
  const has = Boolean(state.solution);
  const n = state.solution?.length ?? 0;
  $('#first').disabled = !has || state.step === 0;
  $('#prev').disabled = !has || state.step === 0;
  $('#next').disabled = !has || state.step >= n;
  $('#play').disabled = !has || (state.step >= n && !state.playing);
  $('#play').textContent = state.playing ? 'Pause' : 'Play';
  $('#copy').disabled = !has || n === 0;
}

function changed() {
  history.replaceState(null, '', `#${state.stickers.map((s) => s ?? '.').join('')}`);
  if (!state.solving) updateStatus();
  render();
  updateControls();
}

/* ---------- solving ---------- */

function startSolve() {
  const left = state.stickers.filter((s) => s === null).length;
  if (left > 0) return updateStatus();
  const cube = state.stickers.join('');
  const check = validate(cube, COLOR);
  if (!check.ok) return setStatus(check.error, 'error');

  clearSolution();
  state.solving = true;
  solveId += 1;
  setStatus('Searching…', 'busy');
  updateControls();
  worker.postMessage({
    type: 'solve',
    id: solveId,
    facelets: cube,
    timeLimitMs: Number($('#budget').value),
    names: COLOR,
  });
}

function stopSolve() {
  worker.terminate();
  startWorker();
  state.solving = false;
  setStatus(
    state.solution ? `Stopped. Showing the best solution found, ${state.solution.length} moves.` : 'Stopped.',
  );
  updateControls();
}

/* ---------- solution player ---------- */

function showSolution(moves) {
  if (!state.solution) state.start = state.stickers.join('');
  state.solution = moves;
  state.step = 0;
  pause();
  $('#solution').hidden = false;
  $('#solution-meta').textContent =
    moves.length === 0 ? 'Nothing to do.' : `${moves.length} moves, counting each half turn as 1.`;
  const list = $('#moves');
  list.replaceChildren(
    ...moves.map((move, i) => {
      const item = document.createElement('li');
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = move;
      chip.addEventListener('click', () => (pause(), goTo(i + 1, true)));
      item.append(chip);
      return item;
    }),
  );
  goTo(0);
}

function clearSolution() {
  pause();
  stage.settle();
  state.solution = null;
  state.step = 0;
  $('#solution').hidden = true;
  render();
  updateControls();
}

function describe(move) {
  const index = parseMove(move);
  const face = FACE[move[0]];
  const turn = ['a quarter turn clockwise', 'a half turn', 'a quarter turn counterclockwise'][index % 3];
  return `Turn the ${face} face (${COLOR[move[0]]} center) ${turn}, as you look straight at that face.`;
}

/**
 * Moves the player to a step. With animate set and a step that is one move
 * away, the 3D cube plays that turn. Other jumps change the cube at once. The
 * promise resolves when the cube has stopped moving.
 */
async function goTo(step, animate = false) {
  const n = state.solution.length;
  const from = state.step;
  state.step = Math.max(0, Math.min(n, step));
  const id = ++goToId;
  $('#moves').querySelectorAll('.chip').forEach((chip, i) => {
    chip.classList.toggle('done', i < state.step);
    chip.classList.toggle('current', i === state.step);
  });
  const now = $('#now');
  if (n === 0) now.textContent = 'The cube is already solved.';
  else if (state.step >= n) now.textContent = 'Solved.';
  else {
    const move = state.solution[state.step];
    now.textContent = `Move ${state.step + 1} of ${n}: ${move}. ${describe(move)}`;
  }
  render();
  updateControls();

  const to = state.step;
  stage.settle();
  if (animate && (to === from + 1 || to === from - 1)) {
    const move = to > from ? state.solution[from] : invertMoves([state.solution[to]])[0];
    await stage.turn(move, turnMs(move));
  } else {
    stage.set(facelets());
  }
  if (id === goToId) stage.preview(state.solution?.[state.step] ?? null);
}

function pause() {
  state.playing = null;
}

/** How long the arrow for the next move stays up before Play turns the face. */
function holdMs(move) {
  const ms = turnMs(move);
  return ms === 0 ? 900 : Math.max(350, Math.round(ms * 0.7));
}

async function togglePlay() {
  if (state.playing) {
    pause();
    updateControls();
    return;
  }
  if (state.step >= state.solution.length) await goTo(0);
  const token = Symbol('play');
  state.playing = token;
  updateControls();
  while (state.playing === token && state.step < state.solution.length) {
    await sleep(holdMs(state.solution[state.step]));
    if (state.playing !== token) return;
    await goTo(state.step + 1, true);
  }
  if (state.playing === token) {
    pause();
    updateControls();
  }
}

/* ---------- buttons ---------- */

$('#solve').addEventListener('click', () => (state.solving ? stopSolve() : startSolve()));
$('#scramble').addEventListener('click', () => loadCube(applyMoves(SOLVED, randomScramble(25))));
$('#solved').addEventListener('click', () => loadCube(SOLVED));
$('#clear').addEventListener('click', () => {
  if (state.solving) stopSolve();
  clearSolution();
  state.stickers.fill(null);
  setCenters();
  changed();
});
$('#first').addEventListener('click', () => (pause(), goTo(0)));
$('#prev').addEventListener('click', () => (pause(), goTo(state.step - 1, true)));
$('#next').addEventListener('click', () => (pause(), goTo(state.step + 1, true)));
$('#play').addEventListener('click', togglePlay);
$('#copy').addEventListener('click', async (event) => {
  try {
    await navigator.clipboard.writeText(state.solution.join(' '));
    event.target.textContent = 'Copied';
  } catch {
    event.target.textContent = 'Copy failed';
  }
  setTimeout(() => (event.target.textContent = 'Copy moves'), 1500);
});

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (KEYS[event.key.toLowerCase()]) setPaint(KEYS[event.key.toLowerCase()]);
  else if (state.solution && event.key === 'ArrowRight') (pause(), goTo(state.step + 1, true));
  else if (state.solution && event.key === 'ArrowLeft') (pause(), goTo(state.step - 1, true));
});

function loadCube(cube) {
  if (state.solving) stopSolve();
  clearSolution();
  state.stickers = [...cube];
  changed();
}

/* ---------- start ---------- */

const fromHash = location.hash.slice(1);
if (/^[URFDLB.]{54}$/.test(fromHash)) {
  state.stickers = [...fromHash].map((c) => (c === '.' ? null : c));
  setCenters();
}
setPaint('U');
startWorker();
render();
updateStatus();
updateControls();
