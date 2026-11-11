/**
 * Coordinates, move tables and pruning tables for the two-phase search.
 *
 * Phase 1 moves any cube into G1 = <U, D, R2, L2, F2, B2>, where corner twist
 * and edge flip are 0 and the four middle-slice edges sit in the middle slice.
 * Phase 2 solves the cube using only G1 moves.
 *
 * Phase 1 coordinates: twist (2187), flip (2048), slice position (495).
 * Phase 2 coordinates: corner permutation (40320), U/D edge permutation (40320)
 * and slice edge permutation (24).
 */

import { MOVES, multiply, newCubie, resetCubie } from './cube.js';

export const N_TWIST = 2187;
export const N_FLIP = 2048;
export const N_SLICE = 495;
export const N_PERM8 = 40320;
export const N_PERM4 = 24;

/** Move indices usable in phase 2: U, D any power, and R2 L2 F2 B2. */
export const PHASE2_MOVES = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16];

const BINOMIAL = Array.from({ length: 13 }, (_, n) =>
  Array.from({ length: 5 }, (_, k) => {
    if (k > n) return 0;
    let value = 1;
    for (let i = 1; i <= k; i++) value = (value * (n - k + i)) / i;
    return value;
  }),
);

/* ---------- coordinates ---------- */

export function twistOf(co) {
  let t = 0;
  for (let i = 0; i < 7; i++) t = t * 3 + co[i];
  return t;
}

function setTwist(cubie, t) {
  let sum = 0;
  for (let i = 6; i >= 0; i--) {
    cubie.co[i] = t % 3;
    sum += cubie.co[i];
    t = (t / 3) | 0;
  }
  cubie.co[7] = (3 - (sum % 3)) % 3;
}

export function flipOf(eo) {
  let f = 0;
  for (let i = 0; i < 11; i++) f = f * 2 + eo[i];
  return f;
}

function setFlip(cubie, f) {
  let sum = 0;
  for (let i = 10; i >= 0; i--) {
    cubie.eo[i] = f & 1;
    sum += cubie.eo[i];
    f >>= 1;
  }
  cubie.eo[11] = sum & 1;
}

/** Rank of the set of positions holding slice edges (pieces 8..11). */
export function sliceOf(ep) {
  let rank = 0;
  let k = 1;
  for (let pos = 0; pos < 12; pos++) {
    if (ep[pos] >= 8) rank += BINOMIAL[pos][k++];
  }
  return rank;
}

function setSlice(cubie, rank) {
  const isSlice = new Array(12).fill(false);
  for (let k = 4; k >= 1; k--) {
    let pos = 11;
    while (BINOMIAL[pos][k] > rank) pos--;
    isSlice[pos] = true;
    rank -= BINOMIAL[pos][k];
  }
  let slice = 8;
  let other = 0;
  for (let pos = 0; pos < 12; pos++) {
    cubie.ep[pos] = isSlice[pos] ? slice++ : other++;
  }
}

/** Lehmer rank of the relative order of n values starting at arr[start]. */
export function rankPerm(arr, start, n) {
  let rank = 0;
  for (let i = 0; i < n; i++) {
    let smaller = 0;
    for (let j = i + 1; j < n; j++) if (arr[start + j] < arr[start + i]) smaller++;
    rank = rank * (n - i) + smaller;
  }
  return rank;
}

const DIGITS = new Uint8Array(8);

/** Writes the permutation of n values with the given rank into out[start..], adding offset. */
function unrankPerm(out, start, rank, n, offset = 0) {
  for (let i = n - 1; i >= 0; i--) {
    DIGITS[i] = rank % (n - i);
    rank = (rank / (n - i)) | 0;
  }
  let used = 0;
  for (let i = 0; i < n; i++) {
    let skip = DIGITS[i];
    let value = 0;
    for (;; value++) {
      if ((used >> value) & 1) continue;
      if (skip-- === 0) break;
    }
    used |= 1 << value;
    out[start + i] = value + offset;
  }
}

const setCornerPerm = (cubie, rank) => unrankPerm(cubie.cp, 0, rank, 8);
const setEdgePerm = (cubie, rank) => unrankPerm(cubie.ep, 0, rank, 8);
const setSlicePerm = (cubie, rank) => unrankPerm(cubie.ep, 8, rank, 4, 8);

const cornerPermOf = (cubie) => rankPerm(cubie.cp, 0, 8);
const edgePermOf = (cubie) => rankPerm(cubie.ep, 0, 8);
const slicePermOf = (cubie) => rankPerm(cubie.ep, 8, 4);

/* ---------- table builders ---------- */

function buildMoveTable(size, moveIds, decode, encode) {
  const n = moveIds.length;
  const table = new Uint16Array(size * n);
  const from = newCubie();
  const to = newCubie();
  for (let i = 0; i < size; i++) {
    resetCubie(from);
    decode(from, i);
    for (let j = 0; j < n; j++) {
      multiply(from, MOVES[moveIds[j]], to);
      table[i * n + j] = encode(to);
    }
  }
  return table;
}

/**
 * Breadth-first search over the product of two coordinates. The result holds,
 * for each pair, a lower bound on the number of moves needed to reach solved.
 */
function buildPruneTable(sizeA, sizeB, moveA, moveB, nMoves, startA, startB) {
  const total = sizeA * sizeB;
  const table = new Uint8Array(total).fill(255);
  table[startA * sizeB + startB] = 0;
  for (let depth = 0; ; depth++) {
    let added = 0;
    for (let index = 0; index < total; index++) {
      if (table[index] !== depth) continue;
      const a = (index / sizeB) | 0;
      const b = index - a * sizeB;
      for (let m = 0; m < nMoves; m++) {
        const next = moveA[a * nMoves + m] * sizeB + moveB[b * nMoves + m];
        if (table[next] === 255) {
          table[next] = depth + 1;
          added++;
        }
      }
    }
    if (added === 0) return table;
  }
}

let cached = null;

/** Builds every table once (roughly a second) and returns them. */
export function getTables() {
  if (cached) return cached;
  const all = Array.from({ length: 18 }, (_, i) => i);
  const solved = newCubie();

  const twist = buildMoveTable(N_TWIST, all, setTwist, (c) => twistOf(c.co));
  const flip = buildMoveTable(N_FLIP, all, setFlip, (c) => flipOf(c.eo));
  const slice = buildMoveTable(N_SLICE, all, setSlice, (c) => sliceOf(c.ep));
  const corner = buildMoveTable(N_PERM8, PHASE2_MOVES, setCornerPerm, cornerPermOf);
  const edge = buildMoveTable(N_PERM8, PHASE2_MOVES, setEdgePerm, edgePermOf);
  const slicePerm = buildMoveTable(N_PERM4, PHASE2_MOVES, setSlicePerm, slicePermOf);

  const solvedSlice = sliceOf(solved.ep);
  cached = {
    twist,
    flip,
    slice,
    corner,
    edge,
    slicePerm,
    solvedSlice,
    pruneSliceTwist: buildPruneTable(N_SLICE, N_TWIST, slice, twist, 18, solvedSlice, 0),
    pruneSliceFlip: buildPruneTable(N_SLICE, N_FLIP, slice, flip, 18, solvedSlice, 0),
    pruneCornerSlice: buildPruneTable(N_PERM8, N_PERM4, corner, slicePerm, 10, 0, 0),
    pruneEdgeSlice: buildPruneTable(N_PERM8, N_PERM4, edge, slicePerm, 10, 0, 0),
  };
  return cached;
}

export { cornerPermOf, edgePermOf, slicePermOf };
