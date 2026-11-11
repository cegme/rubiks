/**
 * Cube model: facelets, cubies and the 18 face turns.
 *
 * A cube is a 54 character string of face letters in the order
 * U1..U9, R1..R9, F1..F9, D1..D9, L1..L9, B1..B9 (the Kociemba order).
 * Each letter is the face whose center has that color, so a solved cube is
 * SOLVED. The net is read row by row with U on top, F in front, R on the right.
 *
 * Every sticker position and every quarter turn is derived from 3D
 * coordinates, so the facelet tables cannot disagree with the geometry.
 */

export const FACE_LETTERS = 'URFDLB';
export const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const VECTORS = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

/** Corner and edge positions, in the order used by the cubie model. */
export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

const SUFFIXES = ['', '2', "'"];

/* ---------- geometry ---------- */

function stickerPosition(face, row, col) {
  switch (face) {
    case 'U': return [col - 1, 1, row - 1];
    case 'R': return [1, 1 - row, 1 - col];
    case 'F': return [col - 1, 1 - row, 1];
    case 'D': return [col - 1, -1, 1 - row];
    case 'L': return [-1, 1 - row, col - 1];
    default: return [1 - col, 1 - row, -1];
  }
}

const key = (pos, normal) => `${pos}|${normal}`;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const STICKERS = [];
for (const face of FACE_LETTERS) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      STICKERS.push({ pos: stickerPosition(face, row, col), normal: VECTORS[face] });
    }
  }
}
const STICKER_AT = new Map(STICKERS.map((s, i) => [key(s.pos, s.normal), i]));

/** Rotates v by 90 degrees about an axis (0=x, 1=y, 2=z), right-handed when sign > 0. */
function rotate(v, axis, sign) {
  const [x, y, z] = v;
  if (sign > 0) {
    if (axis === 0) return [x, -z, y];
    if (axis === 1) return [z, y, -x];
    return [-y, x, z];
  }
  if (axis === 0) return [x, z, -y];
  if (axis === 1) return [-z, y, x];
  return [y, -x, z];
}

/** Axis and rotation sign of a clockwise turn, as seen looking at that face. */
const TURN = { U: [1, -1], R: [0, -1], F: [2, -1], D: [1, 1], L: [0, 1], B: [2, 1] };

/**
 * QUARTER_PERMS[f][j] is the sticker that moves into slot j when face f turns
 * a quarter turn clockwise.
 */
export const QUARTER_PERMS = [...FACE_LETTERS].map((face) => {
  const [axis, sign] = TURN[face];
  const perm = Array.from({ length: 54 }, (_, i) => i);
  STICKERS.forEach((s, i) => {
    if (dot(s.pos, VECTORS[face]) !== 1) return;
    const j = STICKER_AT.get(key(rotate(s.pos, axis, sign), rotate(s.normal, axis, sign)));
    perm[j] = i;
  });
  return perm;
});

/** Facelet indices of each corner (U/D sticker first, then clockwise) and edge. */
const location = (name) =>
  [...name].reduce((sum, ch) => sum.map((v, i) => v + VECTORS[ch][i]), [0, 0, 0]);
const stickersOf = (name) =>
  [...name].map((ch) => STICKER_AT.get(key(location(name), VECTORS[ch])));

export const CORNER_FACELETS = CORNER_NAMES.map(stickersOf);
export const EDGE_FACELETS = EDGE_NAMES.map(stickersOf);

/* ---------- facelet moves ---------- */

/** Names a move index 0..17: face = index / 3, power = index % 3. */
export function moveName(index) {
  return FACE_LETTERS[(index / 3) | 0] + SUFFIXES[index % 3];
}

/** Parses "R", "R2" or "R'" into a move index. */
export function parseMove(name) {
  const face = FACE_LETTERS.indexOf(name[0]);
  const power = SUFFIXES.indexOf(name.slice(1));
  if (face < 0 || power < 0 || name.length > 2) {
    throw new Error(`Unknown move: ${name}`);
  }
  return face * 3 + power;
}

/** Applies moves (names or indices) to a facelet string. */
export function applyMoves(facelets, moves) {
  let cur = [...facelets];
  for (const move of moves) {
    const index = typeof move === 'number' ? move : parseMove(move);
    const perm = QUARTER_PERMS[(index / 3) | 0];
    for (let t = index % 3; t >= 0; t--) {
      cur = perm.map((from) => cur[from]);
    }
  }
  return cur.join('');
}

/** Returns the moves that undo the given sequence. */
export function invertMoves(moves) {
  return moves
    .map((name) => {
      const index = parseMove(name);
      return moveName((index / 3 | 0) * 3 + (2 - (index % 3)));
    })
    .reverse();
}

/** Random scramble of the given length with no redundant consecutive turns. */
export function randomScramble(length = 25, random = Math.random) {
  const moves = [];
  let last = -1;
  while (moves.length < length) {
    const face = Math.floor(random() * 6);
    if (face === last || face === last - 3) continue;
    moves.push(moveName(face * 3 + Math.floor(random() * 3)));
    last = face;
  }
  return moves;
}

/* ---------- cubie model ---------- */

export function newCubie() {
  return {
    cp: Uint8Array.from({ length: 8 }, (_, i) => i),
    co: new Uint8Array(8),
    ep: Uint8Array.from({ length: 12 }, (_, i) => i),
    eo: new Uint8Array(12),
  };
}

