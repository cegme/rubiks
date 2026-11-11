/**
 * Two-phase solver (Kociemba's algorithm) for the 3x3x3 cube.
 *
 * Phase 1 searches with IDA* for a move sequence that brings the cube into
 * G1 = <U, D, R2, L2, F2, B2>. Each phase 1 solution is completed by an IDA*
 * search over G1 moves only. After the first solution the search keeps going
 * with a shorter length bound until the time limit, so the result approaches
 * the shortest solution without proving it.
 */

import { MOVES, SOLVED, applyMoves, copyCubie, moveName, multiply, newCubie, validate } from './cube.js';
import {
  N_FLIP,
  N_PERM4,
  N_TWIST,
  PHASE2_MOVES,
  cornerPermOf,
  edgePermOf,
  flipOf,
  getTables,
  slicePermOf,
  sliceOf,
  twistOf,
} from './tables.js';

const N_PHASE2 = PHASE2_MOVES.length;

/** True for moves that stay inside G1 (U, D, and half turns of R, L, F, B). */
const staysInG1 = (move) => {
  const face = (move / 3) | 0;
  return face === 0 || face === 3 || move % 3 === 1;
};

/**
 * Solves a cube given as a 54 character facelet string.
 *
 * @param {string} facelets Face letters in URFDLB order.
 * @param {object} [options]
 * @param {number} [options.maxLength=30] Longest solution accepted.
 * @param {number} [options.timeLimitMs=2000] Time spent looking for shorter solutions.
 * @param {function(string[], number): void} [options.onSolution] Called with each
 *   improved solution and the elapsed milliseconds.
 * @param {object} [options.names] Color names used in validation messages.
 * @returns {{ok: boolean, error?: string, moves?: string[], elapsedMs?: number,
 *   exhausted?: boolean}} The best solution found.
 */
export function solve(facelets, options = {}) {
  const { maxLength = 30, timeLimitMs = 2000, onSolution = null, names = {} } = options;

  const checked = validate(facelets, names);
  if (!checked.ok) return { ok: false, error: checked.error };

  const T = getTables();
  const start = checked.cubie;
  const startTwist = twistOf(start.co);
  const startFlip = flipOf(start.eo);
  const startSlice = sliceOf(start.ep);

  const started = performance.now();
  const deadline = started + timeLimitMs;
  const path1 = new Int8Array(40);
  const path2 = new Int8Array(40);

  let target = maxLength;
  let best = null;
  let stopped = false;
  let nodes = 0;

  let bufA = newCubie();
  let bufB = newCubie();

  const timedOut = () => {
    if ((++nodes & 4095) !== 0 || best === null) return false;
    if (performance.now() < deadline) return false;
    stopped = true;
    return true;
  };

  function search2(corner, edge, slicePerm, remaining, lastFace, depth) {
    if (stopped) return false;
    const h = Math.max(
      T.pruneCornerSlice[corner * N_PERM4 + slicePerm],
      T.pruneEdgeSlice[edge * N_PERM4 + slicePerm],
    );
    if (h > remaining) return false;
    if (remaining === 0) return true;
    if (timedOut()) return false;

    for (let j = 0; j < N_PHASE2; j++) {
      const move = PHASE2_MOVES[j];
      const face = (move / 3) | 0;
      if (face === lastFace || face === lastFace - 3) continue;
      path2[depth] = move;
      const next = search2(
        T.corner[corner * N_PHASE2 + j],
        T.edge[edge * N_PHASE2 + j],
        T.slicePerm[slicePerm * N_PHASE2 + j],
        remaining - 1,
        face,
        depth + 1,
      );
      if (next) return true;
    }
    return false;
  }

  function completePhase2(depth1, lastFace) {
    const limit = target - depth1;
    if (limit < 0) return;

    copyCubie(start, bufA);
    for (let i = 0; i < depth1; i++) {
      multiply(bufA, MOVES[path1[i]], bufB);
      [bufA, bufB] = [bufB, bufA];
    }
    const corner = cornerPermOf(bufA);
    const edge = edgePermOf(bufA);
    const slicePerm = slicePermOf(bufA);

    let depth2 = Math.max(
      T.pruneCornerSlice[corner * N_PERM4 + slicePerm],
      T.pruneEdgeSlice[edge * N_PERM4 + slicePerm],
    );
    for (; depth2 <= limit && !stopped; depth2++) {
      if (!search2(corner, edge, slicePerm, depth2, lastFace, 0)) continue;
      best = [...path1.subarray(0, depth1), ...path2.subarray(0, depth2)];
      target = best.length - 1;
      onSolution?.(best.map(moveName), performance.now() - started);
      return;
    }
  }

  function search1(twist, flip, slice, remaining, lastFace, depth, depth1) {
    if (stopped) return;
    const h = Math.max(
      T.pruneSliceTwist[slice * N_TWIST + twist],
      T.pruneSliceFlip[slice * N_FLIP + flip],
    );
    if (h > remaining) return;
    if (remaining === 0) {
      // A phase 1 sequence ending in a G1 move would have a shorter prefix.
      if (depth > 0 && staysInG1(path1[depth - 1])) return;
      completePhase2(depth1, lastFace);
      return;
    }
    if (timedOut()) return;

    for (let move = 0; move < 18; move++) {
      const face = (move / 3) | 0;
      if (face === lastFace || face === lastFace - 3) continue;
      path1[depth] = move;
      search1(
        T.twist[twist * 18 + move],
        T.flip[flip * 18 + move],
        T.slice[slice * 18 + move],
        remaining - 1,
        face,
        depth + 1,
        depth1,
      );
      if (stopped) return;
    }
  }

  for (let depth1 = 0; depth1 <= target && !stopped; depth1++) {
    search1(startTwist, startFlip, startSlice, depth1, -1, 0, depth1);
  }

  if (best === null) {
    return { ok: false, error: `No solution found within ${maxLength} moves.` };
  }
  const moves = best.map(moveName);
  if (applyMoves(facelets, moves) !== SOLVED) {
    throw new Error(`Internal error: solution ${moves.join(' ')} does not solve the cube.`);
  }
  return { ok: true, moves, elapsedMs: performance.now() - started, exhausted: !stopped };
}
