import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SOLVED, applyMoves, invertMoves } from '../js/cube.js';
import { PATTERNS, TRIGGERS, findTriggers, triggerLabel } from '../js/triggers.js';

const moves = (text) => text.split(' ');
const trigger = (name) => TRIGGERS.find((t) => t.name === name);

test('trigger names are unique and labels include the other name', () => {
  assert.equal(new Set(TRIGGERS.map((t) => t.name)).size, TRIGGERS.length);
  assert.equal(triggerLabel(trigger('Rightie')), 'Rightie (Sexy Move)');
  assert.equal(triggerLabel(trigger('Leftie')), 'Leftie');
});

test('each written trigger is found as itself, not turned', () => {
  for (const name of ['Rightie', 'Leftie', 'Sledgehammer', 'Sune', 'Antisune']) {
    const sequence = moves(trigger(name).moves);
    const found = findTriggers(sequence);
    assert.equal(found.length, 1, name);
    assert.equal(found[0].trigger.name, name);
    assert.equal(found[0].turned, false, name);
    assert.deepEqual([found[0].start, found[0].end], [0, sequence.length]);
  }
});

test('Rightie with the cube turned is still Rightie', () => {
  const found = findTriggers(moves("F R F' R'"));
  assert.equal(found.length, 1);
  assert.equal(found[0].trigger.name, 'Rightie');
  assert.equal(found[0].turned, true);
});

test('triggers inside a longer solution are located and do not overlap', () => {
  const solution = moves("D2 R U R' U' B2 L' U' L U R U R' U' F2");
  const found = findTriggers(solution);
  assert.deepEqual(
    found.map((f) => [f.trigger.name, f.start, f.end]),
    [['Rightie', 1, 5], ['Leftie', 6, 10], ['Rightie', 10, 14]],
  );
});

test('sequences that only look similar are not marked', () => {
  assert.deepEqual(findTriggers(moves("L' U R U'")), []);
  assert.deepEqual(findTriggers(moves("R U R' U")), []);
  assert.deepEqual(findTriggers(moves("R L R' L'")), [], 'opposite faces are not a trigger');
  assert.deepEqual(findTriggers([]), []);
});

test('Hedgeslammer is listed but never matched', () => {
  assert.ok(trigger('Hedgeslammer'));
  assert.ok(!PATTERNS.some((p) => p.trigger.name === 'Hedgeslammer'));
});

test('a 4 move trigger has 24 forms and only one is the written form', () => {
  const forms = PATTERNS.filter((p) => p.trigger.name === 'Rightie');
  assert.equal(forms.length, 24);
  assert.equal(forms.filter((p) => !p.turned).length, 1);
  assert.equal(new Set(forms.map((p) => p.moves.join(' '))).size, 24);
});

test('every pattern returns the cube to solved after 6 repeats', () => {
  for (const pattern of PATTERNS) {
    let cube = SOLVED;
    for (let i = 0; i < 6; i++) cube = applyMoves(cube, pattern.moves);
    assert.equal(cube, SOLVED, `${pattern.trigger.name}: ${pattern.moves.join(' ')}`);
    assert.notEqual(applyMoves(SOLVED, pattern.moves), SOLVED);
  }
});

test('Antisune undoes Sune and both leave the first two layers solved', () => {
  const sune = moves(trigger('Sune').moves);
  const antisune = moves(trigger('Antisune').moves);
  assert.deepEqual(invertMoves(sune), antisune);
  for (const sequence of [sune, antisune]) {
    const cube = applyMoves(SOLVED, sequence);
    assert.equal(cube.slice(27, 36), 'DDDDDDDDD', 'D face');
    for (const [face, letter] of [[1, 'R'], [2, 'F'], [4, 'L'], [5, 'B']]) {
      assert.equal(cube.slice(face * 9 + 3, face * 9 + 9), letter.repeat(6), `${letter} lower rows`);
    }
  }
});