/** Sets a cubie back to the solved state without allocating. */
export function resetCubie(cubie) {
  for (let i = 0; i < 8; i++) {
    cubie.cp[i] = i;
    cubie.co[i] = 0;
  }
  for (let i = 0; i < 12; i++) {
    cubie.ep[i] = i;
    cubie.eo[i] = 0;
  }
}

export function copyCubie(src, dst) {
  dst.cp.set(src.cp);
  dst.co.set(src.co);
  dst.ep.set(src.ep);
  dst.eo.set(src.eo);
}

/** out = a followed by move m. out must not be the same object as a. */
export function multiply(a, m, out) {
  for (let i = 0; i < 8; i++) {
    const j = m.cp[i];
    out.cp[i] = a.cp[j];
    out.co[i] = (a.co[j] + m.co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    const j = m.ep[i];
    out.ep[i] = a.ep[j];
    out.eo[i] = (a.eo[j] + m.eo[i]) & 1;
  }
}

const CORNER_COLORS = CORNER_NAMES.map((name) => [...name]);
const EDGE_COLORS = EDGE_NAMES.map((name) => [...name]);

/**
 * Reads a facelet string into cubies. Returns { cubie } or { error }.
 * Orientation 0 means the U/D sticker of a corner (the U/D or F/B sticker of
 * an edge) sits on the U/D face (the U/D or F/B face) of its position.
 */
export function faceletsToCubie(facelets, names = {}) {
  const color = (k) => facelets[k];
  const label = (ch) => names[ch] ?? ch;
  const cubie = newCubie();

  for (let i = 0; i < 8; i++) {
    const cols = CORNER_FACELETS[i].map(color);
    const ori = cols.findIndex((c) => c === 'U' || c === 'D');
    const triple = ori < 0 ? [] : [cols[ori], cols[(ori + 1) % 3], cols[(ori + 2) % 3]];
    const piece = CORNER_COLORS.findIndex((h) => h.every((c, k) => c === triple[k]));
    if (piece < 0) {
      const stickers = cols.map(label).join(', ');
      return {
        error: `The ${[...CORNER_NAMES[i]].join('/')} corner shows ${stickers}, which cannot occur together on one corner.`,
      };
    }
    cubie.cp[i] = piece;
    cubie.co[i] = ori;
  }

  for (let i = 0; i < 12; i++) {
    const [a, b] = EDGE_FACELETS[i].map(color);
    let piece = -1;
    let flip = 0;
    EDGE_COLORS.forEach(([x, y], j) => {
      if (a === x && b === y) { piece = j; flip = 0; }
      if (a === y && b === x) { piece = j; flip = 1; }
    });
    if (piece < 0) {
      return {
        error: `The ${[...EDGE_NAMES[i]].join('/')} edge shows ${label(a)}, ${label(b)}, which cannot occur together on one edge.`,
      };
    }
    cubie.ep[i] = piece;
    cubie.eo[i] = flip;
  }
  return { cubie };
}

const parity = (arr) => {
  let inversions = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) inversions++;
  }
  return inversions & 1;
};

/**
 * Checks that a facelet string describes a cube that can be solved.
 * Returns { ok: true, cubie } or { ok: false, error }. The optional names map
 * turns face letters into color names for the messages.
 */
export function validate(facelets, names = {}) {
  const label = (ch) => names[ch] ?? ch;
  if (typeof facelets !== 'string' || facelets.length !== 54) {
    return { ok: false, error: 'A cube needs exactly 54 stickers.' };
  }
  const counts = Object.fromEntries([...FACE_LETTERS].map((ch) => [ch, 0]));
  for (const ch of facelets) {
    if (!(ch in counts)) return { ok: false, error: `Unknown sticker color "${ch}".` };
    counts[ch]++;
  }
  const off = FACE_LETTERS.split('').filter((ch) => counts[ch] !== 9);
  if (off.length > 0) {
    const detail = off.map((ch) => `${label(ch)} appears ${counts[ch]} times`).join(', ');
    return { ok: false, error: `Each color must appear exactly 9 times, but ${detail}.` };
  }

  const { cubie, error } = faceletsToCubie(facelets, names);
  if (error) return { ok: false, error };

  if (new Set(cubie.cp).size !== 8) {
    return { ok: false, error: 'Two corners are the same piece, so some stickers are misplaced.' };
  }
  if (new Set(cubie.ep).size !== 12) {
    return { ok: false, error: 'Two edges are the same piece, so some stickers are misplaced.' };
  }
  if (cubie.co.reduce((a, b) => a + b, 0) % 3 !== 0) {
    return { ok: false, error: 'One corner is twisted in place. Check the colors around each corner.' };
  }
  if (cubie.eo.reduce((a, b) => a + b, 0) % 2 !== 0) {
    return { ok: false, error: 'One edge is flipped in place. Check the two colors on each edge.' };
  }
  if (parity(cubie.cp) !== parity(cubie.ep)) {
    return { ok: false, error: 'Two pieces are swapped, which no sequence of turns can produce.' };
  }
  return { ok: true, cubie };
}

/** The 18 face turns as cubie states: index = face * 3 + (power - 1). */
export const MOVES = [];
for (const perm of QUARTER_PERMS) {
  const quarter = faceletsToCubie(applyPerm(SOLVED, perm)).cubie;
  const half = newCubie();
  const threeQuarter = newCubie();
  multiply(quarter, quarter, half);
  multiply(half, quarter, threeQuarter);
  MOVES.push(quarter, half, threeQuarter);
}

function applyPerm(facelets, perm) {
  return perm.map((from) => facelets[from]).join('');
}
