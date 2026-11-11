import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CORNER_FACELETS,
  EDGE_FACELETS,
  MOVES,
  SOLVED,
  applyMoves,
  faceletsToCubie,
  invertMoves,
  moveName,
  parseMove,
  randomScramble,
  validate,
} from '../js/cube.js';

const face = (facelets, letter) => facelets.slice('URFDLB'.indexOf(letter) * 9).slice(0, 9);

test('a solved cube is the identity and is valid', () => {
  const { cubie } = faceletsToCubie(SOLVED);
  assert.deepEqual([...cubie.cp], [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual([...cubie.ep], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(cubie.co.every((v) => v === 0) && cubie.eo.every((v) => v === 0), true);
  assert.equal(validate(SOLVED).ok, true);
});

test('corner and edge facelets match the Kociemba tables', () => {
  // U1..U9 = 0..8, R1..R9 = 9..17, F1..F9 = 18..26, D1..D9 = 27..35, L = 36..44, B = 45..53
  const U = (n) => n - 1, R = (n) => 8 + n, F = (n) => 17 + n;
  const D = (n) => 26 + n, L = (n) => 35 + n, B = (n) => 44 + n;
  assert.deepEqual(CORNER_FACELETS, [
    [U(9), R(1), F(3)], [U(7), F(1), L(3)], [U(1), L(1), B(3)], [U(3), B(1), R(3)],
    [D(3), F(9), R(7)], [D(1), L(9), F(7)], [D(7), B(9), L(7)], [D(9), R(9), B(7)],
  ]);
  assert.deepEqual(EDGE_FACELETS, [
    [U(6), R(2)], [U(8), F(2)], [U(4), L(2)], [U(2), B(2)],
    [D(6), R(8)], [D(2), F(8)], [D(4), L(8)], [D(8), B(8)],
    [F(6), R(4)], [F(4), L(6)], [B(6), L(4)], [B(4), R(6)],
  ]);
});

test('clockwise turns move stickers the way a physical cube does', () => {
  const afterU = applyMoves(SOLVED, ['U']);
  assert.equal(face(afterU, 'F').slice(0, 3), 'RRR', 'U sends the right face to the front');
  assert.equal(face(afterU, 'U'), 'UUUUUUUUU');

  const afterR = applyMoves(SOLVED, ['R']);
  assert.deepEqual([2, 5, 8].map((i) => face(afterR, 'U')[i]), ['F', 'F', 'F'], 'R sends front to up');

  const afterF = applyMoves(SOLVED, ['F']);
  assert.deepEqual([0, 3, 6].map((i) => face(afterF, 'R')[i]), ['U', 'U', 'U'], 'F sends up to right');

  const afterD = applyMoves(SOLVED, ['D']);
  assert.equal(face(afterD, 'F').slice(6), 'LLL', 'D sends the left face to the front');

  const afterL = applyMoves(SOLVED, ['L']);
  assert.deepEqual([0, 3, 6].map((i) => face(afterL, 'U')[i]), ['B', 'B', 'B'], 'L sends back to up');

  const afterB = applyMoves(SOLVED, ['B']);
  assert.deepEqual([2, 5, 8].map((i) => face(afterB, 'R')[i]), ['D', 'D', 'D'], 'B sends down to right');
  assert.equal(face(afterB, 'U').slice(0, 3), 'RRR', 'B sends right to up');
});

test('every face turn has order 4 and powers compose', () => {
  for (const f of 'URFDLB') {
    assert.equal(applyMoves(SOLVED, [f, f, f, f]), SOLVED);
    assert.equal(applyMoves(SOLVED, [f + '2']), applyMoves(SOLVED, [f, f]));
    assert.equal(applyMoves(SOLVED, [f + "'"]), applyMoves(SOLVED, [f, f, f]));
  }
});

test('the sexy move has order 6', () => {
  const sexy = ['R', 'U', "R'", "U'"];
  assert.equal(applyMoves(SOLVED, Array(6).fill(sexy).flat()), SOLVED);
  assert.notEqual(applyMoves(SOLVED, Array(5).fill(sexy).flat()), SOLVED);
});

test('move names round trip and inversion undoes a scramble', () => {
  for (let i = 0; i < 18; i++) assert.equal(parseMove(moveName(i)), i);
  assert.throws(() => parseMove('X'));
  const scramble = randomScramble(30);
  assert.equal(applyMoves(applyMoves(SOLVED, scramble), invertMoves(scramble)), SOLVED);
});

test('cubie moves keep orientation sums valid', () => {
  for (const move of MOVES) {
    assert.equal(move.co.reduce((a, b) => a + b, 0) % 3, 0);
    assert.equal(move.eo.reduce((a, b) => a + b, 0) % 2, 0);
  }
});

test('only F and B quarter turns flip edges', () => {
  const flips = (name) => faceletsToCubie(applyMoves(SOLVED, [name])).cubie.eo.some((v) => v);
  for (const f of ['U', 'D', 'R', 'L']) assert.equal(flips(f), false, f);
  for (const f of ['F', 'B']) assert.equal(flips(f), true, f);
});

test('scrambled cubes validate', () => {
  for (let i = 0; i < 50; i++) {
    assert.equal(validate(applyMoves(SOLVED, randomScramble(30))).ok, true);
  }
});

test('validation explains what is wrong', () => {
  const swapSticker = (s, a, b) => {
    const chars = [...s];
    [chars[a], chars[b]] = [chars[b], chars[a]];
    return chars.join('');
  };
  assert.match(validate('UUU').error, /54 stickers/);
  assert.match(validate(SOLVED.replace('UUUUUUUUU', 'UUUUUUUUR')).error, /exactly 9 times/);
  // Twist one corner: rotate the three stickers of URF.
  const [a, b, c] = CORNER_FACELETS[0];
  const chars = [...SOLVED];
  [chars[a], chars[b], chars[c]] = [chars[b], chars[c], chars[a]];
  assert.match(validate(chars.join('')).error, /twisted/);
  // Flip one edge.
  assert.match(validate(swapSticker(SOLVED, ...EDGE_FACELETS[0])).error, /flipped/);
  // Swap two edges without any other change.
  const e = [...SOLVED];
  const [u1, u2] = EDGE_FACELETS[0];
  const [f1, f2] = EDGE_FACELETS[1];
  [e[u1], e[f1]] = [e[f1], e[u1]];
  [e[u2], e[f2]] = [e[f2], e[u2]];
  assert.match(validate(e.join('')).error, /swapped/);
  // A corner with two stickers of the same color cannot exist.
  const bad = [...SOLVED];
  bad[CORNER_FACELETS[0][1]] = 'U';
  bad[0] = 'R';
  assert.equal(validate(bad.join('')).ok, false);
});
