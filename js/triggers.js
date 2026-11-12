/**
 * Named trigger sequences and a matcher that finds them in a solution.
 *
 * A trigger also counts when the cube is held differently, so F R F' R' is
 * Rightie with the cube turned. The turned forms come from the 24 rotations of
 * the cube, each of which renames the faces: where Rightie uses R and U, the
 * rotation that sends R to F and U to R gives F R F' R'.
 */

import { FACE_LETTERS, VECTORS } from './cube.js';

/**
 * Triggers in the order they are listed on the page. Moves are written in
 * standard notation. A lowercase letter is a wide turn of two layers, which the
 * solver never produces, so those triggers are listed but never matched.
 */
export const TRIGGERS = [
  { name: 'Rightie', aka: 'Sexy Move', moves: "R U R' U'" },
  { name: 'Leftie', moves: "L' U' L U" },
  { name: 'Sledgehammer', moves: "R' F R F'" },
  { name: 'Hedgeslammer', moves: "r' F R F'", note: 'It starts with the wide turn r, so a solution is never marked with it.' },
  { name: 'Sune', moves: "R U R' U R U2 R'", note: 'A common pattern for orienting the last layer.' },
  { name: 'Antisune', moves: "R U2 R' U' R U' R'", note: 'The inverse of Sune, also used to orient the last layer.' },
];

/** Name with its other name, for example "Rightie (Sexy Move)". */
export const triggerLabel = (trigger) => (trigger.aka ? `${trigger.name} (${trigger.aka})` : trigger.name);

/* ---------- cube rotations ---------- */

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const negate = (v) => v.map((x) => (x === 0 ? 0 : -x));
const letterOf = (v) => FACE_LETTERS.split('').find((face) => VECTORS[face].every((x, i) => x === v[i]));
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

/**
 * The 24 rotations of the cube, each as a map from a face letter to the letter
 * of the face that takes its place. A rotation is fixed by where R and U go,
 * and F goes to the cross product of those two directions.
 */
function cubeRotations() {
  const rotations = [];
  for (const x of FACE_LETTERS) {
    for (const y of FACE_LETTERS) {
      const a = VECTORS[x];
      const b = VECTORS[y];
      if (dot(a, b) !== 0) continue;
      const f = cross(a, b);
      rotations.push({
        R: x,
        L: letterOf(negate(a)),
        U: y,
        D: letterOf(negate(b)),
        F: letterOf(f),
        B: letterOf(negate(f)),
      });
    }
  }
  return rotations;
}

/* ---------- matching ---------- */

const isFaceTurn = (move) => FACE_LETTERS.includes(move[0]);

/** Every sequence to look for: each matchable trigger in each distinct orientation. */
export const PATTERNS = [];
for (const trigger of TRIGGERS) {
  const base = trigger.moves.split(' ');
  if (!base.every(isFaceTurn)) continue;
  const seen = new Set();
  for (const rotation of cubeRotations()) {
    const moves = base.map((move) => rotation[move[0]] + move.slice(1));
    const key = moves.join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    PATTERNS.push({ trigger, moves, turned: !(rotation.R === 'R' && rotation.U === 'U') });
  }
}
// Longer sequences first, and the written form before a turned one.
PATTERNS.sort((a, b) => b.moves.length - a.moves.length || Number(a.turned) - Number(b.turned));

/**
 * Finds triggers in a list of moves, scanning left to right. Matches do not
 * overlap. Each result has the start and end index (end is exclusive), the
 * trigger, and whether the cube was turned relative to the written form.
 */
export function findTriggers(moves) {
  const found = [];
  let i = 0;
  while (i < moves.length) {
    const hit = PATTERNS.find((pattern) => pattern.moves.every((move, k) => moves[i + k] === move));
    if (hit) {
      found.push({ start: i, end: i + hit.moves.length, trigger: hit.trigger, turned: hit.turned });
      i += hit.moves.length;
    } else {
      i += 1;
    }
  }
  return found;
}
