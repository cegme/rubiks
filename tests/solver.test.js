import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SOLVED, applyMoves, invertMoves, randomScramble } from '../js/cube.js';
import { solve } from '../js/solver.js';
import { getTables } from '../js/tables.js';

const SUPERFLIP = 'UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB';

test('tables build in a reasonable time', () => {
  const t = performance.now();
  getTables();
  const ms = performance.now() - t;
  console.log(`tables built in ${ms.toFixed(0)} ms`);
  assert.ok(ms < 5000);
});

test('a solved cube needs no moves', () => {
  const result = solve(SOLVED);
  assert.equal(result.ok, true);
  assert.deepEqual(result.moves, []);
});

test('short scrambles are solved in at most the scramble length', () => {
  for (const scramble of [['R'], ['U', 'U'], ['R', 'U', "R'", "U'"], ['F', 'R', 'U', "R'", "U'", "F'"]]) {
    const result = solve(applyMoves(SOLVED, scramble), { timeLimitMs: 300 });
    assert.equal(result.ok, true);
    assert.ok(result.moves.length <= scramble.length + 1, `${scramble} -> ${result.moves}`);
    assert.equal(applyMoves(applyMoves(SOLVED, scramble), result.moves), SOLVED);
  }
});

test('random scrambles are solved and the solutions are short', () => {
  const lengths = [];
  for (let i = 0; i < 60; i++) {
    const facelets = applyMoves(SOLVED, randomScramble(35));
    const result = solve(facelets, { timeLimitMs: 150 });
    assert.equal(result.ok, true, result.error);
    assert.equal(applyMoves(facelets, result.moves), SOLVED);
    lengths.push(result.moves.length);
  }
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  console.log(`mean length ${mean.toFixed(2)}, max ${Math.max(...lengths)}, min ${Math.min(...lengths)}`);
  assert.ok(Math.max(...lengths) <= 26);
  assert.ok(mean <= 23);
});

test('the superflip is solved', () => {
  const result = solve(SUPERFLIP, { timeLimitMs: 3000 });
  assert.equal(result.ok, true, result.error);
  assert.equal(applyMoves(SUPERFLIP, result.moves), SOLVED);
  console.log(`superflip: ${result.moves.length} moves in ${result.elapsedMs.toFixed(0)} ms`);
  assert.ok(result.moves.length <= 24);
});

test('onSolution reports improving lengths', () => {
  const facelets = applyMoves(SOLVED, randomScramble(40));
  const lengths = [];
  solve(facelets, { timeLimitMs: 500, onSolution: (moves) => lengths.push(moves.length) });
  assert.ok(lengths.length >= 1);
  for (let i = 1; i < lengths.length; i++) assert.ok(lengths[i] < lengths[i - 1]);
});

test('an invalid cube is rejected with a message', () => {
  const result = solve(SOLVED.replace('UUUUUUUUU', 'UUUUUUUUR'));
  assert.equal(result.ok, false);
  assert.match(result.error, /9 times/);
});

test('the inverse of a solution re-creates the scramble', () => {
  const scramble = randomScramble(25);
  const facelets = applyMoves(SOLVED, scramble);
  const result = solve(facelets, { timeLimitMs: 100 });
  assert.equal(applyMoves(SOLVED, invertMoves(result.moves)), facelets);
});
